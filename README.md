<a href="https://skill-icons.alanreisanjo.workers.dev">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skill-icons.alanreisanjo.workers.dev/og?i=ts%2Cbun%2Celysia%2Creact%2Cnext%2Cnodejs%2Cnest%2Cvue%2Ctailwind%2Cpostgres%2Cprisma%2Cdocker%2Csupabase%2Caws%2Czod%2Cghactions%2Cmongo%2Chtml%2Ccss%2Csass%2Cfigma%2Cmysql%2Csqlite%2Credis%2Ccf%2Cvercel%2Cterraform%2Cgit%2Clinux%2Cbash%2Cvite%2Cbiome%2Ceslint%2Cprettier%2Chusky%2Cplaywright%2Ccypress%2Creactnative%2Cexpo%2Credux%2Czustand%2Cstorybook%2Cpinia%2Cvuetify%2Cexpress%2Cfastify%2Chono%2Cjest%2Cvitest%2Cdrizzle%2Cswc%2Celectron%2Ccs%2Cnet%2Clit%2Cpy%2Cpr%2Cps%2Cruby%2Crails%2Cphp%2Claravel%2Csymfony%2Cjava%2Cdocusaurus%2Cclaude%2Cmcp%2Cgemini%2Copentelemetry%2Csignoz%2Cjs&bg=dark&theme=dark&perline=14&title=Hoyasumii">
    <source media="(prefers-color-scheme: light)" srcset="https://skill-icons.alanreisanjo.workers.dev/og?i=ts%2Cbun%2Celysia%2Creact%2Cnext%2Cnodejs%2Cnest%2Cvue%2Ctailwind%2Cpostgres%2Cprisma%2Cdocker%2Csupabase%2Caws%2Czod%2Cghactions%2Cmongo%2Chtml%2Ccss%2Csass%2Cfigma%2Cmysql%2Csqlite%2Credis%2Ccf%2Cvercel%2Cterraform%2Cgit%2Clinux%2Cbash%2Cvite%2Cbiome%2Ceslint%2Cprettier%2Chusky%2Cplaywright%2Ccypress%2Creactnative%2Cexpo%2Credux%2Czustand%2Cstorybook%2Cpinia%2Cvuetify%2Cexpress%2Cfastify%2Chono%2Cjest%2Cvitest%2Cdrizzle%2Cswc%2Celectron%2Ccs%2Cnet%2Clit%2Cpy%2Cpr%2Cps%2Cruby%2Crails%2Cphp%2Claravel%2Csymfony%2Cjava%2Cdocusaurus%2Cclaude%2Cmcp%2Cgemini%2Copentelemetry%2Csignoz%2Cjs&bg=light&theme=dark&perline=14&title=Hoyasumii">
    <img alt="https://skill-icons.alanreisanjo.workers.dev" src="https://skill-icons.alanreisanjo.workers.dev/og?i=ts,bun,elysia,react,next,nodejs,nest,vue,tailwind,postgres,prisma,docker,supabase,aws,zod,ghactions,mongo,html,css,sass,figma,mysql,sqlite,redis,cf,vercel,terraform,git,linux,bash,vite,biome,eslint,prettier,husky,playwright,cypress,reactnative,expo,redux,zustand,storybook,pinia,vuetify,express,fastify,hono,jest,vitest,drizzle,swc,electron,cs,net,lit,py,pr,ps,ruby,rails,php,laravel,symfony,java,docusaurus,claude,mcp,gemini,opentelemetry,signoz,js&bg=dark&theme=dark&perline=14&title=Hoyasumii">
  </picture>
</a>

<sub>**English** · [Português](README.pt-BR.md)</sub>

🤓☝🏻 I'm a **Fullstack Developer** from Aracaju, Brazil.

I write **TypeScript** first, with **Bun + Elysia** on the backend. I like modular backends with DDD and typed contracts, and developer tools that work the same from code, from the terminal and from AI agents (**SDK + CLI + MCP**).

## 🫘 Roastery CMS

