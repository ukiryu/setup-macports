/**
 * Configuration information for MacPorts setup
 *
 * Contains paths and values of all configuration files
 * set during the MacPorts installation process.
 */
export interface IConfigurationInfo {
  /**
   * Path to the variants.conf file
   */
  variantsConfPath: string

  /**
   * Path to the sources.conf file
   */
  sourcesConfPath: string

  /**
   * Path to the ports.conf file
   */
  portsConfPath: string

  /**
   * Path to the macports.conf file
   */
  macportsConfPath: string

  /**
   * Configured variants (as they appear in variants.conf)
   */
  configuredVariants: string

  /**
   * Configured sources URLs (as they appear in sources.conf)
   */
  configuredSources: string

  /**
   * Git source path (if using git sources)
   */
  gitSourcePath: string

  /**
   * Rsync source URLs (if using rsync sources)
   */
  rsyncSourceUrls: string
}
