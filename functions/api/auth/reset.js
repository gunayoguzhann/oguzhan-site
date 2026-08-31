import { hashPassword, json } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { token, password } = body || {};

  if (typeof token !== "string" || !token) {
    return json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 400 });
  }
  const raw = await env.SITE_KV.get("reset:" + token);
  if (!raw) {
    return json({ error: "Bağlantı geçersiz veya süresi dolmuş." }, { status: 400 });
  }
  if (typeof password !== "string" || !/^\d{6}$/.test(password)) {
    return json({ error: "Şifre 6 haneli rakamlardan oluşmalı." }, { status: 400 });
  }

  const { email } = JSON.parse(raw);
  const { hash, salt } = await hashPassword(password);
  const accountRaw = await env.SITE_KV.get("admin:account");
  const account = accountRaw ? JSON.parse(accountRaw) : {};
  // Bumping sessionEpoch invalidates every session issued before this reset
  // (see getSession in _lib/auth.js) — a stolen session cookie doesn't
  // survive the very password reset meant to lock it out.
  await env.SITE_KV.put(
    "admin:account",
    JSON.stringify({ ...account, email, hash, salt, sessionEpoch: (account.sessionEpoch || 0) + 1, updatedAt: Date.now() })
  );
  await env.SITE_KV.delete("reset:" + token);

  return json({ ok: true });
}
