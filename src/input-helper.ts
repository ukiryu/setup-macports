import * as core from '@actions/core'
import * as path from 'path'
import type {
  IMacPortsSettings,
  IVariantConfig,
  IPortConfig,
  ESourcesProvider,
  ESignatureCheck
} from './models/settings'

/**
 * Parse a boolean input from GitHub Actions
 * Handles 'true', 'false', '1', '0', 'yes', 'no' (case-insensitive)
 *
 * @param input - The input string to parse
 * @returns Parsed boolean value
 */
export function parseBooleanInput(input: string): boolean {
  const value = input.trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes'
}

/**
 * Parse the variants input
 * Input format: '+variant1 +variant2 -variant3' (space-separated)
 *
 * @param input - The variants input string
 * @returns Parsed variant configuration
 */
export function parseVariantsInput(input: string): IVariantConfig {
  const variants: IVariantConfig = {select: [], deselect: []}

  if (!input || input.trim() === '') {
    return variants
  }

  const parts = input.trim().split(/\s+/)

  for (const part of parts) {
    if (!part) continue

    if (part.startsWith('+')) {
      variants.select.push(part.slice(1))
    } else if (part.startsWith('-')) {
      variants.deselect.push(part.slice(1))
    } else {
      throw new Error(
        `Invalid variant syntax: "${part}". Use +variant to enable or -variant to disable.`
      )
    }
  }

  return variants
}

/**
 * Parse the sources input
 * Input format: multiline string with one source per line
 *
 * @param input - The sources input string
 * @returns Array of source URLs
 */
export function parseSourcesInput(input: string): string[] {
  if (!input || input.trim() === '') {
    return []
  }

  return input
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
}

/**
 * Parse the install-ports input
 * Input format can be:
 * 1. JSON array: [{"name":"port","variants":"+var1 -var2"}, ...]
 * 2. Space-separated: 'port1 port2 port3'
 *
 * @param input - The install-ports input string
 * @returns Array of port configurations
 */
export function parseInstallPortsInput(input: string): IPortConfig[] {
  if (!input || input.trim() === '') {
    return []
  }

  const trimmed = input.trim()

  // Try JSON first
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((port: any) => ({
          name: port.name,
          variants: port.variants
        }))
      }
    } catch (err) {
      core.debug(`Failed to parse as JSON: ${(err as any)?.message ?? err}`)
      // Fall through to space-separated parsing
    }
  }

  // Space-separated list
  return trimmed
    .split(/\s+/)
    .filter(name => name !== '')
    .map(name => ({name}))
}

/**
 * Get and validate all inputs from the action
 *
 * @returns Promise resolving to complete MacPorts settings
 */
export async function getInputs(): Promise<IMacPortsSettings> {
  const version = core.getInput('macports-version')
  const prefix = core.getInput('installation-prefix')
  const variantsInput = core.getInput('variants')
  const sourcesInput = core.getInput('sources')
  const useGitSourcesInput = core.getInput('use-git-sources')
  const sourcesProviderInput = core.getInput('sources-provider')
  const gitRepositoryInput = core.getInput('git-repository')
  const rsyncUrlInput = core.getInput('rsync-url')
  const installPortsInput = core.getInput('install-ports')
  const prependPathInput = core.getInput('prepend-path')
  const verboseInput = core.getInput('verbose')
  const signatureCheckInput = core.getInput('signature-check')
  const skipSignatureCheckInput = core.getInput('skip-signature-check')
  const debugInput = core.getInput('debug')
  const cacheInput = core.getInput('cache')

  // Validate required inputs
  if (!version) {
    throw new Error('macports-version is required')
  }

  if (!prefix) {
    throw new Error('installation-prefix is required')
  }

  // Validate prefix
  // Check if it's an absolute path
  if (!path.isAbsolute(prefix)) {
    throw new Error(
      `installation-prefix must be an absolute path: "${prefix}"`
    )
  }

  // Check for spaces or special characters that might cause issues
  if (/\s/.test(prefix)) {
    core.warning(
      `installation-prefix contains spaces: "${prefix}". This may cause issues with MacPorts.`
    )
  }

  // Warn if using custom prefix (not /opt/local)
  if (prefix !== '/opt/local') {
    core.warning(
      `Using custom prefix: "${prefix}". This is experimental. Many MacPorts ports assume /opt/local and may not work correctly.`
    )
  }

  // Parse variants
  const variants = parseVariantsInput(variantsInput)

  // Parse sources
  const sources = parseSourcesInput(sourcesInput)

  // Parse install-ports
  const ports = parseInstallPortsInput(installPortsInput)

  // Parse boolean inputs
  const useGitSources = parseBooleanInput(useGitSourcesInput)
  const prependPath = parseBooleanInput(prependPathInput)
  const verbose = parseBooleanInput(verboseInput)
  const debug = parseBooleanInput(debugInput)
  const cache = parseBooleanInput(cacheInput)

  // Determine sources provider with backward compatibility
  // Priority: sources-provider input > use-git-sources input > default (auto)
  let sourcesProvider: ESourcesProvider
  if (sourcesProviderInput) {
    // Validate sources-provider input
    const validProviders = ['auto', 'git', 'rsync', 'custom']
    if (!validProviders.includes(sourcesProviderInput)) {
      throw new Error(
        `Invalid sources-provider: "${sourcesProviderInput}". Must be one of: ${validProviders.join(', ')}`
      )
    }
    sourcesProvider = sourcesProviderInput as ESourcesProvider
  } else if (useGitSourcesInput) {
    // Backward compatibility: use-git-sources takes precedence if explicitly set
    sourcesProvider = useGitSources ? 'git' : 'rsync'
    core.debug(
      `Converted use-git-sources="${useGitSourcesInput}" to sources-provider="${sourcesProvider}"`
    )
  } else {
    // Default to auto (use git if available, otherwise rsync)
    sourcesProvider = 'auto'
  }

  // Set defaults for git-repository and rsync-url
  const gitRepository = gitRepositoryInput || 'macports/macports-ports'
  const rsyncUrl =
    rsyncUrlInput ||
    'rsync://rsync.macports.org/macports/release/tarballs/ports.tar'

  // Parse signature-check with backward compatibility for boolean values
  let signatureCheck: ESignatureCheck
  if (signatureCheckInput === 'true' || signatureCheckInput === '1') {
    signatureCheck = 'strict'
  } else if (signatureCheckInput === 'false' || signatureCheckInput === '0') {
    signatureCheck = 'disabled'
  } else if (
    signatureCheckInput === 'strict' ||
    signatureCheckInput === 'permissive' ||
    signatureCheckInput === 'disabled'
  ) {
    signatureCheck = signatureCheckInput as ESignatureCheck
  } else {
    // Default to strict for any unrecognized value
    signatureCheck = 'strict'
  }

  // Parse skip-signature-check (space-separated package names)
  const signatureSkipPackages = skipSignatureCheckInput
    ? skipSignatureCheckInput.trim().split(/\s+/).filter(p => p !== '')
    : []

  return {
    version,
    prefix,
    variants,
    sources,
    ports,
    useGitSources,
    sourcesProvider,
    gitRepository,
    rsyncUrl,
    prependPath,
    verbose,
    signatureCheck,
    signatureSkipPackages,
    debug,
    cache
  }
}
