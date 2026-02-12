import * as fs from 'fs/promises'
import * as path from 'path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import type {IMacPortsSettings} from '../models/settings.js'
import type {IExecUtil} from '../utils/exec.js'

/**
 * MacPorts Configurator Service
 *
 * Handles writing MacPorts configuration files and creating the macports
 * user/group for privilege separation.
 */
export class MacPortsConfigurator {
  private static readonly MACPORTS_USER = 'macports'
  private static readonly MACPORTS_GROUP = 'macports'

  constructor(private execUtil: IExecUtil) {}

  /**
   * Configure MacPorts - write all config files and initialize registry
   *
   * @param settings - MacPorts settings
   * @param gitSourcesPath - Optional path to local git sources
   * @param skipSync - Skip port sync (useful when cache already has synced ports)
   */
  async configure(
    settings: IMacPortsSettings,
    gitSourcesPath?: string,
    skipSync = false
  ): Promise<void> {
    // Ensure macports user and group exist (required for privilege separation)
    // This is critical when restoring from cache where postflight didn't run
    await this.ensureMacPortsUser(settings)

    // Write configuration files
    await this.writeMacPortsConf(settings)
    await this.writeVariantsConf(settings)
    await this.writeSourcesConf(settings, gitSourcesPath)

    // Create directory structure
    await this.createDirectoryStructure(settings)

    // Initialize the registry by running port version
    // Skip port sync if requested (e.g., when cache already has synced ports)
    if (!skipSync) {
      await this.initializeRegistry(settings)
    }
  }

  /**
   * Ensure the macports user and group exist.
   *
   * This mimics the postflight script's create_run_user function.
   * When restoring from cache, the postflight script doesn't run, so the
   * macports user/group won't exist unless we create them.
   *
   * @param settings - MacPorts settings (for home directory path)
   */
  private async ensureMacPortsUser(settings: IMacPortsSettings): Promise<void> {
    const dscl = '/usr/bin/dscl'
    const dseditgroup = '/usr/sbin/dseditgroup'
    const user = MacPortsConfigurator.MACPORTS_USER
    const group = MacPortsConfigurator.MACPORTS_GROUP

    core.debug(`Ensuring ${user} user and ${group} group exist...`)

    // Create the group if it doesn't exist
    try {
      const groupExists = await this.execUtil.exec(
        dscl,
        ['-q', '.', '-read', `/Groups/${group}`],
        {silent: true, ignoreReturnCode: true}
      )
      if (groupExists.exitCode !== 0) {
        core.info(`Creating group "${group}"`)
        await this.execUtil.execSudo(
          dseditgroup,
          ['-q', '-o', 'create', group],
          {silent: false}
        )
      } else {
        core.debug(`Group "${group}" already exists`)
      }
    } catch (err) {
      core.warning(
        `Failed to check/create group: ${(err as any)?.message ?? err}`
      )
    }

    // Create the user if it doesn't exist
    try {
      const userExists = await this.execUtil.exec(
        dscl,
        ['-q', '.', '-list', `/Users/${user}`],
        {silent: true, ignoreReturnCode: true}
      )
      if (userExists.exitCode !== 0) {
        core.info(`Creating user "${user}"`)

        // Find next available UID starting from 501
        let nextUid = 501
        let uidFound = false
        while (!uidFound && nextUid < 600) {
          const result = await this.execUtil.exec(
            dscl,
            ['-q', '/Search', '-search', '/Users', 'UniqueID', String(nextUid)],
            {silent: true, ignoreReturnCode: true}
          )
          if (result.exitCode !== 0 || result.stdout.trim() === '') {
            uidFound = true
          } else {
            nextUid++
          }
        }

        // Create user with dscl (requires sudo)
        await this.execUtil.execSudo(
          dscl,
          ['-q', '.', '-create', `/Users/${user}`, 'UniqueID', String(nextUid)],
          {silent: false}
        )

        // Remove attributes that make user visible in Users & Groups preference pane
        // (as done in the official postflight script)
        try {
          await this.execUtil.execSudo(
            dscl,
            ['-q', '.', '-delete', `/Users/${user}`, 'AuthenticationAuthority'],
            {silent: true, ignoreReturnCode: true}
          )
          await this.execUtil.execSudo(
            dscl,
            ['-q', '.', '-delete', `/Users/${user}`, 'PasswordPolicyOptions'],
            {silent: true, ignoreReturnCode: true}
          )
          await this.execUtil.execSudo(
            dscl,
            [
              '-q',
              '.',
              '-delete',
              `/Users/${user}`,
              'dsAttrTypeNative:KerberosKeys'
            ],
            {silent: true, ignoreReturnCode: true}
          )
          await this.execUtil.execSudo(
            dscl,
            [
              '-q',
              '.',
              '-delete',
              `/Users/${user}`,
              'dsAttrTypeNative:ShadowHashData'
            ],
            {silent: true, ignoreReturnCode: true}
          )
        } catch {
          // These deletions may fail on some systems, that's okay
        }

        // Set user properties
        await this.execUtil.execSudo(
          dscl,
          ['-q', '.', '-create', `/Users/${user}`, 'RealName', 'MacPorts'],
          {silent: false}
        )
        await this.execUtil.execSudo(
          dscl,
          ['-q', '.', '-create', `/Users/${user}`, 'Password', '*'],
          {silent: false}
        )

        // Get the group's PrimaryGroupID
        const groupResult = await this.execUtil.exec(
          dscl,
          ['-q', '.', '-read', `/Groups/${group}`, 'PrimaryGroupID'],
          {silent: true}
        )
        const groupId = groupResult.stdout.split(':')[1]?.trim() || '1'
        await this.execUtil.execSudo(
          dscl,
          ['-q', '.', '-create', `/Users/${user}`, 'PrimaryGroupID', groupId],
          {silent: false}
        )

        // Set home directory and shell
        const homeDir = path.join(settings.prefix, 'var', 'macports', 'home')
        await this.execUtil.execSudo(
          dscl,
          ['-q', '.', '-create', `/Users/${user}`, 'NFSHomeDirectory', homeDir],
          {silent: false}
        )
        await this.execUtil.execSudo(
          dscl,
          [
            '-q',
            '.',
            '-create',
            `/Users/${user}`,
            'UserShell',
            '/usr/bin/false'
          ],
          {silent: false}
        )

        // Create the home directory
        await io.mkdirP(homeDir)

        core.info(`User "${user}" created with UID ${nextUid}`)
      } else {
        core.debug(`User "${user}" already exists`)
      }
    } catch (err) {
      core.warning(
        `Failed to check/create user: ${(err as any)?.message ?? err}`
      )
    }
  }

