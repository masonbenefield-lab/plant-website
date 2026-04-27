-- Admin audit log table — tracks every destructive or significant admin action
create table if not exists admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references profiles(id) on delete set null,
  action      text not null,            -- e.g. 'delete_listing', 'archive_user', 'pause_listing'
  target_type text not null,            -- 'listing' | 'auction' | 'user' | 'report'
  target_id   text not null,            -- UUID of the affected row
  notes       text,                     -- optional human-readable context
  created_at  timestamptz not null default now()
);

-- Only admins can insert; nobody can update or delete audit logs
alter table admin_audit_logs enable row level security;

create policy "Admins can insert audit logs"
  on admin_audit_logs for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "Admins can read audit logs"
  on admin_audit_logs for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- Index for quick lookups by target
create index if not exists admin_audit_logs_target_idx on admin_audit_logs(target_type, target_id);
create index if not exists admin_audit_logs_admin_idx on admin_audit_logs(admin_id);
create index if not exists admin_audit_logs_created_at_idx on admin_audit_logs(created_at desc);
