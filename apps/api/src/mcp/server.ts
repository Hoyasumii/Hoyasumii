import { Exception, toOpenAPI } from "@afora/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
	type CollectionName,
	collectionNames,
	collectionSchemas,
	type SettingsKey,
	settingsKeys,
	settingsSchemas,
} from "@portfolio/shared";
import { z } from "zod";
import { entryOf, findEntity, getContent } from "../domain/content";
import { uploadFromUrl } from "../domain/media";
import type { Services } from "../domain/services";
import { Publish } from "../domain/use-cases/admin";
import { collectionOperations } from "../domain/use-cases/collections";
import { readSettings, saveSettings } from "../domain/use-cases/settings";
import { aforaPrincipal } from "../lib/auth";
import { deepMerge } from "../lib/merge";
import type { Principal } from "../services/auth";

// The MCP SDK describes tool inputs with Zod; the values themselves are validated by afora.
const collection = z
	.enum(collectionNames as [CollectionName, ...CollectionName[]])
	.describe("projects, experience, stack (icon groups), links, articles or releases (release notes)");
const settingsKey = z
	.enum(settingsKeys as [SettingsKey, ...SettingsKey[]])
	.describe("profile, seo, appearance (accent color and Skill Icons style per theme) or devto (dev.to articles)");
const fields = z
	.record(z.string(), z.unknown())
	.describe("Entry fields, following the schema returned by describe_schema");

const INSTRUCTIONS = `Edits the content of Alan Reis's portfolio (hoyasumii.dev). The site is static: every change
made here is saved and the site is rebuilt and redeployed by itself in 1-2 minutes.

Content:
- settings (one document each): profile, seo, appearance, devto.
- collections (ordered lists): projects, experience, stack, links, articles, releases.
Texts shown on the site are bilingual objects: { "pt": "...", "en": "..." }. Always fill both.
Stack icons and project stacks use Skill Icons names (ts, react, postgres, ...).
The accent color (appearance.accent) has a light and a dark variant, as 6 hex digits without "#";
keep each readable on its theme's background (#ebe9e3 light, #0e0e0d dark).
appearance.icons sets, for each theme of the site, the Skill Icons variant ("light" or "dark" tile) and
tint ("accent", a hex color, or "" for the original colors).
seo holds the site title and description, plus favicon (browser tab icon) and image (cover for shared
links, 1200x630) as image URLs, keywords and the X handle without "@". Use upload_image_from_url to host
an image before pointing a field at it.
Articles are Markdown; unpublished articles stay as drafts. devto turns the listing of dev.to articles
on or off; when enabled it needs url, the dev.to profile page (https://dev.to/username).

Releases are release notes: a new project (kind "launch") or something new in one (kind "feature"),
e.g. title "Skill Icons", version "26.10.3". They get their own page and show in the site's "news" panel,
never in the articles list. project is the id of the entry in projects (or "" for none); summary is one or
two sentences per language (the news panel and the push notification), body is Markdown per language.
With notify on, everyone subscribed in the browser gets a push notification once the release is live.
Whenever the user creates a project, publishes one, or tells you they shipped a feature, ask whether they
want a release note for it, and offer to draft it from what you know about the change.

Before creating or changing something, call describe_schema for its exact fields. Use update_entry and
update_settings to change only some fields: the rest is kept.`;

/** After a project is created or published, the agent should offer a release note. */
const RELEASE_HINT =
	'Ask the user whether they want a release note for this (collection "releases", kind "launch" for a new project, "feature" for something new in it).';

function ok(value: unknown): CallToolResult {
	return { content: [{ type: "text", text: JSON.stringify(value ?? null, null, 2) }] };
}

/** The issues of an invalid value, wherever afora put them on the exception. */
function issuesOf(error: Exception): unknown {
	for (let current: unknown = error; current instanceof Exception; current = current.cause) {
		const issues = (current.details as { issues?: unknown } | undefined)?.issues;
		if (Array.isArray(issues)) {
			return issues.map(({ path, message }: { path: unknown; message: string }) => ({
				path,
				message: message.replace(/^Invalid value for property "[^"]*": /, ""),
			}));
		}
	}
	return undefined;
}

/** Errors the caller can act on (validation, not found, conflicts) are told; the rest is logged. */
const TOLD = new Set([
	"InvalidUseCaseInput",
	"InvalidData",
	"NotFound",
	"SlugTaken",
	"BadRequest",
	"PublishFailed",
	"RepositoryUniqueViolation",
	"RepositoryEntityNotFound",
]);

function failure(error: unknown): CallToolResult {
	if (error instanceof Exception && TOLD.has(error.name)) {
		const issues = issuesOf(error);
		const text = `${error.message}${issues ? `\n${JSON.stringify(issues, null, 2)}` : ""}`;
		return { isError: true, content: [{ type: "text", text }] };
	}
	console.error("MCP tool failed", error);
	return { isError: true, content: [{ type: "text", text: "Something went wrong on the server" }] };
}

async function run(work: () => Promise<unknown>): Promise<CallToolResult> {
	try {
		return ok(await work());
	} catch (error) {
		return failure(error);
	}
}

