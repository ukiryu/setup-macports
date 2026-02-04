import {PackageBuilder} from '../src/services/package-builder'
import type {IMacPortsSettings} from '../src/models/settings'
import type {IPlatformInfo} from '../src/models/platform-info'

describe('PackageBuilder', () => {
  let builder: PackageBuilder

  beforeEach(() => {
    builder = new PackageBuilder()
  })

  const createSettings = (version: string): IMacPortsSettings => ({
    version,
    prefix: '/opt/local',
    variants: {select: [], deselect: []},
    sources: [],
    ports: [],
    sourcesProvider: 'auto',
    gitRepository: 'macports/macports-ports',
    rsyncUrl: 'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
    prependPath: true,
    verbose: false,
    signatureCheck: 'strict',
    signatureSkipPackages: [],
    debug: false,
    cache: false
  })

  const createPlatform = (
    version: string,
    versionNumber: string,
    arch: string
  ): IPlatformInfo => ({
    version,
    versionNumber,
    architecture: arch
  })

  describe('buildUrl', () => {
    it('builds URL for macOS 15 Sequoia arm64', () => {
      const settings = createSettings('2.11.5')
      const platform = createPlatform('Sequoia', '15.0', 'arm64')

      const url = builder.buildUrl(settings, platform)

      expect(url).toBe(
        'https://github.com/macports/macports-base/releases/download/v2.11.5/MacPorts-2.11.5-15-Sequoia.pkg'
      )
    })

    it('builds URL using resolvedVersion', () => {
      const settings = createSettings('2.11.5')
      settings.resolvedVersion = '2.11.6'
      const platform = createPlatform('Sequoia', '15.0', 'arm64')

      const url = builder.buildUrl(settings, platform)

      // URL should contain '2.11.6', not '2.11.5'
      expect(url).toBe(
        'https://github.com/macports/macports-base/releases/download/v2.11.6/MacPorts-2.11.6-15-Sequoia.pkg'
      )
    })

    it('builds URL for macOS 14 Sonoma x86_64', () => {
      const settings = createSettings('2.10.0')
      const platform = createPlatform('Sonoma', '14.5', 'x86_64')

      const url = builder.buildUrl(settings, platform)

      expect(url).toBe(
        'https://github.com/macports/macports-base/releases/download/v2.10.0/MacPorts-2.10.0-14-Sonoma.pkg'
      )
    })

    it('builds URL for macOS 26 Tahoe', () => {
      const settings = createSettings('2.12.0')
      const platform = createPlatform('Tahoe', '26.0', 'arm64')

      const url = builder.buildUrl(settings, platform)

      expect(url).toBe(
        'https://github.com/macports/macports-base/releases/download/v2.12.0/MacPorts-2.12.0-26-Tahoe.pkg'
      )
    })

    it('throws error for unsupported macOS version', () => {
      const settings = createSettings('2.11.5')
      const platform = createPlatform('Unknown', '99.0', 'arm64')

      expect(() => builder.buildUrl(settings, platform)).toThrow(
        'Unsupported macOS version: 99'
      )
    })

    it('builds URL for RC release versions', () => {
      const settings = createSettings('2.12.0-rc1')
      const platform = createPlatform('Sequoia', '15.0', 'arm64')

      const url = builder.buildUrl(settings, platform)

      expect(url).toBe(
        'https://github.com/macports/macports-base/releases/download/v2.12.0-rc1/MacPorts-2.12.0-rc1-15-Sequoia.pkg'
      )
    })
  })
})
