import { inMemoryProvider, repositoryOf } from "@afora/core";
import type { IRepositoryProvider, ProviderQuery, RepositoryContext, RepositoryData } from "@afora/core/adapters";
import {
	Article,
	Experience,
	Link,
	Project,
	PushNotification,
	PushSubscriptionRecord,
	Release,
	SettingsDocument,
	StackGroup,
	StoredApiKey,
} from "./entities";

/**
 * The provider every repository writes through. The store is chosen from the Worker's bindings
 * (Supabase, or memory without credentials; see container.ts) once the first request arrives, so
 * the repositories, declared here at module level, hand each call to whichever provider is in use.
 */
class StoreProvider implements IRepositoryProvider {
	private target: IRepositoryProvider = inMemoryProvider();

	use(provider: IRepositoryProvider) {
		this.target = provider;
	}

	get current(): IRepositoryProvider {
		return this.target;
	}

	findOne(context: RepositoryContext, query?: ProviderQuery) {
		return this.target.findOne(context, query);
	}
	findMany(context: RepositoryContext, query?: ProviderQuery) {
		return this.target.findMany(context, query);
	}
	insert(context: RepositoryContext, data: RepositoryData) {
		return this.target.insert(context, data);
	}
	update(context: RepositoryContext, data: RepositoryData) {
		return this.target.update(context, data);
	}
	remove(context: RepositoryContext, id: string) {
		return this.target.remove(context, id);
	}
	count(context: RepositoryContext, query?: ProviderQuery) {
		return this.target.count(context, query);
	}
}

export const store = new StoreProvider();

const entryActions = ["findById", "findMany", "create", "update", "delete"] as const;

export const Projects = repositoryOf({ entity: Project, actions: entryActions, provider: store });
export const ExperienceEntries = repositoryOf({ entity: Experience, actions: entryActions, provider: store });
export const StackGroups = repositoryOf({ entity: StackGroup, actions: entryActions, provider: store });
export const Links = repositoryOf({ entity: Link, actions: entryActions, provider: store });
export const Articles = repositoryOf({
	entity: Article,
	actions: [...entryActions, "findBySlug"],
	provider: store,
});
export const Releases = repositoryOf({
	entity: Release,
	actions: [...entryActions, "findBySlug"],
	provider: store,
});

export const collectionRepositories = {
	projects: Projects,
	experience: ExperienceEntries,
	stack: StackGroups,
	links: Links,
	articles: Articles,
	releases: Releases,
} as const;

export const SettingsDocuments = repositoryOf({
	entity: SettingsDocument,
	actions: ["findById", "findMany", "create", "update", "count"],
	provider: store,
});

export const ApiKeys = repositoryOf({
	entity: StoredApiKey,
	actions: ["findById", "findMany", "findByHash", "create", "update"],
	provider: store,
});

export const PushSubscriptions = repositoryOf({
	entity: PushSubscriptionRecord,
	actions: ["findMany", "findByEndpoint", "create", "update", "delete", "count"],
	provider: store,
});

export const PushNotifications = repositoryOf({
	entity: PushNotification,
	actions: ["findMany", "findById", "create", "update"],
	provider: store,
});
