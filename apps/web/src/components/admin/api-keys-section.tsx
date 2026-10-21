"use client";

import type { ApiKey, ApiKeyScope, CreatedApiKey, OAuthConnection } from "@portfolio/shared";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, useAdmin } from "./context";
import { TextField } from "./fields";
import { apiUrl } from "./session";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const when = (value: string | null) => (value ? dateTime.format(new Date(value)) : "nunca");

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			className="button"
			onClick={async () => {
				await navigator.clipboard.writeText(text);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}}
		>
			{copied ? "Copiado" : label}
		</button>
	);
}

/** Shown once, right after a key is created: the only moment the key can be copied. */
function NewKey({ created, onClose }: { created: CreatedApiKey; onClose: () => void }) {
	const endpoint = `${apiUrl.replace(/\/$/, "")}/mcp`;
	const claudeCode = `claude mcp add --transport http portfolio ${endpoint} --header "Authorization: Bearer ${created.key}"`;
	const json = JSON.stringify(
		{ mcpServers: { portfolio: { type: "http", url: endpoint, headers: { Authorization: `Bearer ${created.key}` } } } },
		null,
		2,
	);

	return (
		<div className="new-key" role="alert">
			<p className="editor__mode">Chave criada: {created.apiKey.name}</p>
			<p className="field__hint">Copie agora: ela não aparece de novo. Se perder, revogue e crie outra.</p>
			<div className="new-key__value">
				<code>{created.key}</code>
				<CopyButton text={created.key} />
			</div>

			<p className="field__label">Claude Code</p>
			<div className="new-key__value">
				<code>{claudeCode}</code>
				<CopyButton text={claudeCode} />
			</div>

			<p className="field__label">Outros clientes MCP (Cursor, Codex, Claude Desktop…)</p>
			<div className="new-key__value new-key__value--block">
				<pre>{json}</pre>
				<CopyButton text={json} />
			</div>

			<button type="button" className="button button--ghost" onClick={onClose}>
				Já copiei, fechar
			</button>
		</div>
	);
}

/** Apps authorized through OAuth, like the claude.ai connector. */
function Connections() {
	const { api, notify } = useAdmin();
	const [connections, setConnections] = useState<OAuthConnection[] | null>(null);

	const load = useCallback(async () => {
		try {
			setConnections(await api.listConnections());
		} catch (error) {
			notify(errorMessage(error), "error");
		}
	}, [api, notify]);

	useEffect(() => {
		load();
	}, [load]);

	async function revoke(connection: OAuthConnection) {
		if (!window.confirm(`Desconectar "${connection.clientName}"? Ele perde o acesso na hora.`)) return;
		try {
			await api.revokeConnection(connection.id);
			notify("App desconectado.", "success");
			await load();
		} catch (error) {
			notify(errorMessage(error), "error");
		}
	}

	const endpoint = `${apiUrl.replace(/\/$/, "")}/mcp`;

	return (
		<>
			<h2 className="field__label keys__heading">Apps conectados (OAuth)</h2>
			<p className="field__hint">
				Para o claude.ai (web e app): Settings → Connectors → Add custom connector, com a URL <code>{endpoint}</code>.
				Você autoriza numa página própria, com seu e-mail e senha.
			</p>
			{connections === null ? <p className="empty">Carregando…</p> : null}
			{connections?.length === 0 ? <p className="empty">Nenhum app conectado.</p> : null}
			{connections && connections.length > 0 ? (
				<ul className="keys">
					{connections.map((connection) => (
						<li key={connection.id} className="keys__item">
							<div>
								<p className="keys__name">{connection.clientName}</p>
								<p className="keys__meta">
									{connection.redirectHost ?? "app"} · {connection.scope === "write" ? "ler e editar" : "só ler"} ·
									conectado {when(connection.createdAt)}
								</p>
							</div>
							<button type="button" className="button button--danger" onClick={() => revoke(connection)}>
								Desconectar
							</button>
						</li>
					))}
				</ul>
			) : null}
		</>
	);
}

