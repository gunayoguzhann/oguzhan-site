import { parseCookies, clearSessionCookieHeader, json, SESSION_COOKIE } from "../../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (token) await env.SITE_KV.delete(`session:${token}`);
  return json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookieHeader() } });
}
