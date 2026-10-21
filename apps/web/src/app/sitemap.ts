import type { MetadataRoute } from "next";
import { getArticles } from "@/lib/data";
import { locales } from "@/lib/i18n";

export const dynamic = "force-static";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const articles = await getArticles();
	return locales.flatMap((locale) => [
		{ url: `${site}/${locale}/`, changeFrequency: "monthly" as const, priority: 1 },
		{ url: `${site}/${locale}/articles/`, changeFrequency: "weekly" as const, priority: 0.7 },
		...articles
			.filter((article) => article.source === "site" && article.lang === locale)
			.map((article) => ({
				url: `${site}/${locale}/articles/${article.slug}/`,
				lastModified: article.publishedAt,
				priority: 0.6,
			})),
	]);
}
