import {VersionResolver} from '../src/services/version-resolver'
import {getOctokit} from '@actions/github'

// Mock the GitHub module
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn()
}))

describe('VersionResolver', () => {
  let resolver: VersionResolver
  let mockOctokit: any
  let mockListReleases: jest.Mock

  beforeEach(() => {
    resolver = new VersionResolver()

    // Setup mock octokit
    mockListReleases = jest.fn()
    mockOctokit = {
      rest: {
        repos: {
          listReleases: mockListReleases
        }
      }
    }
    ;(getOctokit as jest.Mock).mockReturnValue(mockOctokit)
  })

  const createMockRelease = (
    tag: string,
    prerelease: boolean,
    publishedAt: string
  ) => ({
    tag_name: tag,
    prerelease,
    html_url: `https://github.com/macports/macports-base/releases/tag/${tag}`,
    published_at: publishedAt
  })

  describe('resolve', () => {
    it('returns explicit version as-is', async () => {
      const result = await resolver.resolve('2.11.5')

      expect(result).toEqual({
        version: '2.11.5',
        wasLatest: false,
        originalInput: '2.11.5'
      })
      expect(mockListReleases).not.toHaveBeenCalled()
    })

    it('resolves latest to latest stable version', async () => {
      mockListReleases.mockResolvedValue({
        data: [
          createMockRelease('v2.12.0-rc1', true, '2025-01-01T00:00:00Z'),
          createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z'),
          createMockRelease('v2.11.4', false, '2024-11-01T00:00:00Z')
        ]
      })

      const result = await resolver.resolve('latest')

      expect(result).toEqual({
        version: '2.11.5',
        wasLatest: true,
        originalInput: 'latest'
      })
      expect(mockListReleases).toHaveBeenCalledWith({
        owner: 'macports',
        repo: 'macports-base',
        per_page: 100
      })
    })

    it('excludes RC versions from latest resolution', async () => {
      mockListReleases.mockResolvedValue({
        data: [
          createMockRelease('v2.12.0-rc1', true, '2025-01-01T00:00:00Z'),
          createMockRelease('v2.12.0-beta1', false, '2024-12-15T00:00:00Z'),
          createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z')
        ]
      })

      const result = await resolver.resolve('latest')

      expect(result.version).toBe('2.11.5')
    })

    it('excludes beta versions via regex pattern', async () => {
      mockListReleases.mockResolvedValue({
        data: [
          createMockRelease('v2.12.0-beta1', false, '2025-01-01T00:00:00Z'),
          createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z')
        ]
      })

      const result = await resolver.resolve('latest')

      expect(result.version).toBe('2.11.5')
    })

    it('excludes alpha versions via regex pattern', async () => {
      mockListReleases.mockResolvedValue({
        data: [
          createMockRelease('v2.12.0-alpha1', false, '2025-01-01T00:00:00Z'),
          createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z')
        ]
      })

      const result = await resolver.resolve('latest')

      expect(result.version).toBe('2.11.5')
    })

    it('uses fallback when no stable releases available', async () => {
      mockListReleases.mockResolvedValue({
        data: [
          createMockRelease('v2.12.0-rc1', true, '2025-01-01T00:00:00Z'),
          createMockRelease('v2.12.0-beta1', false, '2024-12-15T00:00:00Z')
        ]
      })

      const result = await resolver.resolve('latest')

      expect(result).toEqual({
        version: '2.12.0',
        wasLatest: true,
        originalInput: 'latest'
      })
    })

    it('uses fallback when GitHub API fails', async () => {
      mockListReleases.mockRejectedValue(new Error('Network error'))

      const result = await resolver.resolve('latest')

      expect(result).toEqual({
        version: '2.12.0',
        wasLatest: true,
        originalInput: 'latest'
      })
    })

    it('handles case-insensitive "latest" input', async () => {
      mockListReleases.mockResolvedValue({
        data: [createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z')]
      })

      const result = await resolver.resolve('LATEST')

      expect(result.wasLatest).toBe(true)
      expect(result.version).toBe('2.11.5')
    })

    it('handles case-insensitive "Latest" input', async () => {
      mockListReleases.mockResolvedValue({
        data: [createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z')]
      })

      const result = await resolver.resolve('Latest')

      expect(result.wasLatest).toBe(true)
      expect(result.version).toBe('2.11.5')
    })

    it('returns most recent stable by publish date', async () => {
      mockListReleases.mockResolvedValue({
        data: [
          createMockRelease('v2.11.3', false, '2024-10-01T00:00:00Z'),
          createMockRelease('v2.11.5', false, '2024-12-01T00:00:00Z'),
          createMockRelease('v2.11.4', false, '2024-11-01T00:00:00Z')
        ]
      })

      const result = await resolver.resolve('latest')

      expect(result.version).toBe('2.11.5')
    })
  })
})
