"use client";

import { useLayoutEffect } from "react";
import { applySavedTheme } from "@/lib/theme";

/**
 * Navigating to another root layout (switching languages, leaving the not-found page) makes React
 * rebuild <html>, which drops data-theme, and the inline theme script does not run again. This puts
 * the theme back before the browser paints.
 */
export function ThemeSync() {
	useLayoutEffect(() => {
		if (!document.documentElement.dataset.theme) applySavedTheme();
	}, []);
	return null;
}
