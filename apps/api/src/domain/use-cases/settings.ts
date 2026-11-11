import { blueprintOf, useCaseOf } from "@afora/core";
import { parseSettings, type Settings, type SettingsKey, settingsKeys, settingsSchemas } from "@portfolio/shared";
import { afterChange, getContent, storedSettings } from "../content";
import { SettingsDocument } from "../entities";
import { InvalidData } from "../exceptions";
import { SettingsDocuments } from "../repositories";
import { adminContext, adminRead, adminWrite, type Services } from "../services";

/** The document as saved, or, until it is first saved, what the site shows (the defaults). */
export async function readSettings<K extends SettingsKey>(services: Services, key: K): Promise<Settings[K]> {
	return (await storedSettings(key)) ?? (await getContent(services))[key];
}

/** Validates, fills defaults and saves a settings document; then the site is rebuilt. */
export async function saveSettings<K extends SettingsKey>(
	services: Services,
	actor: string,
	key: K,
	input: unknown,
): Promise<Settings[K]> {
	const parsed = parseSettings(key, input);
	if (parsed.issues) throw new InvalidData({ source: `settings.${key}`, details: { issues: parsed.issues } });

	const current = await SettingsDocuments.findById(key);
	if (current) await SettingsDocuments.update(current.change.value(parsed.value as never));
	else await SettingsDocuments.create(new SettingsDocument({ id: key, value: parsed.value as never }));
	await afterChange(services, `settings.${key} updated`, actor);
	return parsed.value;
}

function capitalized(name: string) {
	return name[0].toUpperCase() + name.slice(1);
}

/** `GET` and `PUT /admin/settings/<key>`, one pair per settings document. */
function settingsUseCases<K extends SettingsKey>(key: K) {
	const label = capitalized(key);
	const path = `/admin/settings/${key}`;
	// biome-ignore lint/suspicious/noExplicitAny: the four documents share one generic implementation
	const schema = settingsSchemas[key] as any as typeof settingsSchemas.profile;

	class Get extends useCaseOf({
		name: `Get${label}Settings`,
		route: { method: "get", path },
		access: adminRead,
		blueprint: blueprintOf(() => ({})),
		response: schema,
		context: adminContext,
	}) {
		override async execute() {
			return (await readSettings(this.context.services, key)) as Settings["profile"];
		}
	}

	class Put extends useCaseOf({
		name: `Put${label}Settings`,
		route: { method: "put", path },
		access: adminWrite,
		blueprint: schema,
		response: schema,
		context: adminContext,
		errors: [InvalidData],
	}) {
		override async execute() {
			return (await saveSettings(this.context.services, this.context.actor, key, this.input)) as Settings["profile"];
		}
	}

	return { get: Get, put: Put };
}

export const settingsOperations = Object.fromEntries(settingsKeys.map((key) => [key, settingsUseCases(key)])) as {
	[K in SettingsKey]: ReturnType<typeof settingsUseCases<K>>;
};
