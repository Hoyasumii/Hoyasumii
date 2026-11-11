import { blueprintOf, listOf, useCaseOf } from "@afora/core";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@portfolio/shared";
import { getArticle, getContent, listArticles, publishedReleases } from "../content";
import { EntryNotFound, PushDisabled } from "../exceptions";
import { publicKey, subscribe, unsubscribe } from "../push";
import { articleResponse, articleSummary, contentResponse, NullableString, releaseEntry } from "../responses";
import { publicContext } from "../services";

const open = { public: true } as const;

/** Everything the website renders, in one document. */
export class GetContent extends useCaseOf({
	name: "GetContent",
	route: { method: "get", path: "/content" },
	access: open,
	blueprint: blueprintOf(() => ({})),
	response: contentResponse,
	context: publicContext,
}) {
	override async execute() {
		return getContent(this.context.services);
	}
}

/** The site's own articles plus the author's dev.to posts, newest first. */
export class ListArticles extends useCaseOf({
	name: "ListArticles",
	route: { method: "get", path: "/articles" },
	access: open,
	blueprint: blueprintOf(() => ({})),
	response: blueprintOf(() => ({ items: listOf(articleSummary) })),
	context: publicContext,
}) {
	override async execute() {
		return { items: await listArticles(this.context.services) };
	}
}

export class GetArticle extends useCaseOf({
	name: "GetArticle",
	route: { method: "get", path: "/articles/{slug}" },
	access: open,
	blueprint: blueprintOf((ctx) => ({ slug: ctx.string })),
	response: articleResponse,
	context: publicContext,
	errors: [EntryNotFound],
}) {
	override async execute() {
		return getArticle(this.context.services, this.input.slug);
	}
}

/** Published release notes, newest first. */
export class ListReleases extends useCaseOf({
	name: "ListReleases",
	route: { method: "get", path: "/releases" },
	access: open,
	blueprint: blueprintOf(() => ({})),
	response: blueprintOf(() => ({ items: listOf(releaseEntry) })),
	context: publicContext,
}) {
	override async execute() {
		return { items: await publishedReleases(this.context.services) };
	}
}

/** The VAPID public key browsers subscribe with; null while push is not configured. */
export class GetPushKey extends useCaseOf({
	name: "GetPushKey",
	route: { method: "get", path: "/push/key" },
	access: open,
	blueprint: blueprintOf(() => ({})),
	response: blueprintOf(() => ({ publicKey: NullableString })),
	context: publicContext,
}) {
	override async execute() {
		return { publicKey: publicKey(this.context.services) };
	}
}

export class SubscribePush extends useCaseOf({
	name: "SubscribePush",
	route: { method: "post", path: "/push/subscriptions", status: 201 },
	access: open,
	blueprint: pushSubscriptionSchema,
	response: blueprintOf((ctx) => ({ subscribed: ctx.boolean })),
	context: publicContext,
	errors: [PushDisabled],
}) {
	override async execute() {
		await subscribe(this.context.services, structuredClone(this.input));
		return { subscribed: true };
	}
}

/** The endpoint comes in the query: `DELETE /push/subscriptions?endpoint=…`. */
export class UnsubscribePush extends useCaseOf({
	name: "UnsubscribePush",
	route: { method: "delete", path: "/push/subscriptions" },
	access: open,
	blueprint: pushUnsubscribeSchema,
	response: blueprintOf((ctx) => ({ subscribed: ctx.boolean })),
	context: publicContext,
}) {
	override async execute() {
		await unsubscribe(this.input.endpoint);
		return { subscribed: false };
	}
}
