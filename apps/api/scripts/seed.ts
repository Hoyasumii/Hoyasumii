/**
 * Fills an empty Supabase project with the default content.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun run seed
 *
 * Settings are only written when missing, and a collection is only seeded when it is empty,
 * so running it twice changes nothing.
 */
import { collectionNames, defaultCollections, defaultSettings, settingsKeys } from "@portfolio/shared";
import { createClient } from "@supabase/supabase-js";
import { SupabaseContentRepository } from "../src/repositories/supabase";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
	console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
	process.exit(1);
}

const repository = new SupabaseContentRepository(
	createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
);

for (const name of settingsKeys) {
	if (await repository.getSettings(name)) {
		console.log(`settings.${name}: already set`);
		continue;
	}
	await repository.putSettings(name, defaultSettings[name] as never);
	console.log(`settings.${name}: seeded`);
}

for (const name of collectionNames) {
	if ((await repository.list(name)).length > 0) {
		console.log(`${name}: not empty, skipped`);
		continue;
	}
	for (const input of defaultCollections[name]) await repository.create(name, input as never);
	console.log(`${name}: ${defaultCollections[name].length} entries`);
}
