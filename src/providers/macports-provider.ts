import * as core from '@actions/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import type {
  IMacPortsSettings,
  IVariantConfig,
  IPortConfig,
  ESourcesProvider
} from '../models/settings'
import type {IMacPortsInstallInfo, IPlatformInfo} from '../models/install-info'
import type {IConfigurationInfo} from '../models/configuration-info'
import type {IPlatformDetector} from '../models/platform-info'
import type {IExecUtil} from '../utils/exec'
import {PlatformDetector} from '../services/platform-detector'
import {PackageBuilder} from '../services/package-builder'
import {MacPortsInstaller} from '../services/installer'
import {MacPortsConfigurator} from '../services/configurator'
import {SourcesFetcher} from '../services/sources-fetcher'
import {PortsInstaller} from '../services/ports-installer'
import {ExecUtil} from '../utils/exec'
import {CacheUtil} from '../utils/cache'
import {
  setIsPost,
  setInstallationPrefix,
  setCacheKey,
  setMacPortsVersion
} from '../state-helper'

/**
 * Re-export types for convenience
 */
export type {
  IPlatformInfo,
  IMacPortsInstallInfo,
  IConfigurationInfo,
  ESourcesProvider
}
export type {IVariantConfig, IPortConfig}

/**
 * MacPorts Provider - Orchestrates MacPorts installation
 *
 * This class acts as a facade, coordinating various services to install
 * and configure MacPorts on macOS runners.
 */
export class MacPortsProvider {
  private readonly execUtil: IExecUtil
  private readonly platformDetector: IPlatformDetector
  private readonly packageBuilder: PackageBuilder
  private readonly installer: MacPortsInstaller
  private readonly configurator: MacPortsConfigurator
  private readonly sourcesFetcher: SourcesFetcher
  public readonly portsInstaller: PortsInstaller
  private readonly cacheUtil: CacheUtil

  private installInfo: Partial<IMacPortsInstallInfo> = {}
  private configInfo: Partial<IConfigurationInfo> = {}

  constructor(private settings: IMacPortsSettings) {
    // Initialize all services (dependency injection)
    this.execUtil = new ExecUtil()
    this.platformDetector = new PlatformDetector()
    this.packageBuilder = new PackageBuilder()
    this.installer = new MacPortsInstaller(this.execUtil)
    this.configurator = new MacPortsConfigurator(this.execUtil)
    this.sourcesFetcher = new SourcesFetcher(this.execUtil)
    this.portsInstaller = new PortsInstaller(this.execUtil)
    this.cacheUtil = new CacheUtil()

    // Initialize install info with settings
    this.installInfo.version = settings.resolvedVersion || settings.version
    this.installInfo.prefix = settings.prefix
  }

  /**
   * Main setup method - orchestrates the entire installation
   *
   * @returns Complete installation information
   */
  async setup(): Promise<IMacPortsInstallInfo> {
    // Phase 1: Platform Detection
    core.startGroup('Detecting platform')
    const platform = await this.platformDetector.detect()
    core.info(`macOS: ${platform.version} (${platform.versionNumber})`)
    core.info(`Architecture: ${platform.architecture}`)
    this.installInfo.platform = platform
    core.endGroup()

    // Phase 2: Cache Key Generation
    core.startGroup('Generating cache key')
    const cacheKey = this.cacheUtil.generateImprovedCacheKey(
      this.settings,
      platform
    ).cacheKey
    this.installInfo.cacheKey = cacheKey
    core.info(`Cache key: ${cacheKey}`)
    core.endGroup()

    // Save state for potential cleanup
    setInstallationPrefix(this.settings.prefix)
    setCacheKey(cacheKey)
    setMacPortsVersion(this.settings.resolvedVersion || this.settings.version)

    // Phase 3: Build Package URL
    core.startGroup('Building package URL')
    const packageUrl = this.packageBuilder.buildUrl(this.settings, platform)
    this.installInfo.packageUrl = packageUrl
    core.info(`Package URL: ${packageUrl}`)
    core.endGroup()

    // Phase 4: Download and Install MacPorts
    core.startGroup('Installing MacPorts')
    await this.installer.install(this.settings, packageUrl)
    core.endGroup()

    // Phase 5: Setup Sources BEFORE configuration (Required for git mode)
    // This must come before configure() so that sources.conf points to git
    // before the first sync happens
    await this.setupSources()

    // Phase 6: Configure MacPorts (including port sync)
    // This now uses the correct sources (git or rsync) from setupSources()
    core.startGroup('Configuring MacPorts')
    // Pass git sources path if we set it up, so configure() doesn't overwrite it
    const gitSourcesPath = this.installInfo.gitSourcePath
    await this.configurator.configure(this.settings, gitSourcesPath)
    core.endGroup()

    // Phase 7: Add to PATH (Optional)
    if (this.settings.prependPath) {
      core.addPath(path.join(this.settings.prefix, 'bin'))
      core.addPath(path.join(this.settings.prefix, 'sbin'))
    }

    // Phase 8: Install Ports (Optional)
    if (this.settings.ports.length > 0) {
      core.startGroup('Installing ports')
      await this.portsInstaller.install(this.settings)
      core.endGroup()
    }

    // Mark post state
    setIsPost()

    // Set outputs
    await this.setOutputs()

    return this.installInfo as IMacPortsInstallInfo
  }

