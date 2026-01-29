import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as path from 'path'
import {getInputs} from './input-helper'
import {MacPortsProvider, cleanup} from './providers/macports-provider'
import {PlatformDetector} from './services/platform-detector'
import {CacheUtil} from './utils/cache'

async function run(): Promise<void> {
  try {
    core.info('Setting up MacPorts...')

    // Get and validate inputs
    const settings = await getInputs()

    core.debug(`Settings: ${JSON.stringify(settings, null, 2)}`)

    // Detect platform first for cache key generation
    const platformDetector = new PlatformDetector()
    const platform = await platformDetector.detect()
    core.info(
      `Platform: ${platform.version} (${platform.versionNumber}) ${platform.architecture}`
    )

    // Check cache first if enabled
    let cacheHit = false
    if (settings.cache) {
      core.startGroup('Cache MacPorts')
      const cacheUtil = new CacheUtil()
      const {cacheKey, restoreKeys} = cacheUtil.generateImprovedCacheKey(
        settings,
        platform
      )

      core.info(`Primary cache key: ${cacheKey}`)
      core.info(`Restore keys: ${restoreKeys.map(k => `'${k}'`).join(', ')}`)

      cacheHit =
        (await cache.restoreCache([settings.prefix], cacheKey, restoreKeys)) !==
        undefined

      if (cacheHit) {
        core.info(`Cache hit found for ${cacheKey}`)
        core.info('MacPorts installation restored from cache')

        // Set outputs for cached installation
        core.setOutput('version', settings.version)
        core.setOutput('prefix', settings.prefix)
        core.setOutput('cache-hit', 'true')

        // Add to PATH if requested
        if (settings.prependPath) {
          core.addPath(path.join(settings.prefix, 'bin'))
          core.addPath(path.join(settings.prefix, 'sbin'))
        }

        core.endGroup()
        core.info('MacPorts setup complete (from cache)!')
        return
      }

      core.info(`Cache miss for ${cacheKey}`)
      core.endGroup()
    }

    // Create provider and setup MacPorts
    const provider = new MacPortsProvider(settings)
    const installInfo = await provider.setup()

    // Save cache if enabled and not a hit
    if (settings.cache && !cacheHit) {
      core.startGroup('Save MacPorts cache')
      const cacheUtil = new CacheUtil()
      const {cacheKey} = cacheUtil.generateImprovedCacheKey(settings, platform)

      try {
        await cache.saveCache([settings.prefix], cacheKey)
        core.info(`Cache saved with key: ${cacheKey}`)
      } catch (error) {
        // Cache might already exist or other error - log but don't fail
        if ((error as any)?.name === 'ReservedCacheKey') {
          core.warning(`Cache key ${cacheKey} is reserved`)
        } else {
          core.warning(
            `Failed to save cache: ${(error as any)?.message ?? error}`
          )
        }
      }

      core.endGroup()
    }

    core.info('MacPorts setup complete!')
    core.info(`Version: ${installInfo.version}`)
    core.info(`Prefix: ${installInfo.prefix}`)
    core.info(`Cache Key: ${installInfo.cacheKey}`)
  } catch (error) {
    core.setFailed(`${(error as any)?.message ?? error}`)
  }
}

// Main
// Check if this is a post execution
if (process.env['STATE_isPost'] === 'true') {
  cleanup()
} else {
  run()
}
