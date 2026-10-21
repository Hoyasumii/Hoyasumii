"use client";

import { marked } from "marked";
import { useId, useMemo, useRef, useState } from "react";
import { useUpload } from "./fields";

type Mode = "write" | "split" | "preview";

/** Markdown with a live preview; images are uploaded and inserted where the cursor is. */
export function MarkdownEditor({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const id = useId();
	const [mode, setMode] = useState<Mode>("split");
	const textarea = useRef<HTMLTextAreaElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const { upload, busy } = useUpload();
	const html = useMemo(() => (mode === "write" ? "" : marked.parse(value, { async: false, gfm: true })), [mode, value]);

	function insert(snippet: string) {
		const element = textarea.current;
		const start = element?.selectionStart ?? value.length;
		const end = element?.selectionEnd ?? value.length;
		onChange(`${value.slice(0, start)}${snippet}${value.slice(end)}`);
		requestAnimationFrame(() => {
			element?.focus();
			element?.setSelectionRange(start + snippet.length, start + snippet.length);
		});
	}

	function wrap(before: string, after = before) {
		const element = textarea.current;
		if (!element) return;
		const { selectionStart: start, selectionEnd: end } = element;
		const selected = value.slice(start, end) || "texto";
		onChange(`${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`);
		requestAnimationFrame(() => {
			element.focus();
			element.setSelectionRange(start + before.length, start + before.length + selected.length);
		});
	}

	const words = value.split(/\s+/).filter(Boolean).length;

	return (
		<div className="field md">
			<div className="md__bar">
				<label className="field__label" htmlFor={id}>
					{label}
				</label>
				<div className="md__tools">
					<button type="button" onClick={() => wrap("**")} title="Negrito">
						B
					</button>
					<button type="button" onClick={() => wrap("_")} title="Itálico">
						<em>I</em>
					</button>
					<button type="button" onClick={() => insert("\n## ")} title="Subtítulo">
						H2
					</button>
					<button type="button" onClick={() => wrap("[", "](https://)")} title="Link">
						Link
					</button>
					<button type="button" onClick={() => wrap("`")} title="Código">
						{"</>"}
					</button>
					<button type="button" onClick={() => insert("\n```ts\n\n```\n")} title="Bloco de código">
						{"{ }"}
					</button>
					<button type="button" disabled={busy} onClick={() => fileRef.current?.click()} title="Imagem">
						{busy ? "…" : "Img"}
					</button>
					<input
						ref={fileRef}
						type="file"
						accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
						hidden
						onChange={async (event) => {
							const file = event.target.files?.[0];
							event.target.value = "";
							if (!file) return;
							const url = await upload(file);
							if (url) insert(`\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`);
						}}
					/>
				</div>
				<div className="md__modes" role="tablist" aria-label="Visualização">
					{(
						[
							["write", "Escrever"],
							["split", "Lado a lado"],
							["preview", "Prévia"],
						] as const
					).map(([key, text]) => (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={mode === key}
							className={mode === key ? "is-active" : ""}
							onClick={() => setMode(key)}
						>
							{text}
						</button>
					))}
				</div>
			</div>
			<div className={`md__panes md__panes--${mode}`}>
				{mode !== "preview" ? (
					<textarea
						id={id}
						ref={textarea}
						className="input md__input"
						value={value}
						spellCheck
						onChange={(event) => onChange(event.target.value)}
						placeholder={"# Título\n\nEscreva em Markdown…"}
					/>
				) : null}
				{mode !== "write" ? (
					// biome-ignore lint/security/noDangerouslySetInnerHtml: preview of the owner's own markdown
					<div className="md__preview prose" dangerouslySetInnerHTML={{ __html: html }} />
				) : null}
			</div>
			<p className="field__hint">
				{words} palavras · ~{Math.max(1, Math.round(words / 220))} min de leitura
			</p>
		</div>
	);
}
