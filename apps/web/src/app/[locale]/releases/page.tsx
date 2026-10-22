import { releaseName } from "@portfolio/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/components/site/article-list";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getContent, getReleases } from "@/lib/data";
import { dict, isLocale, t } from "@/lib/i18n";
import { shareImages, twitterCard } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	if (!isLocale(locale)) return {};
	const { seo } = await getContent();
	const title = `${dict(locale).newsTitle} — ${seo.title}`;
	const description = t(seo.description, locale);
	return {
		title,
		alternates: { canonical: `/${locale}/releases/` },
		openGraph: { title, description, url: `/${locale}/releases/`, type: "website", images: shareImages(seo) },
		twitter: twitterCard(seo, { title, description }),
	};
}

export default async function ReleasesPage({ params }: Props) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const [content, releases] = await Promise.all([getContent(), getReleases()]);
	const d = dict(locale);
	const home = `/${locale}/`;

	return (
		<>
			<SiteHeader
				profile={content.profile}
				locale={locale}
				d={d}
				path="releases/"
				anchorBase={home}
				nav={[
					{ id: "work", label: d.work },
					{ id: "writing", label: d.writing },
					{ id: "contact", label: d.contact },
				]}
			/>
			<main id="top" className="page">
				<h1 className="page__title">{d.newsTitle}</h1>
				{releases.length === 0 ? (
					<p className="hint">{d.newsEmpty}</p>
				) : (
					<ul className="articles releases">
						{releases.map((release) => (
							<li key={release.id}>
								<Link href={`/${locale}/releases/${release.slug}/`}>
									<time dateTime={release.publishedAt}>{formatDate(release.publishedAt, locale)}</time>
									<span className="articles__title">{releaseName(release)}</span>
									<span className="articles__meta">{d[release.kind]}</span>
									{t(release.summary, locale) ? (
										<span className="releases__summary">{t(release.summary, locale)}</span>
									) : null}
								</Link>
							</li>
						))}
					</ul>
				)}
			</main>
			<SiteFooter name={content.profile.name} d={d} />
		</>
	);
}
