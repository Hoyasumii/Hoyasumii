/**
 * The part of node:async_hooks the API uses. Workers provide it with the nodejs_compat flag, but
 * @cloudflare/workers-types does not declare it, and @types/node would bring Node's globals along.
 */
declare module "node:async_hooks" {
	export class AsyncLocalStorage<T> {
		getStore(): T | undefined;
		run<R>(store: T, callback: () => R): R;
	}
}
