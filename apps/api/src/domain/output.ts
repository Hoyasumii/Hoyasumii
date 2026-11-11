import { commandOf, outputOf } from "@afora/core";
import { hono } from "@afora/hono";
import type { Hono } from "hono";
import { authenticator } from "../lib/auth";
import {
	CreateApiKey,
	GetMcpServer,
	GetPushStatus,
	ListApiKeys,
	ListConnections,
	Me,
	Publish,
	RevokeApiKey,
	RevokeConnection,
	SendPush,
} from "./use-cases/admin";
import { collectionOperations } from "./use-cases/collections";
import {
	GetArticle,
	GetContent,
	GetPushKey,
	ListArticles,
	ListReleases,
	SubscribePush,
	UnsubscribePush,
} from "./use-cases/public";
import { settingsOperations } from "./use-cases/settings";

/* Commands: the use cases under operation names, one command per area of the API. */

export const Site = commandOf({
	name: "Site",
	useCases: {
		content: GetContent,
		articles: ListArticles,
		article: GetArticle,
		releases: ListReleases,
		pushKey: GetPushKey,
		subscribe: SubscribePush,
		unsubscribe: UnsubscribePush,
	},
});

export const Admin = commandOf({
	name: "Admin",
	useCases: {
		me: Me,
		mcp: GetMcpServer,
		publish: Publish,
		pushStatus: GetPushStatus,
		sendPush: SendPush,
		listApiKeys: ListApiKeys,
		createApiKey: CreateApiKey,
		revokeApiKey: RevokeApiKey,
		listConnections: ListConnections,
		revokeConnection: RevokeConnection,
	},
});

export const Settings = commandOf({
	name: "Settings",
	useCases: Object.fromEntries(
		Object.entries(settingsOperations).flatMap(([key, { get, put }]) => [
			[`get${key[0].toUpperCase()}${key.slice(1)}`, get],
			[`put${key[0].toUpperCase()}${key.slice(1)}`, put],
		]),
	),
});

/** One command per collection: Projects.list, Projects.create… */
export const Collections = Object.entries(collectionOperations).map(([name, useCases]) =>
	commandOf({ name: `${name[0].toUpperCase()}${name.slice(1)}`, useCases }),
);

/** Static headers of the public responses: the site and its visitors cache them. */
const responses = {
	"Site.content": { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" } },
	"Site.articles": { headers: { "cache-control": "public, max-age=300, s-maxage=1800" } },
	"Site.article": { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
	"Site.releases": { headers: { "cache-control": "public, max-age=300, s-maxage=1800" } },
};

/**
 * The API: every command served by the hono sink on `app`, which already holds the middlewares
 * (security headers, CORS, the services of the request) and the routes afora does not serve.
 */
export function apiOutput(app: Hono) {
	return outputOf({
		name: "Api",
		commands: [Site, Admin, Settings, ...Collections],
		statuses: {
			NotFound: 404,
			SlugTaken: 409,
			InvalidData: 400,
			BadRequest: 400,
			PushDisabled: 503,
			PublishFailed: 424,
		},
		pipe: [
			hono(
				{
					context: { variables: { services: "services" } },
					responses,
					security: { schemes: { bearer: { type: "http", scheme: "bearer" } } },
					docs: { path: "/openapi.json", info: { title: "Portfolio API", version: "1.0.0" } },
				},
				{ app, authenticator },
			),
		],
	});
}
