// Site CMS content. GET is public (the live site reads it to render). PUT
// requires an authenticated admin session (the admin panel writes it).
import { requireAuth, json } from "../_lib/auth.js";

export async function onRequestGet({ env }) {
  const raw = await env.SITE_KV.get("site:content");
  return json(raw ? JSON.parse(raw) : {});
}

const ROUTE_PAGES = ["home", "about", "projects", "contact"];
const ROUTE_LANGS = ["tr", "en"];

// When a page's URL slug changes, keep the old one as a standing alias so
// links people already have (bookmarks, shares, search results) keep
// working instead of breaking the moment the admin renames a route.
function migrateRouteAliases(prev, next) {
  const prevRoutes = prev.routes || {};
  const nextRoutes = next.routes || {};
  const aliases = Array.isArray(prev.routeAliases) ? prev.routeAliases.slice() : [];
  ROUTE_PAGES.forEach((page) => {
    ROUTE_LANGS.forEach((lang) => {
      const oldSlug = prevRoutes[page] && prevRoutes[page][lang];
      const newSlug = nextRoutes[page] && nextRoutes[page][lang];
      if (!oldSlug || !newSlug || oldSlug === newSlug) return;
      const alreadyAliased = aliases.some((a) => a.page === page && a.lang === lang && a.slug === oldSlug);
      const collidesWithCurrent = ROUTE_PAGES.some((p) => nextRoutes[p] && nextRoutes[p][lang] === oldSlug);
      if (!alreadyAliased && !collidesWithCurrent) aliases.push({ page, lang, slug: oldSlug });
    });
  });
  return aliases.slice(-200);
}

export async function onRequestPut({ request, env }) {
  const session = await requireAuth(request, env);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const prevRaw = await env.SITE_KV.get("site:content");
    const prev = prevRaw ? JSON.parse(prevRaw) : {};
    const aliases = migrateRouteAliases(prev, body);
    if (aliases.length) body.routeAliases = aliases;
  } catch (e) {}

  await env.SITE_KV.put("site:content", JSON.stringify(body));
  return json({ ok: true });
}
