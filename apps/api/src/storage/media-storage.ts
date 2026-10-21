export type StoredMedia = { url: string; path: string };

export interface MediaStorage {
	upload(file: File): Promise<StoredMedia>;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/avif",
	"image/gif",
	"image/x-icon",
	"image/vnd.microsoft.icon",
];

const EXTENSIONS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
	"image/avif": "avif",
	"image/gif": "gif",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
};

export function mediaPath(file: File): string {
	const date = new Date().toISOString().slice(0, 7);
	return `${date}/${crypto.randomUUID()}.${EXTENSIONS[file.type] ?? "bin"}`;
}
