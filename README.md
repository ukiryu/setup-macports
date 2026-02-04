# Setup MacPorts

[![build](https://github.com/ukiryu/setup-macports/workflows/test.yml/badge.svg)](https://github.com/ukiryu/setup-macports/actions/workflows/test.yml)

This action installs and configures [MacPorts](https://www.macports.org/) on macOS runners.

> **Note:** This action only supports macOS runners. MacPorts depends on the
> official PKG installer which is macOS-specific. Using this action on other
> platforms (ubuntu-latest, windows-latest) will fail with a clear error
> message.

## What's new

- Improved caching support with automatic cache key generation
- Flexible port sources: git (via GitHub API), rsync, or custom sources
- Full TypeScript rewrite with comprehensive unit and integration tests
- Support for all current macOS versions: Sonoma (14), Sequoia (15), Tahoe (26)
- Support for both ARM64 (Apple Silicon) and Intel (x86_64) architectures

## Usage

<!-- start usage -->
```yaml
- uses: ukiryu/setup-macports@v1
  with:
    # MacPorts version to install. Use 'latest' for the latest stable release,
    # or specify a version (e.g., 2.11.6, 2.10.0, 2.12.0-rc1)
    # Default: latest
    macports-version: 'latest'

    # Cache MacPorts installation for faster subsequent runs.
    # Cache key format: macports-{version}-{arch}-{platform}
    # Example: macports-2.11.6-arm64-15
    # Default: true
    cache: 'true'

    # Global variants to configure. Use +variant to enable, -variant to disable.
    # Space-separated. Example: '+aqua +metal -x11'
    # Matches MacPorts variants.conf syntax.
    # Default: ''
    variants: ''

    # Custom port sources (one per line). First entry marked as [default].
    # Defaults to MacPorts rsync if not specified.
    # Example: 'file:///path/to/ports [default]'
    # Default: ''
    sources: ''

    # Port sources provider. Options:
    # - 'auto': Automatically choose (uses git if available, otherwise rsync)
    # - 'git': Use git sources from GitHub
    # - 'rsync': Use rsync sources
    # - 'custom': Use custom sources from 'sources' input
    # Default: git
    sources-provider: 'git'

    # Git repository for sources (for 'git' provider).
    # Format: 'owner/repo' or full git URL.
    # Default: 'macports/macports-ports'
    git-repository: 'macports/macports-ports'

    # Git ref to fetch (branch, tag, or commit).
    # Examples: 'master', 'main', 'develop', 'v2.11.0'
    # Default: master
    git-ref: 'master'

    # Rsync URL for ports archive (for 'rsync' provider).
    # Default: MacPorts official rsync URL
    rsync-url: 'rsync://rsync.macports.org/macports/release/tarballs/ports.tar'

    # GitHub token for API authentication. Used for fetching latest version
    # and git sources to avoid rate limits. Defaults to GITHUB_TOKEN.
    # Set to empty string to use unauthenticated requests (rate limited).
    # Default: ${{ github.token }}
    github-token: ${{ github.token }}

    # Ports to install after MacPorts is set up.
    # Simple (space-separated): 'git curl wget'
    # With variants (JSON array): '[{"name":"db48","variants":"+tcl +universal -java"}]'
    # Default: ''
    install-ports: ''

    # Add MacPorts bin directories to PATH
    # Default: true
    prepend-path: 'true'

    # Enable verbose output for port operations
    # Default: false
    verbose: 'false'

    # Signature verification mode. Options:
    # - 'strict': Verify all package signatures (default)
    # - 'permissive': Allow skipping signatures for specified packages
    # - 'disabled': Skip all signature checks
    # Default: strict
    signature-check: 'strict'

    # Packages or patterns to skip signature verification (for 'permissive' mode).
    # Space-separated list of package names.
    # Default: ''
    skip-signature-check: ''

    # Enable debug logging for troubleshooting
    # Default: false
    debug: 'false'
```
<!-- end usage -->

### Scenarios

#### Use default settings (recommended)

```yaml
- uses: ukiryu/setup-macports@v1
  # Caching is enabled by default!
  # Uses git sources from macports/macports-ports
```

### Port Sources Providers

The action supports multiple ways to fetch the MacPorts ports tree:

| Provider | Description | Use Case |
|----------|-------------|----------|
| `git` | Fetches via GitHub API, then clones with git | Faster, cached by GitHub, default |
| `rsync` | Downloads tarball via rsync | Traditional method |
| `auto` | Chooses git if available, otherwise rsync | Automatic fallback |
| `custom` | Use your own sources from `sources` input | Local or custom sources |

**Git sources (default):**
- Uses GitHub API to fetch repository information (avoiding rate limits with `github-token`)
- Clones the ports tree using git
- Faster than rsync for most cases
- Default provider: `sources-provider: 'git'`

**Rsync sources:**
- Downloads the official MacPorts ports tarball
- Traditional, reliable method
- Use `sources-provider: 'rsync'`

#### Install a specific version

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    macports-version: '2.10.0'
```

#### Configure global variants

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    variants: '+aqua +metal -x11'
```

#### Install specific ports

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    install-ports: 'git curl wget'
```

#### Install ports with variants

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    install-ports: >-
      [
        {"name":"db48","variants":"+tcl +universal -java"},
        {"name":"gmp","variants":"+native"},
        {"name":"curl"}
      ]
```

#### Use custom git repository or branch

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    git-repository: 'myuser/macports-ports-fork'
    git-ref: 'feature-xyz'  # or 'main', 'develop', 'v2.11.0', etc.
```

#### Use default rsync sources

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    sources-provider: 'rsync'
```

#### Use custom rsync URL

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    sources-provider: 'rsync'
    rsync-url: 'rsync://mirror.example.com/macports/release/tarballs/ports.tar'
```

#### Add additional sources alongside git/remote sources

When using git or rsync sources, you can add additional local sources. The primary
source (git or rsync) will be marked `[default]` automatically:

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    sources-provider: 'git'
    sources: >-
      file:///path/to/local/ports
      file:///another/local/sources
```

**Important:** The git/rsync source is automatically marked as `[default]`. Any additional
sources you specify are added as secondary sources. Do not mark any of your custom sources
as `[default]` or it will conflict with the primary source.

#### Disable caching

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    cache: 'false'
```

### Caching

The action has built-in caching enabled by default. The cache key is
automatically generated using the format:

```
macports-{version}-{architecture}-{platform-major}
```

**Examples:**
- `macports-2.11.6-arm64-15` (macOS 15 Sequoia, ARM64)
- `macports-2.11.6-x86_64-14` (macOS 14 Sonoma, Intel)
- `macports-latest-arm64-15` (when using `macports-version: 'latest'`, resolves to actual version)

The cache stores the entire MacPorts installation at the specified prefix (default: `/opt/local`).

**Built-in caching is enabled by default:**

```yaml
- uses: ukiryu/setup-macports@v1
  # No cache input needed - caching is automatic!
```

**Disable caching if needed:**

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    cache: 'false'
```

**Note:** You do NOT need to add separate `actions/cache` steps. The action
handles caching internally with automatic cache key generation based on version,
architecture, and platform.

### Permissions

The action needs minimal permissions:

```yaml
permissions:
  contents: read
```

**Note:** The `packages: write` permission is NOT required for installing
MacPorts ports. That permission is for publishing to GitHub Packages registry.
Installing MacPorts ports does not interact with GitHub Packages.

#### GitHub Token for API Calls

The action uses the GitHub API to:
- Fetch the latest MacPorts version when `macports-version: 'latest'` is used
- Fetch git sources from GitHub repositories

By default, the action uses `${{ github.token }}` for authenticated requests.
This provides higher rate limits and avoids throttling.

If you experience rate limiting issues, you can explicitly pass a token:

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    github-token: ${{ github.token }}
```

To use unauthenticated requests (not recommended due to rate limits):

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    github-token: ''
```

If your workflow performs other GitHub operations (pushing commits, creating
releases, etc.), add the appropriate permissions for those operations.

## Outputs

| Name | Description |
|------|-------------|
| `version` | The MacPorts version installed |
| `prefix` | The installation prefix path |
| `package-url` | URL of the installer package used |
| `cache-key` | Cache key for this installation |
| `cache-hit` | Whether the cache was hit (only when `cache: true`) |
| `uses-git-sources` | Whether git sources were configured |
| `variants-conf-path` | Path to the variants.conf file |
| `sources-conf-path` | Path to the sources.conf file |
| `ports-conf-path` | Path to the ports.conf file |
| `macports-conf-path` | Path to the macports.conf file |
| `configured-variants` | Configured variants (as they appear in variants.conf) |
| `configured-sources` | Configured sources (as they appear in sources.conf) |
| `git-source-path` | Path to local git sources (only when using git sources) |
| `rsync-source-urls` | Rsync source URL (only when using rsync sources) |

## Platform Support

This action supports the following macOS runners:

| Runner | Version | Architecture |
|--------|---------|--------------|
| `macos-14` | Sonoma | ARM64 |
| `macos-15` | Sequoia | ARM64 |
| `macos-15-intel` | Sequoia | Intel x86_64 |
| `macos-26` | Tahoe | ARM64 |

## Acknowledgements

The original implementation was inspired by
[melusina-org/setup-macports](https://github.com/melusina-org/setup-macports).

## Copyright and license

Copyright Ribose.

The scripts and documentation in this project are released under the
[MIT License](LICENSE).
