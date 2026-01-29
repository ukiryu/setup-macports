/**
 * Complete MacPorts settings
 */
export interface IMacPortsSettings {
  /**
   * MacPorts version to install
   */
  version: string

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
   * Use git sources from GitHub API
   */
  useGitSources: boolean

  /**
   * Add MacPorts to PATH
   */
  prependPath: boolean

  /**
   * Enable verbose output
   */
  verbose: boolean

  /**
   * Verify package signatures
   */
  signatureCheck: boolean

  /**
   * Enable debug logging
   */
  debug: boolean

  /**
   * Enable caching of MacPorts installation
   */
  cache: boolean
}

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
