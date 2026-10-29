### Title
[FEAT] Add Rust AST signature parser for `pub fn` and `struct` definitions

### Labels
`enhancement`, `help wanted`, `good-first-issue`

### Description
**Is your feature request related to a problem? Please describe.**
Currently `src/core/ast-analyzer.ts` supports TypeScript, JavaScript, and Python public function/class signature changes. Rust has become one of the most popular languages in systems and WASM development.

**Describe the solution you'd like**
Add regex/token-based AST parsing for Rust source files (`.rs`):
- Detect `pub fn <name>(...)` removals or argument count modifications.
- Detect `pub struct <name>` removals.
- Detect `pub trait <name>` modifications.

**Files to modify**
- `src/core/ast-analyzer.ts`
- `tests/ast-analyzer.test.ts`