  /**
   * Configure an existing MacPorts installation
   *
   * Use this when MacPorts is already installed (e.g., from cache)
   * and you need to apply configuration (variants, sources, etc.)
   *
   * @param skipSync - Skip port sync (useful for cache hits where ports are already synced)
   * @param skipSetupSources - Skip git clone (useful when ports are already in cache)
   */
  async configure(skipSync = false, skipSetupSources = false): Promise<void> {
    let gitSourcesPath: string | undefined

    // Setup Sources BEFORE configuration (Required for git mode)
    // Skip if sources are already cached (Ports Cache hit)
    if (!skipSetupSources) {
      await this.setupSources()
      gitSourcesPath = this.installInfo.gitSourcePath
    } else if (this.settings.sourcesProvider === 'git') {
      // Sources are cached, calculate git sources path for sources.conf
      // Parse git repository (supports 'owner/repo' or full URL)
      const repo = this.settings.gitRepository
      let owner: string
      let repoName: string

      if (repo.includes('/')) {
        // Format: 'owner/repo' or 'owner/repo.git'
        const parts = repo.split('/')
        owner = parts[0]
        repoName = parts[1]?.replace(/\.git$/, '') || repo
      } else {
        // Full URL or other format - use default macports owner
        owner = 'macports'
        repoName = repo
      }

      // Calculate the git sources path (must match setupGitSources)
      // Path: /opt/local/var/macports/sources/github.com/{owner}/{repo}
      gitSourcesPath = path.join(
        this.settings.prefix,
        'var',
        'macports',
        'sources',
        'github.com',
        owner,
        repoName
      )
    }

    // Configure MacPorts (variants, sources.conf, macports.conf, port sync)
    core.startGroup('Configuring MacPorts')
    await this.configurator.configure(this.settings, gitSourcesPath, skipSync)
    core.endGroup()

    // Add to PATH (Optional)
    if (this.settings.prependPath) {
      core.addPath(path.join(this.settings.prefix, 'bin'))
      core.addPath(path.join(this.settings.prefix, 'sbin'))
    }

    // Install Ports (Optional)
    if (this.settings.ports.length > 0) {
      core.startGroup('Installing ports')
      await this.portsInstaller.install(this.settings)
      core.endGroup()
    }

    // Mark post state
    setIsPost()

    // Set outputs
    await this.setOutputs()
  }

  /**
   * Setup sources based on the sourcesProvider setting
   *
   * Handles four modes:
   * - 'auto': Use git if available, otherwise rsync
   * - 'git': Use git sources from GitHub
   * - 'rsync': Use rsync sources
   * - 'custom': Use custom sources from 'sources' input
   */
  private async setupSources(): Promise<void> {
    const provider = this.settings.sourcesProvider

    core.debug(`Sources provider: ${provider}`)

    // For 'auto' mode, try git first, fall back to rsync
    if (provider === 'auto') {
      core.startGroup('Setting up sources (auto)')
      try {
        await this.setupGitSources()
      } catch (err) {
        core.warning(
          `Git sources failed: ${(err as any)?.message ?? err}. Falling back to rsync.`
        )
        // Rsync is the default, no additional setup needed
        this.installInfo.usesGitSources = false
      }
      core.endGroup()
      return
    }

    // For 'git' mode
    if (provider === 'git') {
      core.startGroup('Setting up git sources')
      await this.setupGitSources()
      core.endGroup()
      return
    }

    // For 'rsync' and 'custom' modes
    // Rsync is the default, custom uses the 'sources' input
    // No additional setup needed, configurator handles it
    this.installInfo.usesGitSources = false
    core.info(`Using ${provider} sources (configured in sources.conf)`)
  }

