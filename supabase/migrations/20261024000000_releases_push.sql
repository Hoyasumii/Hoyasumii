-- Release notes are a collection like the others; their slugs are URLs, so keep them unique.
alter table public.entries drop constraint if exists entries_collection_check;
alter table public.entries add constraint entries_collection_check
	check (collection in ('projects', 'experience', 'stack', 'links', 'articles', 'releases'));

create unique index if not exists entries_release_slug_idx
	on public.entries ((data ->> 'slug'))
	where collection = 'releases';

-- Browsers subscribed to release notifications (Web Push). Like the other tables, only the API
-- (service role) reads and writes them.
create table if not exists public.push_subscriptions (
	id uuid primary key default gen_random_uuid(),
	endpoint text not null unique,
	p256dh text not null,
	auth text not null,
	locale text not null check (locale in ('pt', 'en')),
	created_at timestamptz not null default now()
);

-- Releases already announced, so each one is sent once.
create table if not exists public.push_notifications (
	release_id uuid primary key references public.entries (id) on delete cascade,
	recipients integer not null default 0,
	sent_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_notifications enable row level security;
