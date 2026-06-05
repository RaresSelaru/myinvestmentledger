# Investor Usage Audit

Date: 2026-06-05  
Environment tested: production host, `https://myinvestmentledger.vercel.app`  
Account used: `rares.selaru@yahoo.com`  
Mode: read-only product audit. I intentionally did not submit imports, save changed strategy values, refresh quotes, delete data, or alter account settings.

## Executive Summary

The app is now usable as a portfolio cockpit, but the decision-management layer is not yet self-guiding enough. As an investor, I can see portfolio value, cash, holdings, live-price-derived values, allocation, Activity, Strategy, and Settings. However, the app currently expects me to know what needs to be configured before it becomes useful as a decision-support system.

The biggest issue is not visual polish. It is workflow clarity:

- All holdings currently appear to be missing target allocation and company type.
- Because of that, Decision Cockpit has no accumulation or trim candidates.
- Strategy contains the right inputs, but the app does not guide me through the minimum setup needed to unlock useful decisions.
- Portfolio and Stock Detail repeatedly show `Needs setup`, but do not offer a fast inline way to fix that setup.

The app should move toward a guided setup flow: "Set target allocation -> set company type -> optional anchors -> confidence improves -> candidates appear."

## What Worked Well

- Login worked on production.
- Main pages loaded without visible fatal errors:
  - Dashboard
  - Portfolio
  - Activity
  - Imports
  - Strategy
  - Settings
  - Stock detail for `ALAB.US`
- No browser console errors were detected during normal page navigation.
- Live prices appear enabled in Settings.
- Finnhub key appears saved.
- Dashboard values are now conceptually separated:
  - cash from broker snapshot
  - realized P/L from imported closed positions
  - market values using cached live quotes
- Activity is cleaner than the earlier raw ledger view.
- Portfolio detail now shows useful USD price context:
  - average cost in USD
  - current price in USD
  - market value and P/L in RON
- Strategy row expansion works.
- Strategy info popovers work and explain fields like Core/Satellite clearly.
- Dark mode toggle works at a basic level.

## Highest Priority Issues

### 1. Decision Engine Is Present But Not Yet Useful Without Guided Setup

Observed:

- Dashboard Decision Setup shows:
  - missing target: 11
  - missing company type: 11
  - missing thesis: 11
  - missing zones: 11
- Accumulation candidates and trim candidates are empty.
- Portfolio rows show `Needs setup` for price zones.
- Stock Detail score cards show dashes.

Why this matters:

The engine exists, but the user does not get decision support until they configure Strategy. The app should make the minimum next action obvious.

Recommended fix:

- Add a "Decision setup checklist" near the top of Dashboard.
- Add a "Quick setup" button for each symbol.
- Ask only for:
  - target %
  - max %
  - company type
  - core/satellite split
  - optional buy/trim anchors
- Hide thesis/rubric scores until "advanced".
- After saving one symbol, immediately show how the score/zone changed.

### 2. Dashboard Decision Cockpit Is Too Low In The Page

Observed:

- Decision Cockpit exists but appears below the account overview and holdings section.
- The user sees high-level portfolio visuals first, but not the decision workflow.

Why this matters:

The final goal is decision discipline, not only portfolio display. If Decision Cockpit is the "action brain", it should be visible earlier.

Recommended fix:

- Keep Account Overview, but surface a compact Decision Setup / Decision Cockpit card above or beside it.
- If candidates are empty, show setup blockers instead of empty candidate cards.
- Example:
  - "11 holdings need target allocation"
  - "Start with top 5 largest positions"
  - "Configure ALAB.US, ORCL.US, LEU.US first"

### 3. Portfolio Table Repeats "Not set" And "Needs setup" Too Much

Observed:

- Every row shows `Not set` target and `Needs setup` zone.
- This is correct technically, but visually noisy.

Why this matters:

When everything says the same thing, the table stops being helpful. The app should identify the most important missing setup, not repeat the same warning in 11 rows.

Recommended fix:

- Add a setup banner above Portfolio:
  - "Targets are missing for 11 holdings. Configure largest positions first."
- In rows, replace repeated labels with a small compact action:
  - `Set target`
- Consider hiding score columns until at least target allocation exists.

### 4. Strategy Is Better, But Still Needs A Guided Basic/Advanced Split

Observed:

