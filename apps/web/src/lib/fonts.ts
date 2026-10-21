import { Archivo, IBM_Plex_Mono } from "next/font/google";

export const archivo = Archivo({
	subsets: ["latin", "latin-ext"],
	axes: ["wdth"],
	variable: "--font-sans",
	display: "swap",
});

export const plexMono = IBM_Plex_Mono({
	subsets: ["latin", "latin-ext"],
	weight: ["400", "500"],
	variable: "--font-mono",
	display: "swap",
});

export const fontClasses = `${archivo.variable} ${plexMono.variable}`;
