"use client";

export function ThemeToggle({ label }: { label: string }) {
	function toggle() {
		const root = document.documentElement;
		const next = root.dataset.theme === "light" ? "dark" : "light";
		root.dataset.theme = next;
		try {
			localStorage.setItem("theme", next);
		} catch {
			// Private mode: the choice just isn't remembered.
		}
	}

	return (
		<button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
			<span aria-hidden="true" />
		</button>
	);
}
