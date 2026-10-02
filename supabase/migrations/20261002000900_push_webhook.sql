-- Push delivery: a new notification worth pushing calls the send-push Edge Function.
-- Instead of a dashboard webhook and a function secret, the URL and a shared secret live in Vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'push_webhook_secret');
-- The trigger sends the secret in x-webhook-secret; the function checks it with push_secret_ok().
-- Without pg_net or Vault (plain Postgres, the tests) or without those secrets, nothing is sent.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

-- Same list as PUSH_KINDS in supabase/functions/send-push/push.ts.
create function public.push_kind(k text) returns boolean language sql immutable set search_path = public as $$
  select k in ('hold_expiring', 'holds_released', 'clearance_earned', 'waitlist_booked', 'waitlist_open', 'waitlist_missed')
$$;

create function public.push_secret(p_name text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if to_regclass('vault.decrypted_secrets') is null then return null; end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v using p_name;
  return v;
end $$;
revoke execute on function public.push_secret from public, anon, authenticated, service_role;

-- For the Edge Function (service role): is this the webhook secret?
create function public.push_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(p_secret = public.push_secret('push_webhook_secret'), false)
$$;
revoke execute on function public.push_secret_ok from public, anon, authenticated;
grant execute on function public.push_secret_ok to service_role;

create function public.send_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  url text;
  secret text;
begin
  if not public.push_kind(new.kind) or to_regproc('net.http_post') is null then return new; end if;
  if not exists (select 1 from public.push_tokens where member_id = new.member_id) then return new; end if;
  url := public.push_secret('push_function_url');
  secret := public.push_secret('push_webhook_secret');
  if url is null or secret is null then return new; end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
  using url,
        jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new)),
        jsonb_build_object('content-type', 'application/json', 'x-webhook-secret', secret);
  return new;
end $$;
revoke execute on function public.send_push from public, anon, authenticated;

create trigger notifications_push after insert on public.notifications
for each row execute function public.send_push();
