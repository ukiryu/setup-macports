import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import type { IMacPortsSettings } from "../models/settings";
import type { IExecUtil } from "../utils/exec";

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
    core.info("Downloading MacPorts installer...");

    // Download the PKG
    const pkgPath = await tc.downloadTool(packageUrl);
    core.info(`Downloaded to: ${pkgPath}`);

    core.info("Installing MacPorts...");

    // Create prefix directory
    await io.mkdirP(settings.prefix);

    // Run the installer with sudo
    await this.execUtil.execSudo(
      "installer",
      ["-pkg", pkgPath, "-target", "/"],
      {
        silent: false,
      }
    );

    core.info("MacPorts installed successfully");

    // Fix ownership to current user
    core.info("Fixing ownership...");
    await this.execUtil.execSudo(
      "chown",
      ["-R", process.env.USER || "nobody", settings.prefix],
      { silent: true }
    );

    // Clean up downloaded PKG
    core.debug(`Cleaning up: ${pkgPath}`);
    await io.rmRF(pkgPath);
  }
}
