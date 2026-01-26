# AGENTS.md — Operating Rules for raycast-search

> **This file defines how AI agents (Claude Code, Cursor, etc.) operate in this repo.**
> Project-specific context lives in `CLAUDE.md`.

## Project Context

This is a Raycast extension for Supplyline Industrial, a water treatment equipment e-commerce marketplace. The extension enables system-wide search of products, SKUs, and documentation via Algolia.

### Owner
- **Eric Pittman** — Founder of Supplyline Industrial
- GitHub: `Supplyline`

### Developer
- **Sasha (mikheldev)** — Full contributor access

## The Two Loops

Every non-trivial task follows this pattern:

### Loop A: Build (Claude Code)
1. **Research** — bullets, links, constraints
2. **Spec Interview** — questions → refine spec until ambiguity is minimal
3. **Plan** — tasks + files + commands
4. **Execute** — small diffs, run checks
5. **Narrate** — explain what changed and why

### Loop B: Review
6. **Independent Review** — spec mismatch, edge cases, migration safety, perf/security, missing tests
7. **Fix + Re-review** — iterate until clean

## Documentation Structure

This repo uses a flat `/docs` structure (not feature capsules):

```
docs/
├── SPEC.md                  # Full specification
├── PLAN.md                  # Implementation phases
├── ACCEPTANCE.md            # Acceptance criteria
├── algolia-index-spec.md    # Algolia index schemas
└── implementation-guide.md  # Complete code reference
```

## Git Workflow

### Direct to main (safe changes)
- Docs, comments, CLAUDE.md updates
- Test-only changes
- Typos, import fixes

### PR + review (non-trivial)
- New features, components
- Changes to search logic
- API integration changes
- 3+ files with logic changes

**When in doubt, PR it.**

## Commit Protocol

Only commit when explicitly requested. When committing:

1. `git status` + `git diff` to understand changes
2. Check recent commit style with `git log --oneline -10`
3. Draft message: 1-2 sentences, focus on "why" not "what"
4. Never commit `.env`, credentials, or secrets

## Stack

| Layer | Technology |
|-------|------------|
| Extension | Raycast API, React, TypeScript |
| Search | Algolia (`algoliasearch` client) |
| Backend | Algolia indices (managed by supplyline-etl) |

## Algolia Indices (Read-Only)

This extension **reads** from 3 Algolia indices. It does not write to them.

| Index | Purpose |
|-------|---------|
| `supplyline_products_browse` | Series + Parent (drill targets) |
| `supplyline_products_sku` | Child + Sibling SKUs (terminal items) |
| `supplyline_docs` | Manuals, datasheets, IOMs |

Indices are populated by the `supplyline-etl` pipeline (separate repo).

## Key Concepts

### MNO Detection
Alphanumeric queries with no spaces (e.g., "PD051832NI") trigger exact-match mode with minimal typo tolerance.

### Stack Navigation
Users drill into the product hierarchy (Brand → Series → Parent → SKU). The stack tracks the current position and filters search results.

### Primary vs Drill Behavior
- **drill** items (series, parent) → push to stack, refetch children
- **open** items (SKU, doc) → open URL in browser

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Run in Raycast dev mode
npm run build    # Build for production
npm run lint     # Lint code
```

## Credentials

| Credential | Source | Access |
|------------|--------|--------|
| Algolia App ID | Eric (Supplyline dashboard) | Search-only |
| Algolia Search API Key | Eric (Supplyline dashboard) | Search-only |

**Never use admin/write keys in the extension.**

## Architecture Preferences

### Agent-Native Design
- Expose atomic, judgment-free tools
- Let agents loop to achieve outcomes
- Avoid encoding workflows in code

### Code Style
- Kebab-case for files and folders
- Descriptive names over clever abbreviations
- Comments explain *why*, not *what*
- TypeScript for all code

### Data Flow
- Idempotency as a first-class constraint
- Clear provenance (trace values to source)
- Explicit over implicit

## What "Done" Means

A task is done when:
- [ ] Implementation matches SPEC.md
- [ ] All items in ACCEPTANCE.md pass
- [ ] Tests pass (if applicable)
- [ ] No P0/P1 issues from review
- [ ] Changes committed (if requested)

## Don't

- Don't start coding before spec is clear
- Don't skip review for non-trivial changes
- Don't write to Algolia indices (read-only client)
- Don't hardcode credentials
- Don't invent requirements — ask when unclear

## Related Repos

| Repo | Relationship |
|------|--------------|
| `supplyline-search` | Source of spec (web Command Menu) |
| `supplyline-etl` | Populates Algolia indices |
| `supplyline-sync` | DAM asset processing |

## Contact

Questions about the spec or business requirements → Eric (`Supplyline`)
