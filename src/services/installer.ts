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

    // Run the installer with sudo
    // Note: The PKG installer will create /opt/local with proper permissions
    await this.execUtil.execSudo(
      "installer",
      ["-pkg", pkgPath, "-target", "/"],
      {
        silent: false,
      }
    );

    core.info("MacPorts installed successfully");

    // Fix ownership to current user (non-critical, may fail on some runners)
    const username = process.env.USER || process.env.USERNAME || "runner";
    core.debug(`Fixing ownership to ${username}...`);
    try {
      await this.execUtil.execSudo("chown", ["-R", username, settings.prefix], {
        silent: true,
      });
    } catch (err) {
      core.warning(`Failed to fix ownership: ${(err as any)?.message ?? err}`);
    }

    // Clean up downloaded PKG
    core.debug(`Cleaning up: ${pkgPath}`);
    await io.rmRF(pkgPath);
  }
}
