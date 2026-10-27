-- 0235: staff notice acks + office call tasks (owner 2026-10-23).
create table if not exists app.staff_notice_acks (
  notice_key text not null,
  name text not null,
  acked_at timestamptz not null default now(),
  primary key (notice_key, name)
);
create table if not exists app.staff_call_tasks (
  id uuid primary key default gen_random_uuid(),
  assignee text not null,
  phone text not null,
  contact_name text,
  title text not null,
  script text,
  outcome text,
  note text,
  logged_by text,
  logged_at timestamptz,
  attempts jsonb not null default '[]'::jsonb,
  snooze_until date,
  created_at timestamptz not null default now()
);
alter table app.staff_notice_acks enable row level security;
alter table app.staff_call_tasks enable row level security;
grant all on app.staff_notice_acks, app.staff_call_tasks to service_role;

insert into app.staff_call_tasks (assignee, phone, contact_name, title, script)
select 'Heather', '7208833286', 'Anthony Matthews',
  'Call 720-883-3286 (Anthony Matthews) about the $722 card dispute on the Oct 6 job.',
  E'Be polite.\nAsk: did you make this purchase?\nYes: ask them to call their bank and withdraw the dispute.\nNo: thank them and end the call.'
where not exists (select 1 from app.staff_call_tasks where phone = '7208833286' and assignee = 'Heather');
