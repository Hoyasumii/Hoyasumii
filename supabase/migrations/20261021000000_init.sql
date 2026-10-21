-- Portfolio content. The API (Cloudflare Worker) is the only reader and writer and uses the
-- service role key, so RLS is enabled with no policies: anon/authenticated clients get nothing.

create table if not exists public.settings (
	key text primary key,
	value jsonb not null,
	updated_at timestamptz not null default now()
);

create table if not exists public.entries (
	id uuid primary key default gen_random_uuid(),
	collection text not null check (collection in ('projects', 'experience', 'stack', 'links', 'articles')),
	data jsonb not null,
	position integer not null default 0,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists entries_collection_position_idx on public.entries (collection, position);

-- Article slugs are URLs: keep them unique even if two saves race.
create unique index if not exists entries_article_slug_idx
	on public.entries ((data ->> 'slug'))
	where collection = 'articles';

alter table public.settings enable row level security;
alter table public.entries enable row level security;

-- Sets positions from the order of p_ids in one statement.
create or replace function public.reorder_entries(p_collection text, p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
	update public.entries as e
	set position = o.ordinality - 1, updated_at = now()
	from unnest(p_ids) with ordinality as o(id, ordinality)
	where e.id = o.id and e.collection = p_collection;
$$;

revoke execute on function public.reorder_entries(text, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_entries(text, uuid[]) to service_role;

-- Public bucket for images uploaded from the admin panel.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do nothing;
