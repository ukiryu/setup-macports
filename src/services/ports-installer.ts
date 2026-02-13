import * as path from 'path'
import * as core from '@actions/core'
import type {IMacPortsSettings} from '../models/settings.js'
import type {IExecUtil} from '../utils/exec.js'

/**
 * Ports Installer Service
 *
 * Installs requested ports via MacPorts
 */
export class PortsInstaller {
  constructor(private execUtil: IExecUtil) {}

  /**
   * Install requested ports
   *
   * @param settings - MacPorts settings
   */
  async install(settings: IMacPortsSettings): Promise<void> {
    const portBinary = path.join(settings.prefix, 'bin', 'port')
    const skipPackages = new Set(settings.signatureSkipPackages)

    for (const port of settings.ports) {
      core.info(`Installing port: ${port.name}`)

      // Check if this port should have signature check skipped
      const shouldSkipSignature = skipPackages.has(port.name)
      const globalArgs: string[] = []

      if (shouldSkipSignature) {
        core.warning(
          `Installing ${port.name} with force flag to bypass signature verification`
        )
        globalArgs.push('-f')
      }

      if (settings.verbose) {
        globalArgs.push('-v')
      }

      const args = [...globalArgs, 'install', port.name]

      // Add variants if specified
      if (port.variants) {
        const variantList = port.variants.trim().split(/\s+/)
        for (const variant of variantList) {
          if (variant) {
            args.push(variant)
          }
        }
      }

      await this.execUtil.exec(portBinary, args, {silent: false})
      core.info(`Port ${port.name} installed successfully`)
    }
  }
}
