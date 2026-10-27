-- Tech logo videos (owner 2026-10-14): techs film the TV playing our logo
-- video at the end of a job. Videos are too big for the function body, so the
-- phone uploads straight to storage with a signed URL; the row lives beside
-- the job photos with is_video = true.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-videos', 'job-videos', true, 524288000,
        array['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table app.booking_photos add column if not exists is_video boolean not null default false;
