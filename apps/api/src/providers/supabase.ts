import { RepositoryEntityNotFound, RepositoryUniqueViolation, recordNameOf } from "@afora/core";
import type { IRepositoryProvider, ProviderQuery, RepositoryContext, RepositoryData } from "@afora/core/adapters";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

/**
 * How one entity is laid out in Postgres: its table, the filters that pick its rows out of a shared
 * table, which entity keys are columns, and how a whole row maps to the entity's data and back.
 */
export type TableMapping = {
	table: string;
	/** Fixed column values of every row, e.g. `{ collection: "projects" }` in `entries`. */
	scope?: Row;
	/** The column (or JSON path, like `data->>slug`) a key is filtered by. */
	column(key: string): string;
	/** What a structured value (an object or a list) is matched by, as JSON: `data->address`. */
	jsonColumn?(key: string): string;
	/**
	 * The keys Postgres can sort by (real columns); sorting by any other key is done here, by code
	 * point, as afora specifies (Postgres would use its collation). Leave out when every key is one.
	 */
	sortable?: readonly string[];
	/** The column that marks a soft-deleted row, for the tables that keep them. */
	deletedColumn?: string;
	fromRow(row: Row): RepositoryData;
	toRow(data: RepositoryData): Row;
};

const camelToSnake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const snakeToCamel = (key: string) => key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** Drops the keys Postgres holds as null: optional keys of an entity are left out instead. */
function withoutNulls(data: Row): Row {
	return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== null && value !== undefined));
}

/**
 * A table whose columns are the entity's keys in snake_case, with `rename` for the ones that differ
 * and `skip` for the keys it has no column for (by default the timestamps few tables keep).
 */
export function columnsMapping(
	table: string,
	rename: Record<string, string> = {},
	skip: readonly string[] = ["updatedAt", "deletedAt"],
): TableMapping {
	const column = (key: string) => rename[key] ?? camelToSnake(key);
	const back = Object.fromEntries(Object.entries(rename).map(([key, name]) => [name, key]));
	return {
		table,
		column,
		fromRow: (row) =>
			withoutNulls(
				Object.fromEntries(Object.entries(row).map(([name, value]) => [back[name] ?? snakeToCamel(name), value])),
			),
		toRow: (data) =>
			Object.fromEntries(
				Object.entries(data)
					.filter(([key]) => !skip.includes(key))
					.map(([key, value]) => [column(key), value === undefined ? null : value]),
			),
	};
}

const ENTRY_COLUMNS: Record<string, string> = {
	id: "id",
	position: "position",
	createdAt: "created_at",
	updatedAt: "updated_at",
};

/** A collection in `entries`: id, position and timestamps are columns, everything else is `data`. */
export function entriesMapping(collection: string): TableMapping {
	return {
		table: "entries",
		scope: { collection },
		column: (key) => ENTRY_COLUMNS[key] ?? `data->>${key}`,
		jsonColumn: (key) => `data->${key}`,
		sortable: Object.keys(ENTRY_COLUMNS),
		fromRow: ({ id, position, created_at, updated_at, data }) =>
			withoutNulls({ ...(data as Row), id, position, createdAt: created_at, updatedAt: updated_at }),
		toRow: ({ id, position, createdAt, updatedAt, deletedAt: _deletedAt, ...data }) =>
			withoutNulls({ id, position, created_at: createdAt, updated_at: updatedAt, data }),
	};
}

/**
 * Any entity as a JSON document in one table (`entity`, `id`, `data`), keyed by its record name:
 * what the provider contract kit runs against (see test/supabase-provider.test.ts).
 */
export function documentsMapping(table: string, entity: string): TableMapping {
	return {
		table,
		scope: { entity },
		column: (key) => (key === "id" ? "id" : `data->>${key}`),
		jsonColumn: (key) => `data->${key}`,
		sortable: ["id"],
		deletedColumn: "data->>deletedAt",
		fromRow: ({ id, data }) => ({ ...(data as Row), id }),
		toRow: ({ id, ...data }) => ({ id, data }),
	};
}

/** The tables of the portfolio (see supabase/migrations), by record name. */
export const portfolioTables: Record<string, TableMapping> = {
	...Object.fromEntries(
		["projects", "experience", "stack", "links", "articles", "releases"].map((name) => [name, entriesMapping(name)]),
	),
	/** `settings` has no created_at: a document is as old as its last save. */
	settings: {
		table: "settings",
		column: (key) => ({ id: "key", value: "value", createdAt: "updated_at", updatedAt: "updated_at" })[key] ?? key,
		fromRow: ({ key, value, updated_at }) => ({ id: key, value, createdAt: updated_at, updatedAt: updated_at }),
		toRow: ({ id, value, updatedAt, createdAt }) => ({ key: id, value, updated_at: updatedAt ?? createdAt }),
	},
	api_keys: columnsMapping("api_keys"),
	push_subscriptions: {
		...columnsMapping("push_subscriptions"),
		fromRow: ({ id, endpoint, p256dh, auth, locale, created_at }) => ({
			id,
			endpoint,
			keys: { p256dh, auth },
			locale,
			createdAt: created_at,
		}),
		toRow: ({ id, endpoint, keys, locale, createdAt }) => {
			const { p256dh, auth } = keys as { p256dh: string; auth: string };
			return { id, endpoint, p256dh, auth, locale, created_at: createdAt };
		},
	},
	push_notifications: {
		table: "push_notifications",
		column: (key) => ({ id: "release_id", createdAt: "sent_at" })[key] ?? camelToSnake(key),
		fromRow: ({ release_id, recipients, sent_at }) => ({ id: release_id, recipients, createdAt: sent_at }),
		toRow: ({ id, recipients, createdAt }) => ({ release_id: id, recipients, sent_at: createdAt }),
	},
};

