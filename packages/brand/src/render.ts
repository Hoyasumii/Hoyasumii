import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

type Theme = "light" | "dark";

interface Job {
	/** HTML file in templates/, without the extension. */
	template: string;
	theme: Theme;
	/** The template's own size in CSS pixels. */
	width: number;
	height: number;
	/** Pixel ratio: 2 renders the same layout at twice the resolution. */
	scale?: number;
	out: string;
}

const logo = (theme: Theme): Job => ({ template: "logo", theme, width: 512, height: 512, out: `logo-${theme}.png` });
const og = (theme: Theme): Job => ({ template: "og", theme, width: 1200, height: 630, out: `og-${theme}.png` });

const JOBS: Job[] = [logo("light"), logo("dark"), og("light"), og("dark")];

const templates = new URL("../templates/", import.meta.url);
const images = fileURLToPath(new URL("../images/", import.meta.url));

/** `bun run render` renders everything; `bun run render og` only the jobs whose file starts with "og". */
const filters = process.argv.slice(2);
const jobs = filters.length > 0 ? JOBS.filter((job) => filters.some((f) => job.out.startsWith(f))) : JOBS;

await mkdir(images, { recursive: true });
const browser = await chromium.launch();
try {
	for (const job of jobs) {
		const page = await browser.newPage({
			viewport: { width: job.width, height: job.height },
			deviceScaleFactor: job.scale ?? 1,
		});
		await page.goto(new URL(`${job.template}.html?theme=${job.theme}`, templates).href);
		await page.evaluate(() => document.fonts.ready);
		await page.screenshot({ path: `${images}${job.out}`, omitBackground: true });
		await page.close();
		console.log(`images/${job.out}`);
	}
} finally {
	await browser.close();
}
