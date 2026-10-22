/**
 * Creates the Web Push (VAPID) key pair for release notifications.
 *
 *   bun --filter @portfolio/api vapid
 *
 * The public key goes in wrangler.jsonc (VAPID_PUBLIC_KEY); the private key is a secret
 * (VAPID_PRIVATE_KEY in GitHub Actions, or `wrangler secret put VAPID_PRIVATE_KEY`). Changing the
 * keys later drops every subscription, so create them once.
 */
import { generateVapidKeys } from "../src/push/web-push";

const { publicKey, privateKey } = await generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
