import { type Locale, type Localized, locales } from "@portfolio/shared";

export { type Locale, locales };

export function isLocale(value: string): value is Locale {
	return (locales as readonly string[]).includes(value);
}

export function t(value: Localized, locale: Locale): string {
	return value[locale] || value.pt || value.en;
}

const dictionary = {
	pt: {
		index: "Índice",
		about: "Sobre",
		work: "Trabalho",
		experience: "Experiência",
		stack: "Stack",
		writing: "Escritos",
		contact: "Contato",
		selectedWork: "Trabalho selecionado",
		otherWork: "Outros projetos",
		packages: "Pacotes",
		present: "atual",
		localTime: "Hora local",
		sayHi: "Tem um projeto, uma vaga ou só quer trocar uma ideia?",
		writeMe: "Me escreva",
		elsewhere: "Em outros lugares",
		colophon: "Colofão",
		colophonText:
			"Composto em Archivo e IBM Plex Mono. Ícones pelo Skill Icons. Gerado estaticamente com Next.js, servido pelo GitHub Pages e editado por um painel próprio.",
		readOn: "Publicado originalmente no dev.to",
		allArticles: "Todos os escritos",
		minRead: "min de leitura",
		otherLanguages: "Em outros idiomas",
		notFoundTitle: "Página não encontrada",
		notFoundText: "O endereço pode ter mudado. Comece pelo índice.",
		goHome: "Ir para o início",
		switchTo: "English",
		theme: "Tema",
		language: "Idioma",
		backToTop: "Voltar ao topo",
		repo: "código",
		site: "site",
		docs: "docs",
		npm: "npm",
		year: "Ano",
		project: "Projeto",
		type: "Tipo",
		hoverHint: "passe o mouse para ver as cores originais",
	},
	en: {
		index: "Index",
		about: "About",
		work: "Work",
		experience: "Experience",
		stack: "Stack",
		writing: "Writing",
		contact: "Contact",
		selectedWork: "Selected work",
		otherWork: "Other projects",
		packages: "Packages",
		present: "present",
		localTime: "Local time",
		sayHi: "Got a project, a role, or just want to talk shop?",
		writeMe: "Write me",
		elsewhere: "Elsewhere",
		colophon: "Colophon",
		colophonText:
			"Set in Archivo and IBM Plex Mono. Icons by Skill Icons. Statically built with Next.js, served by GitHub Pages and edited from its own panel.",
		readOn: "Originally published on dev.to",
		allArticles: "All writing",
		minRead: "min read",
		otherLanguages: "In other languages",
		notFoundTitle: "Page not found",
		notFoundText: "The address may have changed. Start from the index.",
		goHome: "Go to the start",
		switchTo: "Português",
		theme: "Theme",
		language: "Language",
		backToTop: "Back to top",
		repo: "code",
		site: "site",
		docs: "docs",
		npm: "npm",
		year: "Year",
		project: "Project",
		type: "Type",
		hoverHint: "hover to see the original colors",
	},
} satisfies Record<Locale, Record<string, string>>;

export type Dictionary = (typeof dictionary)["pt"];

export function dict(locale: Locale): Dictionary {
	return dictionary[locale];
}
