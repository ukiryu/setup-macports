import * as path from 'path'
import * as core from '@actions/core'
import type {IMacPortsSettings} from '../models/settings'
import type {IExecUtil} from '../utils/exec'

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

    for (const port of settings.ports) {
      core.info(`Installing port: ${port.name}`)

      const args = ['install', port.name]

      // Add variants if specified
      if (port.variants) {
        const variantList = port.variants.trim().split(/\s+/)
        for (const variant of variantList) {
          if (variant) {
            args.push(variant)
          }
        }
      }

      // Add verbose flag if requested
      if (settings.verbose) {
        args.push('-v')
      }

      await this.execUtil.exec(portBinary, args, {silent: false})
      core.info(`Port ${port.name} installed successfully`)
    }
  }
}
