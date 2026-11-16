import {
	blueprintBuilderOf,
	blueprintOf,
	CreatedAt,
	DeletedAt,
	entityBuilderOf,
	propertyOf,
	UpdatedAt,
} from "@afora/core";
import {
	apiKeyScopes,
	articleInput,
	type CollectionName,
	experienceInput,
	linkInput,
	localeSchema,
	projectInput,
	releaseInput,
	stackGroupInput,
} from "@portfolio/shared";
import { Type } from "typebox";

/**
 * Ids are opaque strings: the rows written before afora carry UUID v4 ids (and the in-memory seed
 * ids like `projects-1`), so the UUID v7 identity of the standard `entityOf` would reject them.
 * New entities still get a random UUID, which the uuid columns of Postgres accept.
 */
const AnyId = propertyOf({ name: "id", schema: Type.String({ minLength: 1, maxLength: 128 }), unique: true });

export const entityOf = entityBuilderOf({
	identity: blueprintBuilderOf()(() => ({
		id: AnyId,
		createdAt: CreatedAt,
		updatedAt: UpdatedAt,
		deletedAt: DeletedAt,
	})),
	generateId: () => crypto.randomUUID(),
	now: () => new Date().toISOString(),
});

const positioned = blueprintOf((ctx) => ({ position: ctx.integer({ min: 0 }) }));

/* Collections: one entity each, stored in the `entries` table (see providers/supabase.ts). */

export class Project extends entityOf(projectInput.join(positioned), { name: "projects", change: ["position"] }) {}
export class Experience extends entityOf(experienceInput.join(positioned), {
	name: "experience",
	change: ["position"],
}) {}
export class StackGroup extends entityOf(stackGroupInput.join(positioned), { name: "stack", change: ["position"] }) {}
export class Link extends entityOf(linkInput.join(positioned), { name: "links", change: ["position"] }) {}
/** Article and release slugs are their URLs, so two entries of one collection can't share one. */
export class Article extends entityOf(articleInput.join(positioned), {
	name: "articles",
	unique: ["slug"],
	change: ["position"],
}) {}
export class Release extends entityOf(releaseInput.join(positioned), {
	name: "releases",
	unique: ["slug"],
	change: ["position"],
}) {}

export const collectionEntities = {
	projects: Project,
	experience: Experience,
	stack: StackGroup,
	links: Link,
	articles: Article,
	releases: Release,
} as const satisfies Record<CollectionName, unknown>;

/** A settings document: `id` is its key (profile, seo, appearance, devto), `value` the document. */
export class SettingsDocument extends entityOf(
	blueprintOf((ctx) => ({ value: ctx.json })),
	{ name: "settings", change: ["value"] },
) {}

/** An API key, stored by the SHA-256 of its value; the value itself is never stored. */
export class StoredApiKey extends entityOf(
	blueprintOf((ctx) => ({
		name: ctx.text({ max: 60 }),
		prefix: ctx.string,
		hash: propertyOf({ name: "keyHash", schema: Type.String(), sensitive: true, unique: true }),
		scope: ctx.enumOf(apiKeyScopes),
		lastUsedAt: ctx.optional.dateTime,
		revokedAt: ctx.optional.dateTime,
	})),
	{ name: "api_keys", change: ["lastUsedAt", "revokedAt"] },
) {}

/** A browser subscribed to release notifications. */
export class PushSubscriptionRecord extends entityOf(
	blueprintOf((ctx) => ({
		endpoint: propertyOf({ name: "endpoint", schema: Type.String({ maxLength: 2048 }), unique: true }),
		keys: blueprintOf(() => ({ p256dh: ctx.string, auth: ctx.string })),
		locale: localeSchema,
	})),
	{ name: "push_subscriptions" },
) {}

/** A release already announced (or skipped): `id` is the release's id. */
export class PushNotification extends entityOf(
	blueprintOf((ctx) => ({ recipients: ctx.integer({ min: 0 }) })),
	{ name: "push_notifications" },
) {}
