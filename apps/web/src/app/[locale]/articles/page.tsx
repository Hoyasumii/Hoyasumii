import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/site/article-list";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getArticles, getContent } from "@/lib/data";
import { dict, isLocale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { locale } = await params;
	if (!isLocale(locale)) return {};
	const { seo } = await getContent();
	return { title: `${dict(locale).writing} — ${seo.title}`, alternates: { canonical: `/${locale}/articles/` } };
}

export default async function ArticlesPage({ params }: Props) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const [content, articles] = await Promise.all([getContent(), getArticles()]);
	const d = dict(locale);
	const home = `/${locale}/`;

	return (
		<>
			<SiteHeader
				profile={content.profile}
				locale={locale}
				d={d}
				path="articles/"
				anchorBase={home}
				nav={[
					{ id: "work", label: d.work },
					{ id: "writing", label: d.writing },
					{ id: "contact", label: d.contact },
				]}
			/>
			<main id="top" className="page">
				<h1 className="page__title">{d.writing}</h1>
				<ArticleList articles={articles} locale={locale} d={d} />
			</main>
			<SiteFooter name={content.profile.name} d={d} />
		</>
	);
}
