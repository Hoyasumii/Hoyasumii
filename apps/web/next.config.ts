import type { NextConfig } from "next";

/** Set when the site is served from a sub-path, e.g. "/Hoyasumii" on <user>.github.io. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const config: NextConfig = {
	// GitHub Pages serves files: everything is rendered at build time into `out/`.
	output: "export",
	trailingSlash: true,
	basePath,
	images: { unoptimized: true },
	transpilePackages: ["@portfolio/shared"],
	experimental: { globalNotFound: true },
};

export default config;
