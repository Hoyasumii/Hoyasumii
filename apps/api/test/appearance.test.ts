import {
	accentFor,
	type Content,
	contrastRatio,
	defaultAccent,
	defaultIconStyles,
	iconLook,
	inkOn,
	MIN_ACCENT_CONTRAST,
	PAPER,
} from "@portfolio/shared";
import { describe, expect, it } from "vitest";
import { ADMIN, data, setup } from "./helpers";

describe("color helpers", () => {
	it("computes WCAG contrast", () => {
		expect(contrastRatio("000000", "ffffff")).toBeCloseTo(21, 1);
		expect(contrastRatio("ffffff", "ffffff")).toBeCloseTo(1, 5);
	});

	it("picks readable ink for the accent", () => {
		expect(inkOn("d4441c")).toBe("ffffff");
		expect(inkOn("ffe08a")).toBe("0e0e0d");
	});

	it("suggests per-theme variants that stand out from the paper", () => {
		for (const base of ["d4441c", "34c759", "ffcc00", "5856d6", "8e8e93"]) {
			expect(contrastRatio(accentFor("light", base), PAPER.light)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
			expect(contrastRatio(accentFor("dark", base), PAPER.dark)).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST);
		}
	});
});

describe("appearance settings", () => {
	it("migrates documents saved with a single iconTint and no accent", async () => {
		const { call, repository } = setup();
		await repository.putSettings("appearance", { iconTint: "5fd3c4" } as never);
		const content = await data<Content>(await call("/content"));
		expect(content.appearance).toEqual({
			accent: defaultAccent,
			icons: { light: { variant: "light", tint: "5fd3c4" }, dark: { variant: "dark", tint: "5fd3c4" } },
		});
	});

	it("resolves the icon look per theme of the site", () => {
		const appearance = {
			accent: { light: "1f5fd1", dark: "6aa5ff" },
			icons: { light: { variant: "dark", tint: "accent" }, dark: { variant: "dark", tint: "" } },
		} as const;
		expect(iconLook(appearance, "light")).toEqual({ variant: "dark", tint: "1f5fd1" });
		expect(iconLook(appearance, "dark")).toEqual({ variant: "dark", tint: undefined });
	});

	it("saves a custom accent and rejects invalid colors", async () => {
		const { call } = setup();
		const ok = await call("/admin/settings/appearance", {
			method: "PUT",
			token: ADMIN,
			json: { accent: { light: "1f7a4d", dark: "4ade80" }, icons: defaultIconStyles },
		});
		expect(ok.status).toBe(200);
		expect((await data<Content>(await call("/content"))).appearance.accent).toEqual({
			light: "1f7a4d",
			dark: "4ade80",
		});

		const bad = await call("/admin/settings/appearance", {
			method: "PUT",
			token: ADMIN,
			json: { accent: { light: "#1f7a4d", dark: "green" }, icons: defaultIconStyles },
		});
		expect(bad.status).toBe(400);
	});
});
