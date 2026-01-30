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
    signatureCheck: true,
    debug: false,
    cache: false,
    ...overrides
  })

  const createPlatform = (version: string, arch: string): IPlatformInfo => ({
    version,
    versionNumber: '15.0',
    architecture: arch
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
})
