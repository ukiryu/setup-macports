import * as path from 'path'
import * as core from '@actions/core'
import * as io from '@actions/io'
import * as fs from 'fs'
import * as fsPromises from 'fs/promises'
import type {IExecUtil} from '../utils/exec'

/**
 * Sources Fetcher Service
 *
 * Clones the macports-ports repository using git (same approach as actions/checkout)
 */
export class SourcesFetcher {
  constructor(private execUtil: IExecUtil) {}

  /**
   * Clone the macports-ports repository using git fetch
   *
   * Uses the same approach as actions/checkout:
   * 1. git init
   * 2. git remote add origin <url>
   * 3. git fetch --depth=1 origin <ref>
   * 4. git checkout -b <ref> origin/<ref>
   *
   * @param targetDir - Target directory for the repository
   * @param repository - Git repository in format 'owner/repo' or full URL
   * @param ref - Git ref to fetch (default: 'master')
   * @returns Path to the cloned repository
   */
  async fetch(
    targetDir: string,
    repository: string,
    ref: string = 'master'
  ): Promise<string> {
    // repository is in format 'owner/repo' or full URL
    let repoUrl: string
    let owner: string
    let repo: string

    if (repository.includes('/')) {
      // Format: 'owner/repo' - assume GitHub
      const [ownerName, repoName] = repository.split('/')
      owner = ownerName
      repo = repoName
      repoUrl = `https://github.com/${ownerName}/${repoName}.git`
    } else if (
      repository.startsWith('https://') ||
      repository.startsWith('git@')
    ) {
      // Full URL - use as-is
      repoUrl = repository

      // Try to extract owner/repo from URL for directory structure
      // Only treat as GitHub if the hostname is actually github.com
      let isGithub = false

      if (repository.startsWith('https://')) {
        try {
          const parsed = new URL(repository)
          // Only exact hostname match - no spoofing allowed
          if (parsed.hostname === 'github.com') {
            isGithub = true
          }
        } catch {
          // If URL parsing fails, treat as non-GitHub
          isGithub = false
        }
      } else if (repository.startsWith('git@github.com:')) {
        // SSH URL - check exact prefix to prevent spoofing
        isGithub = true
      }

      if (isGithub) {
        const match = repository.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
        if (match) {
          owner = match[1]
          repo = match[2]
        } else {
          owner = 'custom'
          repo = 'repository'
        }
      } else {
        owner = 'custom'
        repo = 'repository'
      }
    } else {
      throw new Error(
        `Invalid git repository format: "${repository}". Expected 'owner/repo' or full URL.`
      )
    }

    core.info(`Fetching ${owner}/${repo} from GitHub (depth 1, ref: ${ref})...`)

    try {
      await fsPromises.mkdir(targetDir, {recursive: true})

      const finalPath = path.join(targetDir, repo)

      // Remove existing directory if present
      if (fs.existsSync(finalPath)) {
        core.debug(`Removing existing directory: ${finalPath}`)
        await io.rmRF(finalPath)
      }

      // Create directory
      await fsPromises.mkdir(finalPath, {recursive: true})

      // Initialize repository (same as actions/checkout)
      core.debug(`git init ${finalPath}`)
      await this.execUtil.exec('git', ['init', finalPath], {silent: true})

      // Add remote
      core.debug(`git remote add origin ${repoUrl}`)
      await this.execUtil.exec('git', ['remote', 'add', 'origin', repoUrl], {
        silent: true,
        cwd: finalPath
      })

      // Fetch with depth 1 (same as actions/checkout)
      core.debug(`git fetch --depth=1 origin ${ref}`)
      await this.execUtil.exec('git', ['fetch', '--depth=1', 'origin', ref], {
        silent: false,
        cwd: finalPath,
        stderrLogLevel: 'info' // Git writes status to stderr, log as info instead of error
      })

      // Create and checkout local branch (not detached HEAD)
      core.debug(`git checkout -b ${ref} origin/${ref}`)
      await this.execUtil.exec(
        'git',
        ['checkout', '-b', ref, `origin/${ref}`],
        {
          silent: true,
          cwd: finalPath
        }
      )

      core.info(`Successfully fetched ${owner}/${repo} to ${finalPath}`)

      return finalPath
    } catch (error) {
      const err = error as any
      core.error(`Failed to fetch ${owner}/${repo}: ${err.message}`)
      throw err
    }
  }

  /**
   * Initialize the PortIndex for local git sources
   *
   * After cloning macports-ports, we need to run 'port index' to generate
   * the PortIndex file that MacPorts uses for port discovery.
   *
   * @param portsPath - Path to the ports directory
   * @param portBinary - Path to the port command
   */
  async initializePortIndex(
    portsPath: string,
    portBinary: string
  ): Promise<void> {
    core.info(`Initializing PortIndex for ${portsPath}...`)

    try {
      await this.execUtil.exec(portBinary, ['index', portsPath], {
        silent: false
      })

      core.info(`PortIndex initialized successfully`)
    } catch (error) {
      const err = error as any
      core.warning(`Failed to initialize PortIndex: ${err.message}`)
      // This is not a fatal error - MacPorts will regenerate it on sync
    }
  }
}
