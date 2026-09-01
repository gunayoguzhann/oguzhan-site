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

// Home/Projects/About slugs used to build the footer nav row, mirroring the
// admin-editable routes in site:content (functions/api/content.js). Falls
// back to these when the admin hasn't customized a route yet.
const DEFAULT_ROUTES = {
  home: { tr: "anasayfa", en: "home" },
  projects: { tr: "projeler", en: "projects" },
  about: { tr: "hakkinda", en: "about" },
};

const NAV_LABELS = {
  tr: { home: "Anasayfa", projects: "Projeler", about: "Hakkında" },
  en: { home: "Home", projects: "Projects", about: "About" },
};

// Reads the site's current (possibly admin-renamed) page slugs so the email
// footer's nav links always match what's actually live, in whichever
// language the triggering action happened in.
async function getSiteNavLinks(env, lang) {
  const safeLang = lang === "en" ? "en" : "tr";
  let routes = DEFAULT_ROUTES;
  try {
    const raw = await env.SITE_KV.get("site:content");
    const content = raw ? JSON.parse(raw) : null;
    if (content && content.routes) {
      routes = {
        home: { ...DEFAULT_ROUTES.home, ...(content.routes.home || {}) },
        projects: { ...DEFAULT_ROUTES.projects, ...(content.routes.projects || {}) },
        about: { ...DEFAULT_ROUTES.about, ...(content.routes.about || {}) },
      };
    }
  } catch (e) {}
  const labels = NAV_LABELS[safeLang];
  const slug = (page) => routes[page][safeLang] || DEFAULT_ROUTES[page][safeLang];
  return [
    { key: "home", label: labels.home, href: `https://oguzhangunay.com/${slug("home")}` },
    { key: "projects", label: labels.projects, href: `https://oguzhangunay.com/${slug("projects")}` },
    { key: "about", label: labels.about, href: `https://oguzhangunay.com/${slug("about")}` },
  ];
}

const ATTRIBUTION = {
  tr: "Bu e-posta oguzhangunay.com üzerinden otomatik olarak gönderildi.",
  en: "This email was sent automatically via oguzhangunay.com.",
};

// Shared branded layout for every transactional email the site sends.
// Table-based markup on purpose: it's the layout style that renders
// consistently across Outlook/Gmail/Apple Mail, unlike flexbox/grid.
function emailTemplate({ preheader = "", title, bodyHtml, ctaLabel, ctaUrl, navLinks, lang }) {
  const safeLang = lang === "en" ? "en" : "tr";
  const cta = ctaUrl
    ? `<tr><td style="padding:4px 40px 32px">
         <table role="presentation" cellpadding="0" cellspacing="0"><tr>
           <td style="background:#ec3013;border:2px solid #201e1d">
             <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#ffffff;text-decoration:none">${ctaLabel}</a>
           </td>
         </tr></table>
       </td></tr>`
    : "";

  const nav =
    Array.isArray(navLinks) && navLinks.length
      ? `<tr><td style="padding:4px 40px 28px">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:2px solid #201e1d">
             <tr>
               ${navLinks
                 .map(
                   (n, i) => `<td width="${Math.round(100 / navLinks.length)}%" style="background:#ffcf40;padding:14px 12px;vertical-align:top${i < navLinks.length - 1 ? ";border-right:2px solid #201e1d" : ""}">
                     <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:10px;font-weight:800;color:#201e1d;letter-spacing:.08em">0${i + 1}</div>
                     <a href="${n.href}" style="display:block;margin-top:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;font-weight:800;color:#201e1d;text-decoration:none">${n.label} →</a>
                   </td>`
                 )
                 .join("")}
             </tr>
           </table>
         </td></tr>`
      : "";

  return `<!doctype html>
<html lang="${safeLang}">
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
        ${nav}
        <tr><td style="padding:8px 40px 24px">
          <div style="border-top:1px solid #d7d3d3;padding-top:16px;font-size:11px;line-height:1.6;color:#9a9696;letter-spacing:.02em">
            ${ATTRIBUTION[safeLang]}
          </div>
        </td></tr>
        <tr><td style="background:#ec3013;padding:26px 40px">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:26px;line-height:1.05;letter-spacing:-0.01em;color:#ffffff">NEVER<br>GIVE UP</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export { sendEmail, emailTemplate, getSiteNavLinks };
