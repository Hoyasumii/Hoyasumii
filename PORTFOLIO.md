# hoyasumii.dev

Portfólio + painel de conteúdo. Monorepo com Bun workspaces, na raiz deste repositório de perfil: o `README.md` continua sendo o README do perfil do GitHub, e esta é a documentação do site.

```
apps/web         Next.js 16, export estático → GitHub Pages (site + painel em /admin)
apps/api         Hono no Cloudflare Workers (conteúdo, artigos, uploads, publicação)
packages/shared  Contrato zod, conteúdo padrão e client tipado da API
supabase/        Migrations (Postgres, RLS, bucket de mídia)
```

## Como funciona

```
 Painel (/admin) ──Supabase Auth──▶ token
      │                                │
      └──── PUT/POST /admin/* ─────────┴──▶ API (Workers)
                                              ├─ Supabase Postgres   (settings + entries)
                                              ├─ Supabase Storage    (imagens)
                                              ├─ Upstash Redis       (cache de /content e /articles)
                                              └─ repository_dispatch ──▶ GitHub Actions
                                                                           └─ next build → Pages
```

- O site é **estático**. A cada alteração salva no painel, a API invalida o cache e dispara `content-updated` no GitHub; o workflow `Deploy` gera o site com o conteúdo novo e publica no Pages. Builds seguidos se cancelam, então sempre sai o mais recente.
- **Artigos** podem ser escritos no painel (Markdown com prévia) ou vir do dev.to. Os dois aparecem juntos e são renderizados no próprio site. Um build diário traz os novos do dev.to.
- **Ícones** vêm do [Skill Icons](https://skill-icons.alanreisanjo.workers.dev). Por padrão eles são tingidos com a cor de destaque de cada tema e mostram as cores originais no hover (configurável em _Painel → Aparência_).
- O cache é opcional: se o Upstash cair, a API lê direto do Supabase.

## Desenvolvimento

```sh
bun install
bun run dev:api   # http://localhost:8787, adapters em memória (sem Supabase/Upstash)
bun run dev:web   # http://localhost:3000
```

Sem `NEXT_PUBLIC_SUPABASE_URL`, o painel entra em **modo local** e usa o token `dev-admin-token`, que a API aceita quando roda em memória. Para o site ler da API local, crie `apps/web/.env.local` a partir do `.env.example`. Sem `API_URL`, o build usa o conteúdo padrão de `packages/shared/src/defaults.ts`.

```sh
bun run lint        # Biome
bun run typecheck
bun run test        # testes da API (vitest)
bun run build:web   # gera apps/web/out
```

## Produção

### 1. Supabase

1. Crie o projeto e aplique a migration: `supabase link` + `supabase db push` (ou deixe o workflow aplicar, veja `SUPABASE_DB_URL`).
2. Em **Authentication → Users**, crie o seu usuário (email + senha). Cadastro público fica desligado.
3. Em **Authentication → URL Configuration**, adicione `https://hoyasumii.dev/admin/`.
4. Popule o conteúdo inicial uma vez:

   ```sh
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… bun --filter @portfolio/api seed
   ```

### 2. Upstash

Crie um Redis e copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.

### 3. Cloudflare

Crie um API token com permissão _Edit Cloudflare Workers_. Se quiser a API em domínio próprio, descomente `routes` em `apps/api/wrangler.jsonc` e coloque o domínio do site em `ALLOWED_ORIGINS`.

### 4. GitHub

- **Settings → Pages → Source: GitHub Actions**. O domínio vem de `apps/web/public/CNAME`.
- Crie um _fine-grained token_ com **Contents: read and write** neste repositório. A API usa esse token para disparar o rebuild.

**Secrets** (Settings → Secrets and variables → Actions):

| Secret                                               | Para quê                                |
| ---------------------------------------------------- | --------------------------------------- |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`      | deploy da API                           |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`          | API → banco e storage                   |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | cache                                   |
| `GH_DISPATCH_TOKEN`                                  | API → rebuild do site                   |
| `SUPABASE_DB_URL`                                    | aplicar migrations no deploy (opcional) |

**Variables**:

| Variable            | Exemplo                                         |
| ------------------- | ----------------------------------------------- |
| `API_URL`           | `https://portfolio-api.<conta>.workers.dev`     |
| `SUPABASE_URL`      | `https://<ref>.supabase.co`                     |
| `SUPABASE_ANON_KEY` | chave pública (anon/publishable)                |
| `SITE_URL`          | `https://hoyasumii.dev`                         |
| `BASE_PATH`         | vazio com domínio próprio; `/Hoyasumii` sem ele |

E-mails com acesso ao painel e origens permitidas ficam em `apps/api/wrangler.jsonc` (`ADMIN_EMAILS`, `ALLOWED_ORIGINS`).

### Deploy

Push na `main` roda: migrations (se mudaram) → testes + deploy da API (se `apps/api` ou `packages/shared` mudaram) → build e deploy do site. O workflow também roda por `repository_dispatch` (painel), por cron diário e manualmente.