type SupabaseError = { message?: string; code?: string; details?: string | null; hint?: string | null };

/** Describes a failed call with whatever Supabase returned, since some responses carry no message. */
export function describeError(error: SupabaseError | null): string {
	if (!error) return "no data returned";
	const parts = [error.message, error.code && `code ${error.code}`, error.details, error.hint].filter(Boolean);
	return parts.length > 0 ? parts.join(" · ") : JSON.stringify(error);
}

/** How afora orders values: missing first, numbers as numbers, strings by code point. */
function compareValues(a: unknown, b: unknown): number {
	const missing = (value: unknown) => value === undefined || value === null;
	if (missing(a) || missing(b)) return missing(a) === missing(b) ? 0 : missing(a) ? -1 : 1;
	if (typeof a === "number" && typeof b === "number") return a - b;
	if (typeof a === "string" && typeof b === "string") {
		const [left, right] = [[...a], [...b]];
		for (let i = 0; i < Math.min(left.length, right.length); i++) {
			const difference = (left[i].codePointAt(0) ?? 0) - (right[i].codePointAt(0) ?? 0);
			if (difference !== 0) return difference;
		}
		return left.length - right.length;
	}
	const [left, right] = [JSON.stringify(a), JSON.stringify(b)];
	return left < right ? -1 : left > right ? 1 : 0;
}

function sortRows(rows: RepositoryData[], orderBy: readonly { key: string; direction?: "asc" | "desc" }[]) {
	return [...rows].sort((a, b) => {
		for (const { key, direction } of orderBy) {
			const order = compareValues(a[key], b[key]);
			if (order !== 0) return direction === "desc" ? -order : order;
		}
		return compareValues(a.id, b.id);
	});
}

/** PostgREST answers at most this many rows at once; longer reads are paged. */
const PAGE = 1000;

/**
 * An afora repository provider on Supabase (PostgREST through supabase-js), over the tables the
 * site already has: no table is created or changed. Queries support equality, `in`, ordering,
 * limit and offset. PostgREST has no interactive transactions, so neither does this provider.
 */
export class SupabaseProvider implements IRepositoryProvider {
	readonly capabilities = { transactions: false } as const;

	/**
	 * `tables` maps record names to tables; `fallback` lays out the entities it does not name
	 * (by default, none: an unmapped entity is an error).
	 */
	constructor(
		private readonly client: SupabaseClient,
		private readonly tables: Record<string, TableMapping> = portfolioTables,
		private readonly fallback?: (name: string) => TableMapping,
	) {}

	private mappingOf(context: RepositoryContext): TableMapping {
		const name = recordNameOf(context.entity);
		const mapping = this.tables[name] ?? this.fallback?.(context.name);
		if (!mapping) throw new Error(`Supabase: no table is mapped for "${name}"`);
		return mapping;
	}

	private fail(action: string, error: SupabaseError | null): never {
		throw new Error(`Supabase: could not ${action}: ${describeError(error)}`);
	}

	// biome-ignore lint/suspicious/noExplicitAny: the PostgREST builder types are deeply generic
	private filtered(mapping: TableMapping, builder: any, query: ProviderQuery = {}) {
		let request = builder;
		for (const [column, value] of Object.entries(mapping.scope ?? {})) request = request.eq(column, value);
		for (const [key, condition] of Object.entries(query.where ?? {})) {
			if (condition === undefined) continue;
			const column = mapping.column(key);
			const structured = (value: unknown) => typeof value === "object" && value !== null;
			if (condition !== null && typeof condition === "object" && "in" in condition && !Array.isArray(condition)) {
				request = request.in(column, [...(condition.in as unknown[])]);
			} else if (condition === null) {
				request = request.is(column, null);
			} else if (structured(condition) && mapping.jsonColumn) {
				// Compared as jsonb: by structure, whatever the order of the keys.
				request = request.eq(mapping.jsonColumn(key), JSON.stringify(condition));
			} else {
				request = request.eq(column, condition);
			}
		}
		// Soft-deleted entities are left out unless asked for (hard deletion always asks for them).
		if (query.withDeleted !== true && mapping.deletedColumn) request = request.is(mapping.deletedColumn, null);
		return request;
	}

