import { blueprintOf, listOf, useCaseOf } from "@afora/core";
import {
	type CollectionInput,
	type CollectionName,
	collectionNames,
	collectionSchemas,
	type Entry,
	reorderSchema,
	sluggedCollections,
} from "@portfolio/shared";
import { afterChange, entityClassOf, entryOf, findEntity, listEntities, listEntries, repositoryOf } from "../content";
import { EntryNotFound, InvalidData, SlugTaken } from "../exceptions";
import { entrySchemas, idResponse } from "../responses";
import { adminContext, adminRead, adminWrite } from "../services";

type Value = Record<string, unknown>;

/** Article and release slugs are their URLs, so two entries of one collection can't share one. */
async function assertUniqueSlug(name: CollectionName, input: Value, id?: string) {
	if (!sluggedCollections.includes(name)) return;
	const slug = input.slug as string;
	const taken = (await listEntries(name)).some(
		(entry) => (entry as { slug?: string }).slug === slug && entry.id !== id,
	);
	if (taken) {
		throw new SlugTaken({ source: name, details: { noun: name === "articles" ? "article" : "release", slug } });
	}
}

/** A release names its project by id; catch typos before they become a dead link. */
async function assertProject(name: CollectionName, input: Value) {
	if (name !== "releases" || !input.project) return;
	const exists = (await listEntities("projects")).some((entry) => entry.id === input.project);
	if (!exists) {
		throw new InvalidData({
			source: name,
			details: {
				issues: [
					{
						path: ["project"],
						code: "invalid_value",
						message: `No project with id "${input.project}" (use list_entries on projects)`,
					},
				],
			},
		});
	}
}

function capitalized(name: string) {
	return name[0].toUpperCase() + name.slice(1);
}

/**
 * The operations of one collection, served under `/admin/collections/<name>`: each with its own
 * input blueprint, so an entry is validated (and documented in the OpenAPI document) as what it is.
 */
function collectionUseCases<N extends CollectionName>(name: N) {
	const label = capitalized(name);
	const path = `/admin/collections/${name}`;
	// biome-ignore lint/suspicious/noExplicitAny: the six collections share one generic implementation
	const schema = collectionSchemas[name] as any as typeof collectionSchemas.projects;
	// biome-ignore lint/suspicious/noExplicitAny: see above
	const entry = entrySchemas[name] as any as (typeof entrySchemas)["projects"];
	const Entity = entityClassOf(name);
	const repository = repositoryOf(name);
	const result = (entity: Parameters<typeof entryOf>[0]) =>
		entryOf<N>(entity) as unknown as Entry<CollectionInput<"projects">>;

	class List extends useCaseOf({
		name: `List${label}`,
		route: { method: "get", path },
		access: adminRead,
		blueprint: blueprintOf(() => ({})),
		response: blueprintOf(() => ({ items: listOf(entry) })),
		context: adminContext,
	}) {
		override async execute() {
			return { items: (await listEntries(name)) as unknown as Entry<CollectionInput<"projects">>[] };
		}
	}

	class Get extends useCaseOf({
		name: `Get${label}Entry`,
		route: { method: "get", path: `${path}/{id}` },
		access: adminRead,
		blueprint: blueprintOf((ctx) => ({ id: ctx.string })),
		response: entry,
		context: adminContext,
		errors: [EntryNotFound],
	}) {
		override async execute() {
			return result(await findEntity(name, this.input.id));
		}
	}

	/** Adds an entry at the end of the collection. */
	class Create extends useCaseOf({
		name: `Create${label}Entry`,
		route: { method: "post", path, status: 201 },
		access: adminWrite,
		blueprint: schema,
		response: entry,
		context: adminContext,
		errors: [SlugTaken, InvalidData],
	}) {
		override async execute() {
			const input = structuredClone(this.input) as Value;
			await assertUniqueSlug(name, input);
			await assertProject(name, input);
			const [last] = await repository.findMany({ orderBy: [{ key: "position", direction: "desc" }], limit: 1 });
			const position = last ? (last.toJSON().position as number) + 1 : 0;
			const created = await repository.create(new Entity({ ...input, position }));
			await afterChange(this.context.services, `${name} entry created`, this.context.actor);
			return result(created);
		}
	}

	/** Sets positions from the order of `ids`; ids that are not entries of this collection are ignored. */
	class Reorder extends useCaseOf({
		name: `Reorder${label}`,
		route: { method: "put", path: `${path}/order` },
		access: adminWrite,
		blueprint: reorderSchema,
		response: blueprintOf(() => ({ items: listOf(entry) })),
		context: adminContext,
	}) {
		override async execute() {
			const entities = new Map((await listEntities(name)).map((entity) => [entity.id, entity]));
			let position = 0;
			for (const id of this.input.ids) {
				const entity = entities.get(id) as { change: { position(value: number): unknown } } | undefined;
				if (!entity) continue;
				await repository.update(entity.change.position(position++) as never);
			}
			await afterChange(this.context.services, `${name} reordered`, this.context.actor);
			return { items: (await listEntries(name)) as unknown as Entry<CollectionInput<"projects">>[] };
		}
	}

	/** Replaces an entry's fields (the panel sends the whole entry). */
	class Update extends useCaseOf({
		name: `Update${label}Entry`,
		route: { method: "put", path: `${path}/{id}` },
		access: adminWrite,
		blueprint: schema.join(blueprintOf((ctx) => ({ id: ctx.string }))),
		response: entry,
		context: adminContext,
		errors: [EntryNotFound, SlugTaken, InvalidData],
	}) {
		override async execute() {
			const { id, ...input } = structuredClone(this.input) as Value & { id: string };
			const current = (await findEntity(name, id)).toJSON();
			await assertUniqueSlug(name, input, id);
			await assertProject(name, input);
			const updated = await repository.update(
				new Entity({
					...input,
					id,
					position: current.position,
					createdAt: current.createdAt,
					updatedAt: new Date().toISOString(),
				}),
			);
			await afterChange(this.context.services, `${name} entry updated`, this.context.actor);
			return result(updated);
		}
	}

	class Remove extends useCaseOf({
		name: `Delete${label}Entry`,
		route: { method: "delete", path: `${path}/{id}` },
		access: adminWrite,
		blueprint: blueprintOf((ctx) => ({ id: ctx.string })),
		response: idResponse,
		context: adminContext,
		errors: [EntryNotFound],
	}) {
		override async execute() {
			await repository.delete(await findEntity(name, this.input.id));
			await afterChange(this.context.services, `${name} entry deleted`, this.context.actor);
			return { id: this.input.id };
		}
	}

	// Reorder before update: `/order` must win over `/{id}`.
	return { list: List, get: Get, create: Create, reorder: Reorder, update: Update, remove: Remove };
}

export const collectionOperations = Object.fromEntries(
	collectionNames.map((name) => [name, collectionUseCases(name)]),
) as { [N in CollectionName]: ReturnType<typeof collectionUseCases<N>> };
