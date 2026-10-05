<a href="https://skill-icons.alanreisanjo.workers.dev">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skill-icons.alanreisanjo.workers.dev/og?i=ts,bun,elysia,react,next,nodejs,nest,vue,tailwind,postgres,prisma,docker,supabase,aws,zod,ghactions,mongo,html,css,sass,figma,mysql,sqlite,redis,cf,vercel,terraform,git,linux,bash,vite,biome,eslint,prettier,husky,playwright,cypress,reactnative,expo,redux,zustand,storybook,pinia,vuetify,express,fastify,hono,jest,vitest,drizzle,swc,electron,cs,net,lit,py,pr,ps,ruby,rails,php,laravel,symfony,java,docusaurus,claude,mcp,gemini,opentelemetry,signoz,js&bg=dark&theme=dark&perline=14&title=Hoyasumii">
    <source media="(prefers-color-scheme: light)" srcset="https://skill-icons.alanreisanjo.workers.dev/og?i=ts,bun,elysia,react,next,nodejs,nest,vue,tailwind,postgres,prisma,docker,supabase,aws,zod,ghactions,mongo,html,css,sass,figma,mysql,sqlite,redis,cf,vercel,terraform,git,linux,bash,vite,biome,eslint,prettier,husky,playwright,cypress,reactnative,expo,redux,zustand,storybook,pinia,vuetify,express,fastify,hono,jest,vitest,drizzle,swc,electron,cs,net,lit,py,pr,ps,ruby,rails,php,laravel,symfony,java,docusaurus,claude,mcp,gemini,opentelemetry,signoz,js&bg=light&theme=light&perline=14&title=Hoyasumii">
    <img alt="https://skill-icons.alanreisanjo.workers.dev" src="https://skill-icons.alanreisanjo.workers.dev/og?i=ts,bun,elysia,react,next,nodejs,nest,vue,tailwind,postgres,prisma,docker,supabase,aws,zod,ghactions,mongo,html,css,sass,figma,mysql,sqlite,redis,cf,vercel,terraform,git,linux,bash,vite,biome,eslint,prettier,husky,playwright,cypress,reactnative,expo,redux,zustand,storybook,pinia,vuetify,express,fastify,hono,jest,vitest,drizzle,swc,electron,cs,net,lit,py,pr,ps,ruby,rails,php,laravel,symfony,java,docusaurus,claude,mcp,gemini,opentelemetry,signoz,js&bg=dark&theme=dark&perline=14&title=Hoyasumii">
  </picture>
</a>

<sub>[English](README.md) · **Português**</sub>

🤓☝🏻 Sou **Desenvolvedor Fullstack**, de Aracaju, Brasil.

Escrevo **TypeScript** antes de tudo, com **Bun + Elysia** no backend. Gosto de backends modulares com DDD e contratos tipados, e de ferramentas para devs que funcionam igual no código, no terminal e em agentes de IA (**SDK + CLI + MCP**).

## 🫘 Roastery CMS