	async findMany(context: RepositoryContext, query: ProviderQuery = {}): Promise<RepositoryData[]> {
		const mapping = this.mappingOf(context);
		const orderBy = query.orderBy ?? [];
		if (mapping.sortable && orderBy.some(({ key }) => !mapping.sortable?.includes(key))) {
			// Sorted here: read every matching row, then sort and page.
			const all = await this.findMany(context, { ...query, orderBy: [], limit: undefined, offset: undefined });
			const start = query.offset ?? 0;
			return sortRows(all, orderBy).slice(start, query.limit === undefined ? undefined : start + query.limit);
		}

		const rows: Row[] = [];
		let offset = query.offset ?? 0;
		const wanted = query.limit ?? Number.POSITIVE_INFINITY;
		while (rows.length < wanted) {
			let request = this.filtered(mapping, this.client.from(mapping.table).select("*"), query);
			for (const { key, direction } of orderBy) {
				request = request.order(mapping.column(key), {
					ascending: direction !== "desc",
					nullsFirst: direction !== "desc",
				});
			}
			request = request.order(mapping.column("id"), { ascending: true });
			const size = Math.min(PAGE, wanted - rows.length);
			const { data, error } = await request.range(offset, offset + size - 1);
			if (error) this.fail(`read ${context.name}`, error);
			rows.push(...(data as Row[]));
			if ((data as Row[]).length < size) break;
			offset += size;
		}
		return rows.map((row) => mapping.fromRow(row));
	}

	async findOne(context: RepositoryContext, query: ProviderQuery = {}) {
		const [first] = await this.findMany(context, { ...query, limit: Math.min(query.limit ?? 1, 1) });
		return first;
	}

	async count(context: RepositoryContext, query: ProviderQuery = {}) {
		const mapping = this.mappingOf(context);
		const { count, error } = await this.filtered(
			mapping,
			this.client.from(mapping.table).select("*", { count: "exact", head: true }),
			query,
		);
		if (error) this.fail(`count ${context.name}`, error);
		return count ?? 0;
	}

	/**
	 * Unique keys besides `id`: the tables guard some of them with indexes (slugs, key hashes,
	 * endpoints), the rest is checked here before writing.
	 */
	private async assertUnique(context: RepositoryContext, data: RepositoryData) {
		for (const key of context.unique) {
			if (key === "id" || data[key] === undefined || data[key] === null) continue;
			const [other] = await this.findMany(context, { where: { [key]: data[key] }, limit: 2, withDeleted: true });
			if (other && other.id !== data.id) {
				throw new RepositoryUniqueViolation({ source: context.name, details: { key } });
			}
		}
	}

	async insert(context: RepositoryContext, data: RepositoryData) {
		const mapping = this.mappingOf(context);
		if (await this.findOne(context, { where: { id: data.id }, withDeleted: true })) {
			throw new RepositoryUniqueViolation({ source: context.name, details: { key: "id" } });
		}
		await this.assertUnique(context, data);
		const { error } = await this.client.from(mapping.table).insert({ ...mapping.toRow(data), ...mapping.scope });
		if (error) this.writeFailed(context, "create", error);
	}

	async update(context: RepositoryContext, data: RepositoryData) {
		const mapping = this.mappingOf(context);
		await this.assertUnique(context, data);
		const row = mapping.toRow(data);
		const idColumn = mapping.column("id");
		const { data: updated, error } = await this.filtered(
			mapping,
			this.client.from(mapping.table).update(row).eq(idColumn, data.id),
			{ withDeleted: true },
		).select(idColumn);
		if (error) this.writeFailed(context, "update", error);
		if ((updated ?? []).length === 0) {
			throw new RepositoryEntityNotFound({ source: context.name, details: { id: String(data.id) } });
		}
	}

	async remove(context: RepositoryContext, id: string) {
		const mapping = this.mappingOf(context);
		const idColumn = mapping.column("id");
		const { data: removed, error } = await this.filtered(
			mapping,
			this.client.from(mapping.table).delete().eq(idColumn, id),
			{ withDeleted: true },
		).select(idColumn);
		if (error) this.fail(`delete from ${context.name}`, error);
		if ((removed ?? []).length === 0) {
			throw new RepositoryEntityNotFound({ source: context.name, details: { id } });
		}
	}

	/** A unique index refused the row: a 409 for the key it guards (or the first unique key). */
	private writeFailed(context: RepositoryContext, action: string, error: SupabaseError): never {
		if (error.code === "23505") {
			const text = `${error.message ?? ""} ${error.details ?? ""}`;
			const key = context.unique.find((name) => name !== "id" && text.includes(name)) ?? context.unique[1] ?? "id";
			throw new RepositoryUniqueViolation({ source: context.name, details: { key } });
		}
		this.fail(`${action} in ${context.name}`, error);
	}
}
