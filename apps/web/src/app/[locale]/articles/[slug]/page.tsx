import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/site/article-list";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getArticle, getArticles, getContent } from "@/lib/data";
import { dict, isLocale, locales } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Placeholder so the export has a page to render when there are no articles yet. */
const EMPTY = "_";

export const dynamicParams = false;

export async function generateStaticParams() {
	const articles = await getArticles();
	const slugs = articles.length > 0 ? articles.map((article) => article.slug) : [EMPTY];
	return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

async function load(slug: string) {
	if (slug === EMPTY) return null;
	return getArticle(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale, slug } = await params;
	const article = await load(slug);
	if (!article || !isLocale(locale)) return { robots: { index: false } };
	return {
		title: article.title,
		description: article.excerpt,
		alternates: { canonical: article.externalUrl ?? `/${article.lang}/articles/${article.slug}/` },
		openGraph: {
			type: "article",
			title: article.title,
			description: article.excerpt,
			publishedTime: article.publishedAt,
			tags: article.tags,
			images: article.cover ? [{ url: article.cover }] : undefined,
		},
	};
}

export default async function ArticlePage({ params }: Props) {
	const { locale, slug } = await params;
	if (!isLocale(locale)) notFound();
	const [content, article] = await Promise.all([getContent(), load(slug)]);
	if (!article) notFound();

	const d = dict(locale);
	const html = article.format === "markdown" ? renderMarkdown(article.body) : article.body;

	return (
		<>
			<SiteHeader
				profile={content.profile}
				locale={locale}
				d={d}
				path={`articles/${article.slug}/`}
				anchorBase={`/${locale}/`}
				nav={[
					{ id: "work", label: d.work },
					{ id: "writing", label: d.writing },
					{ id: "contact", label: d.contact },
				]}
			/>
			<main id="top" className="page">
				<article className="post" lang={article.lang}>
					<header className="post__head">
						<p className="post__meta">
							<Link href={`/${locale}/articles/`}>← {d.allArticles}</Link>
							<span>
								<time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time> ·{" "}
								{article.readingMinutes} {d.minRead}
							</span>
						</p>
						<h1 className="post__title">{article.title}</h1>
						{article.excerpt ? <p className="post__excerpt">{article.excerpt}</p> : null}
						{article.tags.length > 0 ? (
							<ul className="post__tags">
								{article.tags.map((tag) => (
									<li key={tag}>#{tag}</li>
								))}
							</ul>
						) : null}
					</header>
					{article.cover ? <img className="post__cover" src={article.cover} alt="" /> : null}
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: the owner's own article, rendered at build time */}
					<div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
					{article.externalUrl ? (
						<p className="post__source">
							<a href={article.externalUrl} target="_blank" rel="noreferrer">
								{d.readOn} ↗
							</a>
						</p>
					) : null}
				</article>
			</main>
			<SiteFooter name={content.profile.name} d={d} />
		</>
	);
}
