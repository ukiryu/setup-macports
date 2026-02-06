import * as crypto from 'crypto'
import * as core from '@actions/core'
import type {IMacPortsSettings} from '../models/settings.js'
import type {IPlatformInfo} from '../models/platform-info.js'

/**
 * Cache Utility Class
 *
 * Generates cache keys for MacPorts installation
 */
export class CacheUtil {
  /**
   * Generate a cache key for MacPorts installation
   *
   * The cache key includes:
   * - macOS version
   * - Architecture
   * - MacPorts version
   * - Installation prefix
   * - Hash of variants and sources configuration
   *
   * @param settings - MacPorts settings
   * @param platform - Platform information
   * @returns Cache key string
   */
  generateCacheKey(
    settings: IMacPortsSettings,
    platform: IPlatformInfo
  ): string {
    // Create a deterministic string from configuration that affects installation
    const configData = {
      prefix: settings.prefix,
      version: settings.version,
      variants: {
        select: settings.variants.select.sort(),
        deselect: settings.variants.deselect.sort()
      },
      sources: settings.sources.sort()
    }

    const configString = JSON.stringify(configData)

    core.debug(`Configuration for cache key: ${configString}`)

    // Use RIPEMD160 to match the shell implementation
    const hash = crypto
      .createHash('ripemd160')
      .update(configString)
      .digest('hex')

    // Cache key format: macports-{macos}-{arch}-v2-{hash}
    // v2 is the cache version - bump if installation format changes
    const cacheKey = `macports-${platform.version}-${platform.architecture}-v2-${hash}`

    core.debug(`Generated cache key: ${cacheKey}`)

    return cacheKey
  }

  /**
   * Generate an improved cache key that includes workflow and git context
   *
   * The cache key includes:
   * - MacPorts version
   * - Platform architecture
   * - Platform version (major)
   * - Configuration hash (variants, sources, prefix)
   * - Context hash (workflow, git ref, setup-macports version)
   *
   * @param settings - MacPorts settings
   * @param platform - Platform information
   * @returns Object with cache key and restore keys
   */
  generateImprovedCacheKey(
    settings: IMacPortsSettings,
    platform: IPlatformInfo
  ): {cacheKey: string; restoreKeys: string[]} {
    // Cache key: ONLY factors that affect the BASE MacPorts installation
    // Things applied AFTER cache restore (variants, ports) are NOT included
    const platformMajor = platform.versionNumber?.split('.')[0] || '15'

    // Use resolvedVersion if available (for 'latest'), otherwise use version
    const effectiveVersion = settings.resolvedVersion || settings.version

    // Cache key format: macports-{version}-{arch}-{platform}
    // This matches Homebrew's simple approach - cache the base installation only
    const cacheKey = `macports-${effectiveVersion}-${platform.architecture}-${platformMajor}`

    core.debug(`Generated cache key: ${cacheKey}`)

    // No restore keys - exact match only
    return {cacheKey, restoreKeys: []}
  }

  /**
   * Generate setup cache key (base MacPorts installation only)
   *
   * The setup cache contains:
   * - MacPorts PKG installation (binaries, config files)
   * - EXCLUDING: /opt/local/var/macports/sources
   *
   * Reusable by: ALL users regardless of sources provider
   *
   * @param version - MacPorts version (resolved version)
   * @param platform - Platform information
   * @returns Setup cache key string
   */
  generateSetupCacheKey(version: string, platform: IPlatformInfo): string {
    const platformMajor = platform.versionNumber?.split('.')[0] || '15'
    const setupKey = `macports-setup-${version}-${platform.architecture}-${platformMajor}`

    core.debug(`Generated setup cache key: ${setupKey}`)
    return setupKey
  }

  /**
   * Generate ports cache key (synced ports tree only)
   *
   * The ports cache contains:
   * - /opt/local/var/macports/sources (synced ports tree)
   *
   * Reusable by: Users with same sources provider and git ref
   *
   * @param settings - MacPorts settings (for sources provider and git ref)
   * @param platform - Platform information
   * @returns Ports cache key string
   */
  generatePortsCacheKey(
    settings: IMacPortsSettings,
    platform: IPlatformInfo
  ): string {
    const platformMajor = platform.versionNumber?.split('.')[0] || '15'

    // For non-git sources (rsync, auto), use 'rsync' as the provider
    // For git sources, include the git ref in the key
    const provider = settings.sourcesProvider === 'git' ? 'git' : 'rsync'
    const gitRef = settings.gitRef || 'master'

    // Ports cache key: macports-ports-{provider}-{git_ref}-{platform}
    // For rsync: git_ref is ignored (still 'master' for consistency)
    const portsKey = `macports-ports-${provider}-${gitRef}-${platformMajor}`

    core.debug(`Generated ports cache key: ${portsKey}`)
    return portsKey
  }
}
