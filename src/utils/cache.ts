import * as crypto from 'crypto'
import * as core from '@actions/core'
import {readFileSync} from 'fs'
import {join} from 'path'
import type {IMacPortsSettings} from '../models/settings'
import type {IPlatformInfo} from '../models/platform-info'

/**
 * Get the setup-macports version from package.json
 */
function getSetupMacPortsVersion(): string {
  try {
    const packagePath = join(__dirname, '../../package.json')
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Normalize git ref for cache key
 * - For branches (refs/heads/*): use branch name
 * - For tags (refs/tags/*): use tag name
 * - For PRs (refs/pull/N/merge): use target branch from github.base_ref
 */
function normalizeGitRef(ref: string, baseRef?: string): string {
  if (ref.startsWith('refs/heads/')) {
    return ref.replace('refs/heads/', '')
  }
  if (ref.startsWith('refs/tags/')) {
    return ref.replace('refs/tags/', '')
  }
  // For PRs, use the target branch if available
  if (baseRef) {
    return baseRef
  }
  // Fallback: use the full ref
  return ref
}

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
    const workflow = process.env['GITHUB_WORKFLOW'] || 'unknown'
    const ref = process.env['GITHUB_REF'] || 'unknown'
    const baseRef = process.env['GITHUB_BASE_REF'] || ''

    const normalizedRef = normalizeGitRef(ref, baseRef)
    const setupMacPortsVersion = getSetupMacPortsVersion()

    // Configuration hash (existing logic)
    const configData = {
      prefix: settings.prefix,
      version: settings.version,
      variants: {
        select: settings.variants.select.sort(),
        deselect: settings.variants.deselect.sort()
      },
      sources: settings.sources.sort()
    }
    const configHash = crypto
      .createHash('ripemd160')
      .update(JSON.stringify(configData))
      .digest('hex')
      .substring(0, 16)

    // Context hash (workflow, git ref, setup-macports version)
    const contextData = {
      workflow,
      ref: normalizedRef,
      setupMacPortsVersion
    }
    const contextHash = crypto
      .createHash('ripemd160')
      .update(JSON.stringify(contextData))
      .digest('hex')
      .substring(0, 8)

    // Platform version (major version only for broader compatibility)
    const platformMajor = platform.versionNumber?.split('.')[0] || '15'

    // Primary cache key: exact match
    const cacheKey = `macports-${settings.version}-${platform.architecture}-${platformMajor}-${configHash}-${contextHash}`

    // Restore keys for fallback
    const restoreKeys = [
      // Same version/arch/platform/config, different context (different branch)
      `macports-${settings.version}-${platform.architecture}-${platformMajor}-${configHash}-`,
      // Same version/arch/platform, different config
      `macports-${settings.version}-${platform.architecture}-${platformMajor}-`,
      // Same version/arch, any platform
      `macports-${settings.version}-${platform.architecture}-`
    ]

    core.debug(`Generated improved cache key: ${cacheKey}`)
    core.debug(`Restore keys: ${restoreKeys.join(', ')}`)

    return {cacheKey, restoreKeys}
  }
}
