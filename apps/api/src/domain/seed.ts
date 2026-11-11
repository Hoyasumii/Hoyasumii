import { buildDefaultContent, type CollectionName, collectionNames, settingsKeys } from "@portfolio/shared";
import { entityClassOf, repositoryOf } from "./content";
import { SettingsDocument } from "./entities";
import { SettingsDocuments } from "./repositories";

/**
 * Writes the default content where there is none: settings only when missing, and a collection
 * only when it is empty, so running it twice changes nothing. Returns what it did, for logs.
 * `keepIds` keeps the seed's ids (`projects-1`), for the in-memory store; Postgres wants UUIDs.
 */
export async function seedDefaults({ keepIds = false } = {}): Promise<string[]> {
	const content = buildDefaultContent();
	const report: string[] = [];

	for (const key of settingsKeys) {
		if (await SettingsDocuments.findById(key)) {
			report.push(`settings.${key}: already set`);
			continue;
		}
		await SettingsDocuments.create(new SettingsDocument({ id: key, value: structuredClone(content[key]) as never }));
		report.push(`settings.${key}: seeded`);
	}

	for (const name of collectionNames as CollectionName[]) {
		const repository = repositoryOf(name);
		if ((await repository.findMany({ limit: 1 })).length > 0) {
			report.push(`${name}: not empty, skipped`);
			continue;
		}
		const entries = (content as unknown as Record<string, Record<string, unknown>[] | undefined>)[name] ?? [];
		const Entity = entityClassOf(name);
		for (const { id, ...entry } of entries) {
			await repository.create(new Entity({ ...structuredClone(entry), ...(keepIds ? { id } : {}) }));
		}
		report.push(`${name}: ${entries.length} entries`);
	}
	return report;
}
