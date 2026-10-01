-- TrustSync Stripe billing columns on organizations + fast webhook lookups.
alter table organizations
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_subscription_id text unique,
  add column if not exists stripe_price_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean default false;

create index if not exists idx_orgs_stripe_customer
  on organizations (stripe_customer_id);
create index if not exists idx_orgs_stripe_subscription
  on organizations (stripe_subscription_id);
