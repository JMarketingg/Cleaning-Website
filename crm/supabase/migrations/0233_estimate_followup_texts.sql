-- 0233: once-only stamps for the 3 h / 24 h estimate follow-up texts.
alter table app.estimates add column if not exists followup_text1_at timestamptz, add column if not exists followup_text2_at timestamptz;
