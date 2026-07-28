# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev       # Vite dev server at http://127.0.0.1:5173/
npm run build     # tsc (type-check, noEmit) + vite build -> dist/
npm run preview   # serve the production build locally
```

There is no test suite, lint script, or CI config in this repo. `npm run build` is the closest thing to a correctness gate (TypeScript strict mode via `tsc`, then the Vite bundle). There is no single-test command to run since no test runner is configured.

Node version is pinned via `.nvmrc` (24).

## Branches

- `main` — the deployed frontend-only app (this is what's normally checked out). Pure React/Vite SPA, no backend.
- `SaaS` — active development branch adding a backend (`api/` — Vercel serverless functions for auth, Stripe billing, SQLite/libSQL via `api/utils/db.ts`), a landing page, and account management on top of the same analysis engine. Substantially diverged from `main` (auth hooks, `AuthPages`, `AccountPanel`, `LandingPage`, Stripe webhook/checkout/portal routes). Check which branch you're on before assuming the backend exists.

`seed_local.ts` (gitignored) is a local-only DB seeding script tied to the SaaS branch's backend; it references `./api/utils/db.js` which does not exist on `main`.

## Architecture (main / frontend core)

This is a client-side balancete (accounting trial balance) analyzer: PDFs are parsed and analyzed **entirely in the browser** — no file ever leaves the user's machine. That "local processing" guarantee is a product requirement, not an implementation detail; don't introduce a server round-trip for the PDF/analysis pipeline without treating it as a breaking change to the value proposition (see `LocalProcessingDoc.tsx`, `DataSecurity.tsx`, `PrivacyPolicy.tsx`).

Data flow: `Dropzone` → `useFileProcessing` hook → `parser.ts` → `reports.ts` / analysis builders → `types.ts` shapes → rendered by `CompanyOverviewCard` / `CompanyCard` / `SummaryCards`, and separately summarized for `ChatbotFab`.

- **`src/utils/parser.ts`** — the core engine. Uses `pdf.js` to extract positioned text items per page, regroups them into logical lines (`groupItemsIntoLines`), then parses Brazilian-formatted accounting lines (account code, name, previous/current balance, debit/credit) with regexes tuned to real balancete layouts (`accountRegex`, `moneyRegex`, `cnpjRegex`, `companyCodeRegex`). From the parsed `LedgerLine[]` it derives:
  - `invertedRows` — asset accounts (`1.*`) with credit nature or liability/equity accounts (`2.*`) with debit nature (excluding known dual-nature accounts like `1.2.05.007`, `2.4.13.004`).
  - `zeroMovementRows` — accounts with zero debit and credit movement.
  - `comparisonReport` — cross-checks distribution vs. result accounts.
  - `analysisReports` — 12 fixed rule-based analyses (`AnalysisKind` = `analysis1`..`analysis12`, e.g. CMV x Receita, depreciation pairing) built in `reports.ts`.
  - `unclassified` lines and `errors` are kept so users can see what the parser couldn't confidently interpret — never silently drop unparseable lines.
- **`src/types.ts`** is the shared contract between the parser, the report builders, and every component that renders results (`CompanyReport` is the central object passed around the whole app).
- **`src/utils/reports.ts`** builds the human-facing tables/columns (`balanceColumns`, `comparisonColumns`, `depreciationColumns`) and drives PDF (`jsPDF`) / Excel (`xlsx`) export from the same `CompanyReport` data.
- **`src/utils/gemini.ts`** — optional AI assistant, and **the only code path in the whole app that sends data over the network**. Calls the Gemini REST API directly from the browser with a fetch call (`x-goog-api-key` header) using a fixed, carefully-worded Portuguese system instruction (severity classification, `[Fato]/[Inferencia]/[Hipotese]` tagging, mandatory response sections). Never sends raw PDF/ledger data — only a compact summary built by `summarizeReportsForPrompt`. Because this is the one place the "local processing" guarantee is qualified, several invariants must hold together — changing any one of them silently makes the privacy copy in `PrivacyPolicy.tsx` / `DataSecurity.tsx` / `LocalProcessingDoc.tsx` false:
  - **Consent gate.** Nothing is sent until `hasGeminiConsent()` is true (set via the checkbox in `ChatbotFab`'s config panel). Key present but no consent ⇒ local mode + `buildConsentPendingNotice()`. Never bypass this.
  - **Pseudonymization.** Everything outbound goes through `src/utils/anonymize.ts`: company names become `Empresa N` aliases, CNPJ/CPF are stripped entirely, and `stripDocumentNumbers` is a final safety net over the assembled prompt. Chat history is re-anonymized on each turn (replies are stored de-anonymized), and the model's reply is passed back through `deanonymizeText` before display. Account codes/names, balances and alerts *are* sent — that's disclosed in the UI, don't quietly widen it.
  - **API key storage.** Persisted in `localStorage` as `{ value, savedAt }` with a 30-day TTL (`GEMINI_API_KEY_TTL_DAYS`); `getStoredGeminiApiKey()` deletes it once expired. Reading also migrates the two older formats (plain string, and the even older `sessionStorage` key) — don't remove that migration without checking whether it's still needed.
  - **`VITE_GEMINI_API_KEY` is dev-only** (`getBuildTimeApiKey()` returns `''` unless `import.meta.env.DEV`). Any `VITE_*` value is inlined in plaintext into the public bundle at build time, so honoring it in production would publish the key to every visitor.
- **`src/utils/anonymize.ts`** — the pseudonymization layer described above. Both replace passes sort by length descending so a longer name/alias is substituted first (otherwise `ACME LTDA` would eat part of `ACME COMERCIO LTDA`, and `Empresa 1` would corrupt `Empresa 10`).
- **`src/utils/chatbot.ts`** provides canned suggestion prompts and the local (non-AI) fallback replies. It must not import from `gemini.ts` — `ChatbotFab` passes the raw user message to `generateGeminiChatReply`, which builds the prompt exactly once. (An earlier `buildLocalPromptForGemini` wrapper caused the balancete summary to be embedded twice per request.)
- **`useFileProcessing` hook** (`src/hooks/useFileProcessing.ts`) owns all file/report state for `App.tsx`: dropzone drag state, dedup of already-added files (by name+size+lastModified), sequential per-file processing with progress (`processingIndex`/`processingPercent`), and clearing state.
- **`App.tsx`** is a thin shell: sidebar navigation between `main` / `privacy` / `security` / `docs` views, lazy-loads the heavier secondary views and the chatbot FAB (`React.lazy` + `Suspense`) to keep the initial bundle small, and computes the top-level summary counts (`buildResultsSummary`) from `CompanyReport[]`.
- Styling is Tailwind with a custom design-token system in `tailwind.config.js` / `src/styles.css` (CSS variables for light/dark themes, custom spacing/typography scale like `gap-xl`, `font-display-lg`) rather than ad hoc utility values — reuse existing tokens instead of inventing new spacing/font classes.
- `vite.config.ts` manually chunks `react`/`react-dom` and `pdfjs-dist` into separate bundles — keep this in mind if adding new heavy dependencies (consider adding them to `manualChunks` too).
