// Transactional email via Resend (https://resend.com). Requires RESEND_API_KEY
// to be set as a Cloudflare Pages environment secret. EMAIL_FROM should be an
// address on a domain verified in Resend (see Resend dashboard -> Domains);
// until then Resend falls back to its shared onboarding@resend.dev sender.

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

// Shared branded layout for every transactional email the site sends.
// Table-based markup on purpose: it's the layout style that renders
// consistently across Outlook/Gmail/Apple Mail, unlike flexbox/grid.
function emailTemplate({ preheader = "", title, bodyHtml, ctaLabel, ctaUrl }) {
  const cta = ctaUrl
    ? `<tr><td style="padding:4px 40px 32px">
         <table role="presentation" cellpadding="0" cellspacing="0"><tr>
           <td style="background:#ec3013;border:2px solid #201e1d">
             <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none">${ctaLabel}</a>
           </td>
         </tr></table>
       </td></tr>`
    : "";
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#e9e7e6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e9e7e6">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:2px solid #201e1d">
        <tr>
          <td style="padding:22px 40px;border-bottom:2px solid #201e1d">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:30px;height:30px;background:#ec3013;color:#ffffff;font-weight:900;font-size:11px;text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif">NGU</td>
              <td style="padding-left:12px;font-weight:800;font-size:15px;color:#201e1d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">Oğuzhan Günay</td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:32px 40px 6px;font-size:19px;font-weight:800;color:#201e1d">${title}</td></tr>
        <tr><td style="padding:6px 40px 8px;font-size:14px;line-height:1.7;color:#3c3a3a">${bodyHtml}</td></tr>
        ${cta}
        <tr><td style="padding:24px 40px 28px">
          <div style="border-top:1px solid #d7d3d3;padding-top:16px;font-size:11px;line-height:1.6;color:#9a9696;letter-spacing:.02em">
            Bu e-posta oguzhangunay.com üzerinden otomatik olarak gönderildi.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export { sendEmail, emailTemplate };
