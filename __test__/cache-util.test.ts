import {CacheUtil} from '../src/utils/cache'
import type {IMacPortsSettings} from '../src/models/settings'
import type {IPlatformInfo} from '../src/models/platform-info'

describe('CacheUtil', () => {
  let cacheUtil: CacheUtil

  beforeEach(() => {
    cacheUtil = new CacheUtil()
  })

  const createSettings = (
    overrides?: Partial<IMacPortsSettings>
  ): IMacPortsSettings => ({
    version: '2.11.5',
    prefix: '/opt/local',
    variants: {select: [], deselect: []},
    sources: [],
    ports: [],
    useGitSources: true,
    sourcesProvider: 'auto',
    gitRepository: 'macports/macports-ports',
    rsyncUrl: 'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
    prependPath: true,
    verbose: false,
    signatureCheck: 'strict',
    signatureSkipPackages: [],
    debug: false,
    cache: false,
    ...overrides
  })

  const createPlatform = (version: string, arch: string): IPlatformInfo => ({
    version,
    versionNumber: '15.0',
    architecture: arch
  })

  describe('generateImprovedCacheKey', () => {
    it('generates cache key for basic settings', () => {
      const settings = createSettings()
      const platform = createPlatform('Sequoia', 'arm64')

      const {cacheKey} = cacheUtil.generateImprovedCacheKey(settings, platform)

      expect(cacheKey).toBe('macports-2.11.5-arm64-15')
    })

    it('uses resolvedVersion when available', () => {
      const settings = createSettings({
        version: 'latest',
        resolvedVersion: '2.11.6'
      })
      const platform = createPlatform('Sequoia', 'arm64')

      const {cacheKey} = cacheUtil.generateImprovedCacheKey(settings, platform)

      // Cache key should contain '2.11.6', not 'latest'
      expect(cacheKey).toBe('macports-2.11.6-arm64-15')
    })

    it('falls back to version when resolvedVersion is not set', () => {
      const settings = createSettings({version: '2.10.0'})
      const platform = createPlatform('Sonoma', 'x86_64')

      const {cacheKey} = cacheUtil.generateImprovedCacheKey(settings, platform)

      // Note: createPlatform uses versionNumber '15.0', so major is 15
      expect(cacheKey).toBe('macports-2.10.0-x86_64-15')
    })
  })

  describe('generateCacheKey', () => {
    it('generates cache key for basic settings', () => {
      const settings = createSettings()
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generateCacheKey(settings, platform)

      expect(cacheKey).toMatch(/^macports-Sequoia-arm64-v2-[a-f0-9]{40}$/)
    })

    it('generates same cache key for same settings', () => {
      const settings1 = createSettings()
      const settings2 = createSettings()
      const platform = createPlatform('Sonoma', 'x86_64')

      const key1 = cacheUtil.generateCacheKey(settings1, platform)
      const key2 = cacheUtil.generateCacheKey(settings2, platform)

      expect(key1).toBe(key2)
    })

    it('generates different cache keys for different versions', () => {
      const settings1 = createSettings({version: '2.11.5'})
      const settings2 = createSettings({version: '2.10.0'})
      const platform = createPlatform('Sequoia', 'arm64')

      const key1 = cacheUtil.generateCacheKey(settings1, platform)
      const key2 = cacheUtil.generateCacheKey(settings2, platform)

      expect(key1).not.toBe(key2)
    })

    it('generates different cache keys for different variants', () => {
      const settings1 = createSettings({
        variants: {select: ['aqua'], deselect: ['x11']}
      })
      const settings2 = createSettings({
        variants: {select: ['metal'], deselect: []}
      })
      const platform = createPlatform('Sequoia', 'arm64')

      const key1 = cacheUtil.generateCacheKey(settings1, platform)
      const key2 = cacheUtil.generateCacheKey(settings2, platform)

      expect(key1).not.toBe(key2)
    })

    it('generates different cache keys for different prefixes', () => {
      const settings1 = createSettings({prefix: '/opt/local'})
      const settings2 = createSettings({prefix: '/opt/package'})
      const platform = createPlatform('Sequoia', 'arm64')

      const key1 = cacheUtil.generateCacheKey(settings1, platform)
      const key2 = cacheUtil.generateCacheKey(settings2, platform)

      expect(key1).not.toBe(key2)
    })

    it('generates different cache keys for different architectures', () => {
      const settings = createSettings()
      const platform1 = createPlatform('Sequoia', 'arm64')
      const platform2 = createPlatform('Sequoia', 'x86_64')

      const key1 = cacheUtil.generateCacheKey(settings, platform1)
      const key2 = cacheUtil.generateCacheKey(settings, platform2)

      expect(key1).not.toBe(key2)
    })
  })

  describe('generateSetupCacheKey', () => {
    it('generates setup cache key for basic settings', () => {
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generateSetupCacheKey('2.11.5', platform)

      expect(cacheKey).toBe('macports-setup-2.11.5-arm64-15')
    })

    it('generates different setup cache keys for different versions', () => {
      const platform = createPlatform('Sequoia', 'arm64')

      const key1 = cacheUtil.generateSetupCacheKey('2.11.5', platform)
      const key2 = cacheUtil.generateSetupCacheKey('2.10.0', platform)

      expect(key1).not.toBe(key2)
    })

    it('generates different setup cache keys for different architectures', () => {
      const platform1 = createPlatform('Sequoia', 'arm64')
      const platform2 = createPlatform('Sequoia', 'x86_64')

      const key1 = cacheUtil.generateSetupCacheKey('2.11.5', platform1)
      const key2 = cacheUtil.generateSetupCacheKey('2.11.5', platform2)

      expect(key1).not.toBe(key2)
    })

    it('generates different setup cache keys for different platform versions', () => {
      const platform1: IPlatformInfo = {
        version: 'Sequoia',
        versionNumber: '15.0',
        architecture: 'arm64'
      }
      const platform2: IPlatformInfo = {
        version: 'Sonoma',
        versionNumber: '14.0',
        architecture: 'arm64'
      }

      const key1 = cacheUtil.generateSetupCacheKey('2.11.5', platform1)
      const key2 = cacheUtil.generateSetupCacheKey('2.11.5', platform2)

      expect(key1).not.toBe(key2)
    })

    it('uses same setup cache key regardless of sources provider', () => {
      const platform = createPlatform('Sequoia', 'arm64')

      const key = cacheUtil.generateSetupCacheKey('2.11.5', platform)

      // Setup cache key should NOT include sources provider
      expect(key).toBe('macports-setup-2.11.5-arm64-15')
      expect(key).not.toContain('git')
      expect(key).not.toContain('rsync')
    })
  })

  describe('generatePortsCacheKey', () => {
    it('generates ports cache key for git provider', () => {
      const settings = createSettings({sourcesProvider: 'git'})
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      expect(cacheKey).toBe('macports-ports-git-master-15')
    })

    it('generates ports cache key for rsync provider', () => {
      const settings = createSettings({sourcesProvider: 'rsync'})
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      expect(cacheKey).toBe('macports-ports-rsync-master-15')
    })

    it('generates ports cache key for auto provider (treats as rsync)', () => {
      const settings = createSettings({sourcesProvider: 'auto'})
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      // Auto provider should use rsync
      expect(cacheKey).toBe('macports-ports-rsync-master-15')
    })

    it('includes git ref in ports cache key for git provider', () => {
      const settings = createSettings({
        sourcesProvider: 'git',
        gitRef: 'v2.12.0'
      })
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      expect(cacheKey).toBe('macports-ports-git-v2.12.0-15')
    })

    it('uses default git ref when not provided', () => {
      const settings = createSettings({
        sourcesProvider: 'git',
        gitRef: undefined
      })
      const platform = createPlatform('Sequoia', 'arm64')

      const cacheKey = cacheUtil.generatePortsCacheKey(settings, platform)

      expect(cacheKey).toBe('macports-ports-git-master-15')
    })

    it('generates different ports cache keys for git vs rsync', () => {
      const platform = createPlatform('Sequoia', 'arm64')
      const gitSettings = createSettings({sourcesProvider: 'git'})
      const rsyncSettings = createSettings({sourcesProvider: 'rsync'})

      const gitKey = cacheUtil.generatePortsCacheKey(gitSettings, platform)
      const rsyncKey = cacheUtil.generatePortsCacheKey(rsyncSettings, platform)

      expect(gitKey).not.toBe(rsyncKey)
      expect(gitKey).toContain('git')
      expect(rsyncKey).toContain('rsync')
    })
  })
})
