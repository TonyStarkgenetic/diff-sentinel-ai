### Title
[FEAT] Add SARIF export format for GitHub Advanced Security / Code Scanning integration

### Labels
`enhancement`, `security`, `good-first-issue`

### Description
**Is your feature request related to a problem? Please describe.**
Many enterprise and OSS repositories use GitHub Advanced Security Code Scanning tabs. Currently, `diff-sentinel` outputs ANSI CLI text, raw JSON, and Markdown PR comments.

**Describe the solution you'd like**
Add a `--sarif` flag to `diff-sentinel diff` and `diff-sentinel scan`:
- Emit valid SARIF 2.1.0 (Static Analysis Results Interchange Format) JSON.
- This will allow developers to run `diff-sentinel` in GitHub Actions and upload results using `github/codeql-action/upload-sarif@v3`.

**Files to modify**
- `src/cli.ts`
- `src/types.ts`
- Add tests in `tests/`
