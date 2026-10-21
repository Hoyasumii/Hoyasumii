import {
	accentFor,
	type Content,
	contrastRatio,
	defaultAccent,
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
	it("fills the accent of documents saved before it existed", async () => {
		const { call, repository } = setup();
		await repository.putSettings("appearance", { iconTint: "accent" } as never);
		const content = await data<Content>(await call("/content"));
		expect(content.appearance).toEqual({ iconTint: "accent", accent: defaultAccent });
	});

	it("saves a custom accent and rejects invalid colors", async () => {
		const { call } = setup();
		const ok = await call("/admin/settings/appearance", {
			method: "PUT",
			token: ADMIN,
			json: { iconTint: "accent", accent: { light: "1f7a4d", dark: "4ade80" } },
		});
		expect(ok.status).toBe(200);
		expect((await data<Content>(await call("/content"))).appearance.accent).toEqual({
			light: "1f7a4d",
			dark: "4ade80",
		});

		const bad = await call("/admin/settings/appearance", {
			method: "PUT",
			token: ADMIN,
			json: { iconTint: "accent", accent: { light: "#1f7a4d", dark: "green" } },
		});
		expect(bad.status).toBe(400);
	});
});
