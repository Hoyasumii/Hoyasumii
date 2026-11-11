import { blueprintOf, propertyOf } from "@afora/core";
import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Type } from "typebox";
import type { Cache } from "../cache/cache";
import type { VapidKeys } from "../push/web-push";
import type { TokenVerifier } from "../services/auth";
import type { Publisher } from "../services/publisher";
import type { MediaStorage } from "../storage/media-storage";

/** Runs work after the response when the runtime allows it (Workers' waitUntil). */
export type Background = (work: Promise<unknown>) => void;

export type PushConfig = {
	vapid: VapidKeys | null;
	/** Public address of the website (with its base path), for the links in notifications. */
	siteUrl: string | null;
};

/** What the Worker's bindings give: chosen once per isolate (see container.ts). */
export type Adapters = {
	cache: Cache;
	storage: MediaStorage;
	verifier: TokenVerifier;
	publisher: Publisher;
	push: PushConfig;
	/** For dev.to and push services; tests replace it. */
	fetcher: typeof fetch;
	adminEmails: string[];
	allowedOrigins: string[];
	/** Which adapters are in use, reported by /health. */
	mode: { database: "supabase" | "memory"; cache: "upstash" | "memory" };
};

/**
 * Everything a use case needs besides repositories, for one request: the adapters, where to run
 * work after the response, the public address of the API and the OAuth server's helpers. afora
 * only injects repositories as dependencies, so these reach use cases through their context
 * (`context.services`, set by a middleware in app.ts).
 */
export type Services = Adapters & {
	background: Background;
	/** Public address of this API, e.g. https://portfolio-api.example.workers.dev. */
	origin: string;
	oauth?: OAuthHelpers;
};

const ServicesProperty = propertyOf({ name: "services", schema: Type.Unsafe<Services>(Type.Any()) });

/** The context of public operations. */
export const publicContext = blueprintOf(() => ({ services: ServicesProperty }));

/**
 * The context of admin operations: the services, plus who calls, from the principal the
 * authenticator gave (see lib/auth.ts) through `access.context`.
 */
export const adminContext = blueprintOf((ctx) => ({
	services: ServicesProperty,
	/** "owner@example.com", 'API key "ci"' or 'app "Claude"': for logs and publish reasons. */
	actor: ctx.string,
	/** The session user's id, the key's id or the OAuth grant's user. */
	subject: ctx.string,
	via: ctx.enumOf(["session", "api-key", "oauth"]),
	/** What the caller may do: "write", or "read" for read-only API keys and connections. */
	scope: ctx.enumOf(["read", "write"]),
	/** The session user's email. */
	email: ctx.optional.string,
	/** The key's or the connected app's name. */
	name: ctx.optional.string,
}));

/** What `access.context` takes from the principal for `adminContext`. */
export const adminPrincipal = {
	actor: "claims.actor",
	subject: "subject",
	via: "claims.via",
	scope: "claims.scope",
	email: "claims.email",
	name: "claims.name",
} as const;

export const adminRead = { scopes: ["admin:read"], context: adminPrincipal } as const;
export const adminWrite = { scopes: ["admin:write"], context: adminPrincipal } as const;
/** Managing API keys and connections needs the owner's session: a leaked key must not mint others. */
export const sessionOnly = { scopes: ["session"], context: adminPrincipal } as const;
