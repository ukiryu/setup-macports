/**
 * Ports Installer Service Tests
 *
 * Tests for the PortsInstaller class that handles port installation
 * with signature bypass support.
 */

import {describe, it, expect, beforeEach, vi, type Mock} from 'vitest'
import {PortsInstaller} from '../src/services/ports-installer'
import type {IMacPortsSettings} from '../src/models/settings'
import type {IExecUtil} from '../src/utils/exec'

describe('PortsInstaller', () => {
  let mockExecUtil: IExecUtil
  let execMock: Mock
  let installer: PortsInstaller

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock exec utility that returns successful result
    execMock = vi.fn().mockResolvedValue({exitCode: 0, stdout: '', stderr: ''})
    mockExecUtil = {
      exec: execMock,
      execSudo: vi.fn().mockResolvedValue({exitCode: 0, stdout: '', stderr: ''})
    }

    installer = new PortsInstaller(mockExecUtil)
  })

  describe('basic installation', () => {
    it('should install a port with correct arguments', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'git-lfs'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'strict',
        signatureSkipPackages: [],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledTimes(1)
      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['install', 'git-lfs'],
        {silent: false}
      )
    })

    it('should install multiple ports in sequence', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'git-lfs'}, {name: 'rsync'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'strict',
        signatureSkipPackages: [],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledTimes(2)
      expect(execMock).toHaveBeenNthCalledWith(
        1,
        '/opt/local/bin/port',
        ['install', 'git-lfs'],
        {silent: false}
      )
      expect(execMock).toHaveBeenNthCalledWith(
        2,
        '/opt/local/bin/port',
        ['install', 'rsync'],
        {silent: false}
      )
    })
  })

  describe('variants handling', () => {
    it('should append variants to install command', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'python312', variants: '+tcl +universal'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'strict',
        signatureSkipPackages: [],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['install', 'python312', '+tcl', '+universal'],
        {silent: false}
      )
    })

    it('should handle variants with extra whitespace', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'python312', variants: '  +tcl   +universal  '}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'strict',
        signatureSkipPackages: [],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['install', 'python312', '+tcl', '+universal'],
        {silent: false}
      )
    })
  })

  describe('verbose mode', () => {
    it('should add -v flag when verbose is enabled', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'git-lfs'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: true,
        signatureCheck: 'strict',
        signatureSkipPackages: [],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['-v', 'install', 'git-lfs'],
        {silent: false}
      )
    })
  })

  describe('signature bypass (force flag)', () => {
    it('should add -f flag for packages in signatureSkipPackages', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'gdk-pixbuf2'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'permissive',
        signatureSkipPackages: ['gdk-pixbuf2'],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['-f', 'install', 'gdk-pixbuf2'],
        {silent: false}
      )
    })

    it('should NOT add -f flag for packages NOT in signatureSkipPackages', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'git-lfs'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'permissive',
        signatureSkipPackages: ['gdk-pixbuf2', 'boehmgc'],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      // git-lfs is NOT in skip list, so no -f flag
      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['install', 'git-lfs'],
        {silent: false}
      )
    })

    it('should handle multiple ports with mixed skip status', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'gdk-pixbuf2'}, {name: 'git-lfs'}, {name: 'boehmgc'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'permissive',
        signatureSkipPackages: ['gdk-pixbuf2', 'boehmgc'],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledTimes(3)

      // gdk-pixbuf2 is in skip list → -f flag
      expect(execMock).toHaveBeenNthCalledWith(
        1,
        '/opt/local/bin/port',
        ['-f', 'install', 'gdk-pixbuf2'],
        {silent: false}
      )

      // git-lfs is NOT in skip list → no -f flag
      expect(execMock).toHaveBeenNthCalledWith(
        2,
        '/opt/local/bin/port',
        ['install', 'git-lfs'],
        {silent: false}
      )

      // boehmgc is in skip list → -f flag
      expect(execMock).toHaveBeenNthCalledWith(
        3,
        '/opt/local/bin/port',
        ['-f', 'install', 'boehmgc'],
        {silent: false}
      )
    })

    it('should combine -f and -v flags when both are needed', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'gdk-pixbuf2'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: true,
        signatureCheck: 'permissive',
        signatureSkipPackages: ['gdk-pixbuf2'],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      // Both -f (force) and -v (verbose) should be present
      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['-f', '-v', 'install', 'gdk-pixbuf2'],
        {silent: false}
      )
    })

    it('should combine force flag with variants', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'gdk-pixbuf2', variants: '+x11'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'permissive',
        signatureSkipPackages: ['gdk-pixbuf2'],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['-f', 'install', 'gdk-pixbuf2', '+x11'],
        {silent: false}
      )
    })

    it('should handle empty signatureSkipPackages array', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/local',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'git-lfs'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'permissive',
        signatureSkipPackages: [], // Empty array
        debug: false,
        cache: false
      }

      await installer.install(settings)

      // No packages to skip, so no -f flag
      expect(execMock).toHaveBeenCalledWith(
        '/opt/local/bin/port',
        ['install', 'git-lfs'],
        {silent: false}
      )
    })
  })

  describe('custom prefix', () => {
    it('should use custom prefix for port binary path', async () => {
      const settings: IMacPortsSettings = {
        version: '2.11.5',
        prefix: '/opt/custom',
        variants: {select: [], deselect: []},
        sources: [],
        ports: [{name: 'git-lfs'}],
        sourcesProvider: 'auto',
        gitRepository: 'macports/macports-ports',
        rsyncUrl:
          'rsync://rsync.macports.org/macports/release/tarballs/ports.tar',
        prependPath: true,
        verbose: false,
        signatureCheck: 'strict',
        signatureSkipPackages: [],
        debug: false,
        cache: false
      }

      await installer.install(settings)

      expect(execMock).toHaveBeenCalledWith(
        '/opt/custom/bin/port',
        ['install', 'git-lfs'],
        {silent: false}
      )
    })
  })
})
