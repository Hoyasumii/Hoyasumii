import type { CollectionInput, CollectionName, Content, Settings } from "./schema";

type ProjectInput = CollectionInput<"projects">;

const roasteryParts: ProjectInput["parts"] = [
	{
		name: "@roastery/beans",
		url: "https://github.com/roastery-cms/beans",
		description: {
			en: "Blueprint-driven DDD building blocks: declare the model once and get validation, schema, serialization, events and fixtures.",
			pt: "Blocos de DDD guiados por blueprint: declare o modelo uma vez e ganhe validação, schema, serialização, eventos e fixtures.",
		},
	},
	{
		name: "@roastery/terroir",
		url: "https://github.com/roastery-cms/terroir",
		description: {
			en: "Layered exception hierarchy and runtime schema validation.",
			pt: "Hierarquia de exceções em camadas e validação de schema em runtime.",
		},
	},
	{
		name: "@roastery/aroma",
		url: "https://github.com/roastery-cms/aroma",
		description: {
			en: "Structured, transport-based logger with OpenTelemetry correlation.",
			pt: "Logger estruturado baseado em transports, com correlação OpenTelemetry.",
		},
	},
	{
		name: "@roastery/barista",
		url: "https://github.com/roastery-cms/barista",
		description: { en: "Elysia HTTP server factory.", pt: "Fábrica de servidor HTTP com Elysia." },
	},
	{
		name: "@roastery/pantry",
		url: "https://github.com/roastery-cms/pantry",
		description: {
			en: "Shared utilities, use cases, DTOs and domain abstractions.",
			pt: "Utilitários, casos de uso, DTOs e abstrações de domínio compartilhados.",
		},
	},
	{
		name: "@roastery/blend",
		url: "https://github.com/roastery-cms/blend",
		description: {
			en: "Capsule manifest contract: metadata, env requirements, dependencies and plugin registration.",
			pt: "Contrato de manifesto das capsules: metadados, variáveis de ambiente, dependências e registro de plugins.",
		},
	},
];

function sdkProject(name: string, api: string, summary: { en: string; pt: string }): ProjectInput {
	return {
		name: `@hoyasumii/${name}`,
		year: "2026",
		kind: { en: `SDK · MCP · CLI — ${api}`, pt: `SDK · MCP · CLI — ${api}` },
		summary,
		cover: "",
		stack: ["ts", "bun", "mcp", "zod"],
		featured: false,
		published: true,
		links: {
			repo: `https://github.com/Hoyasumii/${name}`,
			site: "",
			docs: `https://hoyasumii.github.io/${name}/`,
			npm: `https://www.npmjs.com/package/@hoyasumii/${name}`,
		},
		parts: [],
	};
}

/** Older projects, carried over from the previous portfolio-api seed. */
function archiveProject(
	name: { en: string; pt: string },
	year: string,
	summary: { en: string; pt: string },
	site: string,
	cover: string,
	stack: string[],
): ProjectInput {
	return {
		name: name.en,
		year,
		kind: { en: "Web app", pt: "Aplicação web" },
		summary,
		cover,
		stack,
		featured: false,
		published: true,
		links: { repo: "", site, docs: "", npm: "" },
		parts: [],
	};
}

export const defaultSettings: Settings = {
	profile: {
		name: "Alan Reis",
		handle: "Hoyasumii",
		role: { en: "Fullstack Developer", pt: "Desenvolvedor Fullstack" },
		location: "Aracaju, Brasil",
		timeZone: "America/Maceio",
		headline: {
			en: "I write TypeScript first, and build backends that stay small, typed and easy to plug into.",
			pt: "Escrevo TypeScript antes de tudo, e construo backends pequenos, tipados e fáceis de plugar.",
		},
		about: {
			en: "Bun + Elysia on the backend. I like modular backends with DDD and typed contracts, and developer tools that work the same from code, from the terminal and from AI agents — SDK, CLI and MCP from a single client. Off the keyboard: psychedelic rock, Os Mutantes and Júpiter Maçã, Pokémon since I was six, and Ode N, my YouTube channel about how things actually work — O(n).",
			pt: "Bun + Elysia no backend. Gosto de backends modulares com DDD e contratos tipados, e de ferramentas para devs que funcionam igual no código, no terminal e em agentes de IA — SDK, CLI e MCP a partir de um único cliente. Longe do teclado: rock psicodélico, Os Mutantes e Júpiter Maçã, Pokémon desde os seis anos, e o Ode N, meu canal no YouTube sobre como as coisas funcionam de verdade — O(n).",
		},
		avatar: "https://github.com/Hoyasumii.png",
		email: "alanreisanjo@gmail.com",
		available: true,
		availability: { en: "Open to new projects", pt: "Aberto a novos projetos" },
	},
	seo: {
		title: "Alan Reis — Hoyasumii",
		description: {
			en: "Fullstack developer from Aracaju, Brazil. TypeScript, Bun and Elysia; headless CMS, typed SDKs and MCP servers.",
			pt: "Desenvolvedor fullstack de Aracaju. TypeScript, Bun e Elysia; CMS headless, SDKs tipados e servidores MCP.",
		},
	},
	appearance: { iconTint: "accent" },
};

