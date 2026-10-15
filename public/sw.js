/* FjaloriShqip — service worker: makes the site installable and shows the daily notifications.
 * No offline mode on purpose: there is no fetch handler, so every page comes from the network as usual
 * (and every visit is counted). The pushes carry no data: on each one this script reads today's word and
 * proverb from /api/v1/njoftime.json (built by scripts/build-site.ts) and shows one of them. */
"use strict";

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

/** Today's date in Albania (Europe/Tirane), "2026-10-15". */
function todayInAlbania() {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10);
  }
}

self.addEventListener("push", function (event) {
  // the morning push brings the word of the day, the evening push the proverb
  var evening = new Date().getUTCHours() >= 12;
  event.waitUntil(
    fetch("/api/v1/njoftime.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var day = data.dite[todayInAlbania()] || data.dite[Object.keys(data.dite)[0]];
        var n = evening ? day.fjaleUrte : day.fjala;
        return self.registration.showNotification(n.titulli, {
          body: n.teksti,
          icon: "/icon-512.png",
          badge: "/icon-192.png",
          lang: "sq",
          tag: evening ? "fjala-e-urte" : "fjala-e-dites",
          data: { url: n.url },
        });
      })
      .catch(function () {
        return self.registration.showNotification("FjaloriShqip", { body: "Fjala e ditës ju pret.", icon: "/icon-512.png", data: { url: "/" } });
      }),
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || "/";
  // through /hap, so the opening is counted as coming from a notification
  var open = "/hap?burim=njoftim&te=" + encodeURIComponent(target);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("navigate" in list[i]) return list[i].navigate(open).then(function (c) { return c && c.focus(); });
      }
      return self.clients.openWindow(open);
    }),
  );
});
