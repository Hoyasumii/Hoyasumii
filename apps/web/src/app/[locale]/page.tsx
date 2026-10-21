import {
	type Appearance,
	type ArticleSummary,
	type Content,
	iconLook,
	type Locale,
	type Project,
} from "@portfolio/shared";
import { notFound } from "next/navigation";
import { ArticleList } from "@/components/site/article-list";
import { ProjectCover } from "@/components/site/project-cover";
import { RotatingBadge } from "@/components/site/rotating-badge";
import { SiteFooter } from "@/components/site/site-footer";
import { type NavItem, SiteHeader } from "@/components/site/site-header";
import { TechIcon } from "@/components/tech-icon";
import { getArticles, getContent } from "@/lib/data";
import { type Dictionary, dict, isLocale, t } from "@/lib/i18n";

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

type SectionProps = {
	id: string;
	number: number;
	label: string;
	children: React.ReactNode;
};

function Section({ id, number, label, children }: SectionProps) {
	return (
		<section id={id} className="section" aria-labelledby={`${id}-label`}>
			<header className="section__label">
				<span className="section__number">{pad(number)}</span>
				<h2 id={`${id}-label`}>{label}</h2>
			</header>
			<div className="section__body">{children}</div>
		</section>
	);
}

function ProjectLinks({ project, d }: { project: Project; d: Dictionary }) {
	const entries = (["repo", "site", "docs", "npm"] as const).filter((key) => project.links[key]);
	if (entries.length === 0) return null;
	return (
		<ul className="project-links">
			{entries.map((key) => (
				<li key={key}>
					<a href={project.links[key]} target="_blank" rel="noreferrer">
						{d[key]} <span aria-hidden="true">↗</span>
					</a>
				</li>
			))}
		</ul>
	);
}

