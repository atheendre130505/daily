-- "My day": the day you're on doesn't change at midnight. You move to the next day with the "Next day" button,
-- so ticks after midnight (before you sleep) still count for the day you're finishing.

alter table public.user_settings add column if not exists current_day date;

-- The day ticks are allowed for: your current day, or the calendar date if you haven't set one.
create or replace function public.my_day(uid uuid) returns date language sql stable security definer set search_path = public as $$
  select coalesce((select s.current_day from public.user_settings s where s.user_id = uid), public.app_today())
$$;

create or replace function public.lock_completions() returns trigger language plpgsql as $$
declare
  allowed date := public.my_day(new.user_id);
begin
  if current_user = 'service_role' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.date <> allowed or (tg_op = 'UPDATE' and old.date <> new.date) then
    raise exception 'Only today''s habits can be ticked (got %, your day is %)', new.date, allowed
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

-- The day can only move forward, and never past the real date (so past days stay locked).
create or replace function public.check_current_day() returns trigger language plpgsql as $$
begin
  if current_user = 'service_role' or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if new.current_day is not null then
    if new.current_day > public.app_today() then
      raise exception 'The next day hasn''t started yet' using errcode = 'check_violation';
    end if;
    if tg_op = 'UPDATE' and old.current_day is not null and new.current_day < old.current_day then
      raise exception 'You can''t go back to an earlier day' using errcode = 'check_violation';
    end if;
    if (tg_op = 'INSERT' or old.current_day is null) and new.current_day < public.app_today() - 1 then
      raise exception 'You can''t go back to an earlier day' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists user_settings_day on public.user_settings;
create trigger user_settings_day before insert or update on public.user_settings
  for each row execute function public.check_current_day();

-- Phone and PC see "Next day" instantly.
do $$ begin
  alter publication supabase_realtime add table public.user_settings;
exception when duplicate_object then null; end $$;
