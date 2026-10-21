"use client";

import { type Appearance, defaultSettings, type PortfolioClient } from "@portfolio/shared";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AccentStyle } from "../accent-style";

type Tone = "info" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone };

type AdminContextValue = {
	api: PortfolioClient;
	notify: (message: string, tone?: Tone) => void;
	/** The site's appearance (icon tint and accent), so previews match the site. */
	appearance: Appearance;
	setAppearance: (appearance: Appearance) => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
	const value = useContext(AdminContext);
	if (!value) throw new Error("useAdmin must be used inside <AdminProvider>");
	return value;
}

let nextId = 0;

export function AdminProvider({ api, children }: { api: PortfolioClient; children: React.ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);
	const [appearance, setAppearance] = useState<Appearance>(defaultSettings.appearance);

	const notify = useCallback((message: string, tone: Tone = "info") => {
		const id = ++nextId;
		setToasts((current) => [...current, { id, message, tone }]);
		setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
	}, []);

	const value = useMemo(() => ({ api, notify, appearance, setAppearance }), [api, notify, appearance]);

	return (
		<AdminContext.Provider value={value}>
			{/* The panel follows the site's accent too. */}
			<AccentStyle accent={appearance.accent} />
			{children}
			<div className="toasts" role="status" aria-live="polite">
				{toasts.map((toast) => (
					<p key={toast.id} className={`toast toast--${toast.tone}`}>
						{toast.message}
					</p>
				))}
			</div>
		</AdminContext.Provider>
	);
}

/** Turns an API error into something readable, including the first validation issue. */
export function errorMessage(error: unknown): string {
	if (!(error instanceof Error)) return "Algo deu errado";
	const issues = (error as { issues?: { path?: (string | number)[]; message: string }[] }).issues;
	const first = Array.isArray(issues) ? issues[0] : undefined;
	if (first) return `${first.path?.join(".") || "campo"}: ${first.message}`;
	return error.message;
}