function FeaturedProject({
	project,
	index,
	locale,
	appearance,
	d,
}: {
	project: Project;
	index: number;
	locale: Locale;
	appearance: Appearance;
	d: Dictionary;
}) {
	return (
		<article className="feature">
			<div className="feature__head">
				<span className="feature__index">{pad(index)}</span>
				<h3 className="feature__name">{project.name}</h3>
				<span className="feature__meta">
					{t(project.kind, locale)} — {project.year}
				</span>
			</div>
			{project.cover ? (
				<ProjectCover
					src={project.cover}
					alt={`${d.coverOf} ${project.name}`}
					caption={`fig. ${pad(index)} — ${project.name}`}
					variant="feature"
					eager={index === 1}
				/>
			) : null}
			<div className="feature__body">
				<p className="feature__summary">{t(project.summary, locale)}</p>
				{project.stack.length > 0 ? (
					<div className="icon-row">
						{project.stack.map((name) => (
							<TechIcon key={name} name={name} appearance={appearance} size={32} />
						))}
					</div>
				) : null}
				<ProjectLinks project={project} d={d} />
			</div>
			{project.parts.length > 0 ? (
				<div className="tree">
					<p className="tree__root">
						{d.packages} <span aria-hidden="true">/</span>
					</p>
					<ul>
						{project.parts.map((part) => (
							<li key={part.name}>
								{part.url ? (
									<a href={part.url} target="_blank" rel="noreferrer" className="tree__name">
										{part.name}
									</a>
								) : (
									<span className="tree__name">{part.name}</span>
								)}
								<span className="tree__desc">{t(part.description, locale)}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</article>
	);
}

function ProjectTable({
	projects,
	offset,
	locale,
	appearance,
	d,
}: {
	projects: Project[];
	offset: number;
	locale: Locale;
	appearance: Appearance;
	d: Dictionary;
}) {
	return (
		<div className="ledger">
			<div className="ledger__head" aria-hidden="true">
				<span>Nº</span>
				<span>{d.project}</span>
				<span>{d.type}</span>
				<span>{d.year}</span>
			</div>
			{projects.map((project, i) => (
				<details key={project.id} className="ledger__row">
					<summary>
						<span className="ledger__index">{pad(offset + i)}</span>
						<span className="ledger__name">{project.name}</span>
						<span className="ledger__kind">{t(project.kind, locale)}</span>
						<span className="ledger__year">{project.year}</span>
						<span className="ledger__toggle" aria-hidden="true" />
					</summary>
					<div className="ledger__detail">
						{project.cover ? (
							<ProjectCover src={project.cover} alt={`${d.coverOf} ${project.name}`} variant="thumb" />
						) : null}
						<div className="ledger__text">
							<p>{t(project.summary, locale)}</p>
							{project.stack.length > 0 ? (
								<div className="icon-row">
									{project.stack.map((name) => (
										<TechIcon key={name} name={name} appearance={appearance} size={28} />
									))}
								</div>
							) : null}
							<ProjectLinks project={project} d={d} />
						</div>
					</div>
				</details>
			))}
		</div>
	);
}

function sections(content: Content, articles: ArticleSummary[], d: Dictionary): NavItem[] {
	const list: NavItem[] = [
		{ id: "about", label: d.about },
		{ id: "work", label: d.work },
	];
	if (content.experience.length > 0) list.push({ id: "experience", label: d.experience });
	if (content.stack.length > 0) list.push({ id: "stack", label: d.stack });
	if (articles.length > 0) list.push({ id: "writing", label: d.writing });
	list.push({ id: "contact", label: d.contact });
	return list;
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();

	const [content, articles] = await Promise.all([getContent(), getArticles()]);
	const d = dict(locale);
	const { profile } = content;
	const { appearance } = content;
	const featured = content.projects.filter((p) => p.featured);
	const others = content.projects.filter((p) => !p.featured);
	const nav = sections(content, articles, d);
	const numberOf = (id: string) => nav.findIndex((s) => s.id === id) + 1;
	const [firstName, ...rest] = profile.name.split(" ");

	return (
		<>
			<SiteHeader profile={profile} locale={locale} nav={nav} d={d} />

			<main id="top">
				<section className="hero" aria-label={profile.name}>
					<h1 className="hero__name">
						<span className="hero__line">{firstName}</span>
						{rest.length > 0 ? <span className="hero__line hero__line--indent">{rest.join(" ")}</span> : null}
					</h1>
					<div className="hero__figure">
						<RotatingBadge text={`${t(profile.role, locale)} ✳ `} />
						{profile.avatar ? (
							<img src={profile.avatar} alt={profile.name} className="hero__avatar" width={176} height={176} />
						) : null}
					</div>
					<div className="hero__meta">
						<p className="hero__role">{t(profile.role, locale)}</p>
						{profile.available ? (
							<p className="hero__status">
								<span className="dot" aria-hidden="true" />
								{t(profile.availability, locale)}
							</p>
						) : null}
					</div>
					<p className="hero__headline">{t(profile.headline, locale)}</p>
				</section>

				<Section id="about" number={numberOf("about")} label={d.about}>
					<p className="lede">{t(profile.about, locale)}</p>
				</Section>

				<Section id="work" number={numberOf("work")} label={d.selectedWork}>
					{featured.map((project, i) => (
						<FeaturedProject
							key={project.id}
							project={project}
							index={i + 1}
							locale={locale}
							appearance={appearance}
							d={d}
						/>
					))}
					{others.length > 0 ? (
						<>
							<h3 className="subhead">{d.otherWork}</h3>
							<ProjectTable
								projects={others}
								offset={featured.length + 1}
								locale={locale}
								appearance={appearance}
								d={d}
							/>
						</>
					) : null}
				</Section>

				{content.experience.length > 0 ? (
					<Section id="experience" number={numberOf("experience")} label={d.experience}>
						<ol className="timeline">
							{content.experience.map((job) => (
								<li key={job.id} className="timeline__item">
									<span className="timeline__when">
										{job.start} — {job.end || d.present}
									</span>
									<div>
										<h3 className="timeline__role">
											{t(job.role, locale)} <span className="timeline__at">@ {job.company}</span>
										</h3>
										<p>{t(job.description, locale)}</p>
									</div>
								</li>
							))}
						</ol>
					</Section>
				) : null}

				{content.stack.length > 0 ? (
					<Section id="stack" number={numberOf("stack")} label={d.stack}>
						{iconLook(appearance, "light").tint || iconLook(appearance, "dark").tint ? (
							<p className="hint">{d.hoverHint}</p>
						) : null}
						<dl className="stack">
							{content.stack.map((group) => (
								<div key={group.id} className="stack__group">
									<dt>{t(group.title, locale)}</dt>
									<dd className="icon-row">
										{group.icons.map((name) => (
											<TechIcon key={name} name={name} appearance={appearance} size={40} />
										))}
									</dd>
								</div>
							))}
						</dl>
					</Section>
				) : null}

				{articles.length > 0 ? (
					<Section id="writing" number={numberOf("writing")} label={d.writing}>
						<ArticleList articles={articles} locale={locale} d={d} limit={6} />
					</Section>
				) : null}

				<Section id="contact" number={numberOf("contact")} label={d.contact}>
					<p className="lede">{d.sayHi}</p>
					<a className="mail" href={`mailto:${profile.email}`}>
						<span className="mail__label">{d.writeMe} →</span>
						<span className="mail__address">{profile.email}</span>
					</a>
					{content.links.length > 0 ? (
						<div className="elsewhere">
							<h3 className="subhead">{d.elsewhere}</h3>
							<ul>
								{content.links.map((link) => (
									<li key={link.id}>
										<a href={link.url} target="_blank" rel="me noreferrer">
											{link.label} <span aria-hidden="true">↗</span>
										</a>
									</li>
								))}
							</ul>
						</div>
					) : null}
				</Section>
			</main>

			<SiteFooter name={profile.name} d={d} />
		</>
	);
}
