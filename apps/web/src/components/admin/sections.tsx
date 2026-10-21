"use client";

import {
	type Appearance,
	accentFor,
	type CollectionInput,
	contrastRatio,
	defaultAccent,
	inkOn,
	type Localized,
	MIN_ACCENT_CONTRAST,
	PAPER,
} from "@portfolio/shared";
import { iconUrl, parseTint, TINT_SWATCHES } from "@/lib/icons";
import { tintFor } from "@/lib/theme";
import { CollectionEditor } from "./collection-editor";
import { useAdmin } from "./context";
import { ChipsField, IconsField, ImageField, LocalizedField, TextArea, TextField, Toggle } from "./fields";
import { MarkdownEditor } from "./markdown-editor";
import { SettingsEditor } from "./settings-editor";

const blank = (): Localized => ({ pt: "", en: "" });

/** The tint the admin previews icons with (dark theme, like the panel). */
function usePreviewTint() {
	return tintFor(useAdmin().appearance, "dark");
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
	const tint = usePreviewTint();
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
					<IconsField label="Stack" value={value.stack} tint={tint} onChange={(stack) => set({ ...value, stack })} />
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
					<ImageField label="Capa" value={value.cover} onChange={(cover) => set({ ...value, cover })} />
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
	const tint = usePreviewTint();
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
					<IconsField label="Ícones" value={value.icons} tint={tint} onChange={(icons) => set({ ...value, icons })} />
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
					<img key={name} src={iconUrl(name, theme, tintFor(appearance, theme))} alt={name} width={32} height={32} />
				))}
			</div>
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
				const current = { ...value, accent };
				const mode = value.iconTint === "accent" ? "accent" : value.iconTint ? "custom" : "original";
				const setAccent = (next: Appearance["accent"]) => set({ ...current, accent: next });

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
							<legend className="field__label">Tonalização dos ícones</legend>
							<p className="field__hint">Ao passar o mouse, cada ícone mostra as cores originais.</p>
							<div className="segmented">
								{(
									[
										["accent", "Cor de destaque"],
										["custom", "Outra cor"],
										["original", "Cores originais"],
									] as const
								).map(([key, text]) => (
									<label key={key} className={mode === key ? "is-active" : ""}>
										<input
											type="radio"
											name="tint-mode"
											checked={mode === key}
											onChange={() =>
												set({
													...current,
													iconTint: key === "accent" ? "accent" : key === "original" ? "" : TINT_SWATCHES[0],
												})
											}
										/>
										{text}
									</label>
								))}
							</div>
						</fieldset>

						{mode === "custom" ? (
							<div className="field">
								<span className="field__label">Cor dos ícones</span>
								<div className="swatches">
									{TINT_SWATCHES.map((swatch) => (
										<button
											key={swatch}
											type="button"
											className={`swatch${value.iconTint === swatch ? " is-active" : ""}`}
											style={{ background: `#${swatch}` }}
											aria-label={`#${swatch}`}
											onClick={() => set({ ...current, iconTint: swatch })}
										/>
									))}
									<input
										className="input swatches__hex"
										aria-label="Cor em hexadecimal"
										defaultValue={value.iconTint}
										onChange={(event) => {
											const parsed = parseTint(event.target.value);
											if (parsed) set({ ...current, iconTint: parsed });
										}}
									/>
								</div>
							</div>
						) : null}

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

export function SeoSection() {
	return (
		<SettingsEditor settingsKey="seo" title="SEO" description="Título e descrição para buscadores e prévias de link.">
			{(value, set) => (
				<>
					<TextField label="Título" value={value.title} onChange={(title) => set({ ...value, title })} />
					<LocalizedField
						label="Descrição"
						multiline
						value={value.description}
						onChange={(description) => set({ ...value, description })}
					/>
				</>
			)}
		</SettingsEditor>
	);
}
