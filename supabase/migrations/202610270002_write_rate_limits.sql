-- Database-enforced rate limits for authenticated write operations.
-- This complements (but does not replace) Supabase Auth's built-in request limits.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.rate_limit_buckets (
  user_id uuid not null,
  action_key text not null,
  bucket_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (user_id, action_key, bucket_start)
);

revoke all on table private.rate_limit_buckets from public, anon, authenticated;

create or replace function private.enforce_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_user_id uuid;
  v_action_key text;
  v_limit integer;
  v_bucket_width interval;
  v_bucket_start timestamptz;
  v_now timestamptz;
  v_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Please sign in before making changes.'
      using errcode = '28000';
  end if;

  case tg_table_name
    when 'sale_transactions' then
      v_action_key := 'sale_transaction';
      v_limit := 30;
      v_bucket_width := interval '1 minute';
    when 'sales' then
      v_action_key := 'sales_line';
      v_limit := 300;
      v_bucket_width := interval '1 minute';
    when 'products' then
      v_action_key := 'product_create';
      v_limit := 30;
      v_bucket_width := interval '1 hour';
    when 'returns' then
      v_action_key := 'return_create';
      v_limit := 30;
      v_bucket_width := interval '1 minute';
    else
      return new;
  end case;

  v_now := clock_timestamp();
  if v_bucket_width = interval '1 hour' then
    v_bucket_start := date_trunc('hour', v_now);
  else
    v_bucket_start := date_trunc('minute', v_now);
  end if;

  insert into private.rate_limit_buckets as current_bucket
    (user_id, action_key, bucket_start, request_count)
  values (v_user_id, v_action_key, v_bucket_start, 1)
  on conflict (user_id, action_key, bucket_start)
  do update set request_count = current_bucket.request_count + 1
  returning request_count into v_count;

  -- Prune expired buckets only once per active bucket to keep write overhead low.
  if v_count = 1 then
    delete from private.rate_limit_buckets
    where user_id = v_user_id
      and action_key = v_action_key
      and bucket_start < v_now - interval '2 days';
  end if;

  if v_count > v_limit then
    raise exception 'Too many % requests. Please wait before trying again.', replace(v_action_key, '_', ' ')
      using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

-- Trigger functions are invoked by PostgreSQL triggers, not directly by browser clients.
revoke all on function private.enforce_write_rate_limit() from public, anon, authenticated;

drop trigger if exists rate_limit_sale_transactions on public.sale_transactions;
create trigger rate_limit_sale_transactions
before insert on public.sale_transactions
for each row execute function private.enforce_write_rate_limit();

drop trigger if exists rate_limit_sales_lines on public.sales;
create trigger rate_limit_sales_lines
before insert on public.sales
for each row execute function private.enforce_write_rate_limit();

drop trigger if exists rate_limit_products on public.products;
create trigger rate_limit_products
before insert on public.products
for each row execute function private.enforce_write_rate_limit();

drop trigger if exists rate_limit_returns on public.returns;
create trigger rate_limit_returns
before insert on public.returns
for each row execute function private.enforce_write_rate_limit();

-- The auto-RLS event trigger remains installed, but its function should not be
-- callable as an RPC by browser roles.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
