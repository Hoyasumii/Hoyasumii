import type { Content } from "@portfolio/shared";
import { describe, expect, it } from "vitest";
import { ADMIN, data, setup } from "./helpers";

describe("seo settings", () => {
	it("fills the fields added later on documents saved before them", async () => {
		const { call, repository } = setup();
		const description = { pt: "Olá", en: "Hi" };
		await repository.putSettings("seo", { title: "Site", description } as never);
		const content = await data<Content>(await call("/content"));
		expect(content.seo).toEqual({ title: "Site", description, favicon: "", image: "", keywords: [], twitter: "" });
	});

	it("saves the favicon, cover, keywords and X handle", async () => {
		const { call } = setup();
		const seo = {
			title: "Site",
			description: { pt: "Olá", en: "Hi" },
			favicon: "https://cdn.example.com/icon.png",
			image: "https://cdn.example.com/cover.png",
			keywords: ["TypeScript", "Bun"],
			twitter: "hoyasumii",
		};
		const response = await call("/admin/settings/seo", { method: "PUT", token: ADMIN, json: seo });
		expect(response.status).toBe(200);
		expect((await data<Content>(await call("/content"))).seo).toEqual(seo);
	});

	it("rejects an X handle with @ and a favicon that is not a URL", async () => {
		const { call } = setup();
		const base = { title: "Site", description: { pt: "", en: "" } };
		for (const json of [
			{ ...base, twitter: "@hoyasumii" },
			{ ...base, favicon: "favicon.png" },
		]) {
			const response = await call("/admin/settings/seo", { method: "PUT", token: ADMIN, json });
			expect(response.status).toBe(400);
		}
	});
});