O [**Roastery**](https://github.com/roastery-cms) é um CMS headless feito com Bun, Elysia, Prisma/PostgreSQL e Redis. Ele é dividido em pacotes pequenos: bibliotecas de base, *adapters* de persistência e cache, e *capsules* que plugam funcionalidades no servidor.

| Pacote | O que faz | Links |
| --- | --- | --- |
| `@roastery/beans` | Blocos de DDD guiados por blueprint: declare o modelo uma vez e ganhe validação, schema, serialização, eventos e fixtures | [repo](https://github.com/roastery-cms/beans) · [npm](https://www.npmjs.com/package/@roastery/beans) |
| `@roastery/terroir` | Hierarquia de exceções em camadas e validação de schema em runtime | [repo](https://github.com/roastery-cms/terroir) · [npm](https://www.npmjs.com/package/@roastery/terroir) |
| `@roastery/aroma` | Logger estruturado baseado em transports, com correlação OpenTelemetry | [repo](https://github.com/roastery-cms/aroma) · [npm](https://www.npmjs.com/package/@roastery/aroma) |
| `@roastery/barista` | Fábrica de servidor HTTP com Elysia | [repo](https://github.com/roastery-cms/barista) · [npm](https://www.npmjs.com/package/@roastery/barista) |
| `@roastery/pantry` | Utilitários, casos de uso, DTOs e abstrações de domínio compartilhados | [repo](https://github.com/roastery-cms/pantry) · [npm](https://www.npmjs.com/package/@roastery/pantry) |
| `@roastery/blend` | Contrato de manifesto das capsules: metadados, variáveis de ambiente, dependências e registro de plugins | [repo](https://github.com/roastery-cms/blend) · [npm](https://www.npmjs.com/package/@roastery/blend) |

Em cima deles ficam a [API REST](https://github.com/roastery-cms/roastery) e as capsules de [autenticação](https://github.com/roastery-cms/capsules-auth), [JWT](https://github.com/roastery-cms/capsules-jwt), [cache](https://github.com/roastery-cms/adapters-cache), [posts](https://github.com/roastery-cms/capsules.post_post), [models](https://github.com/roastery-cms/capsules.models_models) e [documentação da API](https://github.com/roastery-cms/capsules-api-docs).

## 🧰 SDK · MCP · CLI

Clientes TypeScript tipados para APIs de terceiros. Cada um vem como **SDK**, **servidor MCP** para agentes de IA e **CLI** que registra o servidor no Claude Code, Codex e OpenCode. Os três usam o mesmo cliente, e a documentação é em inglês e português.

| Biblioteca | API | Docs | npm |
| --- | --- | --- | --- |
| [`@hoyasumii/plane`](https://github.com/Hoyasumii/plane) | [Plane](https://plane.so) (v1 e v2) | [docs](https://hoyasumii.github.io/plane/) | [npm](https://www.npmjs.com/package/@hoyasumii/plane) |
| [`@hoyasumii/signoz`](https://github.com/Hoyasumii/signoz) | [SigNoz](https://signoz.io) | [docs](https://hoyasumii.github.io/signoz/) | [npm](https://www.npmjs.com/package/@hoyasumii/signoz) |
| [`@hoyasumii/linkedin`](https://github.com/Hoyasumii/linkedin) | LinkedIn: crie, edite e apague seus próprios posts | [docs](https://hoyasumii.github.io/linkedin/) | [npm](https://www.npmjs.com/package/@hoyasumii/linkedin) |
| [`@hoyasumii/libretranslate`](https://github.com/Hoyasumii/libretranslate) | [LibreTranslate](https://libretranslate.com) | [docs](https://hoyasumii.github.io/libretranslate/) | [npm](https://www.npmjs.com/package/@hoyasumii/libretranslate) |

## ✨ Skill Icons

O [**Skill Icons**](https://skill-icons.alanreisanjo.workers.dev/pt-BR/) coloca seu stack no README: 370+ ícones como API de SVG, um builder visual, cards de preview de link (como o do topo), um servidor MCP (`/mcp`) e um [pacote npm](https://www.npmjs.com/package/@hoyasumii/skill-icons) para React, Vue, Svelte, Angular, Solid e Astro. Roda em Cloudflare Workers. [repo](https://github.com/Hoyasumii/skill-icons)

## 🧠 Stack

**Runtime & Backend**
> ![TypeScript, Bun, Elysia, Node.js, NestJS, Express, Fastify, Hono, Prisma, Drizzle, Zod, SWC](https://skill-icons.alanreisanjo.workers.dev/icons?i=ts,bun,elysia,nodejs,nest,express,fastify,hono,prisma,drizzle,zod,swc)

**Frontend**
> ![React, Next.js, Vue, Pinia, Vuetify, Tailwind, Sass, Redux, Zustand, Storybook, Lit, Vite, HTML, CSS, JavaScript, Figma](https://skill-icons.alanreisanjo.workers.dev/icons?i=react,next,vue,pinia,vuetify,tailwind,sass,redux,zustand,storybook,lit,vite,html,css,js,figma)

**Mobile & Desktop**
> ![React Native, Expo, Electron](https://skill-icons.alanreisanjo.workers.dev/icons?i=reactnative,expo,electron)

**Dados**
> ![PostgreSQL, MySQL, SQLite, Redis, MongoDB, Supabase](https://skill-icons.alanreisanjo.workers.dev/icons?i=postgres,mysql,sqlite,redis,mongo,supabase)

**Cloud & DevOps**
> ![AWS, Cloudflare, Vercel, Terraform, Docker, GitHub Actions, Git, Linux, Bash](https://skill-icons.alanreisanjo.workers.dev/icons?i=aws,cf,vercel,terraform,docker,ghactions,git,linux,bash)

**Qualidade & Ferramentas**
> ![Vitest, Jest, Playwright, Cypress, Biome, ESLint, Prettier, Husky, Docusaurus](https://skill-icons.alanreisanjo.workers.dev/icons?i=vitest,jest,playwright,cypress,biome,eslint,prettier,husky,docusaurus)

**IA & Observabilidade**
> ![Claude, MCP, Gemini, OpenTelemetry, SigNoz](https://skill-icons.alanreisanjo.workers.dev/icons?i=claude,mcp,gemini,opentelemetry,signoz)

**Também já trabalhei com**
> ![C#, .NET, Python, Java, Ruby, Rails, PHP, Laravel, Symfony, Premiere, Photoshop](https://skill-icons.alanreisanjo.workers.dev/icons?i=cs,net,py,java,ruby,rails,php,laravel,symfony,pr,ps)

📚 **Estudando**
> ![Nuxt, GraphQL](https://skill-icons.alanreisanjo.workers.dev/icons?i=nuxt,gql)

## 📫 Contato

[![Portfólio](https://img.shields.io/badge/Portf%C3%B3lio-hoyasumii.dev-111?style=for-the-badge&logo=googlechrome&logoColor=white)](https://hoyasumii.dev)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/AlanReisAnjos/)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@hoy-oden)
[![TabNews](https://img.shields.io/badge/TabNews-111?style=for-the-badge&logo=readdotcv&logoColor=white)](https://www.tabnews.com.br/hoyasumii)
[![E-mail](https://img.shields.io/badge/E--mail-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alanreisanjo@gmail.com)
