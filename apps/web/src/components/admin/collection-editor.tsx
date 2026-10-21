"use client";

import type { CollectionInput, CollectionName, Entry } from "@portfolio/shared";
import { useCallback, useEffect, useState } from "react";
import { errorMessage, useAdmin } from "./context";

type Item<N extends CollectionName> = Entry<CollectionInput<N>>;

type Props<N extends CollectionName> = {
	name: N;
	title: string;
	description?: string;
	/** Singular noun for buttons ("projeto", "artigo"…). */
	noun: string;
	empty: () => CollectionInput<N>;
	label: (item: CollectionInput<N>) => string;
	meta?: (item: CollectionInput<N>) => string;
	/** Collections the site sorts on its own (articles by date) hide the reorder buttons. */
	sortable?: boolean;
	children: (value: CollectionInput<N>, set: (value: CollectionInput<N>) => void) => React.ReactNode;
};

type Selection = { mode: "none" } | { mode: "new" } | { mode: "edit"; id: string };

function strip<N extends CollectionName>(item: Item<N>): CollectionInput<N> {
	const { id: _id, position: _position, ...input } = item;
	return input as CollectionInput<N>;
}

/** A list of entries on the left and the selected one's form on the right. */
export function CollectionEditor<N extends CollectionName>({
	name,
	title,
	description,
	noun,
	empty,
	label,
	meta,
	sortable = true,
	children,
}: Props<N>) {
	const { api, notify } = useAdmin();
	const [items, setItems] = useState<Item<N>[] | null>(null);
	const [selection, setSelection] = useState<Selection>({ mode: "none" });
	const [draft, setDraft] = useState<CollectionInput<N> | null>(null);
	const [baseline, setBaseline] = useState("");
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			setItems(await api.list(name));
		} catch (error) {
			notify(errorMessage(error), "error");
		}
	}, [api, name, notify]);

	useEffect(() => {
		load();
	}, [load]);

	const dirty = draft !== null && JSON.stringify(draft) !== baseline;

	function confirmDiscard() {
		return !dirty || window.confirm("Descartar as alterações não salvas?");
	}

	function open(next: Selection, value: CollectionInput<N> | null) {
		if (!confirmDiscard()) return;
		setSelection(next);
		setDraft(value);
		setBaseline(JSON.stringify(value));
	}

	async function save(event: React.FormEvent) {
		event.preventDefault();
		if (!draft) return;
		setBusy(true);
		try {
			const entry =
				selection.mode === "edit" ? await api.update(name, selection.id, draft) : await api.create(name, draft);
			await load();
			setSelection({ mode: "edit", id: entry.id });
			setDraft(strip(entry));
			setBaseline(JSON.stringify(strip(entry)));
			notify(`${noun[0].toUpperCase()}${noun.slice(1)} salvo. O site será republicado em instantes.`, "success");
		} catch (error) {
			notify(errorMessage(error), "error");
		} finally {
			setBusy(false);
		}
	}

	async function remove() {
		if (selection.mode !== "edit" || !draft) return;
		if (!window.confirm(`Apagar "${label(draft)}"? Isso não pode ser desfeito.`)) return;
		setBusy(true);
		try {
			await api.remove(name, selection.id);
			setSelection({ mode: "none" });
			setDraft(null);
			setBaseline("");
			await load();
			notify("Apagado.", "success");
		} catch (error) {
			notify(errorMessage(error), "error");
		} finally {
			setBusy(false);
		}
	}

	async function move(index: number, delta: number) {
		if (!items) return;
		const next = [...items];
		const [item] = next.splice(index, 1);
		next.splice(index + delta, 0, item);
		setItems(next);
		try {
			setItems(
				await api.reorder(
					name,
					next.map((entry) => entry.id),
				),
			);
		} catch (error) {
			notify(errorMessage(error), "error");
			load();
		}
	}

	return (
		<section className="panel panel--split">
			<header className="panel__head">
				<div>
					<h1 className="panel__title">{title}</h1>
					{description ? <p className="panel__description">{description}</p> : null}
				</div>
				<button type="button" className="button button--primary" onClick={() => open({ mode: "new" }, empty())}>
					+ Novo {noun}
				</button>
			</header>

			<div className="split">
				<ol className="list" aria-label={title}>
					{items === null ? <li className="empty">Carregando…</li> : null}
					{items?.length === 0 ? <li className="empty">Nada por aqui ainda.</li> : null}
					{items?.map((item, index) => {
						const active = selection.mode === "edit" && selection.id === item.id;
						return (
							<li key={item.id} className={`list__item${active ? " list__item--active" : ""}`}>
								<button
									type="button"
									className="list__open"
									onClick={() => open({ mode: "edit", id: item.id }, strip(item))}
								>
									<span className="list__index">{String(index + 1).padStart(2, "0")}</span>
									<span className="list__label">{label(item)}</span>
									{meta ? <span className="list__meta">{meta(item)}</span> : null}
								</button>
								{sortable ? (
									<span className="list__move">
										<button type="button" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
											↑
										</button>
										<button
											type="button"
											aria-label="Descer"
											disabled={index === items.length - 1}
											onClick={() => move(index, 1)}
										>
											↓
										</button>
									</span>
								) : null}
							</li>
						);
					})}
				</ol>

				<div className="editor">
					{draft === null ? (
						<p className="empty">Escolha um item na lista ou crie um novo.</p>
					) : (
						<form className="form" onSubmit={save}>
							<p className="editor__mode">{selection.mode === "new" ? `Novo ${noun}` : `Editando ${noun}`}</p>
							{children(draft, setDraft)}
							<div className="form__actions">
								<button type="submit" className="button button--primary" disabled={busy || !dirty}>
									{busy ? "Salvando…" : dirty ? "Salvar" : "Salvo"}
								</button>
								<button type="button" className="button button--ghost" onClick={() => open({ mode: "none" }, null)}>
									Fechar
								</button>
								{selection.mode === "edit" ? (
									<button type="button" className="button button--danger" disabled={busy} onClick={remove}>
										Apagar
									</button>
								) : null}
							</div>
						</form>
					)}
				</div>
			</div>
		</section>
	);
}
