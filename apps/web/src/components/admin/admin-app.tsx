"use client";

import { useEffect, useState } from "react";
import { AdminProvider, errorMessage, useAdmin } from "./context";
import {
	AppearanceSection,
	ArticlesSection,
	ExperienceSection,
	LinksSection,
	ProfileSection,
	ProjectsSection,
	SeoSection,
	StackSection,
} from "./sections";
import { devMode, getSupabase, useSession } from "./session";

const SECTIONS = {
	profile: { label: "Perfil", render: () => <ProfileSection /> },
	projects: { label: "Projetos", render: () => <ProjectsSection /> },
	articles: { label: "Artigos", render: () => <ArticlesSection /> },
	experience: { label: "Experiência", render: () => <ExperienceSection /> },
	stack: { label: "Stack", render: () => <StackSection /> },
	links: { label: "Links", render: () => <LinksSection /> },
	appearance: { label: "Aparência", render: () => <AppearanceSection /> },
	seo: { label: "SEO", render: () => <SeoSection /> },
} as const;

type SectionKey = keyof typeof SECTIONS;

/** Hash routing: GitHub Pages only serves files, so the panel is a single page. */
function useHashSection(): [SectionKey, (key: SectionKey) => void] {
	const [section, setSection] = useState<SectionKey>("profile");

	useEffect(() => {
		const read = () => {
			const key = window.location.hash.slice(1);
			if (key in SECTIONS) setSection(key as SectionKey);
		};
		read();
		window.addEventListener("hashchange", read);
		return () => window.removeEventListener("hashchange", read);
	}, []);

	return [
		section,
		(key) => {
			window.location.hash = key;
		},
	];
}

function Login() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		const result = await getSupabase()?.auth.signInWithPassword({ email, password });
		if (result?.error) setError("E-mail ou senha incorretos.");
		setBusy(false);
	}

	return (
		<main className="login">
			<form className="login__card" onSubmit={submit}>
				<p className="login__brand">Painel</p>
				<h1 className="login__title">Entrar</h1>
				<label className="field">
					<span className="field__label">E-mail</span>
					<input
						className="input"
						type="email"
						autoComplete="username"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						required
					/>
				</label>
				<label className="field">
					<span className="field__label">Senha</span>
					<input
						className="input"
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						required
					/>
				</label>
				{error ? <p className="login__error">{error}</p> : null}
				<button type="submit" className="button button--primary" disabled={busy}>
					{busy ? "Entrando…" : "Entrar"}
				</button>
			</form>
		</main>
	);
}

function PublishButton() {
	const { api, notify } = useAdmin();
	const [busy, setBusy] = useState(false);

	return (
		<button
			type="button"
			className="button"
			disabled={busy}
			title="Salvar já republica o site; use isto para forçar um novo build (ex.: puxar artigos novos do dev.to)."
			onClick={async () => {
				setBusy(true);
				try {
					await api.publish();
					notify("Publicação iniciada. O site atualiza em 1–2 minutos.", "success");
				} catch (error) {
					notify(errorMessage(error), "error");
				} finally {
					setBusy(false);
				}
			}}
		>
			{busy ? "Publicando…" : "Republicar site"}
		</button>
	);
}

/** Loads the icon tint once, so every icon picker previews the site's colors. */
function TintLoader() {
	const { api, setTint } = useAdmin();
	useEffect(() => {
		api
			.getSettings("appearance")
			.then((value) => setTint(value.iconTint))
			.catch(() => {});
	}, [api, setTint]);
	return null;
}

function Shell({ email, onSignOut }: { email: string; onSignOut: () => Promise<void> }) {
	const [section, go] = useHashSection();
	const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

	return (
		<div className="admin">
			<TintLoader />
			<aside className="sidebar">
				<p className="sidebar__brand">
					Painel<span>{devMode ? "modo local" : email}</span>
				</p>
				<nav className="sidebar__nav" aria-label="Seções">
					{(Object.keys(SECTIONS) as SectionKey[]).map((key) => (
						<a
							key={key}
							href={`#${key}`}
							className={key === section ? "is-active" : ""}
							aria-current={key === section ? "page" : undefined}
							onClick={(event) => {
								event.preventDefault();
								go(key);
							}}
						>
							{SECTIONS[key].label}
						</a>
					))}
				</nav>
				<div className="sidebar__foot">
					<PublishButton />
					<a className="button button--ghost" href={`${base}/`} target="_blank" rel="noreferrer">
						Ver site ↗
					</a>
					{devMode ? null : (
						<button type="button" className="button button--ghost" onClick={onSignOut}>
							Sair
						</button>
					)}
				</div>
			</aside>
			<main className="content">{SECTIONS[section].render()}</main>
		</div>
	);
}

export function AdminApp() {
	const session = useSession();

	if (session.status === "loading") return <p className="splash">Carregando…</p>;
	if (session.status === "signed-out") return <Login />;

	return (
		<AdminProvider api={session.api}>
			<Shell email={session.email} onSignOut={session.signOut} />
		</AdminProvider>
	);
}
