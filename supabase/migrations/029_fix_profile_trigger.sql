-- Fix the profile auto-create trigger so a bad username can never abort signup.
--
-- Background: `handle_new_user` has been live since day one (it was applied by
-- hand in the SQL editor, so this repo never had it). It inserted
-- raw_user_meta_data->>'username' straight into profiles.username, which is
-- `unique not null`, with no conflict handling. Consequences:
--
--   1. If the chosen username was already taken, the INSERT raised a unique
--      violation. Because the trigger fires inside the auth.users insert, that
--      rolled back the whole thing — GoTrue returned 500 "Database error saving
--      new user" and NO account was created. The signup form showed that raw
--      message, so the person had no idea their username was the problem, and
--      the failure left no row behind to notice afterwards.
--   2. The trigger validated nothing, so the email signup path bypassed the
--      format rules that /api/auth/complete-profile enforces on OAuth users.
--
-- After this migration the trigger only ever inserts a username it is sure is
-- legal and free. Anything else is skipped, leaving the account without a
-- profile — which /auth/callback already handles by routing the person to
-- /signup/complete to pick a different name. Failure mode goes from "500, no
-- account" to "pick another username".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text := lower(trim(new.raw_user_meta_data->>'username'));
begin
  -- Google / Apple send no username. Those users choose one at /signup/complete,
  -- which inserts the profile itself. Nothing to do here.
  if candidate is null or candidate = '' then
    return new;
  end if;

  -- Mirror of USERNAME_RE / USERNAME_MIN / USERNAME_MAX in src/lib/username.ts.
  if candidate !~ '^[a-z0-9._-]{3,30}$' then
    return new;
  end if;

  -- `on conflict do nothing` (untargeted) covers both the id primary key and the
  -- username unique index. This is the line that stops a taken username from
  -- taking down the entire signup.
  insert into public.profiles (id, username)
  values (new.id, candidate)
  on conflict do nothing;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
