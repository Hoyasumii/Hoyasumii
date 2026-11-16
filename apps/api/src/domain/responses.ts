import { blueprintOf, listOf, propertyOf } from "@afora/core";
import {
	apiKeyScopes,
	appearanceSchema,
	type CollectionName,
	collectionSchemas,
	devtoSchema,
	profileSchema,
	releaseInput,
	seoSchema,
} from "@portfolio/shared";
import { Type } from "typebox";

/** Response blueprints: afora checks every response against its use case's. */

export const NullableString = propertyOf({ name: "nullableString", schema: Type.Union([Type.String(), Type.Null()]) });

const identified = blueprintOf((ctx) => ({ id: ctx.string, position: ctx.integer }));

/** An entry as the API returns it: its fields, id and position. */
export const entrySchemas = Object.fromEntries(
	Object.entries(collectionSchemas).map(([name, schema]) => [name, schema.join(identified)]),
) as { [N in CollectionName]: ReturnType<(typeof collectionSchemas)[N]["join"]> };

export const releaseEntry = releaseInput.join(identified);

export const contentResponse = blueprintOf(() => ({
	profile: profileSchema,
	seo: seoSchema,
	appearance: appearanceSchema,
	devto: devtoSchema,
	projects: listOf(entrySchemas.projects),
	experience: listOf(entrySchemas.experience),
	stack: listOf(entrySchemas.stack),
	links: listOf(entrySchemas.links),
	updatedAt: NullableString,
}));

const articleFields = (ctx: { string: typeof import("@afora/core").StringProperty }) => ({
	slug: ctx.string,
	source: propertyOf({ name: "articleSource", schema: Type.Union([Type.Literal("site"), Type.Literal("devto")]) }),
	title: ctx.string,
	excerpt: ctx.string,
	lang: ctx.string,
	publishedAt: ctx.string,
	readingMinutes: propertyOf({ name: "minutes", schema: Type.Number() }),
	tags: listOf(ctx.string),
	cover: NullableString,
	externalUrl: NullableString,
});

export const articleSummary = blueprintOf((ctx) => articleFields(ctx));
export const articleResponse = blueprintOf((ctx) => ({
	...articleFields(ctx),
	format: ctx.enumOf(["markdown", "html"]),
	body: ctx.string,
}));

export const apiKeyResponse = blueprintOf((ctx) => ({
	id: ctx.string,
	name: ctx.string,
	prefix: ctx.string,
	scope: ctx.enumOf(apiKeyScopes),
	createdAt: ctx.string,
	lastUsedAt: NullableString,
	revokedAt: NullableString,
}));

export const principalResponse = blueprintOf((ctx) => ({
	via: ctx.enumOf(["session", "api-key", "oauth"]),
	id: ctx.string,
	scope: ctx.enumOf(apiKeyScopes),
	email: ctx.optional.string,
	name: ctx.optional.string,
}));

export const pushStatusResponse = blueprintOf((ctx) => ({
	enabled: ctx.boolean,
	subscribers: ctx.integer,
	pending: listOf(blueprintOf(() => ({ id: ctx.string, title: ctx.string, slug: ctx.string }))),
}));

export const pushReportResponse = blueprintOf((ctx) => ({
	sent: listOf(blueprintOf(() => ({ id: ctx.string, slug: ctx.string, recipients: ctx.integer, failed: ctx.integer }))),
	waiting: listOf(ctx.string),
	skipped: listOf(ctx.string),
	removed: ctx.integer,
}));

export const connectionResponse = blueprintOf((ctx) => ({
	id: ctx.string,
	clientName: ctx.string,
	scope: ctx.enumOf(apiKeyScopes),
	redirectHost: NullableString,
	createdAt: ctx.string,
}));

export const empty = blueprintOf(() => ({}));
export const idResponse = blueprintOf((ctx) => ({ id: ctx.string }));
