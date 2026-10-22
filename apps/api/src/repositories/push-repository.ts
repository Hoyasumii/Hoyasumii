import type { PushSubscriptionInput } from "@portfolio/shared";

export type StoredSubscription = PushSubscriptionInput & { id: string };

/** Browsers subscribed to release notifications, and which releases were already sent. */
export interface PushRepository {
	/** Adds a subscription, or updates its keys and language when the endpoint is known. */
	subscribe(subscription: PushSubscriptionInput): Promise<void>;
	/** Returns false when the endpoint was not subscribed. */
	unsubscribe(endpoint: string): Promise<boolean>;
	list(): Promise<StoredSubscription[]>;
	count(): Promise<number>;
	remove(ids: string[]): Promise<void>;

	/** Ids of the releases already notified (or skipped). */
	notified(): Promise<Set<string>>;
	markNotified(releaseId: string, recipients: number): Promise<void>;
}

export class MemoryPushRepository implements PushRepository {
	private subscriptions: StoredSubscription[] = [];
	private sent = new Map<string, number>();

	async subscribe(subscription: PushSubscriptionInput) {
		const current = this.subscriptions.find((item) => item.endpoint === subscription.endpoint);
		if (current) Object.assign(current, structuredClone(subscription));
		else this.subscriptions.push({ ...structuredClone(subscription), id: crypto.randomUUID() });
	}

	async unsubscribe(endpoint: string) {
		const before = this.subscriptions.length;
		this.subscriptions = this.subscriptions.filter((item) => item.endpoint !== endpoint);
		return this.subscriptions.length < before;
	}

	async list() {
		return structuredClone(this.subscriptions);
	}

	async count() {
		return this.subscriptions.length;
	}

	async remove(ids: string[]) {
		this.subscriptions = this.subscriptions.filter((item) => !ids.includes(item.id));
	}

	async notified() {
		return new Set(this.sent.keys());
	}

	async markNotified(releaseId: string, recipients: number) {
		this.sent.set(releaseId, recipients);
	}
}
