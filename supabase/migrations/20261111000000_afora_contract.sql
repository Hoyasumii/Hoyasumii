-- The table the afora provider contract kit runs against (apps/api/test/supabase-provider.test.ts):
-- any entity as a JSON document, keyed by its record name. The site itself never uses it, and like
-- every other table only the API's service role may touch it.
create table if not exists public.afora_contract (
	entity text not null,
	id text not null,
	data jsonb not null default '{}'::jsonb,
	primary key (entity, id)
);

alter table public.afora_contract enable row level security;
