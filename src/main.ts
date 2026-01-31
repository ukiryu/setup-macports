import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
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

    // Validate that we're running on macOS
    // MacPorts PKG installer only works on macOS
    if (process.platform !== 'darwin') {
      core.setFailed(
        `This action only supports macOS runners. ` +
          `Current platform: ${process.platform}. ` +
          `MacPorts depends on the official PKG installer which is macOS-only. ` +
          `Please use a macOS runner (macos-latest, macos-14, macos-15, etc.)`
      )
      return
    }

    // Check cache first if enabled
    // Skip restore if CACHE_SAVE_ONLY is set (used by cache-setup jobs)
    const cacheSaveOnly = process.env.CACHE_SAVE_ONLY === 'true'
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

      // Restore cache to temp location first (since /opt/local requires root)
      const cacheTempDir = '/tmp/macports-cache'
      if (cacheSaveOnly) {
        core.info('CACHE_SAVE_ONLY is set - skipping cache restore')
      } else {
        cacheHit =
          (await cache.restoreCache([cacheTempDir], cacheKey, restoreKeys)) !==
          undefined
      }

      if (cacheHit) {
        core.info(`Cache hit found for ${cacheKey}`)

        // Copy from temp to final location using sudo
        core.startGroup('Restore cache from temp to final location')
        try {
          core.info(`Copying ${cacheTempDir} to ${settings.prefix}...`)
          await exec.exec('sudo', [
            '-n',
            'cp',
            '-R',
            cacheTempDir + '/.',
            settings.prefix
          ])
          await exec.exec('sudo', ['-n', 'rm', '-rf', cacheTempDir])
          core.info('Cache restored successfully')
        } catch (error) {
          core.warning(
            `Failed to restore cache: ${(error as any)?.message ?? error}`
          )
          cacheHit = false
        }
        core.endGroup()

        if (cacheHit) {
          core.info('MacPorts installation restored from cache')

          // Fix permissions on restored cache
          core.startGroup('Fix permissions on restored cache')
          try {
            core.info('Fixing file ownership and permissions...')
            // Change ownership to current user
            await exec.exec('sudo', [
              '-n',
              'chown',
              '-R',
              `${process.env.USER}`,
              settings.prefix
            ])
            // Fix permissions: directories 755, files 644
            await exec.exec('sudo', [
              '-n',
              'find',
              settings.prefix,
              '-type',
              'd',
              '-exec',
              'chmod',
              '755',
              '{}',
              '+'
            ])
            await exec.exec('sudo', [
              '-n',
              'find',
              settings.prefix,
              '-type',
              'f',
              '-exec',
              'chmod',
              '644',
              '{}',
              '+'
            ])
            // Make executables actually executable
            await exec.exec('sudo', [
              '-n',
              'chmod',
              '-R',
              '755',
              path.join(settings.prefix, 'bin')
            ])
            await exec.exec('sudo', [
              '-n',
              'chmod',
              '-R',
              '755',
              path.join(settings.prefix, 'sbin')
            ])
            core.info('Permissions fixed successfully')
          } catch (error) {
            core.warning(
              `Failed to fix permissions: ${(error as any)?.message ?? error}`
            )
          }
          core.endGroup()

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

      // Set cache-hit output to false for fresh installs
      core.setOutput('cache-hit', 'false')

      try {
        // Copy to temp location first (since /opt/local requires root to read)
        const cacheTempDir = '/tmp/macports-cache'
        core.info(
          `Copying ${settings.prefix} to ${cacheTempDir} for caching...`
        )
        await exec.exec('sudo', ['-n', 'mkdir', '-p', cacheTempDir])
        await exec.exec('sudo', [
          '-n',
          'cp',
          '-R',
          settings.prefix + '/.',
          cacheTempDir
        ])
        // Fix ownership so current user can read it for caching
        await exec.exec('sudo', [
          '-n',
          'chown',
          '-R',
          `${process.env.USER}`,
          cacheTempDir
        ])

        await cache.saveCache([cacheTempDir], cacheKey)
        core.info(`Cache saved with key: ${cacheKey}`)

        // Cleanup temp directory
        await exec.exec('sudo', ['-n', 'rm', '-rf', cacheTempDir])
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
