// Transactional email via Resend (https://resend.com). Requires RESEND_API_KEY
// to be set as a Cloudflare Pages environment secret.

async function sendEmail(env, { to, subject, html, replyTo }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const from = env.EMAIL_FROM || "Oğuzhan Günay <onboarding@resend.dev>";
  const payload = { from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${text}`);
  }
  return res.json();
}

export { sendEmail };
