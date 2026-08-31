// Admin replies to an inbound contact-form message. Sends a branded email
// from the site's own address straight to the visitor, so the admin never
// has to leave the panel or use their personal mail client.
import { requireAuth, json } from "../../_lib/auth.js";
import { sendEmail, emailTemplate, getSiteNavLinks } from "../../_lib/email.js";

const MAX_MESSAGES = 500;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function onRequestPost({ request, env }) {
  const session = await requireAuth(request, env);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const reply = typeof body.reply === "string" ? body.reply.trim().slice(0, 4000) : "";
  if (!id || !reply) return json({ error: "Yanıt boş olamaz." }, { status: 400 });

  const raw = await env.SITE_KV.get("site:messages");
  const list = raw ? JSON.parse(raw) : [];
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return json({ error: "Mesaj bulunamadı." }, { status: 404 });

  const message = list[idx];
  if (!/^\S+@\S+\.\S+$/.test(message.email || "")) {
    return json({ error: "Bu mesajda geçerli bir e-posta adresi yok." }, { status: 400 });
  }

  const accountRaw = await env.SITE_KV.get("admin:account");
  const account = accountRaw ? JSON.parse(accountRaw) : null;

  const bodyHtml =
    `<p style="margin:0 0 20px;white-space:pre-wrap">${escapeHtml(reply)}</p>` +
    `<div style="border-left:3px solid #d7d3d3;padding-left:14px">` +
    `<p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9a9696">Senin mesajın</p>` +
    `<p style="margin:0;font-size:13px;color:#7d7979;white-space:pre-wrap">${escapeHtml(message.body || "")}</p>` +
    `</div>`;

  try {
    await sendEmail(env, {
      to: message.email,
      replyTo: account ? account.email : undefined,
      subject: "Mesajınıza yanıt",
      html: emailTemplate({
        preheader: reply.slice(0, 120),
        title: "Mesajına bir yanıt geldi",
        bodyHtml,
        navLinks: await getSiteNavLinks(env, message.lang === "en" ? "en" : "tr"),
      }),
    });
  } catch (e) {
    console.error("reply email failed", e);
    return json({ error: "Mail gönderilemedi." }, { status: 502 });
  }

  list[idx] = { ...message, replied: true, repliedAt: Date.now() };
  await env.SITE_KV.put("site:messages", JSON.stringify(list.slice(0, MAX_MESSAGES)));

  return json({ ok: true });
}
