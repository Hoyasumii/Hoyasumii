/**
 * Web Push with the Web Crypto API only, so it runs on Workers: VAPID authentication (RFC 8292)
 * and payload encryption with aes128gcm (RFC 8291 over RFC 8188).
 */

export type VapidKeys = {
	/** Uncompressed P-256 public key (65 bytes), base64url. Browsers subscribe with it. */
	publicKey: string;
	/** P-256 private scalar (32 bytes), base64url. */
	privateKey: string;
	/** Contact for push services: "mailto:..." or an https URL. */
	subject: string;
};

/** Where to deliver and the keys of the browser that subscribed (PushSubscription.toJSON()). */
export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

export type PushOptions = {
	/** Seconds the push service keeps the message while the device is offline. */
	ttl?: number;
	urgency?: "very-low" | "low" | "normal" | "high";
};

const encoder = new TextEncoder();
const RECORD_SIZE = 4096;

export function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
	const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

async function hkdf(
	salt: Uint8Array<ArrayBuffer>,
	ikm: Uint8Array<ArrayBuffer>,
	info: Uint8Array<ArrayBuffer>,
	length: number,
) {
	const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
	return new Uint8Array(bits);
}

/** Creates a VAPID key pair; run once (see scripts/vapid.ts) and keep the private key secret. */
export async function generateVapidKeys(): Promise<Omit<VapidKeys, "subject">> {
	const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
		"sign",
		"verify",
	])) as CryptoKeyPair;
	const publicKey = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
	const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
	return { publicKey: base64url(publicKey), privateKey: jwk.d as string };
}

function signingKey({ publicKey, privateKey }: VapidKeys): Promise<CryptoKey> {
	const point = fromBase64url(publicKey);
	if (point.length !== 65 || point[0] !== 4) throw new Error("VAPID public key must be an uncompressed P-256 point");
	return crypto.subtle.importKey(
		"jwk",
		{
			kty: "EC",
			crv: "P-256",
			x: base64url(point.slice(1, 33)),
			y: base64url(point.slice(33, 65)),
			d: privateKey,
			ext: true,
		},
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);
}

/** The Authorization header for one push service (the JWT audience is the endpoint's origin). */
export async function vapidAuthorization(vapid: VapidKeys, endpoint: string, now = Date.now()): Promise<string> {
	const header = base64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
	const claims = base64url(
		encoder.encode(
			JSON.stringify({
				aud: new URL(endpoint).origin,
				// Push services refuse tokens valid for more than 24 hours.
				exp: Math.floor(now / 1000) + 12 * 60 * 60,
				sub: vapid.subject,
			}),
		),
	);
	const unsigned = `${header}.${claims}`;
	// Web Crypto signs ECDSA as r || s, which is the JWS encoding already.
	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		await signingKey(vapid),
		encoder.encode(unsigned),
	);
	return `vapid t=${unsigned}.${base64url(new Uint8Array(signature))}, k=${vapid.publicKey}`;
}

/** Encrypts a payload for one subscription (a single aes128gcm record). */
export async function encryptPayload(
	target: PushTarget,
	payload: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
	const clientPublic = fromBase64url(target.keys.p256dh);
	const authSecret = fromBase64url(target.keys.auth);
	if (clientPublic.length !== 65) throw new Error("p256dh must be an uncompressed P-256 point");
	if (authSecret.length !== 16) throw new Error("auth must be 16 bytes");
	if (payload.length > RECORD_SIZE - 17 - 86) throw new Error("Push payload is too large");

	const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
		"deriveBits",
	])) as CryptoKeyPair;
	const localPublic = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
	const clientKey = await crypto.subtle.importKey(
		"raw",
		clientPublic,
		{ name: "ECDH", namedCurve: "P-256" },
		false,
		[],
	);
	const shared = new Uint8Array(
		await crypto.subtle.deriveBits({ name: "ECDH", public: clientKey }, local.privateKey, 256),
	);

	// RFC 8291 §3.4: mix the auth secret and both public keys into the input keying material.
	const ikm = await hkdf(authSecret, shared, concat(encoder.encode("WebPush: info\0"), clientPublic, localPublic), 32);
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const contentKey = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
	const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);

	const key = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
	// One record: the payload followed by the last-record delimiter (0x02), no padding.
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))),
	);

	const header = new Uint8Array(16 + 4 + 1 + localPublic.length);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, RECORD_SIZE);
	header[20] = localPublic.length;
	header.set(localPublic, 21);
	return concat(header, ciphertext);
}

/** Sends one encrypted message; the push service's response tells whether the subscription is gone. */
export async function sendPush(
	vapid: VapidKeys,
	target: PushTarget,
	payload: string,
	options: PushOptions = {},
	fetcher: typeof fetch = fetch,
): Promise<Response> {
	const body = await encryptPayload(target, encoder.encode(payload));
	const headers: Record<string, string> = {
		Authorization: await vapidAuthorization(vapid, target.endpoint),
		"Content-Encoding": "aes128gcm",
		"Content-Type": "application/octet-stream",
		TTL: String(options.ttl ?? 24 * 60 * 60),
		Urgency: options.urgency ?? "normal",
	};
	return fetcher(target.endpoint, { method: "POST", headers, body });
}
