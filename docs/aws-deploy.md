# TrustSync on AWS — Deployment Runbook

Hosting: **AWS Amplify Hosting** (Next.js 15 SSR) in **us-east-1**.
Supabase, Inngest, and Stripe remain external services.

```
GitHub (MDIFN/TrustSync, master)
        │ webhook
        ▼
Amplify Hosting ── builds with amplify.yml (Node 20, npm ci, next build)
        │
        ▼  SSR compute + edge middleware
https://master.<APP_ID>.amplifyapp.com
        │
        ├──▶ Supabase        (Postgres/pgvector, Storage, Realtime, Auth)
        ├──▶ Inngest Cloud   (calls /api/inngest; workers run in the app)
        └──▶ Stripe          (webhooks → /api/webhooks/stripe)
```

## 1. One-time AWS setup

1. IAM → Users → **Create user** `trustsync-deployer`, programmatic access only.
2. Attach the AWS-managed policy **`AdministratorAccess-Amplify`**
   (covers Amplify plus the supporting S3/IAM/CloudWatch calls its builds make).
   If `create-app` later fails on the service-linked role, also attach
   `IAMFullAccess` — or create the SLR yourself (step 3).
3. Create the access key, then `aws configure` (region: `us-east-1`).
4. Service-linked role (skip if it already exists):

   ```bash
   aws iam create-service-linked-role --aws-service-name amplify.amazonaws.com
   ```

5. Amplify service role (so Amplify can invoke its own SSR compute):

   ```bash
   aws iam create-role --role-name AmplifySSRServiceRole --assume-role-policy-document '{
     "Version": "2012-10-17",
     "Statement": [{"Effect": "Allow", "Principal": {"Service": "amplify.amazonaws.com"}, "Action": "sts:AssumeRole"}]
   }'
   aws iam attach-role-policy --role-name AmplifySSRServiceRole \
     --policy-arn arn:aws:iam::aws:policy/AdministratorAccess-Amplify
   ```

6. GitHub personal access token (classic, `repo` scope) so Amplify can read the
   repo and register its build webhook.

## 2. Deploy

```bash
aws amplify create-app --name TrustSync \
  --repository https://github.com/MDIFN/TrustSync \
  --access-token <GITHUB_PAT> \
  --iam-service-role-arn <ARN from step 5> \
  --environment-variables NEXT_PUBLIC_SITE_URL=https://master.<APP_ID>.amplifyapp.com

aws amplify create-branch --app-id <APP_ID> --branch-name master \
  --enable-auto-build \
  --environment-variables \
    NEXT_PUBLIC_SUPABASE_URL=..., NEXT_PUBLIC_SUPABASE_ANON_KEY=..., \
    SUPABASE_SERVICE_ROLE_KEY=..., OPENAI_API_KEY=..., ANTHROPIC_API_KEY=..., \
    STRIPE_SECRET_KEY=..., STRIPE_WEBHOOK_SECRET=..., \
    STRIPE_PRICE_GROWTH=..., STRIPE_PRICE_SCALE=..., STRIPE_PRICE_ENTERPRISE=..., \
    INNGEST_SIGNING_KEY=..., INNGEST_EVENT_KEY=...

aws amplify start-job --app-id <APP_ID> --branch-name master --job-type RELEASE
aws amplify get-job --app-id <APP_ID> --branch-name master --job-id <JOB_ID> \
  --query 'job.summary.status'
```

Build times ~3–5 min. Verify:

```bash
curl https://master.<APP_ID>.amplifyapp.com/api/health
```

Every push to `master` rebuilds automatically (Amplify's GitHub webhook).

## 3. Post-deploy wiring (production dependencies)

| # | Task | Where |
|---|------|-------|
| 1 | Create Supabase project (us-east-1) and run `supabase db push` for migrations `0001`–`0004` | Supabase |
| 2 | Copy project URL + anon + service-role keys into Amplify env vars | Supabase → Amplify |
| 3 | Create Inngest Cloud app → event key + signing key; set **app base URL** `https://master.<APP_ID>.amplifyapp.com/api/inngest`; hit **Sync** | Inngest |
| 4 | Stripe → Developers → Webhooks → add endpoint `https://master.<APP_ID>.amplifyapp.com/api/webhooks/stripe`; events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`; copy `whsec_...` into `STRIPE_WEBHOOK_SECRET` | Stripe |
| 5 | Update `NEXT_PUBLIC_SITE_URL` to the final Amplify URL (or custom domain) and redeploy | Amplify |
| 6 | Optional: add a custom domain in Amplify (it provisions ACM cert + DNS) | Amplify |

## 4. Notes & limits

- Env vars set via the API are encrypted at rest in Amplify but visible to
  anyone with the Amplify console — fine for a solo-founder AWS account; move
  high-sensitivity values to Secrets Manager later if you add teammates.
- Amplify pricing: no per-request fee, ~$0.01/build-minute and $0.15/GB
  served/month after free allowances — roughly single-digit $/month at launch.
- `NEXT_PUBLIC_*` vars are inlined at **build time**: changing them requires a
  redeploy (Amplify `start-job RELEASE`), not just an env update.
- The Supabase **redirect URL allow-list** must include the deployed domain
  (`https://master.<APP_ID>.amplifyapp.com/**`) or magic-link login will bounce.
