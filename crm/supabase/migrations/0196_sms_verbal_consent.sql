-- Verbal text approval (owner, 2026-10-09). A staff member (owner or
-- secretary) records that a person agreed to our terms by phone. Only manual,
-- staff-sent texts read this; automated sends and the website widget box are
-- untouched. A later STOP text or a blocked number still wins over this row.
-- Purely additive.
set search_path = app, public;
create table if not exists sms_verbal_consent (
  phone         text primary key,                 -- 10-digit, same bare format as messages.customer_phone
  method        text not null default 'verbal',
  recorded_by   text,                             -- staff name who took the approval
  recorded_role text,                             -- owner | secretary
  recorded_at   timestamptz not null default now(),
  business_slug text,
  note          text
);
alter table sms_verbal_consent enable row level security;
alter table sms_verbal_consent force row level security;
