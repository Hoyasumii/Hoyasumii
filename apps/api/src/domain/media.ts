import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type StoredMedia } from "../storage/media-storage";
import { BadRequest } from "./exceptions";
import type { Services } from "./services";

/**
 * Uploads stay outside the afora output: its sinks read JSON bodies, and an upload is
 * multipart/form-data. Both the panel's upload route and the MCP tool go through here.
 */
const badRequest = (message: string) => new BadRequest({ source: "Media", message });

export async function upload(services: Services, file: File): Promise<StoredMedia> {
	if (!ALLOWED_MIME_TYPES.includes(file.type)) throw badRequest(`Unsupported file type ${file.type || "(none)"}`);
	if (file.size > MAX_UPLOAD_BYTES) throw badRequest("File is larger than 5 MB");
	return services.storage.upload(file);
}

/** Downloads an image from a public URL and stores it like an upload from the panel. */
export async function uploadFromUrl(services: Services, url: string): Promise<StoredMedia> {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		throw badRequest("Not a valid URL");
	}
	if (parsed.protocol !== "https:") throw badRequest("Only https:// URLs are accepted");

	const response = await fetch(parsed, { redirect: "follow" }).catch(() => {
		throw badRequest("Could not download the image");
	});
	if (!response.ok) throw badRequest(`Downloading the image failed with ${response.status}`);
	const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
	const declared = Number(response.headers.get("content-length") ?? 0);
	if (declared > MAX_UPLOAD_BYTES) throw badRequest("File is larger than 5 MB");

	const bytes = await response.arrayBuffer();
	const name = parsed.pathname.split("/").pop() || "image";
	return upload(services, new File([bytes], name, { type }));
}
