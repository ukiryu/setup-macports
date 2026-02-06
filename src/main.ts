import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as path from 'path'
import {getInputs} from './input-helper'
import {MacPortsProvider, cleanup} from './providers/macports-provider'
import {PlatformDetector} from './services/platform-detector'
import {VersionResolver} from './services/version-resolver'
import {CacheUtil} from './utils/cache'

async function run(): Promise<void> {
  try {
    core.info('Setting up MacPorts...')

    // Get and validate inputs
    const settings = await getInputs()

    core.debug(`Settings: ${JSON.stringify(settings, null, 2)}`)

    // Resolve version if 'latest'
    if (settings.version.toLowerCase() === 'latest') {
      core.startGroup('Resolving MacPorts version')
      const resolver = new VersionResolver(settings.githubToken)
      const resolution = await resolver.resolve(settings.version)
      settings.resolvedVersion = resolution.version
      core.info(`Resolved version: ${resolution.version}`)
      core.endGroup()
    }

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
    let setupCacheHit = false
    let portsCacheHit = false
    if (settings.cache) {
      core.startGroup('Cache MacPorts')
      const cacheUtil = new CacheUtil()

      // Generate separate cache keys for setup and ports
      const effectiveVersion = settings.resolvedVersion || settings.version
      const setupCacheKey = cacheUtil.generateSetupCacheKey(
        effectiveVersion,
        platform
      )
      const portsCacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      core.info(`Setup cache key: ${setupCacheKey}`)
      core.info(`Ports cache key: ${portsCacheKey}`)

      // Temporary directories for restoring caches
      const setupCacheTempDir = '/tmp/macports-setup-cache'
      const portsCacheTempDir = '/tmp/macports-ports-cache'

      if (cacheSaveOnly) {
        core.info('CACHE_SAVE_ONLY is set - skipping cache restore')
      } else {
        // Restore both caches
        setupCacheHit =
          (await cache.restoreCache([setupCacheTempDir], setupCacheKey)) !==
          undefined
        portsCacheHit =
          (await cache.restoreCache([portsCacheTempDir], portsCacheKey)) !==
          undefined

        core.info(`Setup cache hit: ${setupCacheHit}`)
        core.info(`Ports cache hit: ${portsCacheHit}`)
      }

      if (setupCacheHit) {
        core.info('Setup cache hit found - restoring MacPorts installation')

        // Copy from temp to final location using sudo
        core.startGroup('Restore setup cache from temp to final location')
        try {
          core.info(`Copying ${setupCacheTempDir} to ${settings.prefix}...`)
          await exec.exec('sudo', ['-n', 'mkdir', '-p', settings.prefix])
          await exec.exec('sudo', [
            '-n',
            'cp',
            '-R',
            setupCacheTempDir + '/.',
            settings.prefix
          ])
          await exec.exec('sudo', ['-n', 'rm', '-rf', setupCacheTempDir])
          core.info('Setup cache restored successfully')
        } catch (error) {
          core.warning(
            `Failed to restore setup cache: ${(error as any)?.message ?? error}`
          )
          setupCacheHit = false
        }
        core.endGroup()

        if (setupCacheHit) {
          // Restore ports cache if available
          if (portsCacheHit) {
            core.startGroup('Restore ports cache from temp to final location')
            try {
              const portsDestDir = path.join(
                settings.prefix,
                'var/macports/sources'
              )
              core.info(`Copying ${portsCacheTempDir} to ${portsDestDir}...`)
              await exec.exec('sudo', ['-n', 'mkdir', '-p', portsDestDir])
              await exec.exec('sudo', [
                '-n',
                'cp',
                '-R',
                portsCacheTempDir + '/.',
                portsDestDir
              ])
              await exec.exec('sudo', ['-n', 'rm', '-rf', portsCacheTempDir])
              core.info('Ports cache restored successfully')
            } catch (error) {
              core.warning(
                `Failed to restore ports cache: ${(error as any)?.message ?? error}`
              )
              portsCacheHit = false
            }
            core.endGroup()
          }

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
            // Fix ALL bin and sbin directories recursively (e.g., libexec/macports/bin)
            await exec.exec('sudo', [
              '-n',
              'find',
              settings.prefix,
              '-type',
              'd',
              '(',
              '-name',
              'bin',
              '-o',
              '-name',
              'sbin',
              ')',
              '-exec',
              'chmod',
              '-R',
              '755',
              '{}',
              ';'
            ])
            core.info('Permissions fixed successfully')
          } catch (error) {
            core.warning(
              `Failed to fix permissions: ${(error as any)?.message ?? error}`
            )
          }
          core.endGroup()

          // Apply configuration for cached installation
          // Cache contains base MacPorts + optionally synced ports
          // Even when ports cache hits, we need to write sources.conf and variants.conf
          core.startGroup('Applying configuration (from cache)')
          const provider = new MacPortsProvider(settings)
          if (portsCacheHit) {
            // Ports are cached, but we still need to write config files
            // Skip sync (PortIndex is already built)
            // Skip setup sources (git sources are already cached)
            core.info('Ports cache hit - writing config files, skipping sync')
            await provider.configure(true, true)
          } else {
            // Need to configure sources and sync ports
            core.info('Ports cache miss - configuring and syncing')
            await provider.configure(false, false)
          }
          core.endGroup()

          core.setOutput('cache-hit', 'true')

          // Add MacPorts to PATH if prependPath is enabled
          if (settings.prependPath) {
            core.addPath(path.join(settings.prefix, 'bin'))
            core.addPath(path.join(settings.prefix, 'sbin'))
          }

          core.info('MacPorts setup complete (from cache)!')
          return
        }
      }

      core.info(`Setup cache miss for ${setupCacheKey}`)
      core.endGroup()
    }

    // Create provider and setup MacPorts
    const provider = new MacPortsProvider(settings)
    const installInfo = await provider.setup()

    // Save cache if enabled and not a setup cache hit
    if (settings.cache && !setupCacheHit) {
      core.startGroup('Save MacPorts cache')
      const cacheUtil = new CacheUtil()

      // Set cache-hit output to false for fresh installs
      core.setOutput('cache-hit', 'false')

      // Generate both cache keys
      const effectiveVersion = settings.resolvedVersion || settings.version
      const setupCacheKey = cacheUtil.generateSetupCacheKey(
        effectiveVersion,
        platform
      )
      const portsCacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      // Save setup cache (excluding sources directory)
      try {
        core.startGroup('Save setup cache')
        const setupCacheTempDir = '/tmp/macports-setup-cache'
        core.info(
          `Copying ${settings.prefix} to ${setupCacheTempDir} for caching...`
        )
        await exec.exec('sudo', ['-n', 'mkdir', '-p', setupCacheTempDir])

        // Copy everything EXCEPT sources directory
        await exec.exec('sudo', [
          '-n',
          'rsync',
          '-a',
          '--exclude=var/macports/sources/*',
          settings.prefix + '/',
          setupCacheTempDir + '/'
        ])

        // Fix ownership so current user can read it for caching
        await exec.exec('sudo', [
          '-n',
          'chown',
          '-R',
          `${process.env.USER}`,
          setupCacheTempDir
        ])

        await cache.saveCache([setupCacheTempDir], setupCacheKey)
        core.info(`Setup cache saved with key: ${setupCacheKey}`)

        // Cleanup temp directory
        await exec.exec('sudo', ['-n', 'rm', '-rf', setupCacheTempDir])
        core.endGroup()
      } catch (error) {
        // Handle "unable to reserve cache" error - happens when action is called
        // multiple times in the same job with the same cache key
        const errorMsg = String((error as any)?.message ?? error)
        if (
          errorMsg.includes('Unable to reserve cache') ||
          errorMsg.includes('another job may be creating')
        ) {
          core.info(
            `Setup cache ${setupCacheKey} is being saved by another process, skipping`
          )
        } else {
          core.warning(`Failed to save setup cache: ${errorMsg}`)
        }
        // Cleanup temp directory on error
        try {
          await exec.exec('sudo', [
            '-n',
            'rm',
            '-rf',
            '/tmp/macports-setup-cache'
          ])
        } catch {}
      }

      // Save ports cache (only sources directory)
      try {
        core.startGroup('Save ports cache')
        const portsCacheTempDir = '/tmp/macports-ports-cache'
        const portsSourceDir = path.join(
          settings.prefix,
          'var/macports/sources'
        )

        core.info(
          `Copying ${portsSourceDir} to ${portsCacheTempDir} for caching...`
        )
        await exec.exec('sudo', ['-n', 'mkdir', '-p', portsCacheTempDir])
        await exec.exec('sudo', [
          '-n',
          'cp',
          '-R',
          portsSourceDir + '/.',
          portsCacheTempDir
        ])

        // Fix ownership so current user can read it for caching
        await exec.exec('sudo', [
          '-n',
          'chown',
          '-R',
          `${process.env.USER}`,
          portsCacheTempDir
        ])

        await cache.saveCache([portsCacheTempDir], portsCacheKey)
        core.info(`Ports cache saved with key: ${portsCacheKey}`)

        // Cleanup temp directory
        await exec.exec('sudo', ['-n', 'rm', '-rf', portsCacheTempDir])
        core.endGroup()
      } catch (error) {
        // Handle "unable to reserve cache" error - happens when action is called
        // multiple times in the same job with the same cache key
        const errorMsg = String((error as any)?.message ?? error)
        if (
          errorMsg.includes('Unable to reserve cache') ||
          errorMsg.includes('another job may be creating')
        ) {
          core.info(
            `Ports cache ${portsCacheKey} is being saved by another process, skipping`
          )
        } else {
          core.warning(`Failed to save ports cache: ${errorMsg}`)
        }
        // Cleanup temp directory on error
        try {
          await exec.exec('sudo', [
            '-n',
            'rm',
            '-rf',
            '/tmp/macports-ports-cache'
          ])
        } catch {}
      }

      core.endGroup()
    }

    // Add MacPorts to PATH if prependPath is enabled
    if (settings.prependPath) {
      core.addPath(path.join(settings.prefix, 'bin'))
      core.addPath(path.join(settings.prefix, 'sbin'))
    }

    core.info('MacPorts setup complete!')
    core.info(`Version: ${installInfo.version}`)
    core.info(`Prefix: ${installInfo.prefix}`)
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
