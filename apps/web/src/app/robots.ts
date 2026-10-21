import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", allow: "/", disallow: "/admin/" },
		sitemap: `${site}/sitemap.xml`,
	};
}
