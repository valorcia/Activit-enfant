/* Notifications de l'équipe (admin installée sur le téléphone). Aucun cache : uniquement les notifications. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Boutique", body: event.data ? event.data.text() : "" }; }
  const title = data.title || "Boutique";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icons/equipe-192.png",
    badge: "/icons/equipe-badge.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/admin" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/admin", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of windows) {
      if (w.url.startsWith(self.location.origin)) { await w.focus(); return w.navigate ? w.navigate(url) : undefined; }
    }
    return self.clients.openWindow(url);
  })());
});
