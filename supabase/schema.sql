-- =========================================================================
-- DY 교육 신청 플랫폼 Supabase 스키마
-- 실행 순서: Supabase → SQL Editor 에 통째로 붙여넣고 Run
-- =========================================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- =========================================================================
-- 1. Profiles (auth.users 와 연결)
-- =========================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  email      text not null unique,
  dept       text,
  role       text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz default now()
);

-- 회원가입 시 자동으로 profile 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
          new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- 2. Trainings (교육 과정)
-- =========================================================================
create table if not exists public.trainings (
  id          text primary key,
  title       text not null,
  category    text,
  tag_color   text default 'blue',
  short_desc  text,
  description text,
  hours       int default 0,
  created_at  timestamptz default now()
);

-- =========================================================================
-- 3. Training Sessions (차수)
-- =========================================================================
create table if not exists public.training_sessions (
  id          text primary key,
  training_id text not null references public.trainings(id) on delete cascade,
  round_no    int  not null,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  location    text,
  capacity    int  not null default 0,
  created_at  timestamptz default now(),
  unique (training_id, round_no)
);

-- =========================================================================
-- 4. Applications (신청)
-- =========================================================================
create table if not exists public.applications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  training_id text not null references public.trainings(id) on delete cascade,
  session_id  text not null references public.training_sessions(id) on delete restrict,
  status      text not null default 'confirmed'
              check (status in ('confirmed','cancelled')),
  applied_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 한 사용자당 같은 교육에 대해 active 신청은 1건만 (취소된 건은 남겨둠)
create unique index if not exists uq_active_application
  on public.applications (user_id, training_id)
  where status = 'confirmed';

create index if not exists idx_applications_session on public.applications(session_id);
create index if not exists idx_applications_user    on public.applications(user_id);

-- =========================================================================
-- 5. 뷰 (UI 편의용)
-- =========================================================================

-- 차수 + 현재 신청 인원
create or replace view public.training_sessions_with_count as
  select s.*,
         (select count(*) from public.applications a
           where a.session_id = s.id and a.status = 'confirmed') as registered_count
    from public.training_sessions s;

-- 신청 상세
create or replace view public.applications_detail as
  select a.*,
         p.name  as user_name,
         p.email as user_email,
         p.dept  as user_dept,
         t.title as training_title,
         t.category as training_category,
         s.round_no,
         s.start_at, s.end_at, s.location
    from public.applications a
    join public.profiles p on p.id = a.user_id
    join public.trainings t on t.id = a.training_id
    join public.training_sessions s on s.id = a.session_id;

-- 교육 단위 집계
create or replace view public.training_stats as
  select t.*,
         coalesce(sum(s.capacity), 0) as capacity_total,
         (select count(*) from public.applications a
           where a.training_id = t.id and a.status = 'confirmed') as registered_total,
         case when coalesce(sum(s.capacity), 0) = 0 then 0
              else (select count(*) from public.applications a
                     where a.training_id = t.id and a.status = 'confirmed')::numeric
                   / sum(s.capacity) end as fill_rate
    from public.trainings t
    left join public.training_sessions s on s.training_id = t.id
   group by t.id;

-- =========================================================================
-- 6. RPC 함수 (선착순 원자성 보장)
-- =========================================================================

-- 신청하기: 정원 체크 + 중복 신청 방지를 한 트랜잭션에서 처리
create or replace function public.apply_session (p_user uuid, p_session text)
returns uuid
language plpgsql security definer
as $$
declare
  v_training text;
  v_capacity int;
  v_count    int;
  v_app_id   uuid;
begin
  -- 해당 세션 잠금 (동시 신청 방지)
  select training_id, capacity into v_training, v_capacity
    from public.training_sessions
   where id = p_session
   for update;

  if v_training is null then
    raise exception '존재하지 않는 차수입니다.';
  end if;

  -- 해당 교육에 이미 active 신청이 있는지
  if exists (
    select 1 from public.applications
     where user_id = p_user and training_id = v_training and status = 'confirmed'
  ) then
    raise exception '해당 교육은 이미 신청하셨습니다.';
  end if;

  -- 정원 체크
  select count(*) into v_count
    from public.applications
   where session_id = p_session and status = 'confirmed';

  if v_count >= v_capacity then
    raise exception '정원이 마감되었습니다.';
  end if;

  insert into public.applications (user_id, training_id, session_id)
  values (p_user, v_training, p_session)
  returning id into v_app_id;

  return v_app_id;
end;
$$;

-- 차수 변경
create or replace function public.change_session (p_app uuid, p_new_session text)
returns void
language plpgsql security definer
as $$
declare
  v_training text;
  v_capacity int;
  v_count    int;
  v_user     uuid;
begin
  select user_id into v_user from public.applications where id = p_app;
  if v_user is null then raise exception '신청 내역을 찾을 수 없습니다.'; end if;

  select training_id, capacity into v_training, v_capacity
    from public.training_sessions where id = p_new_session for update;

  select count(*) into v_count
    from public.applications
   where session_id = p_new_session and status = 'confirmed' and id <> p_app;
  if v_count >= v_capacity then
    raise exception '변경하려는 차수가 마감되었습니다.';
  end if;

  update public.applications
     set session_id = p_new_session,
         status     = 'confirmed',
         updated_at = now()
   where id = p_app;
end;
$$;

-- 신청 취소
create or replace function public.cancel_application (p_app uuid)
returns void
language plpgsql security definer
as $$
begin
  update public.applications
     set status = 'cancelled', updated_at = now()
   where id = p_app;
end;
$$;

-- =========================================================================
-- 7. Row Level Security
-- =========================================================================
alter table public.profiles           enable row level security;
alter table public.trainings          enable row level security;
alter table public.training_sessions  enable row level security;
alter table public.applications       enable row level security;

-- Helper: 현재 사용자 admin 여부
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- profiles: 본인 또는 관리자만 읽기, 본인만 수정
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

-- trainings / sessions: 로그인한 누구나 읽기, 관리자만 수정
drop policy if exists "trainings_select" on public.trainings;
create policy "trainings_select" on public.trainings
  for select using (auth.role() = 'authenticated');
drop policy if exists "trainings_admin_all" on public.trainings;
create policy "trainings_admin_all" on public.trainings
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "sessions_select" on public.training_sessions;
create policy "sessions_select" on public.training_sessions
  for select using (auth.role() = 'authenticated');
drop policy if exists "sessions_admin_all" on public.training_sessions;
create policy "sessions_admin_all" on public.training_sessions
  for all using (public.is_admin()) with check (public.is_admin());

-- applications: 본인 것 읽기/관리자 전체 / 쓰기는 RPC 경유
drop policy if exists "apps_select_own_or_admin" on public.applications;
create policy "apps_select_own_or_admin" on public.applications
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "apps_admin_write" on public.applications;
create policy "apps_admin_write" on public.applications
  for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- 8. 리마인더 대상자 뷰 (Edge Function 에서 사용)
-- =========================================================================
create or replace view public.reminder_targets as
  select t.id   as training_id,
         t.title as training_title,
         p.id   as user_id,
         p.name as user_name,
         p.email as user_email
    from public.trainings t
    cross join public.profiles p
   where p.role = 'member'
     and not exists (
       select 1 from public.applications a
        where a.user_id = p.id
          and a.training_id = t.id
          and a.status = 'confirmed'
     );
