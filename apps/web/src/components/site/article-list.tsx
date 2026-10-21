import type { ArticleSummary, Locale } from "@portfolio/shared";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";

export function formatDate(date: string, locale: Locale): string {
	const parsed = new Date(`${date.slice(0, 10)}T12:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return date;
	return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	}).format(parsed);
}

type Props = {
	articles: ArticleSummary[];
	locale: Locale;
	d: Dictionary;
	/** Shows at most this many, with a link to the full list. */
	limit?: number;
};

function Row({ article, locale, d }: { article: ArticleSummary; locale: Locale; d: Dictionary }) {
	return (
		<li>
			<Link href={`/${locale}/articles/${article.slug}/`} hrefLang={article.lang}>
				<time dateTime={article.publishedAt}>{formatDate(article.publishedAt, locale)}</time>
				<span className="articles__title">{article.title}</span>
				<span className="articles__meta">
					{article.lang.toUpperCase()} · {article.readingMinutes} {d.minRead}
					{article.source === "devto" ? " · dev.to" : ""}
				</span>
			</Link>
		</li>
	);
}

/** Articles in the page's language first, then the rest under their own heading. */
export function ArticleList({ articles, locale, d, limit }: Props) {
	const own = articles.filter((article) => article.lang === locale);
	const other = articles.filter((article) => article.lang !== locale);
	const visibleOwn = limit ? own.slice(0, limit) : own;
	const visibleOther = limit ? other.slice(0, Math.max(0, limit - visibleOwn.length)) : other;
	const hidden = articles.length - visibleOwn.length - visibleOther.length;

	return (
		<>
			{visibleOwn.length > 0 ? (
				<ul className="articles">
					{visibleOwn.map((article) => (
						<Row key={article.slug} article={article} locale={locale} d={d} />
					))}
				</ul>
			) : null}
			{visibleOther.length > 0 ? (
				<>
					<h3 className="subhead">{d.otherLanguages}</h3>
					<ul className="articles">
						{visibleOther.map((article) => (
							<Row key={article.slug} article={article} locale={locale} d={d} />
						))}
					</ul>
				</>
			) : null}
			{hidden > 0 ? (
				<p className="more">
					<Link href={`/${locale}/articles/`}>
						{d.allArticles} ({articles.length}) →
					</Link>
				</p>
			) : null}
		</>
	);
}
