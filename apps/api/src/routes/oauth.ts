import {
	AuthorizationError,
	type AuthRequest,
	authorizationErrorRedirect,
	CimdFetchError,
	type ConsentDescription,
} from "@cloudflare/workers-oauth-provider";
import { type Context, Hono } from "hono";
import type { AppEnv } from "../app";
import { hashKey } from "../services/api-keys";
import type { Principal } from "../services/auth";

export const SCOPES = { read: ["mcp:read"], write: ["mcp:read", "mcp:write"] } as const;

/** Everything from the client (name, scopes, hosts) is attacker-chosen: escape it all. */
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * `formAction` lists where the form may lead: the page itself and, after approving, the client's
 * redirect URI. Browsers apply form-action to the redirect that follows the post too.
 */
function page(title: string, body: string, status = 200, formAction: string[] = []): Response {
	const headers = new Headers();
	headers.set("Content-Type", "text/html; charset=utf-8");
	headers.set("Cache-Control", "no-store");
	headers.set("X-Frame-Options", "DENY");
	headers.set(
		"Content-Security-Policy",
		[
			"default-src 'none'",
			"style-src 'unsafe-inline'",
			`form-action ${["'self'", ...formAction].join(" ")}`,
			"frame-ancestors 'none'",
		].join("; "),
	);
	return new Response(
		`<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<style>
	:root { --paper: #ebe9e3; --paper-2: #e1ded6; --ink: #141413; --muted: #75736c; --rule: rgb(20 20 19 / .16); --accent: #d4441c; color-scheme: light dark; }
	@media (prefers-color-scheme: dark) { :root { --paper: #0e0e0d; --paper-2: #191917; --ink: #ecebe5; --muted: #87857d; --rule: rgb(236 235 229 / .14); --accent: #ff6a3d; } }
	* { box-sizing: border-box; }
	body { margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 16px; background: var(--paper); color: var(--ink); font: 16px/1.5 system-ui, sans-serif; }
	main { width: min(100%, 440px); display: grid; gap: 20px; }
	.mono, label span, button, .tag { font-family: ui-monospace, "IBM Plex Mono", monospace; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
	.tag { color: var(--accent); }
	h1 { margin: 0; font-size: 2.4rem; line-height: .95; font-weight: 800; font-stretch: condensed; text-transform: uppercase; }
	p { margin: 0; }
	.muted { color: var(--muted); font-size: 14px; }
	.box { padding: 14px 16px; border: 1px solid var(--rule); background: var(--paper-2); display: grid; gap: 6px; }
	.warn { border-left: 3px solid var(--accent); }
	.error { color: var(--accent); }
	form { display: grid; gap: 16px; }
	label { display: grid; gap: 6px; }
	input[type=email], input[type=password] { width: 100%; padding: 10px 12px; border: 1px solid var(--rule); background: var(--paper-2); color: var(--ink); font: inherit; }
	input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
	fieldset { margin: 0; padding: 0; border: 0; display: grid; gap: 8px; }
	legend { padding: 0; margin-bottom: 8px; }
	.choice { display: flex; gap: 10px; align-items: baseline; }
	.actions { display: flex; gap: 8px; }
	button { padding: 11px 16px; border: 1px solid var(--ink); background: none; color: var(--ink); cursor: pointer; }
	button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
</style>
<main>${body}</main>
</html>`,
		{ status, headers },
	);
}

function errorPage(message: string, status = 400): Response {
	return page(
		"Não foi possível autorizar",
		`<p class="tag">Autorização</p><h1>Algo deu errado</h1><p>${escapeHtml(message)}</p>
<p class="muted">Volte ao aplicativo e tente conectar de novo.</p>`,
		status,
	);
}

type ConsentView = Pick<ConsentDescription, "clientName" | "clientDomain" | "redirectHost" | "redirectIsLoopback">;

function consentPage(details: ConsentView, handle: string, failed: boolean): string {
	const name = escapeHtml(details.clientName || "Um aplicativo");
	const origin = details.clientDomain
		? `Publicado por <strong>${escapeHtml(details.clientDomain)}</strong>.`
		: "O aplicativo se registrou sozinho: o nome não é verificado.";
	return `<p class="tag">Autorizar acesso</p>
<h1>${name} quer editar seu site</h1>
<div class="box${details.redirectIsLoopback ? " warn" : ""}">
	<p>${origin}</p>
	<p class="muted">O acesso será enviado para <strong>${escapeHtml(details.redirectHost)}</strong>.</p>
	${details.redirectIsLoopback ? "<p><strong>Isso envia o acesso para um app no seu computador.</strong> Continue só se você acabou de começar a conexão nele.</p>" : ""}
</div>
${failed ? '<p class="error">E-mail ou senha incorretos, ou esta conta não pode editar o site.</p>' : ""}
<form method="post" action="/authorize">
	<input type="hidden" name="handle" value="${escapeHtml(handle)}">
	<fieldset>
		<legend class="mono">Permissão</legend>
		<label class="choice"><input type="radio" name="access" value="write" checked> Ler e editar o conteúdo</label>
		<label class="choice"><input type="radio" name="access" value="read"> Só ler</label>
	</fieldset>
	<label><span>E-mail</span><input type="email" name="email" autocomplete="username" required></label>
	<label><span>Senha</span><input type="password" name="password" autocomplete="current-password" required></label>
	<div class="actions">
		<button class="primary" name="decision" value="approve">Permitir</button>
		<button name="decision" value="deny" formnovalidate>Negar</button>
	</div>
	<p class="muted">Você pode desconectar quando quiser em Painel → Chaves de API → Apps conectados.</p>
</form>`;
}

