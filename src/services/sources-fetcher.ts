import * as path from "path";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";
import * as io from "@actions/io";
import type { IExecUtil } from "../utils/exec";

/**
 * Sources Fetcher Service
 *
 * Fetches the macports-ports repository via GitHub API
 */
export class SourcesFetcher {
  constructor(private execUtil: IExecUtil) {}

  /**
   * Fetch the macports-ports repository via GitHub API
   *
   * Downloads the repository as a tarball and extracts it to the target directory.
   *
   * @param targetDir - Target directory for the repository
   * @param ref - Git ref to fetch (default: 'master')
   * @returns Path to the extracted repository
   */
  async fetch(targetDir: string, ref: string = "master"): Promise<string> {
    const owner = "macports";
    const repo = "macports-ports";

    core.info(`Fetching ${owner}/${repo} from GitHub...`);

    try {
      // Download using tool-cache (handles retries, temp files)
      const downloadUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${ref}.tar.gz`;
      core.debug(`Download URL: ${downloadUrl}`);

      const tarballPath = await tc.downloadTool(downloadUrl);

      core.debug(`Downloaded to: ${tarballPath}`);

      // Extract to temp directory
      const tempDir = await tc.extractTar(tarballPath);

      // The extracted directory will be named like 'macports-ports-master'
      // Find the actual extracted directory by checking for entries starting with the repo name
      const fs = await import("fs/promises");
      const entries = await fs.readdir(tempDir);
      const extractedDir = entries.find(e => e.startsWith(`${repo}-`));

      if (!extractedDir) {
        throw new Error(`Could not find extracted directory in ${tempDir}`);
      }

      const sourcePath = path.join(tempDir, extractedDir);
      const finalPath = path.join(targetDir, repo);

      core.debug(`Source path: ${sourcePath}`);
      core.debug(`Final path: ${finalPath}`);

      // Create target directory
      await io.mkdirP(targetDir);

      // Move to final location
      core.debug(`Moving ${sourcePath} to ${finalPath}`);
      await io.mv(sourcePath, finalPath);

      // Clean up temp directory
      core.debug(`Cleaning up temp directory: ${tempDir}`);
      await io.rmRF(tempDir);

      core.info(`Successfully fetched ${owner}/${repo} to ${finalPath}`);

      return finalPath;
    } catch (error) {
      const err = error as any;
      core.error(`Failed to fetch ${owner}/${repo}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Initialize the PortIndex for local sources
   *
   * After fetching macports-ports, we need to run 'port index' to generate
   * the PortIndex file that MacPorts uses for port discovery.
   *
   * @param portsPath - Path to the ports directory
   * @param portBinary - Path to the port command
   */
  async initializePortIndex(
    portsPath: string,
    portBinary: string
  ): Promise<void> {
    core.info(`Initializing PortIndex for ${portsPath}...`);

    try {
      await this.execUtil.exec(portBinary, ["index", portsPath], {
        silent: false,
      });

      core.info(`PortIndex initialized successfully`);
    } catch (error) {
      const err = error as any;
      core.warning(`Failed to initialize PortIndex: ${err.message}`);
      // This is not a fatal error - MacPorts will regenerate it on sync
    }
  }
}
