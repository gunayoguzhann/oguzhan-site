// Shared auth helpers for Pages Functions: password hashing, sessions, cookies, rate limiting.
// All state lives in the SITE_KV namespace bound in the Cloudflare Pages project settings.

const PBKDF2_ITERATIONS = 100000;
const SESSION_COOKIE = "__session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days — stay logged in on trusted devices
const RESET_TTL_SECONDS = 60 * 15; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_TTL_SECONDS = 60 * 15;

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyPassword(password, storedHash, saltHex) {
  const { hash } = await hashPassword(password, saltHex);
  return timingSafeEqual(hash, storedHash);
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function sessionCookieHeader(token, maxAgeSeconds) {
  return [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "Secure", "SameSite=Strict", `Max-Age=${maxAgeSeconds}`].join("; ");
}

function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function getSession(request, env) {
  const cookies = parseCookies(request);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  const raw = await env.SITE_KV.get(`session:${token}`);
  if (!raw) return null;
  let session;
  try {
    session = { token, ...JSON.parse(raw) };
  } catch (e) {
    return null;
  }
  // A password reset bumps the account's sessionEpoch, which immediately
  // invalidates every session issued before it (defends against a stolen
  // session cookie surviving a password reset meant to lock the attacker out).
  const accountRaw = await env.SITE_KV.get("admin:account");
  if (!accountRaw) return null;
  const account = JSON.parse(accountRaw);
  if ((session.sessionEpoch || 0) !== (account.sessionEpoch || 0)) return null;
  return session;
}

async function requireAuth(request, env) {
  return getSession(request, env);
}

function json(data, init) {
  return new Response(JSON.stringify(data), {
    ...(init || {}),
    headers: { "Content-Type": "application/json", ...((init && init.headers) || {}) },
  });
}

function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

async function checkLoginRateLimit(env, ip) {
  const raw = await env.SITE_KV.get(`loginfail:${ip}`);
  const attempts = raw ? parseInt(raw, 10) : 0;
  return attempts < LOGIN_MAX_ATTEMPTS;
}

async function recordLoginFailure(env, ip) {
  const key = `loginfail:${ip}`;
  const raw = await env.SITE_KV.get(key);
  const attempts = (raw ? parseInt(raw, 10) : 0) + 1;
  await env.SITE_KV.put(key, String(attempts), { expirationTtl: LOGIN_LOCKOUT_TTL_SECONDS });
}

async function clearLoginFailures(env, ip) {
  await env.SITE_KV.delete(`loginfail:${ip}`);
}

export {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  RESET_TTL_SECONDS,
  hashPassword,
  verifyPassword,
  parseCookies,
  sessionCookieHeader,
  clearSessionCookieHeader,
  getSession,
  requireAuth,
  json,
  clientIp,
  checkLoginRateLimit,
  recordLoginFailure,
  clearLoginFailures,
};
