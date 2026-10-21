import type { Seo } from "@portfolio/shared";
import type { Metadata } from "next";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The favicon chosen in the panel, or the one shipped with the site. */
export function siteIcons(seo: Seo): Metadata["icons"] {
	const icon = seo.favicon || `${base}/favicon.ico`;
	return { icon, shortcut: icon, apple: seo.favicon || undefined };
}

/** Open Graph images: the page's own cover, else the site's cover from the SEO settings. */
export function shareImages(seo: Seo, cover?: string | null, alt?: string) {
	const url = cover || seo.image;
	return url ? [{ url, alt: alt ?? seo.title }] : undefined;
}

/** X (Twitter) card: large when there is a cover to show. */
export function twitterCard(
	seo: Seo,
	page: { title: string; description: string; cover?: string | null },
): Metadata["twitter"] {
	const image = page.cover || seo.image;
	const handle = seo.twitter ? `@${seo.twitter}` : undefined;
	return {
		card: image ? "summary_large_image" : "summary",
		title: page.title,
		description: page.description,
		images: image ? [image] : undefined,
		site: handle,
		creator: handle,
	};
}