export const defaultCollections: { [N in CollectionName]: CollectionInput<N>[] } = {
	projects: [
		{
			name: "Roastery CMS",
			year: "2026",
			kind: { en: "Headless CMS", pt: "CMS headless" },
			summary: {
				en: "A headless CMS built on Bun, Elysia, Prisma/PostgreSQL and Redis, split into small packages: core libraries, adapters for persistence and cache, and capsules that plug features into the server.",
				pt: "Um CMS headless feito com Bun, Elysia, Prisma/PostgreSQL e Redis, dividido em pacotes pequenos: bibliotecas de base, adapters de persistência e cache, e capsules que plugam funcionalidades no servidor.",
			},
			cover: "",
			stack: ["ts", "bun", "elysia", "prisma", "postgres", "redis", "opentelemetry"],
			featured: true,
			published: true,
			links: {
				repo: "https://github.com/roastery-cms",
				site: "",
				docs: "",
				npm: "https://www.npmjs.com/org/roastery",
			},
			parts: roasteryParts,
		},
		{
			name: "Skill Icons",
			year: "2026",
			kind: { en: "Icon API · Builder · MCP", pt: "API de ícones · Builder · MCP" },
			summary: {
				en: "Puts your stack in your README: 600+ icons as an SVG API, a visual builder, link preview cards, an MCP server and an npm package for React, Vue, Svelte, Angular, Solid and Astro. Runs on Cloudflare Workers — and draws every icon on this page.",
				pt: "Coloca sua stack no README: mais de 600 ícones como API SVG, um builder visual, cards de preview, um servidor MCP e um pacote npm para React, Vue, Svelte, Angular, Solid e Astro. Roda no Cloudflare Workers — e desenha todos os ícones desta página.",
			},
			cover: "",
			stack: ["ts", "cf", "mcp", "react", "vue", "svelte"],
			featured: true,
			published: true,
			links: {
				repo: "https://github.com/Hoyasumii/skill-icons",
				site: "https://skill-icons.alanreisanjo.workers.dev",
				docs: "",
				npm: "https://www.npmjs.com/package/@hoyasumii/skill-icons",
			},
			parts: [],
		},
		{
			name: "hoyasumii.dev",
			year: "2026",
			kind: { en: "Portfolio · CMS", pt: "Portfólio · CMS" },
			summary: {
				en: "This site: statically built with Next.js and served by GitHub Pages, edited from its own panel. A Hono API on Cloudflare Workers keeps the content in Supabase, caches it in Upstash Redis and redeploys the site on every change.",
				pt: "Este site: gerado estaticamente com Next.js e servido pelo GitHub Pages, editado pelo próprio painel. Uma API em Hono no Cloudflare Workers guarda o conteúdo no Supabase, faz cache no Upstash Redis e republica o site a cada mudança.",
			},
			cover: "",
			stack: ["ts", "next", "react", "hono", "workers", "supabase", "upstash", "ghactions"],
			featured: false,
			published: true,
			links: {
				repo: "https://github.com/Hoyasumii/Hoyasumii",
				site: "https://hoyasumii.dev",
				docs: "",
				npm: "",
			},
			parts: [],
		},
		sdkProject("plane", "Plane", {
			en: "Typed client for the Plane API (v1 and v2), shipped as an SDK, an MCP server for AI agents and a CLI that registers it in Claude Code, Codex and OpenCode.",
			pt: "Cliente tipado para a API do Plane (v1 e v2), entregue como SDK, servidor MCP para agentes de IA e CLI que o registra no Claude Code, Codex e OpenCode.",
		}),
		sdkProject("signoz", "SigNoz", {
			en: "Typed client for the SigNoz API, as SDK, MCP server and CLI sharing the same core.",
			pt: "Cliente tipado para a API do SigNoz, como SDK, servidor MCP e CLI compartilhando o mesmo núcleo.",
		}),
		sdkProject("linkedin", "LinkedIn", {
			en: "Create, edit and delete your own LinkedIn posts from code, the terminal or an AI agent.",
			pt: "Crie, edite e apague seus próprios posts do LinkedIn pelo código, pelo terminal ou por um agente de IA.",
		}),
		sdkProject("libretranslate", "LibreTranslate", {
			en: "Typed client for LibreTranslate, as SDK, MCP server and CLI.",
			pt: "Cliente tipado para o LibreTranslate, como SDK, servidor MCP e CLI.",
		}),
		archiveProject(
			{ en: "Encurtai", pt: "Encurtai" },
			"2024",
			{
				en: "Shorten links and images easily and get access to next-level tracking.",
				pt: "Encurte links e imagens facilmente e tenha acesso a um monitoramento de outro nível.",
			},
			"https://encurtai.com",
			"https://encurtai.com/public/cover.png",
			["nodejs", "ts", "next", "react", "tailwind", "mongo"],
		),
		archiveProject(
			{ en: "PokeQuiz", pt: "PokeQuiz" },
			"2024",
			{ en: "Pokémon quiz to test your knowledge.", pt: "Quiz sobre Pokémon para testar seu conhecimento." },
			"https://pkquiz.alanreis.blog",
			"https://pkquiz.alanreis.blog/public/cover.png",
			["ts", "next", "react", "tailwind"],
		),
		archiveProject(
			{ en: "Task.me", pt: "Task.me" },
			"2024",
			{ en: "Task management app.", pt: "Aplicativo de tarefas." },
			"https://task-me-client.vercel.app/",
			"https://task.alanreis.blog/public/cover.png",
			["ts", "next", "react", "sass", "express", "prisma"],
		),
		archiveProject(
			{ en: "QR Code Generator", pt: "Gerador de QR Code" },
			"2025",
			{ en: "Simplified QR Code generator.", pt: "Gerador de QR Code facilitado." },
			"https://qr.alanreis.blog",
			"https://qr.alanreis.blog/public/cover.png",
			["ts", "next", "react"],
		),
	],
	experience: [],
	stack: [
		{
			title: { en: "Runtime & Backend", pt: "Runtime & Backend" },
			icons: ["ts", "bun", "elysia", "nodejs", "nest", "express", "fastify", "hono", "prisma", "drizzle", "zod", "swc"],
		},
		{
			title: { en: "Frontend", pt: "Frontend" },
			icons: [
				"react",
				"next",
				"vue",
				"pinia",
				"vuetify",
				"tailwind",
				"sass",
				"redux",
				"zustand",
				"storybook",
				"lit",
				"vite",
				"html",
				"css",
				"js",
				"figma",
			],
		},
		{ title: { en: "Mobile & Desktop", pt: "Mobile & Desktop" }, icons: ["reactnative", "expo", "electron"] },
		{ title: { en: "Data", pt: "Dados" }, icons: ["postgres", "mysql", "sqlite", "redis", "mongo", "supabase"] },
		{
			title: { en: "Cloud & DevOps", pt: "Cloud & DevOps" },
			icons: ["aws", "cf", "vercel", "terraform", "docker", "ghactions", "git", "linux", "bash"],
		},
		{
			title: { en: "Quality & Tooling", pt: "Qualidade & Ferramentas" },
			icons: ["vitest", "jest", "playwright", "cypress", "biome", "eslint", "prettier", "husky", "docusaurus"],
		},
		{
			title: { en: "AI & Observability", pt: "IA & Observabilidade" },
			icons: ["claude", "mcp", "gemini", "opentelemetry", "signoz"],
		},
		{
			title: { en: "Also worked with", pt: "Também já usei" },
			icons: ["cs", "net", "py", "java", "ruby", "rails", "php", "laravel", "symfony", "pr", "ps"],
		},
		{ title: { en: "Studying", pt: "Estudando" }, icons: ["nuxt", "gql"] },
	],
	articles: [],
	links: [
		{ label: "GitHub", url: "https://github.com/Hoyasumii" },
		{ label: "LinkedIn", url: "https://linkedin.com/in/AlanReisAnjos/" },
		{ label: "dev.to", url: "https://dev.to/hoyasumii" },
		{ label: "TabNews", url: "https://www.tabnews.com.br/hoyasumii" },
		{ label: "YouTube", url: "https://www.youtube.com/@hoy-oden" },
	],
};

/** The default content with stable ids, used as a fallback and by the in-memory store. */
export function buildDefaultContent(): Content {
	const withIds = <T>(name: string, items: T[]) =>
		items.map((item, position) => ({ ...item, id: `${name}-${position + 1}`, position }));

	return {
		...defaultSettings,
		projects: withIds("projects", defaultCollections.projects),
		experience: withIds("experience", defaultCollections.experience),
		stack: withIds("stack", defaultCollections.stack),
		links: withIds("links", defaultCollections.links),
		updatedAt: null,
	};
}
