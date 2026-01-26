# Supplyline Raycast Extension — Acceptance Criteria

## Core Search (AC1–AC3)

- [ ] **AC1:** Exact MNO match — Query "PD051832NI" returns that SKU as first result
- [ ] **AC2:** Fuzzy match — Query "injection valve" returns relevant products
- [ ] **AC3:** Performance — Results appear within 300ms of typing stop

## Navigation (AC4–AC6)

- [ ] **AC4:** Drill down — Enter on series item pushes stack, shows children
- [ ] **AC5:** Pop stack — Backspace (empty input) or ⌘+← pops stack level
- [ ] **AC6:** Breadcrumb — Navigation title shows current stack path (e.g., "LMI > PD Series >")

## Actions (AC7–AC9)

- [ ] **AC7:** Open Shop — Enter on SKU opens `urlShop` in default browser
- [ ] **AC8:** Open About — ⌘+⇧+Enter on SKU opens `urlAbout` in browser
- [ ] **AC9:** Copy — ⌘+K copies SKU/price/URL to clipboard

## Scope (AC10–AC11)

- [ ] **AC10:** Default scope — Extension opens with "products" scope by default
- [ ] **AC11:** Docs command — `search-docs` command queries docs index only

## Detail View (AC12–AC13)

- [ ] **AC12:** Preview panel — Highlighting SKU shows price, stock, specs in detail view
- [ ] **AC13:** Stock indicator — In-stock items show green badge, out-of-stock shows red

## Error Handling (AC14–AC15)

- [ ] **AC14:** Network error — Network failure shows toast with retry option
- [ ] **AC15:** Empty results — No matches shows helpful empty state with query

---

## Testing Checklist

### Setup
- [ ] Extension loads without errors
- [ ] Preferences are prompted on first run
- [ ] Algolia connection succeeds with valid credentials
- [ ] Invalid API key shows clear error message

### Search Behavior
- [ ] Empty state shows when no query
- [ ] Results appear within 300ms
- [ ] MNO query (alphanumeric, no spaces) uses exact match mode
- [ ] General query uses fuzzy matching with typo tolerance

### Navigation
- [ ] Drill down on series works (push stack)
- [ ] Drill down on parent works (push stack)
- [ ] Back navigation works (pop stack)
- [ ] Breadcrumb updates correctly
- [ ] Query clears after drill
- [ ] Backspace on empty input pops stack

### Actions
- [ ] Enter on SKU opens shop URL in browser
- [ ] ⌘+⇧+Enter opens about URL
- [ ] ⌘+K copies plain text format
- [ ] ⌘+⇧+K copies markdown format
- [ ] ⌘+← pops navigation stack

### Docs Command
- [ ] `search-docs` command appears in Raycast
- [ ] Docs search returns manuals/datasheets
- [ ] Enter opens document in browser
- [ ] ⌘+P opens QuickLook preview (if implemented)

### Edge Cases
- [ ] Very long SKU names truncate properly
- [ ] Special characters in search don't break queries
- [ ] Rapid typing doesn't cause race conditions
- [ ] Deep stack (3+ levels) works correctly

---

## Sign-off

| Reviewer | Date | Status |
|----------|------|--------|
| | | |

---

*Acceptance Criteria v1.0 — January 2026*
