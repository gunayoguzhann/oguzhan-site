// Site CMS content. GET is public (the live site reads it to render). PUT
// requires an authenticated admin session (the admin panel writes it).
import { requireAuth, json } from "../_lib/auth.js";

export async function onRequestGet({ env }) {
  const raw = await env.SITE_KV.get("site:content");
  return json(raw ? JSON.parse(raw) : {});
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
  await env.SITE_KV.put("site:content", JSON.stringify(body));
  return json({ ok: true });
}
