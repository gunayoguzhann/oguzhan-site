import { json, RESET_TTL_SECONDS } from "../../_lib/auth.js";
import { sendEmail } from "../../_lib/email.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }

  // Always answer identically whether the email matched or not, so this
  // endpoint can't be used to discover the admin's registered address.
  const generic = json({ ok: true, message: "Bu e-posta kayıtlıysa bir sıfırlama bağlantısı gönderildi." });

  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email) return generic;

  const raw = await env.SITE_KV.get("admin:account");
  if (!raw) return generic;
  const account = JSON.parse(raw);
  if (email !== account.email) return generic;

  const token = crypto.randomUUID() + crypto.randomUUID();
  await env.SITE_KV.put("reset:" + token, JSON.stringify({ email: account.email }), {
    expirationTtl: RESET_TTL_SECONDS,
  });

  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/admin?reset=${token}`;
  try {
    await sendEmail(env, {
      to: account.email,
      subject: "Şifre sıfırlama - Admin Paneli",
      html:
        `<p>Admin panelin için bir şifre sıfırlama isteği aldık.</p>` +
        `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
        `<p>Bu bağlantı 15 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>`,
    });
  } catch (e) {
    console.error("forgot-password email failed", e);
  }

  return generic;
}
