"use client";

import type { Profile } from "@portfolio/shared";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type CoverDraft, coverBlob, drawCover, loadCoverFonts } from "@/lib/cover";
import { errorMessage, useAdmin } from "./context";
import { TextArea, TextField, useUpload } from "./fields";

/** Builds the starting cover from the profile, so the generator opens already filled in. */
export type CoverDefaults = (profile: Profile) => Omit<CoverDraft, "theme">;

const LAYOUTS = [
	["profile", "Perfil"],
	["article", "Artigo"],
] as const;

const THEMES = [
	["light", "Claro"],
	["dark", "Escuro"],
] as const;

function Segmented<T extends string>({
	label,
	name,
	options,
	value,
	onChange,
}: {
	label: string;
	name: string;
	options: readonly (readonly [T, string])[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<div className="field">
			<span className="field__label">{label}</span>
			<div className="segmented">
				{options.map(([key, text]) => (
					<label key={key} className={value === key ? "is-active" : ""}>
						<input type="radio" name={name} checked={value === key} onChange={() => onChange(key)} />
						{text}
					</label>
				))}
			</div>
		</div>
	);
}

function CoverDialog({
	defaults,
	onClose,
	onUse,
}: {
	defaults: CoverDefaults;
	onClose: () => void;
	onUse: (url: string) => void;
}) {
	const { api, appearance, notify } = useAdmin();
	const { upload, busy } = useUpload();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [draft, setDraft] = useState<CoverDraft | null>(null);
	const [fontsLoaded, setFontsLoaded] = useState(false);
	// Read once when the dialog opens: the field's draft keeps changing while it is open.
	const defaultsRef = useRef(defaults);

	useEffect(() => {
		dialogRef.current?.showModal();
		let active = true;
		const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
		api
			.getSettings("profile")
			.then((profile) => active && setDraft({ ...defaultsRef.current(profile), theme }))
			.catch((error) => notify(errorMessage(error), "error"));
		loadCoverFonts()
			.then(() => active && setFontsLoaded(true))
			.catch(() => notify("Não foi possível carregar as fontes da capa", "error"));
		return () => {
			active = false;
		};
	}, [api, notify]);

	useEffect(() => {
		if (draft && fontsLoaded && canvasRef.current) drawCover(canvasRef.current, draft, appearance);
	}, [draft, fontsLoaded, appearance]);

	async function render(): Promise<File | null> {
		if (!canvasRef.current) return null;
		const blob = await coverBlob(canvasRef.current);
		return new File([blob], "cover.png", { type: "image/png" });
	}

	async function download() {
		const file = await render();
		if (!file) return;
		const link = document.createElement("a");
		link.href = URL.createObjectURL(file);
		link.download = "cover.png";
		link.click();
		URL.revokeObjectURL(link.href);
	}

	async function use() {
		const file = await render();
		if (!file) return;
		const url = await upload(file);
		if (!url) return;
		onUse(url);
		onClose();
	}

	const set = (patch: Partial<CoverDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

	return (
		<dialog ref={dialogRef} className="cover-dialog" onClose={onClose} aria-labelledby="cover-dialog-title">
			<header className="cover-dialog__head">
				<h2 id="cover-dialog-title" className="cover-dialog__title">
					Gerar capa
				</h2>
				<button type="button" className="button button--ghost" onClick={onClose}>
					Fechar
				</button>
			</header>

			<div className="cover-dialog__body">
				<div className="cover-dialog__preview">
					<canvas ref={canvasRef} width={1200} height={630} aria-label="Prévia da capa" />
					{!draft || !fontsLoaded ? <p className="cover-dialog__loading">Carregando…</p> : null}
				</div>

				{draft ? (
					<div className="cover-dialog__form">
						<div className="grid-2">
							<Segmented
								label="Modelo"
								name="cover-layout"
								options={LAYOUTS}
								value={draft.layout}
								onChange={(layout) => set({ layout })}
							/>
							<Segmented
								label="Tema"
								name="cover-theme"
								options={THEMES}
								value={draft.theme}
								onChange={(theme) => set({ theme })}
							/>
						</div>
						<TextArea
							label={draft.layout === "profile" ? "Nome" : "Título"}
							hint={
								draft.layout === "profile"
									? "Uma linha por linha, como no topo do site; a última fica na cor de destaque."
									: "Quebra sozinho e diminui até caber; a última linha fica na cor de destaque."
							}
							rows={draft.layout === "profile" ? 2 : 3}
							value={draft.headline}
							onChange={(headline) => set({ headline })}
						/>
						<div className="grid-3">
							<TextField
								label="Topo, esquerda"
								value={draft.top.start}
								onChange={(start) => set({ top: { ...draft.top, start } })}
							/>
							<TextField
								label="Topo, centro"
								value={draft.top.center}
								onChange={(center) => set({ top: { ...draft.top, center } })}
							/>
							<TextField
								label="Topo, direita"
								value={draft.top.end}
								onChange={(end) => set({ top: { ...draft.top, end } })}
							/>
						</div>
						<TextArea
							label="Rodapé"
							hint={
								draft.layout === "profile"
									? "Uma linha por item, até 4; a primeira ganha o ponto."
									: "Uma linha por item; ficam lado a lado."
							}
							rows={3}
							value={draft.meta.join("\n")}
							onChange={(meta) => set({ meta: meta.split("\n") })}
						/>
						<p className="field__hint">A cor de destaque é a da Aparência, na variante do tema escolhido.</p>
					</div>
				) : null}
			</div>

			<footer className="cover-dialog__actions">
				<button
					type="button"
					className="button button--primary"
					disabled={!draft || !fontsLoaded || busy}
					onClick={use}
				>
					{busy ? "Enviando…" : "Usar esta capa"}
				</button>
				<button type="button" className="button" disabled={!draft || !fontsLoaded} onClick={download}>
					Baixar PNG
				</button>
			</footer>
		</dialog>
	);
}

/** "Gerar capa" button for an image field; the dialog lives outside the field's form. */
export function CoverGenerator({ defaults, onUse }: { defaults: CoverDefaults; onUse: (url: string) => void }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" className="button" onClick={() => setOpen(true)}>
				Gerar capa
			</button>
			{open
				? createPortal(<CoverDialog defaults={defaults} onClose={() => setOpen(false)} onUse={onUse} />, document.body)
				: null}
		</>
	);
}
