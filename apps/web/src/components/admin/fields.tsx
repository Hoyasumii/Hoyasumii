"use client";

import type { Localized } from "@portfolio/shared";
import { useId, useMemo, useRef, useState } from "react";
import { iconNames, iconUrl, resolveIconName } from "@/lib/icons";
import { useAdmin } from "./context";

type FieldProps = {
	label: string;
	hint?: string;
	children: (id: string) => React.ReactNode;
};

export function Field({ label, hint, children }: FieldProps) {
	const id = useId();
	return (
		<div className="field">
			<label className="field__label" htmlFor={id}>
				{label}
			</label>
			{children(id)}
			{hint ? <p className="field__hint">{hint}</p> : null}
		</div>
	);
}

type TextProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	hint?: string;
	type?: "text" | "url" | "email" | "date";
	placeholder?: string;
	required?: boolean;
};

export function TextField({ label, value, onChange, hint, type = "text", placeholder, required }: TextProps) {
	return (
		<Field label={label} hint={hint}>
			{(id) => (
				<input
					id={id}
					className="input"
					type={type}
					value={value}
					placeholder={placeholder}
					required={required}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</Field>
	);
}

export function TextArea({ label, value, onChange, hint, rows = 4 }: Omit<TextProps, "type"> & { rows?: number }) {
	return (
		<Field label={label} hint={hint}>
			{(id) => (
				<textarea
					id={id}
					className="input"
					rows={rows}
					value={value}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</Field>
	);
}

/** Portuguese and English side by side, so a translation is never forgotten. */
export function LocalizedField({
	label,
	value,
	onChange,
	multiline = false,
	rows = 3,
	hint,
}: {
	label: string;
	value: Localized;
	onChange: (value: Localized) => void;
	multiline?: boolean;
	rows?: number;
	hint?: string;
}) {
	const id = useId();
	const input = (locale: keyof Localized) => {
		const props = {
			id: `${id}-${locale}`,
			className: "input",
			value: value[locale],
			lang: locale === "pt" ? "pt-BR" : "en",
			onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
				onChange({ ...value, [locale]: event.target.value }),
		};
		return multiline ? <textarea rows={rows} {...props} /> : <input type="text" {...props} />;
	};

	return (
		<fieldset className="field localized">
			<legend className="field__label">{label}</legend>
			<div className="localized__pair">
				<label className="localized__item" htmlFor={`${id}-pt`}>
					<span className="localized__tag">PT</span>
					{input("pt")}
				</label>
				<label className="localized__item" htmlFor={`${id}-en`}>
					<span className="localized__tag">EN</span>
					{input("en")}
				</label>
			</div>
			{hint ? <p className="field__hint">{hint}</p> : null}
		</fieldset>
	);
}

export function Toggle({
	label,
	checked,
	onChange,
	hint,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
	hint?: string;
}) {
	return (
		<div className="field">
			<label className="toggle">
				<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
				<span className="toggle__track" aria-hidden="true" />
				<span>{label}</span>
			</label>
			{hint ? <p className="field__hint">{hint}</p> : null}
		</div>
	);
}

/** Uploads to Supabase Storage through the API and returns the public URL. */
export function useUpload() {
	const { api, notify } = useAdmin();
	const [busy, setBusy] = useState(false);

	async function upload(file: File): Promise<string | null> {
		setBusy(true);
		try {
			const { url } = await api.uploadMedia(file);
			return url;
		} catch (error) {
			notify(error instanceof Error ? error.message : "Falha no upload", "error");
			return null;
		} finally {
			setBusy(false);
		}
	}

	return { upload, busy };
}

const IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/avif,image/gif";

export function ImageField({
	label,
	value,
	onChange,
	hint,
	accept = IMAGE_TYPES,
	previewClassName = "image-field__preview",
	actions,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	hint?: string;
	/** File types the upload button offers. */
	accept?: string;
	previewClassName?: string;
	/** More buttons beside the upload one, like the cover generator. */
	actions?: React.ReactNode;
}) {
	const { upload, busy } = useUpload();
	const fileRef = useRef<HTMLInputElement>(null);

	return (
		<Field label={label} hint={hint}>
			{(id) => (
				<div className="image-field">
					{value ? <img src={value} alt="" className={previewClassName} /> : null}
					<div className="image-field__controls">
						<input
							id={id}
							className="input"
							type="url"
							value={value}
							placeholder="https://…"
							onChange={(event) => onChange(event.target.value)}
						/>
						<button type="button" className="button" disabled={busy} onClick={() => fileRef.current?.click()}>
							{busy ? "Enviando…" : "Enviar imagem"}
						</button>
						{actions}
						{value ? (
							<button type="button" className="button button--ghost" onClick={() => onChange("")}>
								Remover
							</button>
						) : null}
						<input
							ref={fileRef}
							type="file"
							accept={accept}
							hidden
							onChange={async (event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (!file) return;
								const url = await upload(file);
								if (url) onChange(url);
							}}
						/>
					</div>
				</div>
			)}
		</Field>
	);
}

export function ChipsField({
	label,
	value,
	onChange,
	hint,
	placeholder = "Digite e aperte Enter",
}: {
	label: string;
	value: string[];
	onChange: (value: string[]) => void;
	hint?: string;
	placeholder?: string;
}) {
	const [draft, setDraft] = useState("");

	function add(raw: string) {
		const items = raw
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item && !value.includes(item));
		if (items.length > 0) onChange([...value, ...items]);
		setDraft("");
	}

	return (
		<Field label={label} hint={hint}>
			{(id) => (
				<div className="chips">
					{value.map((item) => (
						<span key={item} className="chip">
							{item}
							<button
								type="button"
								aria-label={`Remover ${item}`}
								onClick={() => onChange(value.filter((other) => other !== item))}
							>
								×
							</button>
						</span>
					))}
					<input
						id={id}
						className="chips__input"
						value={draft}
						placeholder={placeholder}
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === ",") {
								event.preventDefault();
								add(draft);
							} else if (event.key === "Backspace" && !draft && value.length > 0) {
								onChange(value.slice(0, -1));
							}
						}}
						onBlur={() => draft && add(draft)}
					/>
				</div>
			)}
		</Field>
	);
}

