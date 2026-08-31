// Contact-form messages. POST is public (the contact form submits here).
// GET/PUT require an authenticated admin session (the admin panel reads
// and updates the inbox).
import { requireAuth, json } from "../_lib/auth.js";
import { sendEmail } from "../_lib/email.js";

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
      await sendEmail(env, {
        to: account.email,
        replyTo: safeEmail || undefined,
        subject: "Yeni mesaj: " + (name || "İsimsiz"),
        html:
          `<p><strong>${escapeHtml(name || "İsimsiz")}</strong> iletişim formundan yeni bir mesaj gönderdi.</p>` +
          `<p><strong>E-posta:</strong> ${escapeHtml(email || "—")}</p>` +
          `<p><strong>Mesaj:</strong><br>${escapeHtml(text).replace(/\n/g, "<br>")}</p>` +
          `<p style="color:#888;font-size:12px">Admin panelinden de görüntüleyebilirsin: /Admin Paneli.dc.html</p>`,
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
