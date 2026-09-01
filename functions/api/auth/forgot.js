import { json, RESET_TTL_SECONDS } from "../../_lib/auth.js";
import { sendEmail, emailTemplate, getSiteNavLinks } from "../../_lib/email.js";

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
      subject: "Şifre sıfırlama isteği",
      html: emailTemplate({
        preheader: "Admin panelin için bir şifre sıfırlama isteği aldık.",
        title: "Şifre sıfırlama isteği",
        bodyHtml:
          `<p style="margin:0 0 12px">Admin panelin için bir şifre sıfırlama isteği aldık. Devam etmek için aşağıdaki butona tıkla.</p>` +
          `<p style="margin:0;font-size:12px;color:#9a9696">Bu bağlantı 15 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin, şifren değişmeyecektir.</p>`,
        ctaLabel: "Şifreni Sıfırla",
        ctaUrl: resetUrl,
        navLinks: await getSiteNavLinks(env, "tr"),
        lang: "tr",
      }),
    });
  } catch (e) {
    console.error("forgot-password email failed", e);
  }

  return generic;
}
