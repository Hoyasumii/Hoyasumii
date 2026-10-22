// Service worker for release notifications (Web Push). The API sends { title, body, url, tag, icon }.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
	let message = {};
	try {
		message = event.data ? event.data.json() : {};
	} catch {
		message = { body: event.data ? event.data.text() : "" };
	}
	event.waitUntil(
		self.registration.showNotification(message.title || "hoyasumii.dev", {
			body: message.body || "",
			tag: message.tag,
			icon: message.icon,
			data: { url: message.url || self.registration.scope },
		}),
	);
});

// Opens the release, or focuses a tab already showing it.
self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data?.url || self.registration.scope;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			const open = windows.find((client) => client.url === url);
			return open ? open.focus() : self.clients.openWindow(url);
		}),
	);
});
