import {
  verifyPassword,
  json,
  clientIp,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
  sessionCookieHeader,
  SESSION_TTL_SECONDS,
} from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const ip = clientIp(request);
  const allowed = await checkLoginRateLimit(env, ip);
  if (!allowed) {
    return json({ error: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene." }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const { email, password } = body || {};

  const raw = await env.SITE_KV.get("admin:account");
  if (!raw) {
    return json({ error: "Admin hesabı henüz kurulmadı." }, { status: 400 });
  }
  const account = JSON.parse(raw);

  const suppliedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
  const suppliedPassword = typeof password === "string" ? password : "";
  // Always run the password hash even on an email mismatch, so response
  // timing doesn't leak whether the email was correct.
  const passOk = await verifyPassword(suppliedPassword, account.hash, account.salt);
  const emailOk = suppliedEmail === account.email;

  if (!emailOk || !passOk) {
    await recordLoginFailure(env, ip);
    return json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }

  await clearLoginFailures(env, ip);
  const token = crypto.randomUUID();
  await env.SITE_KV.put(
    `session:${token}`,
    JSON.stringify({ email: account.email, createdAt: Date.now(), sessionEpoch: account.sessionEpoch || 0 }),
    { expirationTtl: SESSION_TTL_SECONDS }
  );

  return json(
    { ok: true, email: account.email },
    { headers: { "Set-Cookie": sessionCookieHeader(token, SESSION_TTL_SECONDS) } }
  );
}