- Rows are compact and expandable now.
- Expanded Strategy still has many fields:
  - target %
  - max %
  - buy price
  - trim price
  - core/satellite
  - company type
  - zone mode
  - theme
  - manual fair value
  - manual anchors
  - thesis/catalyst/theme/criticality/macro/comment

Why this matters:

This is still too much for the first decision setup pass.

Recommended fix:

- Basic section:
  - target %
  - max %
  - company type
  - core/satellite
  - buy anchor
  - trim anchor
- Advanced section:
  - thesis score
  - catalyst
  - theme score
  - criticality
  - macro uncertainty
  - qualitative comment
- Add a "Use sensible defaults" action per symbol:
  - company type remains user-set
  - target allocation can default to current allocation rounded
  - max allocation can default to target + 5%
  - core/satellite can default from current value

### 5. Strategy Inputs Have Accessibility / Labeling Problems

Observed:

- Visible labels exist, but some numeric inputs do not expose a direct accessible label.
- Button accessible names are compressed, e.g. `ALALAB.USCore-led`.

Why this matters:

This can make the app harder to use with keyboard/screen readers and can make browser automation/testing brittle.

Recommended fix:

- Give every input an `id` and connect `Label htmlFor`.
- Give expand buttons explicit `aria-label`, e.g. `Expand ALAB.US strategy`.
- Avoid accessible names that concatenate avatar initials and symbol text.

## Data / Calculation Observations

### Dashboard Metrics

Observed on Dashboard:

- Total portfolio value: about `14,391 RON`
- Cash: `674 RON`
- Total invested: `12,945 RON`
- Unrealized P/L: `772 RON`
- Realized P/L: `1,934 RON`

This looks more coherent than the earlier version where cash was negative. The app communicates that live quote mode is active and cash is static broker snapshot.

Remaining improvement:

- Add an obvious freshness timestamp near the metric row:
  - quote refresh time
  - import snapshot time
  - cash snapshot source

### Live Prices

Observed:

- Settings shows live prices enabled.
- Finnhub key is saved.
- Quote refresh interval is set to every 2 minutes.
- Dashboard says cached live quotes are used.

Remaining improvement:

- Portfolio should expose "quote age" per symbol or at least a top-level "quotes refreshed X minutes ago".
- If a quote is stale or missing, show it compactly in Portfolio.

### Stock Detail

Observed for `ALAB.US`:

- Market value and P/L are useful.
- Average cost and current price are in USD, which is correct.
- Realized and unrealized P/L are visible.
- Target buy/trim anchors are present.
- Decision cards are empty because target allocation/company type are not set.

Issues:

- Recent activity dates are raw ISO-like timestamps.
- Source traceability message says imported lots/raw rows will appear once parser is connected, but the parser/import flow already exists. This message is misleading.

Recommended fix:

- Format recent activity dates as `04 Jun 2026, 19:15`.
- Replace traceability placeholder with actual linked rows/files when available.
- Add "Set target for ALAB.US" CTA in Stock Detail.

## Page-by-Page Notes

### Dashboard

Strengths:

- Good overview cards.
- Account overview pie/list is useful.
- Holdings preview is useful.

Issues:

- No visible page H1.
- Decision Cockpit is below the fold.
- Empty candidates do not guide setup enough.
- `Recalculate` is available, but recalculation cannot help until strategy inputs exist.

Recommended improvements:

- Add compact decision setup module above account overview.
- Use "Configure largest holdings first" guidance.
- Keep a visually hidden H1 for accessibility if the visual heading stays removed.

### Portfolio

Strengths:

- Good sortable/searchable holdings table.
- Price/value/P/L split is clearer now.
- "Not set" target behavior is better than showing false `0%`.

Issues:

- 11 repeated `Not set` links.
- 11 repeated `Needs setup` zones.
- Score columns are not useful until setup exists.

Recommended improvements:

- Add setup banner.
- Add inline quick edit drawer for target/company type.
- Hide or soften score columns until meaningful.

### Activity

Strengths:

- Rows are readable.
- Dates are formatted well in the main table.
- No horizontal overflow detected at 1280px.

Issues:

- Some long comments visually merge into amounts. Example deposit row text combines provider transaction ID and amount, making it look like a malformed huge amount.
- 146 rows are still a lot for a default activity view.

Recommended improvements:

