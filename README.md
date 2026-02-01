# Setup MacPorts

[![build](https://github.com/ukiryu/setup-macports/workflows/test.yml/badge.svg)](https://github.com/ukiryu/setup-macports/actions/workflows/test.yml)

This action installs and configures [MacPorts](https://www.macports.org/) on macOS runners.

> **Note:** This action only supports macOS runners. MacPorts depends on the
> official PKG installer which is macOS-specific. Using this action on other
> platforms (ubuntu-latest, windows-latest) will fail with a clear error
> message.

## What's new

- Improved caching support with automatic cache key generation
- Support for fetching `macports/macports-ports` via GitHub API (no git dependency)
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

    # Installation prefix path for MacPorts.
    # Default: /opt/local
    # WARNING: Custom prefixes are experimental. Most MacPorts ports assume
    # /opt/local and may not work correctly with a custom prefix.
    installation-prefix: '/opt/local'

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

    # Verify package signatures during installation
    # Default: true
    signature-check: 'true'

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
```

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

#### Add additional local sources alongside git sources

When using git sources, you can add additional local sources. The git source
will be marked `[default]` automatically:

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    sources-provider: 'git'
    sources: >-
      file:///path/to/local/ports
      file:///another/local/sources
```

**Important:** When using git sources, the git repository is automatically
marked as `[default]`. Any additional sources you specify are added as secondary
sources. Do not mark any of your custom sources as `[default]` or it will
conflict with the git sources.

#### Custom installation prefix (experimental)

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    installation-prefix: '/tmp/macports-test'
```

**Warning:** Custom prefixes are experimental. Most MacPorts ports assume
`/opt/local` and may not work correctly. Portfiles often contain hardcoded paths
to `/opt/local` in shebangs, scripts, and configuration files.

**How it works:**
1. MacPorts PKG installer always installs to `/opt/local` (hardcoded by Apple)
2. The action then moves the installation to your custom prefix
3. Binaries may have hardcoded shebangs pointing to `/opt/local`

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
| `uses-git-sources` | Whether git sources were configured (only when `use-git-sources: true`) |

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
