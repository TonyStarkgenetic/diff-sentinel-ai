### Title
[FEAT] Support `pnpm-lock.yaml` and `bun.lockb` in `dep-analyzer`

### Labels
`enhancement`, `good-first-issue`

### Description
**Is your feature request related to a problem? Please describe.**
Currently `src/core/dep-analyzer.ts` inspects `package.json`. Projects using pnpm or Bun often commit changes to `pnpm-lock.yaml` or `bun.lockb`.

**Describe the solution you'd like**
Add parsing for `pnpm-lock.yaml` diffs to detect integrity hash modifications and new peer dependency mismatches.

**Files to modify**
- `src/core/dep-analyzer.ts`
- `tests/dep-analyzer.test.ts`
