# Pre-commit Hook Setup

This repository now has pre-commit hooks configured with Husky, Prettier, and lint-staged.

## Setup Required

Due to permission issues, you need to run the following command to install the dependencies:

```bash
bun install
```

This will:

1. Install `prettier`, `husky`, and `lint-staged`
2. Run the `prepare` script which initializes Husky
3. Set up the pre-commit hook

## What the Pre-commit Hook Does

When you commit code, the pre-commit hook will automatically:

1. **Format all staged files** with Prettier
2. **Run TypeScript type checking** on staged TypeScript files
3. **Run tests** on staged TypeScript files

This provides immediate feedback if:

- Code formatting is incorrect
- TypeScript types don't check
- Tests fail

## Manual Commands

You can also run these commands manually:

- `bun run format` - Format all files in the repository
- `bun run format:check` - Check if all files are formatted (useful for CI)
- `bun run typecheck` - Run TypeScript type checker
- `bun run test` - Run tests

## First Time Setup

After running `bun install`, you should format the entire codebase once:

```bash
bun run format
```

Then commit the formatting changes:

```bash
git add -A
git commit -m "Apply prettier formatting to entire codebase"
```

## Notes

- The `.prettierrc` configuration uses standard settings (2 spaces, semicolons, etc.)
- The `.prettierignore` file excludes build outputs, node_modules, and generated files
- The `.lintstagedrc` configuration runs prettier, typecheck, and tests on staged files
- If you need to bypass the pre-commit hook (not recommended), use `git commit --no-verify`
