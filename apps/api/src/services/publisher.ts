const HINTS: Record<number, string> = {
	401: " (GH_DISPATCH_TOKEN is invalid or expired)",
	403: ' (the token needs "Contents: Read and write" on the repository)',
	404: " (the token cannot see GITHUB_REPOSITORY, or the name is wrong)",
};

/** Rebuilds the static website after the content changes. */
export interface Publisher {
	publish(reason: string): Promise<void>;
}

/**
 * Fires a `repository_dispatch` on the website repository; its workflow builds the static site
 * and deploys it to GitHub Pages. The workflow cancels older runs, so bursts of edits end in a
 * single deploy of the latest content.
 */
export class GitHubDispatchPublisher implements Publisher {
	constructor(
		private readonly repository: string,
		private readonly token: string,
		private readonly fetcher?: typeof fetch,
	) {}

	async publish(reason: string) {
		// Workers reject fetch called as a method of another object ("Illegal invocation"), so
		// resolve it first and call it unbound.
		const send = this.fetcher ?? fetch;
		const response = await send(`https://api.github.com/repos/${this.repository}/dispatches`, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${this.token}`,
				"User-Agent": "portfolio-api",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify({ event_type: "content-updated", client_payload: { reason } }),
		});
		if (!response.ok) {
			const body = (await response.json().catch(() => null)) as { message?: string } | null;
			throw new Error(`${response.status} ${body?.message ?? response.statusText}${HINTS[response.status] ?? ""}`);
		}
	}
}

/** Records publishes instead of sending them; used in dev and tests. */
export class NoopPublisher implements Publisher {
	readonly reasons: string[] = [];

	async publish(reason: string) {
		this.reasons.push(reason);
	}
}
