create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  key_id      uuid not null references public.translation_keys(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  message     text not null check (char_length(message) > 0 and char_length(message) <= 2000),
  created_at  timestamptz not null default now()
);

create index comments_key_id_idx on public.comments(key_id);
create index comments_created_at_idx on public.comments(created_at desc);

alter table public.comments enable row level security;

-- Anyone who can see the project can read comments
create policy "comments_select" on public.comments
  for select using (true);

-- Authenticated users can insert their own comments
create policy "comments_insert" on public.comments
  for insert with check (auth.uid() = user_id);

-- Only comment author can delete
create policy "comments_delete" on public.comments
  for delete using (auth.uid() = user_id);
