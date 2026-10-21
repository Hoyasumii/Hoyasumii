"use client";

import type { CollectionInput, Localized } from "@portfolio/shared";
import { iconUrl, parseTint, TINT_SWATCHES } from "@/lib/icons";
import { ACCENT, tintFor } from "@/lib/theme";
import { CollectionEditor } from "./collection-editor";
import { useAdmin } from "./context";
import { ChipsField, IconsField, ImageField, LocalizedField, TextArea, TextField, Toggle } from "./fields";
import { MarkdownEditor } from "./markdown-editor";
import { SettingsEditor } from "./settings-editor";

const blank = (): Localized => ({ pt: "", en: "" });

/** The tint the admin previews icons with (dark theme, like the panel). */
function usePreviewTint() {
	return tintFor(useAdmin().tint, "dark");
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

export function AppearanceSection() {
	const { setTint } = useAdmin();
	return (
		<SettingsEditor
			settingsKey="appearance"
			title="Aparência"
			description="Cor dos ícones do Skill Icons em todo o site. Ao passar o mouse, cada ícone mostra as cores originais."
			onSaved={(value) => setTint(value.iconTint)}
		>
			{(value, set) => {
				const mode = value.iconTint === "accent" ? "accent" : value.iconTint ? "custom" : "original";
				return (
					<>
						<fieldset className="field">
							<legend className="field__label">Tonalização</legend>
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
								<span className="field__label">Cor</span>
								<div className="swatches">
									{TINT_SWATCHES.map((swatch) => (
										<button
											key={swatch}
											type="button"
											className={`swatch${value.iconTint === swatch ? " is-active" : ""}`}
											style={{ background: `#${swatch}` }}
											aria-label={`#${swatch}`}
											onClick={() => set({ iconTint: swatch })}
										/>
									))}
									<input
										className="input swatches__hex"
										aria-label="Cor em hexadecimal"
										defaultValue={value.iconTint}
										onChange={(event) => {
											const parsed = parseTint(event.target.value);
											if (parsed) set({ iconTint: parsed });
										}}
									/>
								</div>
							</div>
						) : null}

						<div className="field">
							<span className="field__label">Prévia</span>
							<div className="tint-preview">
								{(["dark", "light"] as const).map((theme) => (
									<div key={theme} className={`tint-preview__row tint-preview__row--${theme}`}>
										<span>{theme === "dark" ? "Escuro" : "Claro"}</span>
										{PREVIEW_ICONS.map((name) => (
											<img
												key={name}
												src={iconUrl(name, theme, tintFor(value.iconTint, theme))}
												alt={name}
												width={36}
												height={36}
											/>
										))}
									</div>
								))}
							</div>
							{mode === "accent" ? (
								<p className="field__hint">
									#{ACCENT.dark} no tema escuro e #{ACCENT.light} no claro, as mesmas cores de destaque do site.
								</p>
							) : null}
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
