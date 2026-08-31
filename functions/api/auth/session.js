import { getSession, json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env);
  const accountRaw = await env.SITE_KV.get("admin:account");
  return json({
    authed: !!session,
    email: session ? session.email : null,
    setupDone: !!accountRaw,
  });
}
