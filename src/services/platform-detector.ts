import * as os from 'os'
import * as core from '@actions/core'
import {exec} from '@actions/exec'
import type {IPlatformInfo, IPlatformDetector} from '../models/platform-info.js'

/**
 * macOS version database
 * Maps version numbers to version names
 */
const MACOS_VERSIONS: Record<string, string> = {
  '10.6': 'SnowLeopard',
  '10.7': 'Lion',
  '10.8': 'MountainLion',
  '10.9': 'Mavericks',
  '10.10': 'Yosemite',
  '10.11': 'ElCapitan',
  '10.12': 'Sierra',
  '10.13': 'HighSierra',
  '10.14': 'Mojave',
  '10.15': 'Catalina',
  '11': 'BigSur',
  '12': 'Monterey',
  '14': 'Sonoma',
  '15': 'Sequoia',
  '26': 'Tahoe'
}

/**
 * Platform Detector Service
 *
 * Detects macOS version and architecture
 */
export class PlatformDetector implements IPlatformDetector {
  /**
   * Ensure we're running on macOS
   * @throws Error if not running on macOS
   */
  private ensureMacOS(): void {
    if (process.platform !== 'darwin') {
      throw new Error(
        `This action only works on macOS runners. Current platform: ${process.platform}`
      )
    }
  }

  /**
   * Get the macOS version name (e.g., "Sequoia", "Sonoma")
   */
  private async getVersionName(): Promise<string> {
    let output = ''
    let error = ''

    try {
      await exec('sw_vers', ['-productVersion'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString()
          },
          stderr: (data: Buffer) => {
            error += data.toString()
          }
        }
      })

      if (error) {
        core.debug(`sw_vers stderr: ${error}`)
      }

      const version = output.trim()
      core.debug(`Detected macOS version: ${version}`)

      // Extract major version number (first number before the dot)
      const match = version.match(/^(\d+)\./)
      if (match) {
        const versionKey = match[1]
        const versionName = MACOS_VERSIONS[versionKey]
        if (versionName) {
          return versionName
        }
      }

      // Fallback for unknown versions
      core.warning(`Unknown macOS version: ${version}, returning 'Unknown'`)
      return 'Unknown'
    } catch (err) {
      core.debug(`Failed to run sw_vers: ${(err as any)?.message ?? err}`)
      // Fallback to os.release()
      const release = os.release()
      core.debug(`Falling back to os.release(): ${release}`)
      return 'Unknown'
    }
  }

  /**
   * Get the macOS version number (e.g., "15.0", "14.5")
   */
  private async getVersionNumber(): Promise<string> {
    let output = ''

    try {
      await exec('sw_vers', ['-productVersion'], {
        silent: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString()
          }
        }
      })

      return output.trim()
    } catch (err) {
      core.debug(`Failed to run sw_vers: ${(err as any)?.message ?? err}`)
      // Fallback to os.release() which returns Darwin kernel version
      const release = os.release()
      // Convert Darwin version to macOS version
      // Darwin 23.x = macOS 14.x, Darwin 24.x = macOS 15.x
      const darwinMajor = parseInt(release.split('.')[0], 10)
      const macosMajor = darwinMajor - 9
      return `${macosMajor}.0`
    }
  }

  /**
   * Get the CPU architecture
   */
  private getArchitecture(): string {
    const arch = os.arch()
    switch (arch) {
      case 'arm64':
        return 'arm64'
      case 'x64':
        return 'x86_64'
      default:
        core.warning(`Unknown architecture: ${arch}`)
        return 'unknown'
    }
  }

  /**
   * Detect platform information
   */
  async detect(): Promise<IPlatformInfo> {
    this.ensureMacOS()

    const version = await this.getVersionName()
    const versionNumber = await this.getVersionNumber()
    const architecture = this.getArchitecture()

    return {version, versionNumber, architecture}
  }
}