- Truncate comments harder in table rows.
- Move long comments/source details into row expansion.
- Add default grouping by day or event type.
- Add quick filters:
  - Buys/Sells
  - Cash events
  - Dividends/Interest
  - Taxes/Fees
  - Decision events

### Imports

Strengths:

- Simple import panel.
- Broker account selector exists.

Issues:

- `Import report` appears enabled even when no file is selected.
- Broker account text appears duplicated in extracted DOM (`XTB RON account` twice), likely from trigger + selected option.
- No obvious recent import history on the page.

Recommended improvements:

- Disable `Import report` until there is either:
  - selected file
  - staged dry-run file
- Show latest import status:
  - file name
  - imported at
  - rows imported
  - duplicates ignored
  - corrected rows

### Strategy

Strengths:

- Row-based layout is much better than the previous large-card layout.
- Per-symbol Save/Recalculate is a good improvement.
- Core/Satellite explanation popover is helpful.

Issues:

- Still too many fields for first-time setup.
- Advanced fields are technically hidden inside details, but the expanded panel still feels dense.
- Number fields need proper accessible labels.
- No smart defaults.

Recommended improvements:

- Add "Basic setup" and "Advanced scoring" sections.
- Provide default suggestions.
- Show "minimum setup complete" as a plain checklist:
  - target set
  - max set
  - company type set
  - anchors optional

### Settings

Strengths:

- API key handling looks safer; saved key is masked.
- Live prices are configurable.
- Quote refresh interval is configurable.
- Symbol mapping readiness is visible.

Issues:

- Settings is dense and technical.
- Symbol mapping readiness is read-only, so if aliases are wrong there is no fix path yet.

Recommended improvements:

- Split Settings into sections/tabs:
  - Market data
  - Cash
  - Symbol mappings
  - Broker accounts
- Add manual provider-symbol mapping UI later.

## Navigation / Performance

Measured rough production navigation times:

- `/dashboard`: 717-1095ms
- `/portfolio`: 596-736ms
- `/strategy`: 565-575ms
- `/settings`: 584-958ms

This is usable but not "instant". It feels much better than earlier reports, but first load per page is still noticeable.

Recommended improvements:

- Continue page-specific data loading.
- Avoid recalculations on page load unless necessary.
- Consider a lightweight client-side shell transition indicator.
- Consider caching the shell/workspace data more aggressively.

## Recommended Next Implementation Slice

I would not add more formulas yet. The next best slice is product usability:

1. Add a guided Decision Setup card on Dashboard.
2. Add quick setup drawer for a holding.
3. Hide/reduce score columns until setup exists.
4. Make Strategy basic-first:
   - target %
   - max %
   - company type
   - core/satellite
   - buy/trim anchors
5. Add smart defaults:
   - target = current allocation rounded, editable
   - max = target + 5%, editable
   - zone mode = suggested
6. Improve Stock Detail:
   - readable recent activity dates
   - real source traceability
   - direct setup CTA
7. Improve Activity truncation/grouping.

## Notes

- I did not submit forms or alter portfolio data during this audit.
- I did not test file import because that would create storage/import side effects.
- I did not click refresh quotes because that mutates cache state.
- If the latest pushed strategy-save resilience fix has not deployed yet, retest Strategy save after Vercel finishes deploying.

## Follow-Up QA: Strategy Save And Decision Engine Propagation

Date: 2026-06-05

Scope:

- Tested the production app as an authenticated user.
- Focused on Strategy, Portfolio, Stock Detail, and Dashboard Decision Cockpit.
- Performed controlled QA saves for `ORCL.US` and `ALAB.US`, then restored the test values back to the prior observed state.

### What I Tested

1. Opened Strategy.
2. Expanded individual symbol rows.
3. Filled a complete strategy setup for `ORCL.US`:
   - target allocation
   - max allocation
   - buy/trim prices
   - manual fair value
   - manual buy/trim anchors
   - company type
   - zone mode
   - thesis/catalyst/theme/criticality/macro scores
   - qualitative comment
4. Saved the row.
5. Repeated a similar setup for `ALAB.US`.
6. Checked Portfolio table, Stock Detail pages, and Dashboard Decision Cockpit.

### What Worked

- Strategy row expansion works.
- The advanced `Decision inputs` section opens and exposes the scoring fields.
- The visible fields correctly synchronize into the hidden `targetsJson` payload before submit.
- Per-symbol `Save` submits successfully and redirects to:
  - `/strategy?message=Strategy%20saved`
