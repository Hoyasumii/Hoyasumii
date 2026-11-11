/**
 * Fills an empty Supabase project with the default content.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run seed
 *
 * Settings are only written when missing, and a collection is only seeded when it is empty,
 * so running it twice changes nothing.
 */
import { createClient } from "@supabase/supabase-js";
import { store } from "../src/domain/repositories";
import { seedDefaults } from "../src/domain/seed";
import { SupabaseProvider } from "../src/providers/supabase";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
	console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}

store.use(new SupabaseProvider(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })));
for (const line of await seedDefaults()) console.log(line);
