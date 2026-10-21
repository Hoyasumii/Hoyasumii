import { type MediaStorage, mediaPath } from "./media-storage";

/** Dev/test storage: keeps nothing and returns the file inline as a data URL. */
export class MemoryMediaStorage implements MediaStorage {
	async upload(file: File) {
		const bytes = new Uint8Array(await file.arrayBuffer());
		let binary = "";
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return { url: `data:${file.type};base64,${btoa(binary)}`, path: mediaPath(file) };
	}
}
