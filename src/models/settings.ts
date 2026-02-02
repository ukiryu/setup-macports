/**
 * Complete MacPorts settings
 */
export interface IMacPortsSettings {
  /**
   * MacPorts version to install
   */
  version: string

  /**
   * Resolved version (after 'latest' is resolved to actual version)
   * Only present when version input was 'latest'
   */
  resolvedVersion?: string

  /**
   * Installation prefix path
   */
  prefix: string

  /**
   * Variant configuration
   */
  variants: IVariantConfig

  /**
   * Custom sources URLs
   */
  sources: string[]

  /**
   * Ports to install
   */
  ports: IPortConfig[]

  /**
   * @deprecated Use sourcesProvider instead
   * Use git sources from GitHub API
   */
  useGitSources: boolean

  /**
   * Port sources provider (auto, git, rsync, custom)
   */
  sourcesProvider: ESourcesProvider

  /**
   * Git repository for sources (for 'git' provider)
   * Format: 'owner/repo' or full URL
   */
  gitRepository: string

  /**
   * Git ref to fetch (branch, tag, or commit)
   * Only used when sourcesProvider is 'git'
   */
  gitRef?: string

  /**
   * Rsync URL for ports archive (for 'rsync' provider)
   */
  rsyncUrl: string

  /**
   * Add MacPorts to PATH
   */
  prependPath: boolean

  /**
   * Enable verbose output
   */
  verbose: boolean

  /**
   * Signature verification mode
   * - 'strict': Verify all package signatures (default)
   * - 'permissive': Skip signatures for specified packages
   * - 'disabled': Skip all signature checks
   */
  signatureCheck: ESignatureCheck

  /**
   * Packages or patterns to skip signature verification (for permissive mode)
   * Space-separated list of package names
   */
  signatureSkipPackages: string[]

  /**
   * Enable debug logging
   */
  debug: boolean

  /**
   * Enable caching of MacPorts installation
   */
  cache: boolean

  /**
   * GitHub token for API authentication
   */
  githubToken?: string
}

/**
 * Port sources provider type
 */
export type ESourcesProvider = 'auto' | 'git' | 'rsync' | 'custom'

/**
 * Signature verification mode
 */
export type ESignatureCheck = 'strict' | 'permissive' | 'disabled'

/**
 * Variant configuration
 */
export interface IVariantConfig {
  /**
   * Selected variants (with + prefix)
   */
  select: string[]

  /**
   * Deselected variants (with - prefix)
   */
  deselect: string[]
}

/**
 * Port configuration with optional variants
 */
export interface IPortConfig {
  /**
   * Port name
   */
  name: string

  /**
   * Variants for this port (e.g., "+tcl +universal -java")
   */
  variants?: string
}
