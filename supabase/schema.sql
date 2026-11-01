-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Helper Function to securely get current user role without infinite recursion
drop function if exists public.get_current_user_role();
create or replace function public.get_current_user_role()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = auth.uid();
  return user_role;
end;
$$;

-- 1. Profiles Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  name text,
  role text check (role in ('STAFF', 'CLASS_ADVISOR', 'STUDENT')) default 'STUDENT',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Staff can view all profiles" on public.profiles;
create policy "Staff can view all profiles" on public.profiles for select using (
  public.get_current_user_role() in ('STAFF', 'CLASS_ADVISOR')
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Trigger to prevent role/email escalation during profile updates by students
drop function if exists public.protect_profile_fields() cascade;
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- If the user updating is a STUDENT, lock sensitive fields
  if public.get_current_user_role() = 'STUDENT' then
    new.id := old.id;
    new.email := old.email;
    new.role := old.role;
  end if;
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists enforce_profile_security on public.profiles;
create trigger enforce_profile_security
  before update on public.profiles
  for each row execute procedure public.protect_profile_fields();


-- 2. Staff / Faculty Table
drop table if exists public.staff cascade;
create table public.staff (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade unique,
  name text not null,
  department text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.staff enable row level security;
create policy "Staff can be viewed by all" on public.staff for select using (true);


-- 3. Classes Table
drop table if exists public.classes cascade;
create table public.classes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  department text,
  year integer,
  semester integer,
  section text,
  advisor_id uuid references public.staff(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.classes enable row level security;
create policy "Classes can be viewed by all" on public.classes for select using (true);


-- 4. Students Table
create table if not exists public.students (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade unique,
  class_id uuid references public.classes(id) on delete set null,
  name text not null,
  register_number text unique not null,
  department text,
  year integer,
  semester integer,
  section text,
  email text,
  parent_name text,
  parent_mobile text,
  photo_url text,
  face_registration_status boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Students
alter table public.students enable row level security;

drop policy if exists "Students can view their own record" on public.students;
create policy "Students can view their own record" on public.students for select using (profile_id = auth.uid());

drop policy if exists "Staff can view all students" on public.students;
create policy "Staff can view all students" on public.students for select using (
  public.get_current_user_role() in ('STAFF', 'CLASS_ADVISOR')
);

drop policy if exists "Advisors can modify their students" on public.students;
create policy "Advisors can modify their students" on public.students for all using (
  public.get_current_user_role() = 'CLASS_ADVISOR'
);

-- Function to handle new user signup
drop function if exists public.handle_new_user() cascade;
create or replace function public.handle_new_user() 
returns trigger 
language plpgsql 
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'STUDENT');
  return new;
end;
$$;

-- Trigger to call the function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 5. Subjects Table
drop table if exists public.subjects cascade;
create table public.subjects (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.subjects enable row level security;
create policy "Subjects can be viewed by all" on public.subjects for select using (true);


-- 5b. Class Subjects Mapping Table (Class -> Subject -> Faculty)
drop table if exists public.class_subjects cascade;
create table public.class_subjects (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  faculty_id uuid references public.staff(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (class_id, subject_id)
);

alter table public.class_subjects enable row level security;
create policy "Class subjects can be viewed by all" on public.class_subjects for select using (true);
create policy "Staff and advisors can manage class subjects" on public.class_subjects for all using (
  public.get_current_user_role() in ('CLASS_ADVISOR', 'STAFF')
);


-- 6. Timetable Table
drop table if exists public.timetable cascade;
create table public.timetable (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  faculty_id uuid references public.staff(id) on delete cascade not null,
  faculty_name text,
  day text check (day in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')) not null,
  period_number integer not null,
  start_time time not null,
  end_time time not null,
  room text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (class_id, day, period_number)
);

alter table public.timetable enable row level security;
create policy "Timetable can be viewed by all" on public.timetable for select using (true);
create policy "Advisors can manage timetable" on public.timetable for all using (
  public.get_current_user_role() = 'CLASS_ADVISOR'
);


-- 7. Attendance Table
drop table if exists public.attendance cascade;
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students(id) on delete cascade not null,
  timetable_id uuid references public.timetable(id) on delete cascade not null,
  date date not null default current_date,
  check_in_time timestamp with time zone,
  check_out_time timestamp with time zone,
  status text check (status in ('present', 'absent', 'od')) default 'absent',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (student_id, timetable_id, date)
);

-- RLS for Attendance
alter table public.attendance enable row level security;

create policy "Students can view their own attendance" on public.attendance for select using (
  student_id in (select id from public.students where profile_id = auth.uid())
);

create policy "Staff can view all attendance" on public.attendance for select using (
  public.get_current_user_role() in ('STAFF', 'CLASS_ADVISOR')
);

create policy "Staff can modify attendance" on public.attendance for all using (
  public.get_current_user_role() in ('STAFF', 'CLASS_ADVISOR')
);


-- 8. Alerts Table
drop table if exists public.alerts cascade;
create table public.alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.alerts enable row level security;
create policy "Users can view and manage their own alerts" on public.alerts for all using (
  user_id = auth.uid()
);


-- 9. Face Records Table
create table if not exists public.face_records (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students(id) on delete cascade not null,
  encoding_reference text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Face Records
alter table public.face_records enable row level security;

create policy "Students can view their own face records" on public.face_records for select using (
  student_id in (select id from public.students where profile_id = auth.uid())
);

create policy "Staff can view all face records" on public.face_records for select using (
  public.get_current_user_role() in ('STAFF', 'CLASS_ADVISOR')
);

create policy "Staff can modify face records" on public.face_records for all using (
  public.get_current_user_role() in ('STAFF', 'CLASS_ADVISOR')
);


-- ============================================================
-- 10. MIGRATION / SEED HELPER FOR CLASS-SUBJECT MAPPING
-- Run this block if class_subjects table has not been created yet
-- ============================================================
create table if not exists public.class_subjects (
  id uuid default gen_random_uuid() primary key,
  class_id uuid references public.classes(id) on delete cascade not null,
  subject_id uuid references public.subjects(id) on delete cascade not null,
  faculty_id uuid references public.staff(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (class_id, subject_id)
);

-- Add faculty_name column and unique constraint to timetable if migrating existing table
alter table public.timetable add column if not exists faculty_name text;
alter table public.timetable drop constraint if exists timetable_class_day_period_unique;
alter table public.timetable add constraint timetable_class_day_period_unique unique (class_id, day, period_number);


-- Seed mappings for existing classes, subjects, and staff
do $$
declare
  v_class_id uuid;
  v_staff_1 uuid;
  v_staff_2 uuid;
  v_sub_1 uuid;
  v_sub_2 uuid;
  v_sub_3 uuid;
  v_sub_4 uuid;
  v_sub_5 uuid;
begin
  select id into v_class_id from public.classes order by name limit 1;
  select id into v_staff_1 from public.staff order by name limit 1;
  select id into v_staff_2 from public.staff order by name desc limit 1;
  
  select id into v_sub_1 from public.subjects where code = 'CS301';
  select id into v_sub_2 from public.subjects where code = 'CS302';
  select id into v_sub_3 from public.subjects where code = 'CS303';
  select id into v_sub_4 from public.subjects where code = 'CS304';
  select id into v_sub_5 from public.subjects where code = 'CS305';

  if v_class_id is not null and v_staff_1 is not null then
    if v_sub_1 is not null then
      insert into public.class_subjects (class_id, subject_id, faculty_id)
      values (v_class_id, v_sub_1, v_staff_1) on conflict (class_id, subject_id) do update set faculty_id = excluded.faculty_id;
    end if;
    if v_sub_2 is not null then
      insert into public.class_subjects (class_id, subject_id, faculty_id)
      values (v_class_id, v_sub_2, coalesce(v_staff_2, v_staff_1)) on conflict (class_id, subject_id) do update set faculty_id = excluded.faculty_id;
    end if;
    if v_sub_3 is not null then
      insert into public.class_subjects (class_id, subject_id, faculty_id)
      values (v_class_id, v_sub_3, v_staff_1) on conflict (class_id, subject_id) do update set faculty_id = excluded.faculty_id;
    end if;
    if v_sub_4 is not null then
      insert into public.class_subjects (class_id, subject_id, faculty_id)
      values (v_class_id, v_sub_4, coalesce(v_staff_2, v_staff_1)) on conflict (class_id, subject_id) do update set faculty_id = excluded.faculty_id;
    end if;
    if v_sub_5 is not null then
      insert into public.class_subjects (class_id, subject_id, faculty_id)
      values (v_class_id, v_sub_5, v_staff_1) on conflict (class_id, subject_id) do update set faculty_id = excluded.faculty_id;
    end if;
  end if;
end $$;

