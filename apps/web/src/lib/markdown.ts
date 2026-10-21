import "server-only";
import { Marked } from "marked";

const marked = new Marked({ gfm: true, breaks: false });

/** Markdown written in the admin panel, rendered at build time. Only the site owner writes it. */
export function renderMarkdown(markdown: string): string {
	return marked.parse(markdown, { async: false });
}
