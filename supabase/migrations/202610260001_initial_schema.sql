-- Stock & Sales Tracker initial schema
-- Apply only to the intended Supabase project after reviewing the migration.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  currency_code text not null default 'ZMW' check (currency_code ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null default 'General',
  unit_label text not null default 'unit',
  default_unit_price numeric(12,2) not null check (default_unit_price >= 0),
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name),
  unique (id, business_id)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  employee_name text not null check (length(trim(employee_name)) between 1 and 120),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_value numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  sold_at timestamptz not null default now(),
  sold_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint sales_product_belongs_to_business foreign key (product_id, business_id)
    references public.products(id, business_id) deferrable initially immediate
);

-- A composite unique key supports the ownership-safe product/business reference above.
create unique index if not exists products_id_business_id_key on public.products(id, business_id);

create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  recorded_by uuid not null default auth.uid() references auth.users(id),
  employee_name text not null check (length(trim(employee_name)) between 1 and 120),
  quantity numeric(12,3) not null check (quantity > 0),
  returned_on date not null default current_date,
  reason text,
  condition_note text,
  created_at timestamptz not null default now(),
  constraint returns_product_belongs_to_business foreign key (product_id, business_id)
    references public.products(id, business_id) deferrable initially immediate
);

create index if not exists businesses_owner_idx on public.businesses(owner_user_id);
create index if not exists products_business_idx on public.products(business_id);
create index if not exists sales_business_sold_on_idx on public.sales(business_id, sold_on);
create index if not exists sales_product_idx on public.sales(product_id);
create index if not exists returns_business_returned_on_idx on public.returns(business_id, returned_on);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.returns enable row level security;

create policy "Users can view their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Owners can manage their businesses" on public.businesses
  for all to authenticated using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id);

create policy "Owners can read their products" on public.products
  for select to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can add products" on public.products
  for insert to authenticated with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ) and created_by = (select auth.uid()));
create policy "Owners can update their products" on public.products
  for update to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can delete products without transaction history" on public.products
  for delete to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));

create policy "Owners can read sales" on public.sales
  for select to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can add sales" on public.sales
  for insert to authenticated with check (recorded_by = (select auth.uid()) and exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can update sales" on public.sales
  for update to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can delete sales" on public.sales
  for delete to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));

create policy "Owners can read returns" on public.returns
  for select to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can add returns" on public.returns
  for insert to authenticated with check (recorded_by = (select auth.uid()) and exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can update returns" on public.returns
  for update to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));
create policy "Owners can delete returns" on public.returns
  for delete to authenticated using (exists (
    select 1 from public.businesses b where b.id = business_id and b.owner_user_id = (select auth.uid())
  ));

-- Profile creation is intentionally explicit in the client during onboarding.
-- Do not add a SECURITY DEFINER trigger without reviewing its privilege implications.
