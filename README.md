# TrustSync — AI Security Questionnaire Engine

Vertical B2B micro-SaaS that ingests an organization's security collateral
(SOC 2, ISO 27001, policies), drafts answers to vendor security questionnaires
with exact citations + confidence scores, and exports them back into the
original `.xlsx` binary — non-destructively.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, lucide-react |
| Database | Supabase (PostgreSQL + pgvector + RLS + Realtime + Storage) |
| Retrieval | Hybrid search: pgvector cosine + tsvector FTS, fused with RRF |
| Inference | Claude Sonnet (citation-guarded, zero-hallucination policy) |
| Embeddings | OpenAI text-embedding-3-small (1536-dim) |
| Background jobs | Inngest (batch inference, ingestion, retries, concurrency caps) |
| Payments | Stripe (Checkout, Customer Portal, webhooks) |
| Spreadsheets | SheetJS (`xlsx`) — parse questions, write answers, preserve formatting |
| Documents | `pdf-parse` (PDF), `mammoth` (DOCX) → header-aware chunker |

## Architecture

```
[Upload .xlsx] -> Server Action -> Storage + Postgres rows -> Inngest event
                                                                    |
                        +-------------------------------------------+
                        v
        Batches of 5: hybrid search -> Claude (citations, confidence)
                        |
                        v
             Postgres UPDATE  --Realtime WS-->  Review UI
                        |
                        v
        Human approve/flag -> Export action -> SheetJS write-back -> .xlsx
```

Key invariants:

- **Tenant isolation**: every table carries `org_id` with Row-Level Security;
  the hybrid-search RPC filters tenants via explicit parameter.
- **Zero hallucination**: Claude may only cite provided excerpts; absent
  evidence yields `"Information Not Found"` + flagged status. Items below
  0.70 confidence are flagged red for human review.
- **Non-destructive export**: answers are written into the customer's original
  workbook binary; formulas, styles, and merged cells survive.
- **Serverless-safe**: long inference runs in Inngest, never in a request.

## Repo layout

```
supabase/migrations/     SQL schema, RLS, hybrid search, storage, realtime
src/lib/                 clients, parser, chunker, hybrid search, inference
src/app/actions/         Server Actions (upload, export, review, billing, waitlist)
src/app/api/             webhooks/stripe, inngest, export download, auth, health
src/inngest/functions/   background workers (questionnaire + ingestion)
src/app/page.tsx         marketing landing + waitlist funnel
src/app/dashboard/       app shell, questionnaires, knowledge base, billing
```

## Local setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com), then:

   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <your-project-id>
   supabase db push        # applies all migrations incl. pgvector + RLS
   ```

   Alternatively paste each file from `supabase/migrations/` into the
   Dashboard SQL editor, in filename order.

2. **Configure environment**: `cp .env.example .env.local` and fill in keys
   (Supabase API page, OpenAI, Anthropic, Stripe, Inngest).

3. **Stripe products**: create three recurring monthly prices ($499 / $999 /
   $1,999), copy their price IDs into `STRIPE_PRICE_*`, then enable the
   Customer Portal in Stripe settings. Forward webhooks locally:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. **Run**:

   ```bash
   npm install
   npm run dev          # app on :3000
   npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
   ```

5. **First run**: log in with a magic link (this bootstraps your org), upload
   a SOC 2 PDF under **Knowledge Base**, wait for ingestion, then upload a
   questionnaire `.xlsx` and watch answers stream into the review workspace.

## Deployment (Vercel)

```bash
npm install -g vercel
vercel link
vercel env pull           # or add env vars in the dashboard
vercel --prod
curl -I https://your-domain.com/api/health   # expect HTTP 200
```

Point the Inngest app at `https://your-domain.com/api/inngest`, add the
Stripe webhook endpoint `https://your-domain.com/api/webhooks/stripe`
(events: `checkout.session.completed`, `customer.subscription.*`,
`invoice.payment_failed`), and update `NEXT_PUBLIC_SITE_URL`.

## Notes & shortcuts taken vs. the blueprint

- Inference uses the current `claude-sonnet-4-5` model id (blueprint's
  `claude-3.5-sonnet` is retired).
- Confidence scoring combines retrieval similarity + citation discipline +
  refusal detection (blueprint's logit-based component is not exposed by the
  Messages API).
- citations store chunk IDs; the review page hydrates document titles and
  excerpts. Per-page PDF coordinates would need positional parsing output.
- The Chrome extension (Plasmo, portal auto-fill) is a separate package and
  intentionally out of scope for this scaffold.
