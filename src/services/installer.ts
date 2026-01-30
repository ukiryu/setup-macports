import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as io from '@actions/io'
import * as fs from 'fs'
import * as path from 'path'
import type {IMacPortsSettings} from '../models/settings'
import type {IExecUtil} from '../utils/exec'

/**
 * MacPorts Installer Service
 *
 * Handles downloading and installing the MacPorts PKG
 */
export class MacPortsInstaller {
  constructor(private execUtil: IExecUtil) {}

  /**
   * Download and install the MacPorts package
   *
   * @param settings - MacPorts settings
   * @param packageUrl - URL of the package to download
   */
  async install(
    settings: IMacPortsSettings,
    packageUrl: string
  ): Promise<void> {
    const customPrefix = settings.prefix !== '/opt/local'

    core.info('Downloading MacPorts installer...')

    // Download the PKG
    const pkgPath = await tc.downloadTool(packageUrl)
    core.info(`Downloaded to: ${pkgPath}`)

    // Verify the file exists and is readable
    if (!fs.existsSync(pkgPath)) {
      throw new Error(`Downloaded file not found: ${pkgPath}`)
    }
    const stats = fs.statSync(pkgPath)
    core.debug(`Downloaded file size: ${stats.size} bytes`)

    // Copy to /tmp to ensure sudo can access it
    const tmpPkgPath = path.join('/tmp', `macports-installer-${Date.now()}.pkg`)
    core.debug(`Copying PKG to ${tmpPkgPath} for sudo access`)
    await io.cp(pkgPath, tmpPkgPath)

    core.info('Installing MacPorts...')

    // Run the installer with sudo
    // Note: The PKG installer will create /opt/local with proper permissions
    const result = await this.execUtil.execSudo(
      'installer',
      ['-pkg', tmpPkgPath, '-target', '/'],
      {
        silent: false
      }
    )

    if (result.exitCode !== 0) {
      throw new Error(
        `installer failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
      )
    }

    // If using custom prefix, move installation from /opt/local to custom prefix
    if (customPrefix) {
      core.info(`Moving installation to custom prefix: ${settings.prefix}`)
      await this.moveToCustomPrefix(settings.prefix)
    }

    core.info('MacPorts installed successfully')

    // Fix ownership to current user (non-critical, may fail on some runners)
    const username = process.env.USER || process.env.USERNAME || 'runner'
    core.debug(`Fixing ownership to ${username}...`)
    try {
      await this.execUtil.execSudo('chown', ['-R', username, settings.prefix], {
        silent: true
      })
    } catch (err) {
      core.warning(`Failed to fix ownership: ${(err as any)?.message ?? err}`)
    }

    // Clean up downloaded PKG files
    core.debug(`Cleaning up: ${pkgPath}`)
    await io.rmRF(pkgPath)
    core.debug(`Cleaning up: ${tmpPkgPath}`)
    await io.rmRF(tmpPkgPath)
  }

  /**
   * Move MacPorts installation from /opt/local to custom prefix
   *
   * @param customPrefix - The custom prefix path
   */
  private async moveToCustomPrefix(customPrefix: string): Promise<void> {
    core.info(`Moving MacPorts from /opt/local to ${customPrefix}`)

    // Create the custom prefix directory
    await io.mkdirP(customPrefix)

    // Move all contents from /opt/local to custom prefix
    const dirsToMove = [
      'bin',
      'sbin',
      'etc',
      'lib',
      'share',
      'var',
      'include',
      'man'
    ]

    for (const dir of dirsToMove) {
      const srcPath = path.join('/opt/local', dir)
      const destPath = path.join(customPrefix, dir)

      if (fs.existsSync(srcPath)) {
        core.debug(`Moving ${srcPath} to ${destPath}`)
        await this.execUtil.execSudo('mv', [srcPath, destPath], {silent: true})
      }
    }

    // Move any remaining files (including hidden files)
    const remainingFiles = fs.readdirSync('/opt/local')
    for (const file of remainingFiles) {
      if (dirsToMove.includes(file)) continue

      const srcPath = path.join('/opt/local', file)
      const destPath = path.join(customPrefix, file)

      if (fs.existsSync(srcPath)) {
        core.debug(`Moving ${srcPath} to ${destPath}`)
        await this.execUtil.execSudo('mv', [srcPath, destPath], {silent: true})
      }
    }

    core.info(`Successfully moved MacPorts to ${customPrefix}`)
  }
}
