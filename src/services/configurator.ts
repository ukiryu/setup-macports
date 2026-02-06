import * as fs from 'fs/promises'
import * as path from 'path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import type {IMacPortsSettings} from '../models/settings'
import type {IExecUtil} from '../utils/exec'

/**
 * MacPorts Configurator Service
 *
 * Handles writing MacPorts configuration files
 */
export class MacPortsConfigurator {
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
   * Write macports.conf configuration file
   */
  private async writeMacPortsConf(settings: IMacPortsSettings): Promise<void> {
    const etcDir = path.join(settings.prefix, 'etc', 'macports')
    const confPath = path.join(etcDir, 'macports.conf')

    core.debug(`Writing macports.conf to: ${confPath}`)

    await io.mkdirP(etcDir)

    const config = [
      `prefix ${settings.prefix}`,
      `portdbpath ${path.join(settings.prefix, 'var', 'macports', 'portdbpath')}`,
      `sources_conf ${path.join(settings.prefix, 'etc', 'macports', 'sources.conf')}`,
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

    // Handle prefer_copy mode (for environments where clonefile fails)
    // MacPorts 2.12.0+ uses prefer_copy_files instead of prefer_copy
    if (settings.preferCopy) {
      config.push('prefer_copy_files yes')
      core.info('Enabling prefer_copy_files mode to avoid clonefile issues on GitHub Actions')
    }

    config.push('')

    const content = config.join('\n')
    await fs.writeFile(confPath, content, {mode: 0o644})

    core.info(`macports.conf written with prefer_copy_files=${settings.preferCopy ? 'yes' : 'no'}`)
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
      path.join(settings.prefix, 'var', 'macports', 'dist')
    ]

    for (const dir of directories) {
      await io.mkdirP(dir)
      core.debug(`Created directory: ${dir}`)
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
