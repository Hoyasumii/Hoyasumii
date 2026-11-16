import { blueprintOf, listOf, useCaseOf } from "@afora/core";
import { apiKeyCreateSchema, type OAuthConnection } from "@portfolio/shared";
import { createApiKey, listApiKeys, revokeApiKey } from "../api-keys";
import { EntryNotFound, PublishFailed, PushDisabled } from "../exceptions";
import { pushStatus, sendPending } from "../push";
import {
	apiKeyResponse,
	connectionResponse,
	idResponse,
	principalResponse,
	pushReportResponse,
	pushStatusResponse,
} from "../responses";
import { adminContext, adminRead, adminWrite, sessionOnly } from "../services";

const none = blueprintOf(() => ({}));

/** Who is calling: the owner's session, an API key or a connected app. */
export class Me extends useCaseOf({
	name: "Me",
	route: { method: "get", path: "/admin/me" },
	access: adminRead,
	blueprint: none,
	response: principalResponse,
	context: adminContext,
}) {
	override async execute() {
		const { via, subject, scope, email, name } = this.context;
		return { via, id: subject, scope, ...(email ? { email } : {}), ...(name ? { name } : {}) };
	}
}

/** The MCP endpoint of this deploy, the same address the OAuth server announces as its resource. */
export class GetMcpServer extends useCaseOf({
	name: "GetMcpServer",
	route: { method: "get", path: "/admin/mcp" },
	access: adminRead,
	blueprint: none,
	response: blueprintOf((ctx) => ({ url: ctx.string })),
	context: adminContext,
}) {
	override async execute() {
		return { url: `${this.context.services.origin}/mcp` };
	}
}

/** Rebuilds the website now (saving already does this). */
export class Publish extends useCaseOf({
	name: "Publish",
	route: { method: "post", path: "/admin/publish", status: 202 },
	access: adminWrite,
	blueprint: none,
	response: blueprintOf((ctx) => ({ queued: ctx.boolean })),
	context: adminContext,
	errors: [PublishFailed],
}) {
	override async execute() {
		try {
			await this.context.services.publisher.publish(`manual publish by ${this.context.actor}`);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			throw new PublishFailed({ source: "Publish", message: `GitHub refused the rebuild: ${reason}`, cause: error });
		}
		return { queued: true };
	}
}

/** Subscribers and releases waiting to be announced. */
export class GetPushStatus extends useCaseOf({
	name: "GetPushStatus",
	route: { method: "get", path: "/admin/push" },
	access: adminRead,
	blueprint: none,
	response: pushStatusResponse,
	context: adminContext,
}) {
	override async execute() {
		return pushStatus(this.context.services);
	}
}

/** Called by the deploy workflow once the site is live; sends each pending release once. */
export class SendPush extends useCaseOf({
	name: "SendPush",
	route: { method: "post", path: "/admin/push/send" },
	access: adminWrite,
	blueprint: none,
	response: pushReportResponse,
	context: adminContext,
	errors: [PushDisabled],
}) {
	override async execute() {
		return sendPending(this.context.services);
	}
}

/* API keys and connected apps: only from the owner's session. */

export class ListApiKeys extends useCaseOf({
	name: "ListApiKeys",
	route: { method: "get", path: "/admin/api-keys" },
	access: sessionOnly,
	blueprint: none,
	response: blueprintOf(() => ({ items: listOf(apiKeyResponse) })),
	context: adminContext,
}) {
	override async execute() {
		return { items: await listApiKeys() };
	}
}

export class CreateApiKey extends useCaseOf({
	name: "CreateApiKey",
	route: { method: "post", path: "/admin/api-keys", status: 201 },
	access: sessionOnly,
	blueprint: apiKeyCreateSchema,
	response: blueprintOf((ctx) => ({ apiKey: apiKeyResponse, key: ctx.string })),
	context: adminContext,
}) {
	override async execute() {
		return createApiKey({ ...this.input });
	}
}

export class RevokeApiKey extends useCaseOf({
	name: "RevokeApiKey",
	route: { method: "delete", path: "/admin/api-keys/{id}" },
	access: sessionOnly,
	blueprint: blueprintOf((ctx) => ({ id: ctx.string })),
	response: apiKeyResponse,
	context: adminContext,
	errors: [EntryNotFound],
}) {
	override async execute() {
		const key = await revokeApiKey(this.context.services.cache, this.input.id);
		if (!key) throw new EntryNotFound({ source: "RevokeApiKey", details: { what: "API key" } });
		return key;
	}
}

/** Apps authorized with OAuth (MCP connectors), from the OAuth server's grants for the owner. */
export class ListConnections extends useCaseOf({
	name: "ListConnections",
	route: { method: "get", path: "/admin/connections" },
	access: sessionOnly,
	blueprint: none,
	response: blueprintOf(() => ({ items: listOf(connectionResponse) })),
	context: adminContext,
}) {
	override async execute() {
		const oauth = this.context.services.oauth;
		if (!oauth) return { items: [] };

		const connections: OAuthConnection[] = [];
		let cursor: string | undefined;
		do {
			const page = await oauth.listUserGrants(encodeURIComponent(this.context.subject), { cursor });
			for (const grant of page.items) {
				connections.push({
					id: grant.id,
					clientName: grant.metadata?.clientName ?? "MCP connector",
					scope: grant.scope.includes("mcp:write") ? "write" : "read",
					redirectHost: grant.redirectUri ? new URL(grant.redirectUri).host : null,
					createdAt: new Date(grant.createdAt * 1000).toISOString(),
				});
			}
			cursor = page.cursor;
		} while (cursor);
		return { items: connections.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
	}
}

export class RevokeConnection extends useCaseOf({
	name: "RevokeConnection",
	route: { method: "delete", path: "/admin/connections/{id}" },
	access: sessionOnly,
	blueprint: blueprintOf((ctx) => ({ id: ctx.string })),
	response: idResponse,
	context: adminContext,
	errors: [EntryNotFound],
}) {
	override async execute() {
		const oauth = this.context.services.oauth;
		if (!oauth) throw new EntryNotFound({ source: "RevokeConnection", details: { what: "Connection" } });
		await oauth.revokeGrant(this.input.id, encodeURIComponent(this.context.subject));
		return { id: this.input.id };
	}
}
