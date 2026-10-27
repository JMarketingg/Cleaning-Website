-- One-off texts sent at a set time by the 10-min tech_late_check cron (owner 2026-10-08).
create table if not exists app.scheduled_texts (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  body text not null,
  send_at timestamptz not null,
  booking_id uuid references app.bookings(id) on delete set null,
  sent_at timestamptz,
  error text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists scheduled_texts_due on app.scheduled_texts (send_at) where sent_at is null;
alter table app.scheduled_texts enable row level security;
