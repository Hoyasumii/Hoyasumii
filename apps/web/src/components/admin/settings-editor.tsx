"use client";

import type { Settings, SettingsKey } from "@portfolio/shared";
import { useEffect, useState } from "react";
import { errorMessage, useAdmin } from "./context";

type Props<K extends SettingsKey> = {
	settingsKey: K;
	title: string;
	description?: string;
	children: (value: Settings[K], set: (value: Settings[K]) => void) => React.ReactNode;
	onSaved?: (value: Settings[K]) => void;
};

/** Loads one settings document, edits it as a whole and saves it. */
export function SettingsEditor<K extends SettingsKey>({
	settingsKey,
	title,
	description,
	children,
	onSaved,
}: Props<K>) {
	const { api, notify } = useAdmin();
	const [value, setValue] = useState<Settings[K] | null>(null);
	const [saved, setSaved] = useState<string>("");
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let active = true;
		api
			.getSettings(settingsKey)
			.then((loaded) => {
				if (!active) return;
				setValue(loaded);
				setSaved(JSON.stringify(loaded));
			})
			.catch((error) => notify(errorMessage(error), "error"));
		return () => {
			active = false;
		};
	}, [api, notify, settingsKey]);

	const dirty = value !== null && JSON.stringify(value) !== saved;

	async function save(event: React.FormEvent) {
		event.preventDefault();
		if (!value) return;
		setSaving(true);
		try {
			const result = await api.updateSettings(settingsKey, value);
			setSaved(JSON.stringify(result));
			onSaved?.(result);
			notify("Salvo. O site será republicado em instantes.", "success");
		} catch (error) {
			notify(errorMessage(error), "error");
		} finally {
			setSaving(false);
		}
	}

	return (
		<section className="panel">
			<header className="panel__head">
				<div>
					<h1 className="panel__title">{title}</h1>
					{description ? <p className="panel__description">{description}</p> : null}
				</div>
			</header>
			{value === null ? (
				<p className="empty">Carregando…</p>
			) : (
				<form className="form" onSubmit={save}>
					{children(value, setValue)}
					<div className="form__actions">
						<button type="submit" className="button button--primary" disabled={!dirty || saving}>
							{saving ? "Salvando…" : dirty ? "Salvar" : "Salvo"}
						</button>
						{dirty ? (
							<button type="button" className="button button--ghost" onClick={() => setValue(JSON.parse(saved))}>
								Descartar alterações
							</button>
						) : null}
					</div>
				</form>
			)}
		</section>
	);
}
