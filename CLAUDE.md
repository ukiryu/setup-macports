# Claude Instructions for setup-macports

## Important Testing Requirements

### Inkscape Must Always Be Tested

**CRITICAL:** When modifying the test workflow, ALWAYS include Inkscape in the test ports.

Why Inkscape is important:
- It is a complex port with many dependencies
- It tests the completeness of the MacPorts installation
- It validates dependency resolution and installation
- Removing Inkscape from tests is FORBIDDEN

Example:
```yaml
- name: Test port installation
  uses: ./
  with:
    macports-version: '2.10.0'
    install-ports: 'git-lfs inkscape'
```

## Cache Key Design

Following Homebrew's approach: keep it simple.

The cache key format is: `macports-{version}-{arch}-{platformMajor}`

This matches Homebrew's philosophy:
- Cache ONLY the base installation
- Configuration (variants, sources, ports) is applied AFTER cache restore
- This allows maximum cache sharing across all test jobs

The base MacPorts installation is the same regardless of:
- Variants configuration (applied to variants.conf after restore)
- Sources provider (sources.conf is configured after restore)
- Ports to install (installed after restore)

Only these factors affect the base installation and are in the cache key:
- MacPorts version (e.g., 2.10.0, 2.12.0-rc1)
- Architecture (arm64, x86_64)
- macOS platform major version (14, 15, 26)
