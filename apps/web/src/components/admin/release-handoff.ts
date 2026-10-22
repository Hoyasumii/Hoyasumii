import type { CollectionInput, Entry } from "@portfolio/shared";

type ReleaseInput = CollectionInput<"releases">;
type Project = Entry<CollectionInput<"projects">>;

let pending: ReleaseInput | null = null;

export function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

export const emptyRelease = (): ReleaseInput => ({
	title: "",
	version: "",
	kind: "feature",
	project: "",
	slug: "",
	summary: { pt: "", en: "" },
	body: { pt: "", en: "" },
	cover: "",
	publishedAt: new Date().toISOString().slice(0, 10),
	published: true,
	notify: true,
});

/** A release note about a project, filled in from it: its summary is a good first draft. */
export function releaseFor(project: Project, kind: ReleaseInput["kind"]): ReleaseInput {
	return {
		...emptyRelease(),
		title: project.name,
		kind,
		project: project.id,
		slug: slugify(kind === "launch" ? project.name : `${project.name}-${new Date().toISOString().slice(0, 10)}`),
		summary: kind === "launch" ? { ...project.summary } : { pt: "", en: "" },
	};
}

/** Opens the releases section with this draft (the panel is one page, so the draft just waits here). */
export function openRelease(draft: ReleaseInput) {
	pending = draft;
	window.location.hash = "releases";
}

/**
 * The draft handed over by openRelease. It is dropped after the current render, not right away:
 * React's StrictMode runs state initializers twice in development, and both must see it.
 */
export function takeRelease(): ReleaseInput | null {
	const draft = pending;
	if (draft) {
		queueMicrotask(() => {
			if (pending === draft) pending = null;
		});
	}
	return draft;
}