  /**
   * Setup git sources from GitHub
   *
   * This clones the git repository and updates sources.conf to use it.
   * The actual sync will happen later in the configure() phase.
   */
  private async setupGitSources(): Promise<void> {
    // Parse git repository (supports 'owner/repo' or full URL)
    const repo = this.settings.gitRepository
    let owner: string

    if (repo.includes('/')) {
      // Format: 'owner/repo'
      ;[owner] = repo.split('/')
    } else {
      // Full URL or other format - use as-is for fetch
      owner = 'unknown'
    }

    const sourcesDir = path.join(
      this.settings.prefix,
      'var',
      'macports',
      'sources',
      'github.com',
      owner
    )

    // Get git ref from settings, default to 'master'
    const gitRef = this.settings.gitRef || 'master'

    core.info(`Fetching ${repo} to ${sourcesDir}...`)
    core.info(`Fetching ${repo} from GitHub (depth 1, ref: ${gitRef})...`)

    const portsPath = await this.sourcesFetcher.fetch(sourcesDir, repo, gitRef)

    // Store the git sources path in installInfo so configure() can use it
    // The configurator will write sources.conf during configure() call
    this.installInfo.gitSourcePath = portsPath

    this.installInfo.usesGitSources = true
    core.info('Git sources prepared successfully')
  }

  /**
   * Gather configuration information after setup
   */
  private async gatherConfigurationInfo(): Promise<void> {
    const etcDir = path.join(this.settings.prefix, 'etc', 'macports')

    // Configuration file paths
    this.configInfo.variantsConfPath = path.join(etcDir, 'variants.conf')
    this.configInfo.sourcesConfPath = path.join(etcDir, 'sources.conf')
    this.configInfo.portsConfPath = path.join(etcDir, 'ports.conf')
    this.configInfo.macportsConfPath = path.join(etcDir, 'macports.conf')

    // Read variants.conf content
    try {
      const variantsContent = await fs.readFile(
        this.configInfo.variantsConfPath,
        'utf8'
      )
      this.configInfo.configuredVariants = variantsContent.trim()
    } catch {
      this.configInfo.configuredVariants = ''
    }

    // Read sources.conf content
    try {
      const sourcesContent = await fs.readFile(
        this.configInfo.sourcesConfPath,
        'utf8'
      )
      this.configInfo.configuredSources = sourcesContent.trim()
    } catch {
      this.configInfo.configuredSources = ''
    }

    // Git source path (if using git sources)
    if (this.installInfo.usesGitSources) {
      this.configInfo.gitSourcePath = path.join(
        this.settings.prefix,
        'var',
        'macports',
        'sources',
        'github.com',
        'macports',
        'macports-ports'
      )
    }

    // Rsync source URL (if using rsync sources)
    if (!this.installInfo.usesGitSources) {
      // Extract rsync URL from sources content
      const lines = this.configInfo.configuredSources.split('\n')
      for (const line of lines) {
        if (line.startsWith('rsync://')) {
          this.configInfo.rsyncSourceUrls = line.split(' ')[0]
          break
        }
      }
    }
  }

  /**
   * Set GitHub Actions outputs
   */
  private async setOutputs(): Promise<void> {
    // Gather configuration info
    await this.gatherConfigurationInfo()

    // Basic outputs
    core.setOutput(
      'version',
      this.settings.resolvedVersion || this.settings.version
    )
    core.setOutput('prefix', this.settings.prefix)
    core.setOutput('package-url', this.installInfo.packageUrl || '')
    core.setOutput('cache-key', this.installInfo.cacheKey || '')

    // Git sources output
    if (this.installInfo.usesGitSources) {
      core.setOutput('uses-git-sources', 'true')
    }

    // Configuration paths
    core.setOutput('variants-conf-path', this.configInfo.variantsConfPath || '')
    core.setOutput('sources-conf-path', this.configInfo.sourcesConfPath || '')
    core.setOutput('ports-conf-path', this.configInfo.portsConfPath || '')
    core.setOutput('macports-conf-path', this.configInfo.macportsConfPath || '')

    // Configuration values
    core.setOutput(
      'configured-variants',
      this.configInfo.configuredVariants || ''
    )
    core.setOutput(
      'configured-sources',
      this.configInfo.configuredSources || ''
    )

    // Source locations
    core.setOutput('git-source-path', this.configInfo.gitSourcePath || '')
    core.setOutput('rsync-source-urls', this.configInfo.rsyncSourceUrls || '')
  }
}

/**
 * Cleanup function for post-job execution
 */
export async function cleanup(): Promise<void> {
  core.debug('Running cleanup...')

  // Currently no cleanup needed, but this is where we would:
  // - Remove problem matchers
  // - Clean up temporary files
  // - Restore any modified settings

  core.debug('Cleanup complete')
}
