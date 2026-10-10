-- AscenDex schema. Run once in the Supabase SQL editor. Safe to re-run.
--
-- Security model
--   * The server writes with the secret key (bypasses RLS) after checking who
--     is asking: prices are re-decided server-side, shops are verified, roles are
--     set by the server, never by the browser.
--   * Signed-in users can only READ, and only their own rows (RLS below). That
--     is also what Realtime delivers to them.

-- ── Profiles: one per Google account ───────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text check (role in ('customer', 'merchant')),
  display_name text,
  avatar_url text,
  -- merchant: the dataset shop this account runs. One owner per shop.
  merchant_id text unique,
  -- customer: where they usually are and how they want to hear from us.
  locality text,
  lat double precision,
  lng double precision,
  language text not null default 'en',
  interests text[] not null default '{}',
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));

-- Create the profile row the moment someone signs in with Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ── Claims: an offer a customer took, redeemed at the counter ──────────────
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now(),
  customer_id text not null,
  customer_user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  merchant_id text not null,
  merchant_name text not null,
  item_id text not null,
  item_name text not null,
  discount_pct numeric not null,
  base_price_inr numeric not null,
  final_price_inr numeric not null,
  unit_cost_inr numeric not null,
  profit_estimate_inr numeric,
  status text not null default 'claimed' check (status in ('claimed', 'redeemed')),
  redeemed_at timestamptz,
  valid_until timestamptz not null
);
alter table public.claims add column if not exists customer_user_id uuid references auth.users (id) on delete set null;
create index if not exists claims_merchant_idx on public.claims (merchant_id, created_at desc);
create index if not exists claims_customer_idx on public.claims (customer_id, created_at desc);
create index if not exists claims_user_idx on public.claims (customer_user_id, created_at desc);
alter table public.claims enable row level security;
drop policy if exists "customer reads own claims" on public.claims;
create policy "customer reads own claims" on public.claims for select to authenticated
  using (customer_user_id = (select auth.uid()));
drop policy if exists "merchant reads shop claims" on public.claims;
create policy "merchant reads shop claims" on public.claims for select to authenticated
  using (merchant_id = (select p.merchant_id from public.profiles p where p.id = (select auth.uid()) and p.role = 'merchant'));

-- ── Owner rules (live app only; /decide keeps the dataset's rules) ─────────
create table if not exists public.merchant_rules (
  merchant_id text primary key,
  max_discount_pct numeric,
  min_margin_pct numeric,
  promo_start_hour numeric,
  promo_end_hour numeric,
  weekdays_only boolean,
  paused boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.merchant_rules add column if not exists updated_by uuid references auth.users (id) on delete set null;
alter table public.merchant_rules enable row level security;
drop policy if exists "merchant reads own rules" on public.merchant_rules;
create policy "merchant reads own rules" on public.merchant_rules for select to authenticated
  using (merchant_id = (select p.merchant_id from public.profiles p where p.id = (select auth.uid()) and p.role = 'merchant'));

-- ── Decision log (analytics; no customer data) ────────────────────────────
create table if not exists public.decisions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  scenario_id text not null,
  source text not null check (source in ('decide', 'solve')),
  action text not null check (action in ('send', 'skip')),
  merchant_id text,
  item_id text,
  discount_pct numeric,
  final_price_inr numeric,
  profit_estimate_inr numeric,
  language text,
  reason text not null,
  latency_ms numeric
);
create index if not exists decisions_created_at_idx on public.decisions (created_at desc);
alter table public.decisions enable row level security;

-- ── Realtime: push claim changes to the signed-in customer and the shop ────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claims'
  ) then
    alter publication supabase_realtime add table public.claims;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'merchant_rules'
  ) then
    alter publication supabase_realtime add table public.merchant_rules;
  end if;
end $$;
