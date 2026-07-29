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

Data flow: `Dropzone` → `useFileProcessing` hook → `parserClient.ts` → **`parser.worker.ts` (Web Worker)** → `parser.ts` → `reports.ts` / analysis builders → `types.ts` shapes → rendered by `CompanyOverviewCard` / `CompanyCard` / `SummaryCards`, and separately summarized for `ChatbotFab`.

**The whole parse pipeline runs off the main thread.** `useFileProcessing` never imports `parser.ts` directly — it goes through `createParserClient()`, which posts the `File` to a dedicated worker and gets a `CompanyReport` back (both are structured-cloneable, so there's no manual serialization). Two consequences worth knowing before you touch this:
  - **`parser.ts` and everything it imports must stay DOM-free.** It only depends on `pdfjs-dist`, `types.ts`, `format.ts` and `balance.ts` today. (The `document` variable inside `parsePdfFile` is pdf.js's `PDFDocumentProxy`, not the browser's.) Importing anything that touches `window`/`document` breaks the worker at runtime, not at build time.
  - **Cancellation works by terminating the worker** (`parserClient.cancel()`), which is the only reliable way to stop CPU-bound parsing mid-file; the client transparently recreates the worker on the next `parse()`. In-flight promises reject with `ParseCancelledError`.
  - `parserClient` falls back to parsing on the main thread if `new Worker(...)` throws. That fallback is why `yieldToBrowser()` still exists in `parser.ts` — it's a no-op inside the worker (`typeof window === 'undefined'`) and only matters on that path.

- **`src/utils/parser.ts`** — the core engine. Uses `pdf.js` to extract positioned text items per page, regroups them into logical lines (`groupItemsIntoLines`), then parses Brazilian-formatted accounting lines (account code, name, previous/current balance, debit/credit) with regexes tuned to real balancete layouts (`accountRegex`, `moneyRegex`, `cnpjRegex`, `companyCodeRegex`). From the parsed `LedgerLine[]` it derives:
  - `invertedRows` — asset accounts (`1.*`) with credit nature or liability/equity accounts (`2.*`) with debit nature (excluding known dual-nature accounts like `1.2.05.007`, `2.4.13.004`).
  - `zeroMovementRows` — accounts with zero debit and credit movement.
  - `comparisonReport` — cross-checks distribution vs. result accounts.
  - `analysisReports` — 12 fixed rule-based analyses (`AnalysisKind` = `analysis1`..`analysis12`, e.g. CMV x Receita, depreciation pairing) built in `reports.ts`.
  - `unclassified` lines and `errors` are kept so users can see what the parser couldn't confidently interpret — never silently drop unparseable lines.

  Two invariants in this file are load-bearing and easy to break:
  - **Never let two separate pdf.js text items merge into one number.** `groupItemsIntoLines` joins items without a space when the horizontal gap is ≤ 12, but pdf.js sometimes reports a `width` that overruns the next column, producing a *negative* gap between genuinely separate cells. In person-type accounts the CPF sits immediately before the balance, so this silently glued them (`"...OLIVEIRA 01504106466"` + `"0,00C"` → `015041064660,00C`, and `"…45"` + `"1.530,00C"` → `451.530,00C` — a 295x overstatement). `standaloneMoneyRegex` guards this: a text item that is itself a complete money value never gets concatenated onto a trailing digit.
  - **`ledgerBalanceMismatch` (in `balance.ts`) is the tripwire for column misalignment.** `parseLedgerLine` takes `moneyMatches.slice(-4)` as the four columns, which goes wrong whenever a stray number leaks in from the name. Every parsed row is checked against `saldo anterior + débito − crédito = saldo atual`; failures set `LedgerLine.balanceMismatch` and surface as a `CompanyReport.errors` entry rather than being dropped. Across the sample balancetes in `arquivos_de_exemplo/` (gitignored, count varies as files are added/removed locally) the expected count is **0** — if a change makes that number non-zero, it has broken column extraction. Watch the sign convention: this check treats debit as positive, the *opposite* of `signedCurrentBalance`.
  - **`cnpjRegex` and `anonymize.ts`'s `documentNumberRegex` accept the alphanumeric CNPJ format** the Receita Federal started issuing in 2026 (12 leading characters can be `A-Z` or digits; only the 2 trailing check digits stay numeric). Both must be widened together — `cnpjRegex` only affects display, but `documentNumberRegex` is the privacy safety net before the Gemini payload, so missing this format there means an alphanumeric CNPJ would leak unmasked.
- **`src/types.ts`** is the shared contract between the parser, the report builders, and every component that renders results (`CompanyReport` is the central object passed around the whole app).
- **`src/utils/reports.ts`** builds the human-facing tables/columns (`balanceColumns`, `comparisonColumns`, `depreciationColumns`) and drives PDF (`jsPDF`) / Excel (`xlsx`) export from the same `CompanyReport` data.
- **`src/utils/gemini.ts`** — optional AI assistant, and **the only code path in the whole app that sends data over the network**. Calls the Gemini REST API directly from the browser with a fetch call (`x-goog-api-key` header) using a fixed, carefully-worded Portuguese system instruction (severity classification, `[Fato]/[Inferencia]/[Hipotese]` tagging, mandatory response sections). Never sends raw PDF/ledger data — only a compact summary built by `summarizeReportsForPrompt`. Because this is the one place the "local processing" guarantee is qualified, several invariants must hold together — changing any one of them silently makes the privacy copy in `PrivacyPolicy.tsx` / `DataSecurity.tsx` / `LocalProcessingDoc.tsx` false:
  - **Consent gate.** Nothing is sent until `hasGeminiConsent()` is true (set via the checkbox in `ChatbotFab`'s config panel). Key present but no consent ⇒ local mode + `buildConsentPendingNotice()`. Never bypass this.
  - **Pseudonymization.** Everything outbound goes through `src/utils/anonymize.ts`: company names become `Empresa N` aliases, CNPJ/CPF are stripped entirely, and `stripDocumentNumbers` is a final safety net over the assembled prompt. Chat history is re-anonymized on each turn (replies are stored de-anonymized), and the model's reply is passed back through `deanonymizeText` before display. Account codes/names, balances and alerts *are* sent — that's disclosed in the UI, don't quietly widen it.
  - **API key storage.** Persisted in `localStorage` as `{ value, savedAt }` with a 30-day TTL (`GEMINI_API_KEY_TTL_DAYS`); `getStoredGeminiApiKey()` deletes it once expired. Reading also migrates the two older formats (plain string, and the even older `sessionStorage` key) — don't remove that migration without checking whether it's still needed.
  - **`VITE_GEMINI_API_KEY` is dev-only** (`getBuildTimeApiKey()` returns `''` unless `import.meta.env.DEV`). Any `VITE_*` value is inlined in plaintext into the public bundle at build time, so honoring it in production would publish the key to every visitor.
- **`src/utils/anonymize.ts`** — the pseudonymization layer described above. Both replace passes sort by length descending so a longer name/alias is substituted first (otherwise `ACME LTDA` would eat part of `ACME COMERCIO LTDA`, and `Empresa 1` would corrupt `Empresa 10`).
- **`src/utils/chatbot.ts`** provides canned suggestion prompts and the local (non-AI) fallback replies. It must not import from `gemini.ts` — `ChatbotFab` passes the raw user message to `generateGeminiChatReply`, which builds the prompt exactly once. (An earlier `buildLocalPromptForGemini` wrapper caused the balancete summary to be embedded twice per request.)
- **`useFileProcessing` hook** (`src/hooks/useFileProcessing.ts`) owns all file/report state for `App.tsx`: dropzone drag state, dedup of already-added files (by name+size+lastModified), sequential per-file processing with progress (`processingIndex`/`processingPercent`), cancellation (`cancelProcessing`), and clearing state. Holds one `parserClient` per hook instance, disposed on unmount. The reentrancy guard uses a ref, not the `isProcessing` state — inside `processFiles` the state still holds the previous render's value.
- **`App.tsx`** is a thin shell: sidebar navigation between `main` / `privacy` / `security` / `docs` views, lazy-loads the heavier secondary views and the chatbot FAB (`React.lazy` + `Suspense`) to keep the initial bundle small, and computes the top-level summary counts (`buildResultsSummary`) from `CompanyReport[]`.
- Styling is Tailwind with a custom design-token system in `tailwind.config.js` / `src/styles.css` (CSS variables for light/dark themes, custom spacing/typography scale like `gap-xl`, `font-display-lg`) rather than ad hoc utility values — reuse existing tokens instead of inventing new spacing/font classes.
- `vite.config.ts` manually chunks `react`/`react-dom`, `pdfjs-dist`, `xlsx` and `jspdf`/`jspdf-autotable` into separate bundles — keep this in mind if adding new heavy dependencies (consider adding them to `manualChunks` too). The worker gets its own bundle automatically (`parser.worker-*.js`, ~385 kB with pdf.js inlined); the main thread's `pdf-*.js` chunk is now only fetched if the worker fallback triggers. Compression uses a **single** `compression()` instance with `algorithms: ['gzip', 'brotliCompress']` — registering one instance per algorithm also works but makes each re-emit the other's output ("overwrites a previously emitted file" spam).