/** Picks Skill Icons by name, previewed with the site's icon style for the dark theme. */
export function IconsField({
	label,
	value,
	onChange,
	look = { variant: "dark" },
}: {
	label: string;
	value: string[];
	onChange: (value: string[]) => void;
	look?: { variant: "light" | "dark"; tint?: string };
}) {
	const [query, setQuery] = useState("");
	const suggestions = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return iconNames
			.filter((name) => name.includes(q) && !value.includes(name))
			.sort((a, b) => Number(!a.startsWith(q)) - Number(!b.startsWith(q)) || a.length - b.length)
			.slice(0, 12);
	}, [query, value]);

	const unknown = value.filter((name) => !resolveIconName(name));

	function add(name: string) {
		onChange([...value, name]);
		setQuery("");
	}

	function move(index: number, delta: number) {
		const next = [...value];
		const [item] = next.splice(index, 1);
		next.splice(index + delta, 0, item);
		onChange(next);
	}

	return (
		<Field
			label={label}
			hint={unknown.length > 0 ? `Ícones desconhecidos: ${unknown.join(", ")}` : "Busque pelo nome do Skill Icons."}
		>
			{(id) => (
				<div className="icons-field">
					<ul className="icons-field__list">
						{value.map((name, index) => (
							<li key={name} className="icons-field__item">
								<img
									src={iconUrl(resolveIconName(name) ?? name, look.variant, look.tint)}
									alt=""
									width={32}
									height={32}
								/>
								<span>{name}</span>
								<span className="icons-field__actions">
									<button
										type="button"
										aria-label="Mover para a esquerda"
										disabled={index === 0}
										onClick={() => move(index, -1)}
									>
										←
									</button>
									<button
										type="button"
										aria-label="Mover para a direita"
										disabled={index === value.length - 1}
										onClick={() => move(index, 1)}
									>
										→
									</button>
									<button
										type="button"
										aria-label={`Remover ${name}`}
										onClick={() => onChange(value.filter((other) => other !== name))}
									>
										×
									</button>
								</span>
							</li>
						))}
					</ul>
					<div className="icons-field__search">
						<input
							id={id}
							className="input"
							value={query}
							placeholder="ts, react, postgres…"
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									if (suggestions[0]) add(suggestions[0]);
								}
							}}
						/>
						{suggestions.length > 0 ? (
							<ul className="icons-field__suggestions">
								{suggestions.map((name) => (
									<li key={name}>
										<button type="button" onClick={() => add(name)}>
											<img src={iconUrl(name, look.variant, look.tint)} alt="" width={24} height={24} loading="lazy" />
											{name}
										</button>
									</li>
								))}
							</ul>
						) : null}
					</div>
				</div>
			)}
		</Field>
	);
}
