# Project memory

## Product intent & audience

- Next.js web app with 40+ pages; deployed on Netlify.

## Brand personality & voice

- Not yet inferred from this turn.

## Visual design & UX direction

- UI uses dialog and tab animations with open/closed and orientation variants; styles are now maintained directly in the project's own stylesheet rather than via a third-party helper.
- Design and features are considered stable; avoid changes to either unless explicitly requested.

## Decisions, constraints & rationale

- **npm is the canonical package manager**: a stray pnpm lockfile was removed to prevent ambiguous installs on build servers.
- **Next.js pinned to 16.4.6** to resolve known security vulnerabilities; keep it on patched releases.
- **shadcn scaffolding tool removed**: it was installed but never referenced by app code and was the source of remaining audit vulnerabilities.
- Build, type-check, and tests (12 tests) must stay green after dependency or config changes.
- Goal of this turn was strictly error/vulnerability remediation, not feature or design work.

## Open questions & assumptions

- Stylistic preferences and brand voice are not yet captured; infer from the UI in future turns.
- No authoritative `.bolt/prompt` exists yet; update memory if global instructions are added.