-- In-person review ask (owner 2026-10-21): tech's answer on the Before you leave card.
alter table app.bookings add column if not exists review_ask text check (review_ask in ('now','later','not_asked'));
alter table app.bookings add column if not exists review_ask_at timestamptz;
