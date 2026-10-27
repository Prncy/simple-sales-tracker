-- Multi-product sales are represented by a parent transaction with one sales row per product line.
-- Existing single-line sales are preserved and backfilled into their own transactions.
create table public.sale_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recorded_by uuid not null references auth.users(id),
  employee_name text not null check (length(trim(employee_name)) between 1 and 120),
  sold_on date not null default current_date,
  sold_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  constraint sale_transactions_id_business_unique unique (id, business_id)
);

alter table public.sales add column transaction_id uuid;

do $$
declare
  old_sale record;
  new_transaction_id uuid;
begin
  for old_sale in select id, business_id, recorded_by, employee_name, sold_on, sold_at, note from public.sales loop
    new_transaction_id := gen_random_uuid();
    insert into public.sale_transactions (id, business_id, recorded_by, employee_name, sold_on, sold_at, note)
    values (new_transaction_id, old_sale.business_id, old_sale.recorded_by, old_sale.employee_name, old_sale.sold_on, old_sale.sold_at, old_sale.note);
    update public.sales set transaction_id = new_transaction_id where id = old_sale.id;
  end loop;
end $$;

alter table public.sales alter column transaction_id set not null;
alter table public.sales
  add constraint sales_transaction_business_fkey
  foreign key (transaction_id, business_id)
  references public.sale_transactions (id, business_id) on delete cascade;
create index sales_transaction_id_idx on public.sales(transaction_id);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique,
  business_id uuid not null references public.businesses(id) on delete cascade,
  receipt_number text not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  amount_received numeric(12,2) not null check (amount_received >= total_amount),
  change_due numeric(12,2) generated always as (round(amount_received - total_amount, 2)) stored,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint receipts_business_receipt_number_unique unique (business_id, receipt_number),
  constraint receipts_transaction_business_fkey
    foreign key (transaction_id, business_id)
    references public.sale_transactions (id, business_id) on delete cascade
);
create index receipts_business_created_idx on public.receipts(business_id, created_at desc);

alter table public.sale_transactions enable row level security;
alter table public.receipts enable row level security;

create policy "Owners can read sale transactions" on public.sale_transactions
for select to authenticated
using (exists (select 1 from public.businesses b where b.id = sale_transactions.business_id and b.owner_user_id = (select auth.uid())));
create policy "Owners can create sale transactions" on public.sale_transactions
for insert to authenticated
with check (recorded_by = (select auth.uid()) and exists (select 1 from public.businesses b where b.id = sale_transactions.business_id and b.owner_user_id = (select auth.uid())));
create policy "Owners can update sale transactions" on public.sale_transactions
for update to authenticated
using (exists (select 1 from public.businesses b where b.id = sale_transactions.business_id and b.owner_user_id = (select auth.uid())))
with check (recorded_by = (select auth.uid()) and exists (select 1 from public.businesses b where b.id = sale_transactions.business_id and b.owner_user_id = (select auth.uid())));
create policy "Owners can delete sale transactions" on public.sale_transactions
for delete to authenticated
using (exists (select 1 from public.businesses b where b.id = sale_transactions.business_id and b.owner_user_id = (select auth.uid())));

create policy "Owners can read receipts" on public.receipts
for select to authenticated
using (exists (select 1 from public.businesses b where b.id = receipts.business_id and b.owner_user_id = (select auth.uid())));
create policy "Owners can create receipts" on public.receipts
for insert to authenticated
with check (created_by = (select auth.uid()) and exists (select 1 from public.businesses b where b.id = receipts.business_id and b.owner_user_id = (select auth.uid())));
create policy "Owners can update receipts" on public.receipts
for update to authenticated
using (exists (select 1 from public.businesses b where b.id = receipts.business_id and b.owner_user_id = (select auth.uid())))
with check (created_by = (select auth.uid()) and exists (select 1 from public.businesses b where b.id = receipts.business_id and b.owner_user_id = (select auth.uid())));
create policy "Owners can delete receipts" on public.receipts
for delete to authenticated
using (exists (select 1 from public.businesses b where b.id = receipts.business_id and b.owner_user_id = (select auth.uid())));

grant select, insert, update, delete on public.sale_transactions to authenticated;
grant select, insert, update, delete on public.receipts to authenticated;

create or replace function public.create_sale_with_receipt(
  p_business_id uuid,
  p_employee_name text,
  p_sold_on date,
  p_note text,
  p_items jsonb,
  p_receipt_enabled boolean default false,
  p_amount_received numeric default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_unit_price numeric;
  v_total numeric(12,2);
  v_receipt_id uuid;
  v_receipt_number text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to record a sale.'; end if;
  if not exists (select 1 from public.businesses b where b.id = p_business_id and b.owner_user_id = auth.uid()) then
    raise exception 'You do not have permission to record sales for this business.';
  end if;
  if p_employee_name is null or length(trim(p_employee_name)) not between 1 and 120 then raise exception 'Enter a valid employee name.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Add at least one product to the sale.'; end if;
  if p_receipt_enabled and (p_amount_received is null or p_amount_received < 0) then raise exception 'Enter the amount received for the receipt.'; end if;

  insert into public.sale_transactions (business_id, recorded_by, employee_name, sold_on, sold_at, note)
  values (p_business_id, auth.uid(), trim(p_employee_name), coalesce(p_sold_on, current_date),
          (coalesce(p_sold_on, current_date)::timestamp + time '12:00') at time zone current_setting('TIMEZONE'),
          nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_transaction_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unit_price')::numeric;
    if v_quantity is null or v_quantity <= 0 or v_unit_price is null or v_unit_price < 0 then
      raise exception 'Each product needs a positive quantity and a non-negative price.';
    end if;
    insert into public.sales (business_id, product_id, transaction_id, recorded_by, employee_name, quantity, unit_price, sold_on, sold_at, note)
    values (p_business_id, v_product_id, v_transaction_id, auth.uid(), trim(p_employee_name), v_quantity, v_unit_price,
            coalesce(p_sold_on, current_date),
            (coalesce(p_sold_on, current_date)::timestamp + time '12:00') at time zone current_setting('TIMEZONE'),
            nullif(trim(coalesce(p_note, '')), ''));
  end loop;

  select coalesce(sum(s.total_value), 0)::numeric(12,2) into v_total from public.sales s where s.transaction_id = v_transaction_id;
  if p_receipt_enabled then
    if p_amount_received < v_total then raise exception 'Amount received must be at least the sale total.'; end if;
    v_receipt_number := 'SW-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.receipts (transaction_id, business_id, receipt_number, total_amount, amount_received, created_by)
    values (v_transaction_id, p_business_id, v_receipt_number, v_total, p_amount_received, auth.uid())
    returning id into v_receipt_id;
  end if;
  return jsonb_build_object('transaction_id', v_transaction_id, 'total_amount', v_total, 'receipt_id', v_receipt_id, 'receipt_number', v_receipt_number);
end;
$$;
grant execute on function public.create_sale_with_receipt(uuid, text, date, text, jsonb, boolean, numeric) to authenticated;
