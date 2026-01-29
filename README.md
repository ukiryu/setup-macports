# Setup MacPorts

[![build](https://github.com/ukiryu/setup-macports/workflows/test.yml/badge.svg)](https://github.com/ukiryu/setup-macports/actions/workflows/test.yml)

This action installs and configures [MacPorts](https://www.macports.org/) on macOS runners.

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
    # The MacPorts version to install and use. Examples: 2.11.5, 2.10.0
    # Default: 2.11.5
    macports-version: '2.11.5'

    # Cache MacPorts installation directory for faster subsequent runs.
    # Set to 'true' to enable caching.
    # Default: false
    cache: 'false'

    # Installation prefix for MacPorts
    # Default: /opt/local
    # Currently only /opt/local is supported
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

    # Fetch macports/macports-ports via GitHub API for local sources.
    # Automatically configures sources.conf to use the local copy.
    # Set to 'false' to use rsync only.
    # Default: true
    use-git-sources: 'true'

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

#### Enable caching

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    cache: 'true'
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

#### Use rsync sources instead of git

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    use-git-sources: 'false'
```

#### Use custom port sources

```yaml
- uses: ukiryu/setup-macports@v1
  with:
    sources: >-
      file:///path/to/local/ports [default]
      rsync://rsync.macports.org/macports/release/tarballs/ports.tar
```

#### Caching

MacPorts supports caching via `actions/cache`. The cache key is automatically generated based on:
- macOS version
- Architecture
- MacPorts version
- Configuration (variants, sources)

```yaml
- uses: ukiryu/setup-macports@v1
  id: macports

- uses: actions/cache@v4
  with:
    path: /opt/local
    key: ${{ steps.macports.outputs.cache-key }}
```

#### Recommended permissions

The action needs minimal permissions:

```yaml
permissions:
  contents: read
```

For installing ports or additional operations:

```yaml
permissions:
  contents: read
  packages: write  # if installing packages
```

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

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Supporters

The original implementation was inspired by [melusina-org/setup-macports](https://github.com/melusina-org/setup-macports).