  /**
   * Write macports.conf configuration file
   */
  private async writeMacPortsConf(settings: IMacPortsSettings): Promise<void> {
    const etcDir = path.join(settings.prefix, 'etc', 'macports')
    const confPath = path.join(etcDir, 'macports.conf')

    core.debug(`Writing macports.conf to: ${confPath}`)

    await io.mkdirP(etcDir)

    // Use the macports user for privilege separation
    // This user is created by ensureMacPortsUser() above
    const macportsUser = MacPortsConfigurator.MACPORTS_USER

    const config = [
      `prefix ${settings.prefix}`,
      `portdbpath ${path.join(settings.prefix, 'var', 'macports', 'portdbpath')}`,
      `sources_conf ${path.join(settings.prefix, 'etc', 'macports', 'sources.conf')}`,
      `macportsuser ${macportsUser}`,
      ''
    ]

    // Handle signature check modes
    if (settings.signatureCheck === 'strict') {
      config.push('signature_check yes')
    } else if (settings.signatureCheck === 'disabled') {
      config.push('signature_check no')
    } else if (settings.signatureCheck === 'permissive') {
      // Permissive mode: enable signature check but allow skipping for specific packages
      config.push('signature_check yes')
      if (settings.signatureSkipPackages.length > 0) {
        // MacPorts doesn't have a built-in way to skip signatures for specific packages
        // We document this as a limitation and suggest using 'port -o' for offline install
        core.warning(
          `Permissive mode requested for packages: ${settings.signatureSkipPackages.join(', ')}. ` +
            'Note: MacPorts does not support per-package signature skipping. ' +
            'Use signature-check: "disabled" to skip all signature checks, or install problematic ports with "port -o" (offline mode).'
        )
      }
    }
    config.push('')

    await fs.writeFile(confPath, config.join('\n'), {mode: 0o644})

    core.debug(`macports.conf written successfully`)
  }

