// One-time bootstrap: creates the single admin account. Refuses once an
// account already exists, and refuses unless the caller supplies the
// SETUP_TOKEN secret configured in the Pages project's environment variables
// (so a stranger who finds this URL before you finish setup can't hijack it).
import { hashPassword, json } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.SETUP_TOKEN) {
    return json({ error: "Kurulum devre dışı. Önce SETUP_TOKEN ortam değişkenini tanımla." }, { status: 403 });
  }
  const existing = await env.SITE_KV.get("admin:account");
  if (existing) {
    return json({ error: "Bir admin hesabı zaten mevcut." }, { status: 409 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { email, password, setupToken } = body || {};

  if (typeof setupToken !== "string" || setupToken !== env.SETUP_TOKEN) {
    return json({ error: "Kurulum anahtarı yanlış." }, { status: 403 });
  }
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
  }
  if (typeof password !== "string" || !/^\d{6}$/.test(password)) {
    return json({ error: "Şifre 6 haneli rakamlardan oluşmalı." }, { status: 400 });
  }

  const { hash, salt } = await hashPassword(password);
  await env.SITE_KV.put(
    "admin:account",
    JSON.stringify({ email: email.toLowerCase().trim(), hash, salt, sessionEpoch: 0, createdAt: Date.now() })
  );
  return json({ ok: true });
}
