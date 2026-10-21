import type { SupabaseClient } from "@supabase/supabase-js";
import { type MediaStorage, mediaPath } from "./media-storage";

/** Uploads to a public Supabase Storage bucket. */
export class SupabaseMediaStorage implements MediaStorage {
	constructor(
		private readonly client: SupabaseClient,
		private readonly bucket: string,
	) {}

	async upload(file: File) {
		const path = mediaPath(file);
		const { error } = await this.client.storage.from(this.bucket).upload(path, file, {
			contentType: file.type,
			cacheControl: "31536000",
			upsert: false,
		});
		if (error) throw new Error(`Supabase Storage: upload failed: ${error.message}`);
		const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
		return { url: data.publicUrl, path };
	}
}
