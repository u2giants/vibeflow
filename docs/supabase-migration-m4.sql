-- VibeFlow Milestone 4: Cloud Sync + Real-time + Device Ownership
-- Run this in the Supabase SQL editor to add sync tables and RLS policies.

-- ── Conversations table (synced) ─────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects on delete cascade,
  user_id uuid references auth.users on delete cascade,
  title text not null,
  run_state text not null default 'idle',
  owner_device_id uuid references public.devices,
  owner_device_name text,
  lease_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── Messages table (synced) ─────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null,
  content text not null,
  mode_id text,
  model_id text,
  created_at timestamptz default now()
);

-- ── Conversation leases table (for ownership tracking) ──────────────
create table if not exists public.conversation_leases (
  conversation_id uuid primary key references public.conversations on delete cascade,
  device_id uuid references public.devices on delete cascade,
  device_name text not null,
  acquired_at timestamptz default now(),
  expires_at timestamptz not null,
  heartbeat_interval_seconds integer not null default 15
);

-- ── Enable Row Level Security ───────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_leases enable row level security;

-- ── RLS Policies ────────────────────────────────────────────────────

-- Conversations: users can only see and manage their own
create policy "Users can view own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can manage own conversations"
  on public.conversations for all
  using (auth.uid() = user_id);

-- Messages: users can only see and manage their own
create policy "Users can view own messages"
  on public.messages for select
  using (auth.uid() = user_id);

create policy "Users can manage own messages"
  on public.messages for all
  using (auth.uid() = user_id);

-- Conversation leases: users can only see and manage leases for their own conversations
create policy "Users can view own leases"
  on public.conversation_leases for select
  using (
    auth.uid() = (select user_id from public.conversations where id = conversation_id)
  );

create policy "Users can manage own leases"
  on public.conversation_leases for all
  using (
    auth.uid() = (select user_id from public.conversations where id = conversation_id)
  )
  with check (
    auth.uid() = (select user_id from public.conversations where id = conversation_id)
  );

-- ── Enable Realtime ─────────────────────────────────────────────────
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_leases;
