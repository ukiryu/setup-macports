import * as core from '@actions/core'

/**
 * State constants for persisting data between main and post execution
 */
export const STATE_IS_POST = 'isPost'
export const STATE_INSTALLATION_PREFIX = 'installationPrefix'
export const STATE_CACHE_KEY = 'cacheKey'
export const STATE_MACPORTS_VERSION = 'macportsVersion'

/**
 * Set the post execution state flag
 */
export function setIsPost(): void {
  core.saveState(STATE_IS_POST, 'true')
}

/**
 * Check if we're in post execution
 */
export function isPost(): boolean {
  return core.getState(STATE_IS_POST) === 'true'
}

/**
 * Save the installation prefix
 */
export function setInstallationPrefix(prefix: string): void {
  core.saveState(STATE_INSTALLATION_PREFIX, prefix)
}

/**
 * Get the installation prefix
 */
export function getInstallationPrefix(): string | undefined {
  return core.getState(STATE_INSTALLATION_PREFIX)
}

/**
 * Save the cache key
 */
export function setCacheKey(key: string): void {
  core.saveState(STATE_CACHE_KEY, key)
}

/**
 * Get the cache key
 */
export function getCacheKey(): string | undefined {
  return core.getState(STATE_CACHE_KEY)
}

/**
 * Save the MacPorts version
 */
export function setMacPortsVersion(version: string): void {
  core.saveState(STATE_MACPORTS_VERSION, version)
}

/**
 * Get the MacPorts version
 */
export function getMacPortsVersion(): string | undefined {
  return core.getState(STATE_MACPORTS_VERSION)
}
