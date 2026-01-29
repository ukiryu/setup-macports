import * as core from '@actions/core'
import * as path from 'path'
import type {
  IMacPortsSettings,
  IVariantConfig,
  IPortConfig
} from '../models/settings'
import type {IMacPortsInstallInfo, IPlatformInfo} from '../models/install-info'
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
export type {IPlatformInfo, IMacPortsInstallInfo}
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
  private readonly portsInstaller: PortsInstaller
  private readonly cacheUtil: CacheUtil

  private installInfo: Partial<IMacPortsInstallInfo> = {}

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
    this.installInfo.version = settings.version
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
    const cacheKey = this.cacheUtil.generateCacheKey(this.settings, platform)
    this.installInfo.cacheKey = cacheKey
    core.info(`Cache key: ${cacheKey}`)
    core.endGroup()

    // Save state for potential cleanup
    setInstallationPrefix(this.settings.prefix)
    setCacheKey(cacheKey)
    setMacPortsVersion(this.settings.version)

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

    // Phase 5: Configure MacPorts
    core.startGroup('Configuring MacPorts')
    await this.configure()
    core.endGroup()

    // Phase 6: Setup Git Sources (Optional)
    if (this.settings.useGitSources) {
      core.startGroup('Setting up git sources')
      await this.setupGitSources()
      core.endGroup()
    }

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
    this.setOutputs()

    return this.installInfo as IMacPortsInstallInfo
  }

  /**
   * Configure MacPorts
   */
  private async configure(): Promise<void> {
    await this.configurator.configure(this.settings)
  }

  /**
   * Setup git sources from GitHub
   */
  private async setupGitSources(): Promise<void> {
    const sourcesDir = path.join(
      this.settings.prefix,
      'var',
      'macports',
      'sources',
      'github.com',
      'macports'
    )

    core.info(`Fetching macports-ports to ${sourcesDir}...`)

    const portsPath = await this.sourcesFetcher.fetch(sourcesDir, 'master')

    // Reconfigure sources to use git sources
    await this.configurator.configure(this.settings, portsPath)

    this.installInfo.usesGitSources = true
    core.info('Git sources configured successfully')
  }

  /**
   * Set GitHub Actions outputs
   */
  private setOutputs(): void {
    core.setOutput('version', this.settings.version)
    core.setOutput('prefix', this.settings.prefix)
    core.setOutput('package-url', this.installInfo.packageUrl || '')
    core.setOutput('cache-key', this.installInfo.cacheKey || '')

    if (this.installInfo.usesGitSources) {
      core.setOutput('uses-git-sources', 'true')
    }
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
