-- Daily: full database setup (0001_init + 0002_levels_and_locks). Paste into Supabase SQL Editor and Run.

-- Daily app schema. Every row belongs to one user; RLS keeps it private.

create extension if not exists pgcrypto;

-- Habits, events/meetings and tasks share one table.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type text not null check (type in ('habit', 'event', 'task')),
  title text not null default '',
  description text not null default '',
  color text,
  start_at timestamptz,          -- event start / task due / habit series start
  end_at timestamptz,            -- event end
  all_day boolean not null default false,
  rrule text,                    -- RFC 5545 RRULE (no DTSTART), e.g. FREQ=DAILY
  active_from date,              -- habits: first day the habit counts
  active_until date,             -- habits: last day (short-term habits)
  hidden boolean not null default false,
  reminder_time time,            -- habits: daily reminder time
  reminder_minutes int,          -- events: minutes before start
  status text check (status in ('todo', 'doing', 'done')),
  sort_order double precision not null default 0,
  note_page_id uuid,
  gcal_calendar_id text,
  gcal_event_id text,
  gcal_etag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index items_user_type on public.items (user_id, type) where deleted_at is null;
create unique index items_gcal on public.items (user_id, gcal_calendar_id, gcal_event_id)
  where gcal_event_id is not null;

-- One row per habit per day it was ticked (or explicitly unticked).
create table public.completions (
  item_id uuid not null references public.items(id) on delete cascade,
  date date not null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (item_id, date)
);

-- Notion-style nested pages. content = BlockNote JSON blocks.
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references public.pages(id) on delete cascade,
  title text not null default 'Untitled',
  icon text,
  content jsonb not null default '[]'::jsonb,
  plain_text text not null default '',
  sort_order double precision not null default 0,
  is_template boolean not null default false,
  daily_date date,               -- set for a day's "daily note"
  notion_id text,
  search tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(plain_text, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pages_tree on public.pages (user_id, parent_id) where deleted_at is null;
create index pages_search on public.pages using gin (search);
create unique index pages_daily on public.pages (user_id, daily_date) where daily_date is not null;

alter table public.items add constraint items_note_page_fk
  foreign key (note_page_id) references public.pages(id) on delete set null;

-- Google Calendar link (server-side only; no RLS policies = not readable from the browser).
create table public.gcal_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  events_calendar_id text not null default 'primary',
  habits_calendar_id text,
  updated_at timestamptz not null default now()
);

create table public.gcal_calendars (
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id text not null,
  sync_token text,
  channel_id text,
  resource_id text,
  channel_token text,
  expiration timestamptz,
  primary key (user_id, calendar_id)
);

-- updated_at maintenance
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();
create trigger completions_touch before update on public.completions for each row execute function public.touch_updated_at();
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

-- Row level security
alter table public.items enable row level security;
alter table public.completions enable row level security;
alter table public.pages enable row level security;
alter table public.gcal_accounts enable row level security;
alter table public.gcal_calendars enable row level security;

create policy own_items on public.items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_completions on public.completions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_pages on public.pages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Realtime: phone <-> PC live updates
alter publication supabase_realtime add table public.items, public.completions, public.pages;

-- Images
insert into storage.buckets (id, name, public) values ('images', 'images', true)
  on conflict (id) do nothing;
create policy own_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);


-- Levels, per-habit difficulty, settings history, and "only today can be ticked".

-- Habits: difficulty 1 (Easy) â€¦ 5 (Extreme), and earlier settings so edits never rewrite the past.
alter table public.items add column if not exists difficulty int not null default 3 check (difficulty between 1 and 5);
alter table public.items add column if not exists versions jsonb;

-- The user's "today" for locking ticks. Change this if you move timezones.
create or replace function public.app_today() returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- Ticks can only be added or changed for today. The admin key (used by the one-time import) is exempt.
-- (The app never deletes ticks; deletes are left alone so removing an account can cascade.)
create or replace function public.lock_completions() returns trigger language plpgsql as $$
begin
  if current_user = 'service_role' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.date <> public.app_today() or (tg_op = 'UPDATE' and old.date <> new.date) then
    raise exception 'Only today''s habits can be ticked (got %, today is %)', new.date, public.app_today()
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists completions_lock on public.completions;
create trigger completions_lock before insert or update on public.completions
  for each row execute function public.lock_completions();

-- Per-user settings shared by phone and PC (game start date).
create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  game_start date,
  updated_at timestamptz not null default now()
);
alter table public.user_settings enable row level security;
drop policy if exists own_settings on public.user_settings;
create policy own_settings on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

