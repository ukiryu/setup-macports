/**
 * Platform information model
 */
export interface IPlatformInfo {
  /**
   * macOS version name (e.g., "Sequoia", "Sonoma")
   */
  version: string

  /**
   * macOS version number (e.g., "15.0", "14.5")
   */
  versionNumber: string

  /**
   * CPU architecture (arm64, x86_64)
   */
  architecture: string
}

/**
 * Platform detector interface
 */
export interface IPlatformDetector {
  /**
   * Detect platform information
   */
  detect(): Promise<IPlatformInfo>
}