  /**
   * Write variants.conf configuration file
   */
  private async writeVariantsConf(settings: IMacPortsSettings): Promise<void> {
    const etcDir = path.join(settings.prefix, 'etc', 'macports')
    const confPath = path.join(etcDir, 'variants.conf')

    core.info(`Writing variants.conf to: ${confPath}`)
    core.debug(`Variants select: [${settings.variants.select.join(', ')}]`)
    core.debug(`Variants deselect: [${settings.variants.deselect.join(', ')}]`)

    await io.mkdirP(etcDir)

    const lines: string[] = []

    // Add selected variants with + prefix
    for (const variant of settings.variants.select) {
      lines.push(`+${variant}`)
    }

    // Add deselected variants with - prefix
    for (const variant of settings.variants.deselect) {
      lines.push(`-${variant}`)
    }

    const content = lines.length > 0 ? lines.join('\n') + '\n' : ''

    await fs.writeFile(confPath, content, {mode: 0o644})

    core.info(`variants.conf written: ${content || '(empty)'}`)

    // Verify the file was written correctly
    try {
      const writtenContent = await fs.readFile(confPath, 'utf-8')
      core.debug(`variants.conf verification: "${writtenContent}"`)
    } catch (err) {
      core.error(
        `Failed to verify variants.conf: ${(err as any)?.message ?? err}`
      )
    }
  }

  /**
   * Write sources.conf configuration file
   */
  private async writeSourcesConf(
    settings: IMacPortsSettings,
    gitSourcesPath?: string
  ): Promise<void> {
    const etcDir = path.join(settings.prefix, 'etc', 'macports')
    const confPath = path.join(etcDir, 'sources.conf')

    core.debug(`Writing sources.conf to: ${confPath}`)

    await io.mkdirP(etcDir)

    let lines: string[] = []

    if (gitSourcesPath) {
      // Use local git sources as default
      lines.push(`file://${gitSourcesPath}/ [default]`)
      core.debug(`Using git sources from: ${gitSourcesPath}`)
    } else if (
      settings.sourcesProvider === 'custom' &&
      settings.sources.length > 0
    ) {
      // Use custom sources (for 'custom' provider)
      lines = [...settings.sources]
      core.debug(`Using custom sources: ${settings.sources.join(', ')}`)
    } else if (settings.sourcesProvider === 'rsync') {
      // Use configured rsync URL (for 'rsync' provider)
      lines.push(`${settings.rsyncUrl} [default]`)
      core.debug(`Using rsync sources: ${settings.rsyncUrl}`)
    } else {
      // Use default MacPorts rsync source (for 'auto' or 'git' when git fails)
      lines.push(
        'rsync://rsync.macports.org/macports/release/tarballs/ports.tar [default]'
      )
      core.debug('Using default MacPorts rsync source')
    }

    const content = lines.join('\n') + '\n'

    await fs.writeFile(confPath, content, {mode: 0o644})

    core.debug(`sources.conf written: ${content}`)
  }

  /**
   * Create the MacPorts directory structure
   */
  private async createDirectoryStructure(
    settings: IMacPortsSettings
  ): Promise<void> {
    core.debug(`Creating directory structure for: ${settings.prefix}`)

    const directories = [
      path.join(settings.prefix, 'etc', 'macports'),
      path.join(settings.prefix, 'var', 'macports', 'portdbpath', 'registry'),
      path.join(settings.prefix, 'var', 'macports', 'sources'),
      path.join(settings.prefix, 'var', 'macports', 'dist'),
      path.join(settings.prefix, 'var', 'macports', 'home') // Home for macports user
    ]

    for (const dir of directories) {
      await io.mkdirP(dir)
      core.debug(`Created directory: ${dir}`)
    }

    // Set ownership of home directory to macports user
    const homeDir = path.join(settings.prefix, 'var', 'macports', 'home')
    try {
      await this.execUtil.execSudo(
        'chown',
        ['-R', MacPortsConfigurator.MACPORTS_USER, homeDir],
        {silent: true}
      )
    } catch {
      // Non-critical if this fails
      core.debug(`Could not set ownership on ${homeDir}`)
    }
  }

  /**
   * Initialize the MacPorts registry
   */
  private async initializeRegistry(settings: IMacPortsSettings): Promise<void> {
    const portBinary = path.join(settings.prefix, 'bin', 'port')
    core.info('Initializing MacPorts registry...')

    try {
      await this.execUtil.exec(portBinary, ['version'], {silent: true})
    } catch (err) {
      core.debug(`Port version output: ${(err as any)?.message ?? err}`)
    }

    // Run port sync to initialize the registry and update PortIndex
    core.info('Running port sync to initialize registry...')
    const syncArgs = settings.verbose ? ['-v', 'sync'] : ['sync']
    await this.execUtil.exec(portBinary, syncArgs, {silent: false})

    core.info('MacPorts registry initialized successfully')
  }
}
