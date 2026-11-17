-- Levels, per-habit difficulty, settings history, and "only today can be ticked".

-- Habits: difficulty 1 (Easy) … 5 (Extreme), and earlier settings so edits never rewrite the past.
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
