# Contributing to Setup MacPorts

## Overview

This is a [GitHub Action](https://github.com/features/actions) that installs and configures [MacPorts](https://www.macports.org/) on macOS runners.

## Development

### Prerequisites

- Node.js 20 or later
- npm

### Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/setup-macports.git`
3. Navigate to the directory: `cd setup-macports`
4. Install dependencies: `npm install`

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the action |
| `npm run format` | Format the code |
| `npm run format-check` | Check code formatting |
| `npm run lint` | Lint the code |
| `npm test` | Run tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run licensed-check` | Check licenses of dependencies |
| `npm run licensed-generate` | Generate license configuration |
| `npm run all` | Run all checks |

### Making changes

1. Create a new branch: `git checkout -b my-new-feature`
2. Make your changes
3. Format your code: `npm run format`
4. Check formatting: `npm run format-check`
5. Lint your code: `npm run lint`
6. Run tests: `npm test`
7. Build the action: `npm run build`
8. Commit your changes: `git commit -am 'Add some feature'`
9. Push to the branch: `git push origin my-new-feature`
10. Create a Pull Request

### Testing

Tests are written using [Jest](https://jestjs.io/). Run `npm test` to execute the test suite.

To run tests with coverage, use `npm run test:coverage`.

### Code Style

This project uses:
- [Prettier](https://prettier.io/) for code formatting
- [ESLint](https://eslint.org/) for linting

Configuration files:
- `.prettierrc.json` - Prettier configuration
- `eslint.config.mjs` - ESLint configuration

## Release Process

Releases are created using the `release.yml` workflow.

1. Go to the Actions tab
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter the version (e.g., `1.2.0`) or leave empty to use package.json version
5. Select whether to create a GitHub Release
6. Click "Run workflow"

The workflow will:
1. Update the version in package.json (if specified)
2. Run tests
3. Build the action
4. Commit the dist folder
5. Create and push a git tag
6. Create a GitHub Release (if enabled)

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE).

## Support

Please open an issue on GitHub for bug reports, feature requests, or questions.
