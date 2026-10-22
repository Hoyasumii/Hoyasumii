import { type Project, releaseName } from "@portfolio/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/site/article-list";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getContent, getReleases } from "@/lib/data";
import { dict, isLocale, locales, t } from "@/lib/i18n";
import { renderMarkdown } from "@/lib/markdown";
import { shareImages, twitterCard } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Placeholder so the export has a page to render when there are no releases yet. */
const EMPTY = "_";

export const dynamicParams = false;

export async function generateStaticParams() {
	const releases = await getReleases();
	const slugs = releases.length > 0 ? releases.map((release) => release.slug) : [EMPTY];
	return locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

async function load(slug: string) {
	return (await getReleases()).find((release) => release.slug === slug) ?? null;
}

/** Where "about the project" leads: its site, its code, or its entry on the home page. */
function projectLink(project: Project, home: string): { href: string; external: boolean } {
	const external = project.links.site || project.links.repo || project.links.docs;
	return external ? { href: external, external: true } : { href: `${home}#work`, external: false };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale, slug } = await params;
	const [{ seo }, release] = await Promise.all([getContent(), load(slug)]);
	if (!release || !isLocale(locale)) return { robots: { index: false } };
	const title = releaseName(release);
	const description = t(release.summary, locale);
	return {
		title,
		description,
		alternates: {
			canonical: `/${locale}/releases/${release.slug}/`,
			languages: { "pt-BR": `/pt/releases/${release.slug}/`, en: `/en/releases/${release.slug}/` },
		},
		openGraph: {
			type: "article",
			title,
			description,
			publishedTime: release.publishedAt,
			images: shareImages(seo, release.cover, title),
		},
		twitter: twitterCard(seo, { title, description, cover: release.cover }),
	};
}

export default async function ReleasePage({ params }: Props) {
	const { locale, slug } = await params;
	if (!isLocale(locale)) notFound();
	const [content, release] = await Promise.all([getContent(), load(slug)]);
	if (!release) notFound();

	const d = dict(locale);
	const home = `/${locale}/`;
	const summary = t(release.summary, locale);
	const html = renderMarkdown(t(release.body, locale));
	const project = content.projects.find((item) => item.id === release.project);
	const about = project ? projectLink(project, home) : null;

	return (
		<>
			<SiteHeader
				profile={content.profile}
				locale={locale}
				d={d}
				path={`releases/${release.slug}/`}
				anchorBase={home}
				nav={[
					{ id: "work", label: d.work },
					{ id: "writing", label: d.writing },
					{ id: "contact", label: d.contact },
				]}
			/>
			<main id="top" className="page">
				<article className="post">
					<header className="post__head">
						<p className="post__meta">
							<Link href={`/${locale}/releases/`}>← {d.allNews}</Link>
							<span>
								{d[release.kind]} ·{" "}
								<time dateTime={release.publishedAt}>{formatDate(release.publishedAt, locale)}</time>
							</span>
						</p>
						<h1 className="post__title">
							{release.title}
							{release.version ? <span className="post__version"> {release.version}</span> : null}
						</h1>
						{summary ? <p className="post__excerpt">{summary}</p> : null}
					</header>
					{release.cover ? <img className="post__cover" src={release.cover} alt="" /> : null}
					{/* biome-ignore lint/security/noDangerouslySetInnerHtml: the owner's own release note, rendered at build time */}
					<div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
					{project && about ? (
						<p className="post__source">
							{about.external ? (
								<a href={about.href} target="_blank" rel="noreferrer">
									{d.aboutProject}: {project.name} ↗
								</a>
							) : (
								<Link href={about.href}>
									{d.aboutProject}: {project.name} →
								</Link>
							)}
						</p>
					) : null}
				</article>
			</main>
			<SiteFooter name={content.profile.name} d={d} />
		</>
	);
}
