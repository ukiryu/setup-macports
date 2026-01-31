import * as crypto from 'crypto'
import * as core from '@actions/core'
import type {IMacPortsSettings} from '../models/settings'
import type {IPlatformInfo} from '../models/platform-info'

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

    // Cache key format: macports-{version}-{arch}-{platform}
    // This matches Homebrew's simple approach - cache the base installation only
    const cacheKey = `macports-${settings.version}-${platform.architecture}-${platformMajor}`

    core.debug(`Generated cache key: ${cacheKey}`)

    // No restore keys - exact match only
    return {cacheKey, restoreKeys: []}
  }
}
