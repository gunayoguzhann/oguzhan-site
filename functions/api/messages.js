// Contact-form messages. POST is public (the contact form submits here).
// GET/PUT require an authenticated admin session (the admin panel reads
// and updates the inbox).
import { requireAuth, json } from "../_lib/auth.js";
import { sendEmail, emailTemplate, getSiteNavLinks } from "../_lib/email.js";

const MAX_MESSAGES = 500;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function onRequestGet({ request, env }) {
  const session = await requireAuth(request, env);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });
  const raw = await env.SITE_KV.get("site:messages");
  return json(raw ? JSON.parse(raw) : []);
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name.slice(0, 200) : "";
  const email = typeof body.email === "string" ? body.email.slice(0, 200) : "";
  const text = typeof body.body === "string" ? body.body.slice(0, 4000) : "";
  const lang = body.lang === "en" ? "en" : "tr";
  if (!text.trim()) return json({ error: "Mesaj boş olamaz." }, { status: 400 });

  const raw = await env.SITE_KV.get("site:messages");
  const list = raw ? JSON.parse(raw) : [];
  const mo = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const d = new Date();
  list.unshift({
    id: crypto.randomUUID(),
    name: name || "İsimsiz",
    email: email || "—",
    body: text,
    lang,
    date: `${d.getDate()} ${mo[d.getMonth()]}`,
    read: false,
    open: false,
  });
  await env.SITE_KV.put("site:messages", JSON.stringify(list.slice(0, MAX_MESSAGES)));

  try {
    const accountRaw = await env.SITE_KV.get("admin:account");
    if (accountRaw) {
      const account = JSON.parse(accountRaw);
      const safeEmail = /^\S+@\S+\.\S+$/.test(email) ? email : null;
      const origin = new URL(request.url).origin;
      const displayName = escapeHtml(name || "İsimsiz");
      const bodyHtml =
        `<p style="margin:0 0 16px"><strong>${displayName}</strong> iletişim formundan yeni bir mesaj gönderdi.</p>` +
        `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;border:1px solid #d7d3d3">` +
        `<tr><td style="padding:10px 14px;border-bottom:1px solid #d7d3d3;width:80px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#7d7979">İsim</td><td style="padding:10px 14px;border-bottom:1px solid #d7d3d3;font-size:14px;color:#201e1d">${displayName}</td></tr>` +
        `<tr><td style="padding:10px 14px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#7d7979">E-posta</td><td style="padding:10px 14px;font-size:14px;color:#201e1d">${escapeHtml(email || "—")}</td></tr>` +
        `</table>` +
        `<p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#7d7979">Mesaj</p>` +
        `<p style="margin:0;white-space:pre-wrap">${escapeHtml(text)}</p>`;
      await sendEmail(env, {
        to: account.email,
        replyTo: safeEmail || undefined,
        subject: "Yeni mesaj: " + (name || "İsimsiz"),
        html: emailTemplate({
          preheader: text.slice(0, 120),
          title: "Yeni bir mesajın var",
          bodyHtml,
          ctaLabel: "Admin Panelini Aç",
          ctaUrl: `${origin}/admin`,
          navLinks: await getSiteNavLinks(env, lang),
        }),
      });
    }
  } catch (e) {
    console.error("contact notification email failed", e);
  }

  return json({ ok: true });
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
  if (!Array.isArray(body)) return json({ error: "Invalid payload." }, { status: 400 });
  await env.SITE_KV.put("site:messages", JSON.stringify(body.slice(0, MAX_MESSAGES)));
  return json({ ok: true });
}
