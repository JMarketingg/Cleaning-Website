-- Tech reminders (owner 2026-10-20): 7 AM job-day + 1-hour leave-now texts,
-- late text asks YES + ETA, 15-min no-reply alert to the covering secretary.
alter table app.tech_sms_log add column if not exists confirmed_at timestamptz;
alter table app.tech_sms_log add column if not exists reply_body text;
create unique index if not exists tech_sms_log_once_idx on app.tech_sms_log (kind, booking_id, technician_id, to_phone) where kind in ('jobday','leave_now','late','late_alert');
