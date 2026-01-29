import type { IPlatformInfo } from "./platform-info";

// Re-export IPlatformInfo for convenience
export type { IPlatformInfo } from "./platform-info";

/**
 * MacPorts installation information
 */
export interface IMacPortsInstallInfo {
  /**
   * The MacPorts version being installed
   */
  version: string;

  /**
   * The installation prefix
   */
  prefix: string;

  /**
   * URL of the installer package
   */
  packageUrl: string;

  /**
   * Platform information
   */
  platform: IPlatformInfo;

  /**
   * Whether git sources are being used
   */
  usesGitSources: boolean;

  /**
   * Cache key for this installation
   */
  cacheKey: string;
}
