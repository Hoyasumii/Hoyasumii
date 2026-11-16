import { AsyncLocalStorage } from "node:async_hooks";
import { RepositoryOf, repositoryOf } from "@afora/core";
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
 * Writes the afora provider interface has no room for. `update` stores a whole entity, so a write
 * of one field (or of a collection's order) would put back every other field as it was read, undoing
 * whatever changed in between. A provider can do these in one statement; for one that can't (the
 * in-memory one), the store reads and writes inside a transaction, so nothing runs in between.
 */
export interface PartialWrites {
	/**
	 * Stores only `fields` on the row of `id`, and only when its stored values match `where` (a missing
	 * value matches null). Gives whether a row was written.
	 */
	patch(context: RepositoryContext, id: string, fields: RepositoryData, where?: RepositoryData): Promise<boolean>;
	/** Sets the position of each entry of `ids` to its index there; the other ids are ignored. */
	reorder(context: RepositoryContext, ids: readonly string[]): Promise<void>;
}

/** Runs `work` in a transaction of `provider` when it has them, or on the provider itself. */
function atomically<Result>(
	provider: IRepositoryProvider,
	work: (provider: IRepositoryProvider) => Promise<Result>,
): Promise<Result> {
	return provider.transaction ? provider.transaction(work) : work(provider);
}

const hasPartialWrites = (provider: IRepositoryProvider): provider is IRepositoryProvider & PartialWrites =>
	typeof (provider as Partial<PartialWrites>).patch === "function" &&
	typeof (provider as Partial<PartialWrites>).reorder === "function";

/**
 * The provider every repository writes through. The repositories are declared here at module level,
 * but the store behind them belongs to a runtime (Supabase, or memory without credentials; see
 * container.ts): each request runs inside `store.run(provider, ...)`, and every call made from it,
 * however deep, goes to that provider. Two runtimes in one process never see each other's store.
 */
class StoreProvider implements IRepositoryProvider, PartialWrites {
	private readonly scope = new AsyncLocalStorage<IRepositoryProvider>();

	/** Runs `work` with the repositories reading and writing through `provider`. */
	run<Result>(provider: IRepositoryProvider, work: () => Result): Result {
		return this.scope.run(provider, work);
	}

	get current(): IRepositoryProvider {
		const provider = this.scope.getStore();
		if (!provider) throw new Error("No store in scope: run the repositories inside store.run(provider, ...)");
		return provider;
	}

	findOne(context: RepositoryContext, query?: ProviderQuery) {
		return this.current.findOne(context, query);
	}
	findMany(context: RepositoryContext, query?: ProviderQuery) {
		return this.current.findMany(context, query);
	}
	insert(context: RepositoryContext, data: RepositoryData) {
		return this.current.insert(context, data);
	}
	update(context: RepositoryContext, data: RepositoryData) {
		return this.current.update(context, data);
	}
	remove(context: RepositoryContext, id: string) {
		return this.current.remove(context, id);
	}
	count(context: RepositoryContext, query?: ProviderQuery) {
		return this.current.count(context, query);
	}

	async patch(context: RepositoryContext, id: string, fields: RepositoryData, where: RepositoryData = {}) {
		const provider = this.current;
		if (hasPartialWrites(provider)) return provider.patch(context, id, fields, where);
		return atomically(provider, async (tx) => {
			const stored = await tx.findOne(context, { where: { id }, withDeleted: true });
			if (!stored || !Object.entries(where).every(([key, value]) => (stored[key] ?? null) === value)) return false;
			await tx.update(context, { ...stored, ...fields });
			return true;
		});
	}

	async reorder(context: RepositoryContext, ids: readonly string[]) {
		const provider = this.current;
		if (hasPartialWrites(provider)) return provider.reorder(context, ids);
		await atomically(provider, async (tx) => {
			const stored = await tx.findMany(context, { where: { id: { in: [...ids] } } });
			for (const row of stored) await tx.update(context, { ...row, position: ids.indexOf(row.id as string) });
		});
	}
}

export const store = new StoreProvider();

/**
 * The class of `repository`, with its (protected) context in reach, to add a method that writes
 * through the store's partial writes.
 */
const extensible = <Repository extends object>(repository: Repository) =>
	RepositoryOf(repository as never) as unknown as new () => { readonly context: RepositoryContext };

/** A collection repository that can also set the order of its entries in one write. */
function ordered<Repository extends object>(repository: Repository) {
	class Ordered extends extensible(repository) {
		reorder(ids: readonly string[]) {
			return store.reorder(this.context, ids);
		}
	}
	return new Ordered() as unknown as Repository & Pick<Ordered, "reorder">;
}

const entryActions = ["findById", "findMany", "create", "update", "delete"] as const;

export const Projects = ordered(repositoryOf({ entity: Project, actions: entryActions, provider: store }));
export const ExperienceEntries = ordered(repositoryOf({ entity: Experience, actions: entryActions, provider: store }));
export const StackGroups = ordered(repositoryOf({ entity: StackGroup, actions: entryActions, provider: store }));
export const Links = ordered(repositoryOf({ entity: Link, actions: entryActions, provider: store }));
export const Articles = ordered(
	repositoryOf({ entity: Article, actions: [...entryActions, "findBySlug"], provider: store }),
);
export const Releases = ordered(
	repositoryOf({ entity: Release, actions: [...entryActions, "findBySlug"], provider: store }),
);

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

const apiKeys = repositoryOf({
	entity: StoredApiKey,
	actions: ["findById", "findMany", "findByHash", "create", "update"],
	provider: store,
});

class ApiKeyRepository extends extensible(apiKeys) {
	/**
	 * Records that the key of `id` was used at `at`, writing nothing else, and only while it is not
	 * revoked: a revocation in between is never undone. Gives whether the key is still active.
	 */
	touch(id: string, at: string) {
		return store.patch(this.context, id, { lastUsedAt: at }, { revokedAt: null });
	}
}

export const ApiKeys = new ApiKeyRepository() as unknown as typeof apiKeys & Pick<ApiKeyRepository, "touch">;

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
