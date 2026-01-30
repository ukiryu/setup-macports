import * as core from '@actions/core'
import * as exec from '@actions/exec'

/**
 * Options for command execution
 */
export interface IExecOptions {
  /**
   * Whether to ignore non-zero exit codes
   */
  ignoreReturnCode?: boolean

  /**
   * Whether to run command silently (no output to console)
   */
  silent?: boolean

  /**
   * Working directory for the command
   */
  cwd?: string

  /**
   * Log level for stderr output ('error', 'warning', 'info', 'debug')
   * Default is 'error'
   */
  stderrLogLevel?: 'error' | 'warning' | 'info' | 'debug'
}

/**
 * Result of command execution with captured output
 */
export interface IExecResult {
  /**
   * Exit code (0 for success)
   */
  exitCode: number

  /**
   * Standard output
   */
  stdout: string

  /**
   * Standard error
   */
  stderr: string
}

/**
 * Execution Utility Interface
 */
export interface IExecUtil {
  exec(
    command: string,
    args?: string[],
    options?: IExecOptions
  ): Promise<IExecResult>
  execSudo(
    command: string,
    args?: string[],
    options?: IExecOptions
  ): Promise<IExecResult>
}

/**
 * Execution Utility Class
 *
 * Wraps @actions/exec with additional functionality
 */
export class ExecUtil implements IExecUtil {
  /**
   * Execute a command and optionally capture output
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Promise resolving to exec result with exit code and captured output
   */
  async exec(
    command: string,
    args: string[] = [],
    options: IExecOptions = {}
  ): Promise<IExecResult> {
    const {
      silent = false,
      ignoreReturnCode = false,
      stderrLogLevel = 'error',
      ...execOptions
    } = options

    core.debug(`Executing: ${command} ${args.join(' ')}`)

    let stdout = ''
    let stderr = ''

    // Helper function to log stderr at the specified level
    const logStderr = (message: string) => {
      switch (stderrLogLevel) {
        case 'error':
          core.error(message)
          break
        case 'warning':
          core.warning(message)
          break
        case 'info':
          core.info(message)
          break
        case 'debug':
          core.debug(message)
          break
      }
    }

    const listeners: exec.ExecListeners = {
      stdout: (data: Buffer) => {
        const text = data.toString()
        stdout += text
        if (!silent) {
          core.info(text.trim())
        }
      },
      stderr: (data: Buffer) => {
        const text = data.toString()
        stderr += text
        if (!silent) {
          logStderr(text.trim())
        }
      }
    }

    try {
      const exitCode = await exec.exec(command, args, {
        ...execOptions,
        silent,
        ignoreReturnCode,
        listeners
      })

      return {exitCode: exitCode || 0, stdout, stderr}
    } catch (err) {
      const error = err as any
      core.debug(`Command failed: ${error.message}`)
      return {exitCode: error.exitCode || 1, stdout, stderr}
    }
  }

  /**
   * Execute a command with sudo
   *
   * @param command - Command to execute (without 'sudo')
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Promise resolving to exec result
   */
  async execSudo(
    command: string,
    args: string[] = [],
    options: IExecOptions = {}
  ): Promise<IExecResult> {
    // Use -n flag for non-interactive mode (fails if password required)
    return this.exec('sudo', ['-n', command, ...args], options)
  }

  /**
   * Execute a command and capture its output (silent mode)
   *
   * @param command - Command to execute
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Promise resolving to captured stdout
   * @throws Error if command fails
   */
  async capture(
    command: string,
    args: string[] = [],
    options: IExecOptions = {}
  ): Promise<string> {
    const result = await this.exec(command, args, {
      ...options,
      silent: true
    })

    if (result.exitCode !== 0) {
      throw new Error(
        `Command failed with exit code ${result.exitCode}: ${result.stderr || result.stdout}`
      )
    }

    return result.stdout.trim()
  }
}
