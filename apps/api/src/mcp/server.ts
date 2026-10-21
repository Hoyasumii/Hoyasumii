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
import type { Deps } from "../container";
import { HttpError } from "../lib/errors";
import type { AdminService } from "../services/admin";
import type { Principal } from "../services/auth";

const collection = z
	.enum(collectionNames as [CollectionName, ...CollectionName[]])
	.describe("projects, experience, stack (icon groups), links or articles");
const settingsKey = z
	.enum(settingsKeys as [SettingsKey, ...SettingsKey[]])
	.describe("profile, seo or appearance (accent color and Skill Icons style per theme)");
const fields = z
	.record(z.string(), z.unknown())
	.describe("Entry fields, following the schema returned by describe_schema");

const INSTRUCTIONS = `Edits the content of Alan Reis's portfolio (hoyasumii.dev). The site is static: every change
made here is saved and the site is rebuilt and redeployed by itself in 1-2 minutes.

Content:
- settings (one document each): profile, seo, appearance.
- collections (ordered lists): projects, experience, stack, links, articles.
Texts shown on the site are bilingual objects: { "pt": "...", "en": "..." }. Always fill both.
Stack icons and project stacks use Skill Icons names (ts, react, postgres, ...).
The accent color (appearance.accent) has a light and a dark variant, as 6 hex digits without "#";
keep each readable on its theme's background (#ebe9e3 light, #0e0e0d dark).
appearance.icons sets, for each theme of the site, the Skill Icons variant ("light" or "dark" tile) and
tint ("accent", a hex color, or "" for the original colors).
seo holds the site title and description, plus favicon (browser tab icon) and image (cover for shared
links, 1200x630) as image URLs, keywords and the X handle without "@". Use upload_image_from_url to host
an image before pointing a field at it.
Articles are Markdown; unpublished articles stay as drafts.

Before creating or changing something, call describe_schema for its exact fields. Use update_entry and
update_settings to change only some fields: the rest is kept.`;

function ok(value: unknown): CallToolResult {
	return { content: [{ type: "text", text: JSON.stringify(value ?? null, null, 2) }] };
}

function failure(error: unknown): CallToolResult {
	if (error instanceof HttpError) {
		const issues = error.issues ? `\n${JSON.stringify(error.issues, null, 2)}` : "";
		return { isError: true, content: [{ type: "text", text: `${error.message}${issues}` }] };
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
export function createMcpServer({ deps, admin, principal }: { deps: Deps; admin: AdminService; principal: Principal }) {
	const server = new McpServer({ name: "hoyasumii-portfolio", version: "1.0.0" }, { instructions: INSTRUCTIONS });
	const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

	server.registerTool(
		"get_site_content",
		{
			title: "Get site content",
			description: "Everything the public site shows: settings plus published projects, experience, stack and links.",
			annotations: readOnly,
		},
		() => run(() => deps.content.getPublic()),
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
			run(async () => {
				const schema =
					target in collectionSchemas
						? collectionSchemas[target as CollectionName]
						: settingsSchemas[target as SettingsKey];
				return z.toJSONSchema(schema);
			}),
	);

	server.registerTool(
		"list_entries",
		{
			title: "List entries",
			description: "All entries of a collection in display order, drafts and unpublished projects included.",
			inputSchema: { collection },
			annotations: readOnly,
		},
		({ collection }) => run(() => admin.list(collection)),
	);

	server.registerTool(
		"get_entry",
		{
			title: "Get entry",
			description: "One entry of a collection by id.",
			inputSchema: { collection, id: z.string() },
			annotations: readOnly,
		},
		({ collection, id }) => run(() => admin.get(collection, id)),
	);

	server.registerTool(
		"get_settings",
		{
			title: "Get settings",
			description: "A settings document: profile, seo or appearance.",
			inputSchema: { key: settingsKey },
			annotations: readOnly,
		},
		({ key }) => run(() => admin.getSettings(key)),
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
		({ collection, data }) => run(() => admin.create(collection, data)),
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
		({ collection, id, data }) => run(() => admin.patch(collection, id, data)),
	);

	server.registerTool(
		"delete_entry",
		{
			title: "Delete entry",
			description: "Deletes an entry. This cannot be undone.",
			inputSchema: { collection, id: z.string() },
			annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
		},
		({ collection, id }) => run(() => admin.remove(collection, id)),
	);

	server.registerTool(
		"reorder_entries",
		{
			title: "Reorder entries",
			description: "Sets the display order of a collection from a list of entry ids.",
			inputSchema: { collection, ids: z.array(z.string()).min(1) },
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		({ collection, ids }) => run(() => admin.reorder(collection, ids)),
	);

	server.registerTool(
		"update_settings",
		{
			title: "Update settings",
			description: "Changes only the given fields of a settings document (profile, seo or appearance).",
			inputSchema: { key: settingsKey, data: fields },
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		({ key, data }) => run(() => admin.patchSettings(key, data)),
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
		({ url }) => run(() => admin.uploadFromUrl(url)),
	);

	server.registerTool(
		"publish_site",
		{
			title: "Publish site",
			description: "Rebuilds the site now. Not needed after edits (they publish by themselves).",
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
		},
		() =>
			run(async () => {
				await admin.publish();
				return { queued: true };
			}),
	);

	return server;
}
