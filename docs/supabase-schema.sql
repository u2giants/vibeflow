-- VibeFlow Supabase Database Schema
-- Run this in the Supabase SQL editor to set up required tables.

-- profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz default now()
);

-- devices table
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);

-- projects table
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  description text,
  is_self_maintenance boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.projects enable row level security;

-- RLS policies (users can only see their own data)
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view own devices" on public.devices for select using (auth.uid() = user_id);
create policy "Users can manage own devices" on public.devices for all using (auth.uid() = user_id);
create policy "Users can view own projects" on public.projects for select using (auth.uid() = user_id);
create policy "Users can manage own projects" on public.projects for all using (auth.uid() = user_id);
