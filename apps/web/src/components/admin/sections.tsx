"use client";

import {
	type Appearance,
	accentFor,
	type CollectionInput,
	contrastRatio,
	defaultAccent,
	defaultIconStyles,
	type IconStyle,
	iconLook,
	inkOn,
	type Localized,
	MIN_ACCENT_CONTRAST,
	PAPER,
	type Seo,
} from "@portfolio/shared";
import { siteHost } from "@/lib/cover";
import { iconUrl, parseTint, TINT_SWATCHES } from "@/lib/icons";
import { CollectionEditor } from "./collection-editor";
import { useAdmin } from "./context";
import { type CoverDefaults, CoverGenerator } from "./cover-generator";
import { ChipsField, IconsField, ImageField, LocalizedField, TextArea, TextField, Toggle } from "./fields";
import { MarkdownEditor } from "./markdown-editor";
import { SettingsEditor } from "./settings-editor";

const blank = (): Localized => ({ pt: "", en: "" });

/** The icon style the admin previews icons with (the dark theme, like the panel). */
function usePreviewLook() {
	return iconLook(useAdmin().appearance, "dark");
}

function slugify(text: string): string {
	return text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

/* ------------------------------------------------------------------------- */

export function ProfileSection() {
	return (
		<SettingsEditor settingsKey="profile" title="Perfil" description="Quem você é: aparece no topo e no contato.">
			{(value, set) => (
				<>
					<div className="grid-2">
						<TextField label="Nome" value={value.name} onChange={(name) => set({ ...value, name })} required />
						<TextField label="Handle" value={value.handle} onChange={(handle) => set({ ...value, handle })} />
					</div>
					<LocalizedField label="Cargo" value={value.role} onChange={(role) => set({ ...value, role })} />
					<LocalizedField
						label="Frase de abertura"
						hint="O texto grande logo abaixo do nome."
						multiline
						value={value.headline}
						onChange={(headline) => set({ ...value, headline })}
					/>
					<LocalizedField
						label="Sobre"
						multiline
						rows={6}
						value={value.about}
						onChange={(about) => set({ ...value, about })}
					/>
					<div className="grid-2">
						<TextField
							label="Localização"
							value={value.location}
							onChange={(location) => set({ ...value, location })}
						/>
						<TextField
							label="Fuso horário"
							hint="Para o relógio do topo, ex.: America/Maceio."
							value={value.timeZone}
							onChange={(timeZone) => set({ ...value, timeZone })}
						/>
					</div>
					<TextField
						label="E-mail"
						type="email"
						value={value.email}
						onChange={(email) => set({ ...value, email })}
						required
					/>
					<ImageField label="Foto" value={value.avatar} onChange={(avatar) => set({ ...value, avatar })} />
					<Toggle
						label="Mostrar disponibilidade"
						checked={value.available}
						onChange={(available) => set({ ...value, available })}
					/>
					{value.available ? (
						<LocalizedField
							label="Texto de disponibilidade"
							value={value.availability}
							onChange={(availability) => set({ ...value, availability })}
						/>
					) : null}
				</>
			)}
		</SettingsEditor>
	);
}

/* ------------------------------------------------------------------------- */

const emptyProject = (): CollectionInput<"projects"> => ({
	name: "",
	kind: blank(),
	year: String(new Date().getFullYear()),
	summary: blank(),
	cover: "",
	stack: [],
	featured: false,
	published: true,
	links: { repo: "", site: "", docs: "", npm: "" },
	parts: [],
});

export function ProjectsSection() {
	const look = usePreviewLook();
	return (
		<CollectionEditor
			name="projects"
			title="Projetos"
			noun="projeto"
			description="Os destacados aparecem grandes; os outros, na tabela."
			empty={emptyProject}
			label={(item) => item.name || "Sem nome"}
			meta={(item) =>
				[item.featured ? "★" : "", item.published ? "" : "rascunho", item.year].filter(Boolean).join(" · ")
			}
		>
			{(value, set) => (
				<>
					<div className="grid-2">
						<TextField label="Nome" value={value.name} onChange={(name) => set({ ...value, name })} required />
						<TextField label="Ano" value={value.year} onChange={(year) => set({ ...value, year })} />
					</div>
					<LocalizedField
						label="Tipo"
						hint="Ex.: CMS headless, API, App mobile."
						value={value.kind}
						onChange={(kind) => set({ ...value, kind })}
					/>
					<LocalizedField
						label="Resumo"
						multiline
						rows={4}
						value={value.summary}
						onChange={(summary) => set({ ...value, summary })}
					/>
					<IconsField label="Stack" value={value.stack} look={look} onChange={(stack) => set({ ...value, stack })} />
					<div className="grid-2">
						{(["repo", "site", "docs", "npm"] as const).map((key) => (
							<TextField
								key={key}
								label={{ repo: "Código", site: "Site", docs: "Docs", npm: "npm" }[key]}
								type="url"
								value={value.links[key]}
								onChange={(url) => set({ ...value, links: { ...value.links, [key]: url } })}
							/>
						))}
					</div>
					<ImageField label="Capa" value={value.cover} onChange={(cover) => set({ ...value, cover })} />
					<div className="grid-2">
						<Toggle label="Destacado" checked={value.featured} onChange={(featured) => set({ ...value, featured })} />
						<Toggle
							label="Publicado"
							checked={value.published}
							onChange={(published) => set({ ...value, published })}
						/>
					</div>

					<fieldset className="field parts">
						<legend className="field__label">Pacotes / módulos</legend>
						<p className="field__hint">Aparecem como uma árvore abaixo do projeto.</p>
						{value.parts.map((part, index) => (
							<div key={index} className="parts__item">
								<div className="grid-2">
									<TextField
										label="Nome"
										value={part.name}
										onChange={(name) =>
											set({ ...value, parts: value.parts.map((p, i) => (i === index ? { ...p, name } : p)) })
										}
									/>
									<TextField
										label="URL"
										type="url"
										value={part.url}
										onChange={(url) =>
											set({ ...value, parts: value.parts.map((p, i) => (i === index ? { ...p, url } : p)) })
										}
									/>
								</div>
								<LocalizedField
									label="Descrição"
									value={part.description}
									onChange={(description) =>
										set({
											...value,
											parts: value.parts.map((p, i) => (i === index ? { ...p, description } : p)),
										})
									}
								/>
								<button
									type="button"
									className="button button--ghost"
									onClick={() => set({ ...value, parts: value.parts.filter((_, i) => i !== index) })}
								>
									Remover pacote
								</button>
							</div>
						))}
						<button
							type="button"
							className="button"
							onClick={() => set({ ...value, parts: [...value.parts, { name: "", url: "", description: blank() }] })}
						>
							+ Pacote
						</button>
					</fieldset>
				</>
			)}
		</CollectionEditor>
	);
}

/* ------------------------------------------------------------------------- */

const emptyArticle = (): CollectionInput<"articles"> => ({
	title: "",
	slug: "",
	lang: "pt",
	excerpt: "",
	body: "",
	cover: "",
	tags: [],
	publishedAt: new Date().toISOString().slice(0, 10),
	published: false,
});

/** An article's cover: its title, the date and language on top, the tags at the bottom. */
function articleCover(article: CollectionInput<"articles">): CoverDefaults {
	return (profile) => ({
		layout: "article",
		top: {
			start: profile.handle || profile.name,
			center: [article.lang === "pt" ? "Artigo" : "Article", article.publishedAt].filter(Boolean).join(" · "),
			end: siteHost,
		},
		headline: article.title,
		meta: article.tags.map((tag) => `#${tag}`),
	});
}

export function ArticlesSection() {
	return (
		<CollectionEditor
			name="articles"
			title="Artigos"
			noun="artigo"
			description="Escritos no próprio site. Os do dev.to entram sozinhos a cada publicação."
			sortable={false}
			empty={emptyArticle}
			label={(item) => item.title || "Sem título"}
			meta={(item) => [item.lang.toUpperCase(), item.published ? item.publishedAt : "rascunho"].join(" · ")}
		>
			{(value, set) => (
				<>
					<TextField
						label="Título"
						value={value.title}
						required
						onChange={(title) => {
							const autoSlug = !value.slug || value.slug === slugify(value.title);
							set({ ...value, title, slug: autoSlug ? slugify(title) : value.slug });
						}}
					/>
					<div className="grid-3">
						<TextField
							label="Slug"
							hint="Endereço: /pt/articles/<slug>/"
							value={value.slug}
							onChange={(slug) => set({ ...value, slug: slugify(slug) })}
							required
						/>
						<div className="field">
							<label className="field__label" htmlFor="article-lang">
								Idioma
							</label>
							<select
								id="article-lang"
								className="input"
								value={value.lang}
								onChange={(event) => set({ ...value, lang: event.target.value as "pt" | "en" })}
							>
								<option value="pt">Português</option>
								<option value="en">English</option>
							</select>
						</div>
						<TextField
							label="Data de publicação"
							type="date"
							value={value.publishedAt}
							onChange={(publishedAt) => set({ ...value, publishedAt })}
							required
						/>
					</div>
					<TextArea
						label="Resumo"
						hint="Aparece na lista e nas prévias de link."
						rows={2}
						value={value.excerpt}
						onChange={(excerpt) => set({ ...value, excerpt })}
					/>
					<MarkdownEditor label="Texto" value={value.body} onChange={(body) => set({ ...value, body })} />
					<ImageField
						label="Capa"
						value={value.cover}
						onChange={(cover) => set({ ...value, cover })}
						actions={<CoverGenerator defaults={articleCover(value)} onUse={(cover) => set({ ...value, cover })} />}
					/>
					<ChipsField label="Tags" value={value.tags} onChange={(tags) => set({ ...value, tags })} />
					<Toggle
						label="Publicado"
						hint="Rascunhos ficam só aqui no painel."
						checked={value.published}
						onChange={(published) => set({ ...value, published })}
					/>
				</>
			)}
		</CollectionEditor>
	);
}

/* ------------------------------------------------------------------------- */

const emptyExperience = (): CollectionInput<"experience"> => ({
	company: "",
	role: blank(),
	start: "",
	end: "",
	description: blank(),
});

export function ExperienceSection() {
	return (
		<CollectionEditor
			name="experience"
			title="Experiência"
			noun="cargo"
			description="A seção só aparece no site quando houver ao menos um item."
			empty={emptyExperience}
			label={(item) => item.company || "Sem empresa"}
			meta={(item) => `${item.start || "?"} — ${item.end || "atual"}`}
		>
			{(value, set) => (
				<>
					<TextField
						label="Empresa"
						value={value.company}
						onChange={(company) => set({ ...value, company })}
						required
					/>
					<LocalizedField label="Cargo" value={value.role} onChange={(role) => set({ ...value, role })} />
					<div className="grid-2">
						<TextField
							label="Início"
							placeholder="2024"
							value={value.start}
							onChange={(start) => set({ ...value, start })}
						/>
						<TextField label="Fim" hint="Vazio = atual." value={value.end} onChange={(end) => set({ ...value, end })} />
					</div>
					<LocalizedField
						label="Descrição"
						multiline
						value={value.description}
						onChange={(description) => set({ ...value, description })}
					/>
				</>
			)}
		</CollectionEditor>
	);
}

/* ------------------------------------------------------------------------- */

export function StackSection() {
	const look = usePreviewLook();
	return (
		<CollectionEditor
			name="stack"
			title="Stack"
			noun="grupo"
			description="Grupos de ícones do Skill Icons."
			empty={() => ({ title: blank(), icons: [] })}
			label={(item) => item.title.pt || item.title.en || "Sem título"}
			meta={(item) => `${item.icons.length} ícones`}
		>
			{(value, set) => (
				<>
					<LocalizedField label="Título" value={value.title} onChange={(title) => set({ ...value, title })} />
					<IconsField label="Ícones" value={value.icons} look={look} onChange={(icons) => set({ ...value, icons })} />
				</>
			)}
		</CollectionEditor>
	);
}

/* ------------------------------------------------------------------------- */

export function LinksSection() {
	return (
		<CollectionEditor
			name="links"
			title="Links"
			noun="link"
			description="Redes e perfis listados no contato."
			empty={() => ({ label: "", url: "" })}
			label={(item) => item.label || "Sem nome"}
			meta={(item) => item.url.replace(/^https?:\/\//, "")}
		>
			{(value, set) => (
				<>
					<TextField label="Nome" value={value.label} onChange={(label) => set({ ...value, label })} required />
					<TextField label="URL" type="url" value={value.url} onChange={(url) => set({ ...value, url })} required />
				</>
			)}
		</CollectionEditor>
	);
}

/* ------------------------------------------------------------------------- */

const PREVIEW_ICONS = ["ts", "react", "bun", "postgres", "docker", "figma"];

/** Accent presets: a base color; each theme's variant is derived to stay readable. */
const ACCENT_PRESETS = [
	{ name: "Brasa", light: "d4441c", dark: "ff6a3d" },
	{ name: "Musgo", light: "2f7a3d", dark: "5fd27a" },
	{ name: "Oceano", light: "1f5fd1", dark: "6aa5ff" },
	{ name: "Violeta", light: "6b3fd4", dark: "b493ff" },
	{ name: "Rosa", light: "c2185b", dark: "ff6fa8" },
	{ name: "Âmbar", light: "9a6200", dark: "ffb238" },
	{ name: "Grafite", light: "3d3c39", dark: "c9c7bf" },
];

const THEME_LABEL = { light: "Claro", dark: "Escuro" } as const;

function ContrastBadge({ color, theme }: { color: string; theme: "light" | "dark" }) {
	const ratio = contrastRatio(color, PAPER[theme]);
	const ok = ratio >= MIN_ACCENT_CONTRAST;
	return (
		<span className={`contrast${ok ? "" : " contrast--low"}`} title="Contraste com o fundo (WCAG, mínimo 3:1)">
			{ratio.toFixed(1)}:1 {ok ? "ok" : "baixo"}
		</span>
	);
}

function AccentField({
	theme,
	value,
	onChange,
}: {
	theme: "light" | "dark";
	value: string;
	onChange: (hex: string) => void;
}) {
	return (
		<div className="accent-field">
			<span className="field__label">Tema {THEME_LABEL[theme].toLowerCase()}</span>
			<div className="accent-field__row">
				<input
					type="color"
					aria-label={`Cor de destaque no tema ${THEME_LABEL[theme].toLowerCase()}`}
					value={`#${value}`}
					onChange={(event) => onChange(event.target.value.slice(1).toLowerCase())}
				/>
				<input
					className="input accent-field__hex"
					aria-label={`Hexadecimal do tema ${THEME_LABEL[theme].toLowerCase()}`}
					key={value}
					defaultValue={value}
					onChange={(event) => {
						const parsed = parseTint(event.target.value);
						if (parsed) onChange(parsed);
					}}
				/>
				<ContrastBadge color={value} theme={theme} />
			</div>
		</div>
	);
}

/** A slice of the site in one theme, drawn with the chosen colors. */
function AccentPreview({ appearance, theme }: { appearance: Appearance; theme: "light" | "dark" }) {
	const accent = appearance.accent[theme];
	return (
		<div
			className={`accent-preview accent-preview--${theme}`}
			style={{ "--preview-accent": `#${accent}`, "--preview-ink": `#${inkOn(accent)}` } as React.CSSProperties}
		>
			<span className="accent-preview__label">{THEME_LABEL[theme]}</span>
			<p className="accent-preview__name">
				ALAN <span>REIS</span>
			</p>
			<p className="accent-preview__section">
				<span>02</span> Trabalho selecionado
			</p>
			<p className="accent-preview__link">Link em destaque ↗</p>
			<span className="accent-preview__button">Botão</span>
			<div className="accent-preview__icons">
				{PREVIEW_ICONS.map((name) => (
					<img
						key={name}
						src={iconUrl(name, iconLook(appearance, theme).variant, iconLook(appearance, theme).tint)}
						alt={name}
						width={32}
						height={32}
					/>
				))}
			</div>
		</div>
	);
}

/** Variant and tint of Skill Icons in one theme of the site. */
function IconStyleEditor({
	theme,
	style,
	onChange,
}: {
	theme: "light" | "dark";
	style: IconStyle;
	onChange: (style: IconStyle) => void;
}) {
	const mode = style.tint === "accent" ? "accent" : style.tint ? "custom" : "original";
	const label = THEME_LABEL[theme].toLowerCase();
	return (
		<div className="icon-style">
			<p className="icon-style__title">No tema {label}</p>
			<div className="icon-style__row">
				<span className="field__label">Variante</span>
				<div className="segmented">
					{(["light", "dark"] as const).map((variant) => (
						<label key={variant} className={style.variant === variant ? "is-active" : ""}>
							<input
								type="radio"
								name={`icon-variant-${theme}`}
								checked={style.variant === variant}
								onChange={() => onChange({ ...style, variant })}
							/>
							{THEME_LABEL[variant]}
						</label>
					))}
				</div>
			</div>
			<div className="icon-style__row">
				<span className="field__label">Cor</span>
				<div className="segmented">
					{(
						[
							["accent", "Destaque"],
							["custom", "Outra cor"],
							["original", "Originais"],
						] as const
					).map(([key, text]) => (
						<label key={key} className={mode === key ? "is-active" : ""}>
							<input
								type="radio"
								name={`icon-tint-${theme}`}
								checked={mode === key}
								onChange={() =>
									onChange({
										...style,
										tint: key === "accent" ? "accent" : key === "original" ? "" : TINT_SWATCHES[0],
									})
								}
							/>
							{text}
						</label>
					))}
				</div>
			</div>
			{mode === "custom" ? (
				<div className="swatches">
					{TINT_SWATCHES.map((swatch) => (
						<button
							key={swatch}
							type="button"
							className={`swatch${style.tint === swatch ? " is-active" : ""}`}
							style={{ background: `#${swatch}` }}
							aria-label={`#${swatch}`}
							onClick={() => onChange({ ...style, tint: swatch })}
						/>
					))}
					<input
						className="input swatches__hex"
						aria-label={`Cor dos ícones no tema ${label}, em hexadecimal`}
						key={style.tint}
						defaultValue={style.tint}
						onChange={(event) => {
							const parsed = parseTint(event.target.value);
							if (parsed) onChange({ ...style, tint: parsed });
						}}
					/>
				</div>
			) : null}
		</div>
	);
}

export function AppearanceSection() {
	const { setAppearance } = useAdmin();
	return (
		<SettingsEditor
			settingsKey="appearance"
			title="Aparência"
			description="Cor de destaque do site e cor dos ícones do Skill Icons."
			onSaved={(value) => setAppearance(value)}
		>
			{(value, set) => {
				const accent = value.accent ?? defaultAccent;
				const icons = value.icons ?? defaultIconStyles;
				const current = { ...value, accent, icons };
				const setAccent = (next: Appearance["accent"]) => set({ ...current, accent: next });
				const setIcons = (theme: "light" | "dark", style: IconStyle) =>
					set({ ...current, icons: { ...icons, [theme]: style } });

				return (
					<>
						<fieldset className="field">
							<legend className="field__label">Cor de destaque</legend>
							<p className="field__hint">
								Usada no nome, nos números das seções, nos links e nos botões. Cada tema tem a sua variante, para ficar
								legível nos dois fundos.
							</p>
							<div className="swatches">
								{ACCENT_PRESETS.map((preset) => (
									<button
										key={preset.name}
										type="button"
										className={`swatch swatch--pair${accent.light === preset.light && accent.dark === preset.dark ? " is-active" : ""}`}
										style={{ background: `linear-gradient(135deg, #${preset.light} 50%, #${preset.dark} 50%)` }}
										aria-label={preset.name}
										title={preset.name}
										onClick={() => setAccent({ light: preset.light, dark: preset.dark })}
									/>
								))}
							</div>
							<div className="grid-2">
								<AccentField theme="light" value={accent.light} onChange={(light) => setAccent({ ...accent, light })} />
								<AccentField theme="dark" value={accent.dark} onChange={(dark) => setAccent({ ...accent, dark })} />
							</div>
							<div className="accent-actions">
								<button
									type="button"
									className="button"
									onClick={() => setAccent({ light: accent.light, dark: accentFor("dark", accent.light) })}
								>
									Gerar escuro a partir do claro
								</button>
								<button
									type="button"
									className="button"
									onClick={() => setAccent({ light: accentFor("light", accent.dark), dark: accent.dark })}
								>
									Gerar claro a partir do escuro
								</button>
								<button type="button" className="button button--ghost" onClick={() => setAccent(defaultAccent)}>
									Voltar ao padrão
								</button>
							</div>
						</fieldset>

						<fieldset className="field">
							<legend className="field__label">Ícones do Skill Icons</legend>
							<p className="field__hint">
								Escolha, para cada tema do site, a variante do ícone e a cor. Ícones tonalizados mostram as cores
								originais ao passar o mouse.
							</p>
							<div className="icon-styles">
								<IconStyleEditor theme="light" style={icons.light} onChange={(style) => setIcons("light", style)} />
								<IconStyleEditor theme="dark" style={icons.dark} onChange={(style) => setIcons("dark", style)} />
							</div>
						</fieldset>

						<div className="field">
							<span className="field__label">Prévia</span>
							<div className="accent-previews">
								<AccentPreview appearance={current} theme="light" />
								<AccentPreview appearance={current} theme="dark" />
							</div>
						</div>
					</>
				);
			}}
		</SettingsEditor>
	);
}

/* ------------------------------------------------------------------------- */

/** The site's cover: the hero's name, location and role, as on the home page. */
const siteCover: CoverDefaults = (profile) => ({
	layout: "profile",
	top: { start: profile.handle || profile.name, center: profile.location, end: siteHost },
	headline: profile.name.split(/\s+/).join("\n"),
	meta: [profile.role.en],
});

/** How a link to the site looks when shared, with the browser tab above it. */
function SharePreview({ seo }: { seo: Seo }) {
	return (
		<div className="share-previews">
			<div className="tab-preview">
				{seo.favicon ? (
					<img src={seo.favicon} alt="" width={16} height={16} />
				) : (
					<span className="tab-preview__fallback" aria-hidden="true" />
				)}
				<span className="tab-preview__title">{seo.title || "Sem título"}</span>
			</div>
			<div className="share-preview">
				{seo.image ? (
					<img src={seo.image} alt="" className="share-preview__image" />
				) : (
					<div className="share-preview__image share-preview__image--empty">Sem capa</div>
				)}
				<div className="share-preview__text">
					<span className="share-preview__host">{siteHost}</span>
					<strong className="share-preview__title">{seo.title || "Sem título"}</strong>
					<span className="share-preview__description">{seo.description.pt}</span>
				</div>
			</div>
		</div>
	);
}

export function SeoSection() {
	return (
		<SettingsEditor
			settingsKey="seo"
			title="SEO"
			description="Favicon, título, descrição e capa para buscadores e prévias de link."
		>
			{(value, set) => {
				// Fields added later may be missing while the API is still on an older build.
				const seo: Seo = {
					...value,
					favicon: value.favicon ?? "",
					image: value.image ?? "",
					keywords: value.keywords ?? [],
					twitter: value.twitter ?? "",
				};
				return (
					<>
						<TextField
							label="Título"
							value={seo.title}
							onChange={(title) => set({ ...seo, title })}
							hint="Aparece na aba do navegador, nos resultados de busca e nas prévias de link. Até ~60 caracteres."
						/>
						<LocalizedField
							label="Descrição"
							multiline
							value={seo.description}
							onChange={(description) => set({ ...seo, description })}
							hint={`Até ~160 caracteres. Agora: ${seo.description.pt.length} (pt) · ${seo.description.en.length} (en).`}
						/>
						<ImageField
							label="Favicon"
							value={seo.favicon}
							onChange={(favicon) => set({ ...seo, favicon })}
							accept="image/png,image/x-icon,image/vnd.microsoft.icon,.ico,image/webp,image/gif"
							previewClassName="image-field__favicon"
							hint="Ícone da aba do navegador. PNG quadrado (512×512 serve para todos os tamanhos) ou .ico. Vazio usa o favicon padrão."
						/>
						<ImageField
							label="Capa"
							value={seo.image}
							onChange={(image) => set({ ...seo, image })}
							actions={<CoverGenerator defaults={siteCover} onUse={(image) => set({ ...seo, image })} />}
							hint="Imagem das prévias de link (WhatsApp, LinkedIn, X, Discord…). Use 1200×630. Artigos com capa própria usam a deles."
						/>
						<ChipsField
							label="Palavras-chave"
							value={seo.keywords}
							onChange={(keywords) => set({ ...seo, keywords })}
							hint="Até 20 termos."
						/>
						<TextField
							label="Usuário no X (Twitter)"
							value={seo.twitter}
							placeholder="sem @"
							onChange={(twitter) => set({ ...seo, twitter: twitter.replace(/^@/, "").trim() })}
						/>
						<div className="field">
							<span className="field__label">Prévia</span>
							<SharePreview seo={seo} />
						</div>
					</>
				);
			}}
		</SettingsEditor>
	);
}
