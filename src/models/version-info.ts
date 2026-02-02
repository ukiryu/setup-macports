/**
 * Version information for MacPorts releases
 */
export interface IMacPortsRelease {
  tag: string
  version: string
  isPrerelease: boolean
  url: string
  publishedAt: string
}

/**
 * Result of version resolution
 */
export interface IVersionResolution {
  version: string
  wasLatest: boolean
  originalInput: string
}