export function ApiKeysSection() {
	const { api, notify } = useAdmin();
	const [keys, setKeys] = useState<ApiKey[] | null>(null);
	const [name, setName] = useState("");
	const [scope, setScope] = useState<ApiKeyScope>("write");
	const [created, setCreated] = useState<CreatedApiKey | null>(null);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			setKeys(await api.listApiKeys());
		} catch (error) {
			notify(errorMessage(error), "error");
		}
	}, [api, notify]);

	useEffect(() => {
		load();
	}, [load]);

	async function create(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		try {
			setCreated(await api.createApiKey({ name, scope }));
			setName("");
			await load();
		} catch (error) {
			notify(errorMessage(error), "error");
		} finally {
			setBusy(false);
		}
	}

	async function revoke(key: ApiKey) {
		if (!window.confirm(`Revogar "${key.name}"? Quem usa essa chave perde o acesso na hora.`)) return;
		try {
			await api.revokeApiKey(key.id);
			notify("Chave revogada.", "success");
			await load();
		} catch (error) {
			notify(errorMessage(error), "error");
		}
	}

	const active = keys?.filter((key) => !key.revokedAt) ?? [];
	const revoked = keys?.filter((key) => key.revokedAt) ?? [];

	return (
		<section className="panel">
			<header className="panel__head">
				<div>
					<h1 className="panel__title">Chaves de API</h1>
					<p className="panel__description">
						Deixe uma IA (pelo servidor MCP) ou um script editar o site. As alterações seguem as mesmas regras do painel
						e republicam o site sozinhas.
					</p>
				</div>
			</header>

			{created ? <NewKey created={created} onClose={() => setCreated(null)} /> : null}

			<form className="form" onSubmit={create}>
				<div className="grid-2">
					<TextField
						label="Nome"
						hint="Para reconhecer depois, ex.: Claude Code no Mac."
						value={name}
						onChange={setName}
						required
					/>
					<fieldset className="field">
						<legend className="field__label">Permissão</legend>
						<div className="segmented">
							{(
								[
									["write", "Ler e editar"],
									["read", "Só ler"],
								] as const
							).map(([value, text]) => (
								<label key={value} className={scope === value ? "is-active" : ""}>
									<input type="radio" name="api-key-scope" checked={scope === value} onChange={() => setScope(value)} />
									{text}
								</label>
							))}
						</div>
					</fieldset>
				</div>
				<div>
					<button type="submit" className="button button--primary" disabled={busy || !name.trim()}>
						{busy ? "Criando…" : "Criar chave"}
					</button>
				</div>
			</form>

			<h2 className="field__label keys__heading">Ativas</h2>
			{keys === null ? <p className="empty">Carregando…</p> : null}
			{keys !== null && active.length === 0 ? <p className="empty">Nenhuma chave ativa.</p> : null}
			{active.length > 0 ? (
				<ul className="keys">
					{active.map((key) => (
						<li key={key.id} className="keys__item">
							<div>
								<p className="keys__name">{key.name}</p>
								<p className="keys__meta">
									<code>{key.prefix}…</code> · {key.scope === "write" ? "ler e editar" : "só ler"} · criada{" "}
									{when(key.createdAt)} · último uso {when(key.lastUsedAt)}
								</p>
							</div>
							<button type="button" className="button button--danger" onClick={() => revoke(key)}>
								Revogar
							</button>
						</li>
					))}
				</ul>
			) : null}

			{revoked.length > 0 ? (
				<details className="keys__revoked">
					<summary className="field__label">Revogadas ({revoked.length})</summary>
					<ul className="keys">
						{revoked.map((key) => (
							<li key={key.id} className="keys__item keys__item--revoked">
								<div>
									<p className="keys__name">{key.name}</p>
									<p className="keys__meta">
										<code>{key.prefix}…</code> · revogada {when(key.revokedAt)}
									</p>
								</div>
							</li>
						))}
					</ul>
				</details>
			) : null}

			<Connections />
		</section>
	);
}
