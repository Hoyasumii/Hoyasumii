-- API keys for scripts and AI agents (MCP). Only the SHA-256 of each key is stored; the key itself
-- is shown once when it is created. Like the other tables, only the API (service role) reads it.

create table if not exists public.api_keys (
	id uuid primary key default gen_random_uuid(),
	name text not null check (char_length(name) between 1 and 60),
	prefix text not null,
	hash text not null unique,
	scope text not null check (scope in ('read', 'write')),
	created_at timestamptz not null default now(),
	last_used_at timestamptz,
	revoked_at timestamptz
);

create index if not exists api_keys_active_hash_idx on public.api_keys (hash) where revoked_at is null;

alter table public.api_keys enable row level security;