/** One MCP server per request: the transport is stateless, so nothing is kept between calls. */
export function createMcpServer({ services, principal }: { services: Services; principal: Principal }) {
	const server = new McpServer({ name: "hoyasumii-portfolio", version: "1.0.0" }, { instructions: INSTRUCTIONS });
	const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

	// Tools run the same use cases as the HTTP API, with the caller's identity as their context.
	const { subject, claims } = aforaPrincipal(principal);
	const context = { services, subject, ...claims };
	const actor = claims.actor;
	// biome-ignore lint/suspicious/noExplicitAny: any use case of a collection, called with its own input
	const call = async (UseCase: any, input: object) => new UseCase(input, { context }).execute();
	const operations = (name: CollectionName) => collectionOperations[name];

	server.registerTool(
		"get_site_content",
		{
			title: "Get site content",
			description: "Everything the public site shows: settings plus published projects, experience, stack and links.",
			annotations: readOnly,
		},
		() => run(() => getContent(services)),
	);

	server.registerTool(
		"describe_schema",
		{
			title: "Describe schema",
			description: "JSON Schema of a collection entry or a settings document. Call it before writing.",
			inputSchema: { target: z.union([collection, settingsKey]) },
			annotations: readOnly,
		},
		({ target }) =>
			run(async () =>
				toOpenAPI(
					target in collectionSchemas
						? collectionSchemas[target as CollectionName]
						: settingsSchemas[target as SettingsKey],
				),
			),
	);

	server.registerTool(
		"list_entries",
		{
			title: "List entries",
			description: "All entries of a collection in display order, drafts and unpublished projects included.",
			inputSchema: { collection },
			annotations: readOnly,
		},
		({ collection }) => run(async () => (await call(operations(collection).list, {})).items),
	);

	server.registerTool(
		"get_entry",
		{
			title: "Get entry",
			description: "One entry of a collection by id.",
			inputSchema: { collection, id: z.string() },
			annotations: readOnly,
		},
		({ collection, id }) => run(() => call(operations(collection).get, { id })),
	);

	server.registerTool(
		"get_settings",
		{
			title: "Get settings",
			description: "A settings document: profile, seo, appearance or devto.",
			inputSchema: { key: settingsKey },
			annotations: readOnly,
		},
		({ key }) => run(() => readSettings(services, key)),
	);

	if (principal.scope !== "write") return server;

	server.registerTool(
		"create_entry",
		{
			title: "Create entry",
			description: "Adds an entry at the end of a collection. Every field of the schema is required.",
			inputSchema: { collection, data: fields },
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
		},
		async ({ collection, data }) => {
			const result = await run(() => call(operations(collection).create, data));
			if (collection === "projects" && !result.isError) result.content.push({ type: "text", text: RELEASE_HINT });
			return result;
		},
	);

	server.registerTool(
		"update_entry",
		{
			title: "Update entry",
			description:
				"Changes only the given fields of an entry; nested objects (like { pt, en }) merge, arrays are replaced.",
			inputSchema: { collection, id: z.string(), data: fields },
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		async ({ collection, id, data }) => {
			const result = await run(async () => {
				const { id: _id, position: _position, ...current } = entryOf(await findEntity(collection, id));
				return call(operations(collection).update, { ...deepMerge(current, data), id });
			});
			if (collection === "projects" && data.published === true && !result.isError) {
				result.content.push({ type: "text", text: RELEASE_HINT });
			}
			return result;
		},
	);

	server.registerTool(
		"delete_entry",
		{
			title: "Delete entry",
			description: "Deletes an entry. This cannot be undone.",
			inputSchema: { collection, id: z.string() },
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		},
		({ collection, id }) => run(() => call(operations(collection).remove, { id })),
	);

	server.registerTool(
		"reorder_entries",
		{
			title: "Reorder entries",
			description: "Sets the display order of a collection from a list of entry ids.",
			inputSchema: { collection, ids: z.array(z.string()).min(1) },
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		({ collection, ids }) => run(async () => (await call(operations(collection).reorder, { ids })).items),
	);

	server.registerTool(
		"update_settings",
		{
			title: "Update settings",
			description: "Changes only the given fields of a settings document (profile, seo, appearance or devto).",
			inputSchema: { key: settingsKey, data: fields },
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		({ key, data }) =>
			run(async () => saveSettings(services, actor, key, deepMerge(await readSettings(services, key), data))),
	);

	server.registerTool(
		"upload_image_from_url",
		{
			title: "Upload image from URL",
			description:
				"Copies a public https image (png, jpg, webp, avif or gif, up to 5 MB) to the site's storage and returns its URL, for covers, the avatar or articles.",
			inputSchema: { url: z.string().url() },
			annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
		},
		({ url }) => run(() => uploadFromUrl(services, url)),
	);

	server.registerTool(
		"publish_site",
		{
			title: "Publish site",
			description: "Rebuilds the site now. Not needed after edits (they publish by themselves).",
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		() => run(() => call(Publish, {})),
	);

	return server;
}
