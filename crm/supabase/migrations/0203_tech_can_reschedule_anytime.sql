-- Owner 2026-10-13: per-tech switch for the tech-app Reschedule button.
-- Only Juan gets it for now.
alter table app.technicians add column if not exists can_reschedule_anytime boolean not null default false;
update app.technicians set can_reschedule_anytime = true where id = 'a03d09e2-2099-4e49-b4b2-c6b34be4abc8';
