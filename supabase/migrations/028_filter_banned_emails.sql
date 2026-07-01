-- Suppress all outbound email to banned accounts.
--
-- Email is sent by recipient address, but ban state lives on auth.users
-- (banned_until) and is mirrored onto profiles.banned_at (see 020_user_bans.sql).
-- This function takes a batch of candidate recipient addresses and returns just
-- the ones that belong to a currently-banned account, so the mailer can drop them.
--
-- SECURITY DEFINER + locked-down grants: only the service role (used by the
-- server-side mailer) may call it; it never reaches the client.

create or replace function filter_banned_emails(p_emails text[])
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(lower(u.email)), '{}')
  from auth.users u
  join profiles p on p.id = u.id
  where lower(u.email) = any (select lower(e) from unnest(p_emails) as e)
    and (
      p.banned_at is not null
      or (u.banned_until is not null and u.banned_until > now())
    );
$$;

revoke all on function filter_banned_emails(text[]) from public, anon, authenticated;
grant execute on function filter_banned_emails(text[]) to service_role;
