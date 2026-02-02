import * as core from '@actions/core'
import {getOctokit} from '@actions/github'
import type {IMacPortsRelease, IVersionResolution} from '../models/version-info'

/**
 * Version Resolver Service
 *
 * Resolves 'latest' version to the actual latest stable MacPorts release
 * from the macports/macports-base GitHub repository.
 */
export class VersionResolver {
  private readonly owner = 'macports'
  private readonly repo = 'macports-base'
  private readonly fallbackVersion = '2.12.0'
  private readonly githubToken: string

  constructor(githubToken?: string) {
    this.githubToken = githubToken || process.env.GITHUB_TOKEN || ''
  }

  /**
   * Fetch releases from GitHub repository with retry
   */
  private async fetchReleases(): Promise<IMacPortsRelease[]> {
    const octokit = getOctokit(this.githubToken)
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const releases = await octokit.rest.repos.listReleases({
          owner: this.owner,
          repo: this.repo,
          per_page: 100
        })
        return releases.data.map(release => ({
          tag: release.tag_name,
          version: release.tag_name.replace(/^v/, ''),
          isPrerelease:
            release.prerelease || /-?(rc|beta|alpha)/i.test(release.tag_name),
          url: release.html_url,
          publishedAt: release.published_at || ''
        }))
      } catch (error) {
        lastError = error as Error
        if (attempt < maxRetries) {
          core.info(
            `Retry ${attempt}/${maxRetries} fetching releases: ${lastError.message}`
          )
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }
    throw lastError
  }

  /**
   * Find the latest stable release from a list of releases
   */
  private findLatestStable(
    releases: IMacPortsRelease[]
  ): IMacPortsRelease | null {
    const stableReleases = releases.filter(r => !r.isPrerelease)
    if (stableReleases.length === 0) return null
    stableReleases.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    )
    return stableReleases[0]
  }

  /**
   * Resolve version input to actual version number
   *
   * If input is 'latest', fetches from GitHub API and returns the latest stable version
   * Otherwise, returns the input as-is
   */
  async resolve(input: string): Promise<IVersionResolution> {
    if (input.toLowerCase() !== 'latest') {
      return {version: input, wasLatest: false, originalInput: input}
    }

    core.info('Resolving "latest" MacPorts version from GitHub...')
    try {
      const releases = await this.fetchReleases()
      const latestStable = this.findLatestStable(releases)

      if (!latestStable) {
        core.warning('No stable releases found, using fallback version')
        return {
          version: this.fallbackVersion,
          wasLatest: true,
          originalInput: input
        }
      }

      core.info(`Resolved "latest" to version: ${latestStable.version}`)
      return {
        version: latestStable.version,
        wasLatest: true,
        originalInput: input
      }
    } catch (error) {
      core.warning(
        `Failed to resolve latest version: ${(error as any)?.message ?? error}`
      )
      core.warning(`Using fallback version: ${this.fallbackVersion}`)
      return {
        version: this.fallbackVersion,
        wasLatest: true,
        originalInput: input
      }
    }
  }
}