- No browser console errors appeared during the tested flow.
- The legacy/base strategy fields were written:
  - `targets.target_allocation`
  - `targets.max_allocation`
  - `targets.target_buy_price`
  - `targets.target_sell_price`
  - `targets.core_percent`
  - `targets.satellite_percent`
- The matching `holdings` fields were also updated during save.

### Critical Finding

The Stage 1 decision engine is not actually active on the production Supabase database.

Direct DB checks through the authenticated user session returned:

- `decision_scores`: missing table
- `price_zones`: missing table
- `data_quality_issues`: missing table

This means the migration that creates the decision-engine readiness tables is not applied on the hosted Supabase project.

Result:

- Strategy says `Strategy saved`.
- But no score rows can be persisted.
- No price zones can be persisted.
- No data-quality issues can be persisted.
- Dashboard cannot show accumulation/trim candidates.
- Stock Detail stays in `Needs setup`.
- Portfolio still shows `Needs setup`.

### Secondary Data Bug

The production DB has older target columns and partial newer XTB columns:

- `target_allocation` saved correctly.
- `target_allocation_pct` remained `0`.

The UI/data layer currently prefers `target_allocation_pct` when present. Because it is present but still `0`, the app reads target allocation as `0` even after the save wrote `target_allocation = 26` or `15`.

This is why the UI still showed:

- target not configured
- drift not meaningful
- `Needs setup`

even after a successful Strategy save.

### UX Issue Found During Testing

The advanced scoring fields are hidden inside a closed `<details>` section. This is visually cleaner, but it creates a subtle workflow problem:

- The user can fill basic target/core fields and save.
- But the scoring engine still lacks company type/thesis/anchors unless the user knows to open `Decision inputs`.
- The page does not strongly guide the user toward the minimum required setup for candidates to appear.

Recommendation:

- Add a compact "minimum setup" indicator per row.
- Make missing critical fields actionable.
- Consider a guided setup drawer instead of hiding all decision fields behind a generic advanced section.

### Expected Behavior After Fix

After applying the missing Supabase migration and fixing target fallback behavior:

- Saving `ORCL.US` with target above actual allocation should create a decision score.
- If eligible, it should appear as an accumulation candidate.
- Saving `ALAB.US` with target below actual allocation and a trim anchor below/near current price should create trim pressure.
- If eligible, it should appear as a trim review candidate.
- Stock Detail should show score cards, price zones, gates, confidence, and WhyPanel content.

### Stock Detail Route Sweep

I also opened all current holding detail routes:

- `ALAB.US`
- `ORCL.US`
- `LEU.US`
- `INOD.US`
- `VRT.US`
- `CRDO.US`
- `UAMY.US`
- `OKLO.US`
- `SMR.US`
- `ERO.US`
- `ADTX.US`

Results:

- All routes loaded.
- No 404 was detected.
- No browser console errors were detected.
- All pages still showed `Needs setup`.
- The detail pages expose score/zone sections, but because score/zone tables are missing on Supabase, the sections are empty.

UX note:

- The stock detail pages should make the current symbol much more obvious in the visible header. Automated text extraction did not clearly find the symbol in the main page text, which suggests the page may feel generic when opened from Portfolio.

### Recommended Fix Order

1. Apply the decision-engine Supabase migration to the hosted project.
2. Add a defensive migration or SQL check that verifies these tables exist:
   - `decision_scores`
   - `price_zones`
   - `decision_events`
   - `data_quality_issues`
   - `symbol_mappings`
3. Update save fallback logic so legacy columns and pct columns stay in sync.
4. Update read fallback logic:
   - if `target_allocation_pct` is `0` but `target_allocation` is greater than `0`, use `target_allocation`.
5. Retest Strategy save -> Portfolio -> Stock Detail -> Dashboard.

### Data Cleanup

The temporary QA values entered for `ORCL.US` and `ALAB.US` were restored after testing.

Restored observed values:

- `ORCL.US`
  - target allocation: `0`
  - max allocation: empty
  - buy price: empty
  - trim price: empty
  - core/satellite: `80/20`
- `ALAB.US`
  - target allocation: `0`
  - max allocation: `25`
  - buy price: `280`
  - trim price: `370`
  - core/satellite: `60/40`