function helpers(c: Context<AppEnv>) {
	const oauth = c.env?.OAUTH_PROVIDER;
	const kv = c.env?.OAUTH_KV;
	if (!oauth || !kv) throw new Error("OAuthProvider helpers are missing: the Worker must be wrapped by OAuthProvider");
	return { oauth, kv };
}

/** Errors the user can do something about become a page; anything else is a real failure. */
function handled(error: unknown): Response {
	if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
	if (error instanceof AuthorizationError) return errorPage(error.description ?? "Pedido de autorização inválido.");
	if (error instanceof CimdFetchError) return errorPage("Não foi possível verificar este aplicativo.");
	throw error;
}

/**
 * A pending consent, kept server-side between showing the page and the owner's answer. The form
 * carries only a random handle (stored as its hash) that works once and for ten minutes. The page
 * isn't bound to the browser with a cookie (browsers that open it from another site may not send
 * one back); approving needs the owner's email and password instead, which a forged or replayed
 * form can't supply, and the page refuses to be framed.
 */
type PendingConsent = { request: AuthRequest; details: ConsentView; failures: number };

const CONSENT_TTL_SECONDS = 600;
const MAX_FAILURES = 5;
const consentKey = (hash: string) => `portfolio:consent:${hash}`;

/** Where the form may lead after approving: the client's redirect URI origin (or its scheme for native apps). */
function redirectTarget(redirectUri: string): string[] {
	try {
		const url = new URL(redirectUri);
		return [url.protocol === "https:" || url.protocol === "http:" ? url.origin : url.protocol];
	} catch {
		return [];
	}
}

function renderConsent(pending: PendingConsent, handle: string, failed = false): Response {
	return page(
		`Autorizar ${pending.details.clientName || "aplicativo"}`,
		consentPage(pending.details, handle, failed),
		failed ? 401 : 200,
		redirectTarget(pending.request.redirectUri),
	);
}

/** The OAuth authorization endpoint: sign in as the site owner and approve an MCP connector. */
export const oauthRoutes = new Hono<AppEnv>()
	.get("/authorize", async (c) => {
		try {
			const { oauth, kv } = helpers(c);
			const request = await oauth.parseAuthRequest(c.req.raw);
			const { clientName, clientDomain, redirectHost, redirectIsLoopback } = await oauth.describeConsent(request);
			const pending: PendingConsent = {
				request,
				details: { clientName, clientDomain, redirectHost, redirectIsLoopback },
				failures: 0,
			};

			const handle = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
				.replace(/\+/g, "-")
				.replace(/\//g, "_")
				.replace(/=+$/, "");
			await kv.put(consentKey(await hashKey(handle)), JSON.stringify(pending), {
				expirationTtl: CONSENT_TTL_SECONDS,
			});
			return renderConsent(pending, handle);
		} catch (error) {
			return handled(error);
		}
	})
	.post("/authorize", async (c) => {
		try {
			const { oauth, kv } = helpers(c);
			const form = await c.req.formData();
			const handle = String(form.get("handle") ?? "");
			const key = consentKey(await hashKey(handle));
			const stored = handle ? await kv.get(key) : null;
			if (!stored) return errorPage("Este pedido de autorização expirou ou já foi usado.");
			const pending = JSON.parse(stored) as PendingConsent;

			if (form.get("decision") !== "approve") {
				await kv.delete(key);
				return Response.redirect(authorizationErrorRedirect(pending.request, "access_denied"), 302);
			}

			const deps = c.get("deps");
			const user = await deps.verifier.signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
			if (!user || !deps.adminEmails.includes(user.email.toLowerCase())) {
				pending.failures += 1;
				if (pending.failures >= MAX_FAILURES) {
					await kv.delete(key);
					return errorPage("Muitas tentativas. Volte ao aplicativo e comece de novo.", 429);
				}
				await kv.put(key, JSON.stringify(pending), { expirationTtl: CONSENT_TTL_SECONDS });
				return renderConsent(pending, handle, true);
			}

			await kv.delete(key);
			const access = form.get("access") === "read" ? "read" : "write";
			const scope = [...SCOPES[access]];
			const principal: Principal = {
				via: "oauth",
				id: pending.request.clientId,
				name: pending.details.clientName || "MCP connector",
				scope: access,
			};
			const { redirectTo } = await oauth.completeAuthorization({
				request: { ...pending.request, scope },
				userId: encodeURIComponent(user.id),
				metadata: { clientName: principal.name, email: user.email },
				scope,
				props: { principal },
			});
			return Response.redirect(redirectTo, 302);
		} catch (error) {
			return handled(error);
		}
	});
