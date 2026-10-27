-- Owner can set their own CRM password. Stored only as a bcrypt hash.
create table if not exists app.owner_password (
  id int primary key default 1 check (id = 1),
  hash text not null,
  updated_at timestamptz not null default now()
);
alter table app.owner_password enable row level security;
revoke all on app.owner_password from anon, authenticated;

create or replace function app.th_owner_password_set(p text) returns void
language sql security definer set search_path = app, extensions as $$
  insert into app.owner_password (id, hash, updated_at) values (1, extensions.crypt(p, extensions.gen_salt('bf', 10)), now())
  on conflict (id) do update set hash = excluded.hash, updated_at = now();
$$;
create or replace function app.th_owner_password_check(p text) returns text
language sql security definer set search_path = app, extensions as $$
  select case when not exists (select 1 from app.owner_password) then 'unset'
              when exists (select 1 from app.owner_password where hash = extensions.crypt(p, hash)) then 'ok'
              else 'bad' end;
$$;
revoke all on function app.th_owner_password_set(text) from public, anon, authenticated;
revoke all on function app.th_owner_password_check(text) from public, anon, authenticated;
grant execute on function app.th_owner_password_set(text), app.th_owner_password_check(text) to service_role;
