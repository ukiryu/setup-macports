import type {IMacPortsSettings} from '../models/settings'
import type {IPlatformInfo} from '../models/platform-info'

/**
 * Known macOS versions mapping for PKG filename construction
 * Maps version number to the name used in PKG filenames
 */
interface IPkgVersionInfo {
  name: string
  pkgVersion: string
}

const MACOS_PKG_VERSIONS: Record<string, IPkgVersionInfo> = {
  '10.10': {name: 'Yosemite', pkgVersion: '10.10'},
  '10.11': {name: 'ElCapitan', pkgVersion: '10.11'},
  '10.12': {name: 'Sierra', pkgVersion: '10.12'},
  '10.13': {name: 'HighSierra', pkgVersion: '10.13'},
  '10.14': {name: 'Mojave', pkgVersion: '10.14'},
  '10.15': {name: 'Catalina', pkgVersion: '10.15'},
  '11': {name: 'BigSur', pkgVersion: '11'},
  '12': {name: 'Monterey', pkgVersion: '12'},
  '14': {name: 'Sonoma', pkgVersion: '14'},
  '15': {name: 'Sequoia', pkgVersion: '15'},
  '26': {name: 'Tahoe', pkgVersion: '26'}
}

/**
 * Package Builder Service
 *
 * Constructs download URLs for MacPorts installer packages
 */
export class PackageBuilder {
  /**
   * Build the package URL for download
   *
   * @param settings - MacPorts settings
   * @param platform - Platform information
   * @returns URL of the installer package
   */
  buildUrl(settings: IMacPortsSettings, platform: IPlatformInfo): string {
    // Get the major version number (e.g., "15" from "15.0")
    const versionMatch = platform.versionNumber.match(/^\d+/)
    if (!versionMatch) {
      throw new Error(
        `Could not parse macOS version: ${platform.versionNumber}`
      )
    }

    const majorVersion = versionMatch[0]

    // Look up the PKG version info
    const versionInfo = MACOS_PKG_VERSIONS[majorVersion]
    if (!versionInfo) {
      throw new Error(
        `Unsupported macOS version: ${majorVersion}. ` +
          `Supported versions: ${Object.keys(MACOS_PKG_VERSIONS).join(', ')}`
      )
    }

    // Use resolvedVersion if available (for 'latest'), otherwise use version
    const effectiveVersion = settings.resolvedVersion || settings.version

    // Build the filename: MacPorts-{version}-{os_version}-{os_name}.pkg
    const filename = `MacPorts-${effectiveVersion}-${versionInfo.pkgVersion}-${versionInfo.name}.pkg`

    return `https://github.com/macports/macports-base/releases/download/v${effectiveVersion}/${filename}`
  }
}
