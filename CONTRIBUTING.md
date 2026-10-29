# Contributing to diff-sentinel

Thank you for your interest in contributing to **diff-sentinel**! We welcome bug reports, feature requests, pull requests, and feedback from the community.

## Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/diff-sentinel.git
   cd diff-sentinel
   ```

2. **Requirements:**
   - Node.js >= 22.0.0 (Native TypeScript type-stripping support)
   - npm >= 10.0.0

3. **Running Tests:**
   We use Node's native test runner. Tests run in milliseconds without external test framework overhead:
   ```bash
   npm test
   ```

4. **Running CLI Locally:**
   ```bash
   npm start -- --help
   npm start -- diff examples/sample.patch
   ```

## Pull Request Guidelines

- Ensure all existing unit tests pass (`npm test`).
- Add tests for any new features or bug fixes under `tests/`.
- Follow Conventional Commits:
  - `feat: ...` for new capabilities
  - `fix: ...` for bug fixes
  - `docs: ...` for documentation
  - `feat!: ...` or `fix!: ...` for breaking changes

## Code of Conduct

Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).