[**Roastery**](https://github.com/roastery-cms) is a headless CMS built on Bun, Elysia, Prisma/PostgreSQL and Redis. It is split into small packages: core libraries, *adapters* for persistence and cache, and *capsules* that plug features into the server.

| Package | What it does | Links |
| --- | --- | --- |
| `@roastery/beans` | Blueprint-driven DDD building blocks: declare the model once and get validation, schema, serialization, events and fixtures | [repo](https://github.com/roastery-cms/beans) · [npm](https://www.npmjs.com/package/@roastery/beans) |
| `@roastery/terroir` | Layered exception hierarchy and runtime schema validation | [repo](https://github.com/roastery-cms/terroir) · [npm](https://www.npmjs.com/package/@roastery/terroir) |
| `@roastery/aroma` | Structured, transport-based logger with OpenTelemetry correlation | [repo](https://github.com/roastery-cms/aroma) · [npm](https://www.npmjs.com/package/@roastery/aroma) |
| `@roastery/barista` | Elysia HTTP server factory | [repo](https://github.com/roastery-cms/barista) · [npm](https://www.npmjs.com/package/@roastery/barista) |
| `@roastery/pantry` | Shared utilities, use cases, DTOs and domain abstractions | [repo](https://github.com/roastery-cms/pantry) · [npm](https://www.npmjs.com/package/@roastery/pantry) |
| `@roastery/blend` | Capsule manifest contract: metadata, env requirements, dependencies and plugin registration | [repo](https://github.com/roastery-cms/blend) · [npm](https://www.npmjs.com/package/@roastery/blend) |

On top of them are the [REST API](https://github.com/roastery-cms/roastery) and the capsules for [auth](https://github.com/roastery-cms/capsules-auth), [JWT](https://github.com/roastery-cms/capsules-jwt), [cache](https://github.com/roastery-cms/adapters-cache), [posts](https://github.com/roastery-cms/capsules.post_post), [models](https://github.com/roastery-cms/capsules.models_models) and [API docs](https://github.com/roastery-cms/capsules-api-docs).

## 🧰 SDK · MCP · CLI

Typed TypeScript clients for third-party APIs. Each one ships as a **SDK**, an **MCP server** for AI agents and a **CLI** that registers the server in Claude Code, Codex and OpenCode. All three use the same client, and the docs are in English and Portuguese.

| Library | API | Docs | npm |
| --- | --- | --- | --- |
| [`@hoyasumii/plane`](https://github.com/Hoyasumii/plane) | [Plane](https://plane.so) (v1 and v2) | [docs](https://hoyasumii.github.io/plane/) | [npm](https://www.npmjs.com/package/@hoyasumii/plane) |
| [`@hoyasumii/signoz`](https://github.com/Hoyasumii/signoz) | [SigNoz](https://signoz.io) | [docs](https://hoyasumii.github.io/signoz/) | [npm](https://www.npmjs.com/package/@hoyasumii/signoz) |
| [`@hoyasumii/linkedin`](https://github.com/Hoyasumii/linkedin) | LinkedIn: create, edit and delete your own posts | [docs](https://hoyasumii.github.io/linkedin/) | [npm](https://www.npmjs.com/package/@hoyasumii/linkedin) |
| [`@hoyasumii/libretranslate`](https://github.com/Hoyasumii/libretranslate) | [LibreTranslate](https://libretranslate.com) | [docs](https://hoyasumii.github.io/libretranslate/) | [npm](https://www.npmjs.com/package/@hoyasumii/libretranslate) |

## ✨ Skill Icons

[**Skill Icons**](https://skill-icons.alanreisanjo.workers.dev) puts your stack in your README: 370+ icons as an SVG API, a visual builder, link preview cards (like the one at the top), an MCP server (`/mcp`) and an [npm package](https://www.npmjs.com/package/@hoyasumii/skill-icons) for React, Vue, Svelte, Angular, Solid and Astro. It runs on Cloudflare Workers. [repo](https://github.com/Hoyasumii/skill-icons)

## 🧠 Stack

**Runtime & Backend**
> ![TypeScript, Bun, Elysia, Node.js, NestJS, Express, Fastify, Hono, Prisma, Drizzle, Zod, SWC](https://skill-icons.alanreisanjo.workers.dev/icons?i=ts,bun,elysia,nodejs,nest,express,fastify,hono,prisma,drizzle,zod,swc)

**Frontend**
> ![React, Next.js, Vue, Pinia, Vuetify, Tailwind, Sass, Redux, Zustand, Storybook, Lit, Vite, HTML, CSS, JavaScript, Figma](https://skill-icons.alanreisanjo.workers.dev/icons?i=react,next,vue,pinia,vuetify,tailwind,sass,redux,zustand,storybook,lit,vite,html,css,js,figma)

**Mobile & Desktop**
> ![React Native, Expo, Electron](https://skill-icons.alanreisanjo.workers.dev/icons?i=reactnative,expo,electron)

**Data**
> ![PostgreSQL, MySQL, SQLite, Redis, MongoDB, Supabase](https://skill-icons.alanreisanjo.workers.dev/icons?i=postgres,mysql,sqlite,redis,mongo,supabase)

**Cloud & DevOps**
> ![AWS, Cloudflare, Vercel, Terraform, Docker, GitHub Actions, Git, Linux, Bash](https://skill-icons.alanreisanjo.workers.dev/icons?i=aws,cf,vercel,terraform,docker,ghactions,git,linux,bash)

**Quality & Tooling**
> ![Vitest, Jest, Playwright, Cypress, Biome, ESLint, Prettier, Husky, Docusaurus](https://skill-icons.alanreisanjo.workers.dev/icons?i=vitest,jest,playwright,cypress,biome,eslint,prettier,husky,docusaurus)

**AI & Observability**
> ![Claude, MCP, Gemini, OpenTelemetry, SigNoz](https://skill-icons.alanreisanjo.workers.dev/icons?i=claude,mcp,gemini,opentelemetry,signoz)

**Also worked with**
> ![C#, .NET, Python, Java, Ruby, Rails, PHP, Laravel, Symfony, Premiere, Photoshop](https://skill-icons.alanreisanjo.workers.dev/icons?i=cs,net,py,java,ruby,rails,php,laravel,symfony,pr,ps)

📚 **Studying**
> ![Nuxt, GraphQL](https://skill-icons.alanreisanjo.workers.dev/icons?i=nuxt,gql)

## 📫 Contact

[![Portfolio](https://img.shields.io/badge/Portfolio-hoyasumii.dev-111?style=for-the-badge&logo=googlechrome&logoColor=white)](https://hoyasumii.dev)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/AlanReisAnjos/)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://www.youtube.com/@hoy-oden)
[![TabNews](https://img.shields.io/badge/TabNews-111?style=for-the-badge&logo=readdotcv&logoColor=white)](https://www.tabnews.com.br/hoyasumii)
[![Email](https://img.shields.io/badge/Email-EA4335?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alanreisanjo@gmail.com)
