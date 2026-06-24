-- Opt-in: a once-daily APP push notification (not email) when a user has plant
-- care due that day. Sent in their local morning via an hourly cron.
alter table profiles add column if not exists care_push_reminders boolean not null default false;
