// Image upload for the admin panel (portrait photo, project icons, screenshots).
// Auth-required. Stores the raw bytes in R2 (binding: SITE_IMAGES) instead of
// embedding base64 in the CMS content JSON — the old approach silently blew
// past localStorage's ~5-10MB quota and later would have pushed KV's 25MB
// per-value limit too, plus shipped megabytes of inline images on every
// visitor's page load. Object storage fixes all three.
import { requireAuth, json } from "../_lib/auth.js";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function onRequestPost({ request, env }) {
  const session = await requireAuth(request, env);
  if (!session) return json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("Content-Type") || "";
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    return json({ error: "Desteklenmeyen dosya türü. JPG, PNG, WEBP veya GIF yükleyin." }, { status: 400 });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return json({ error: "Dosya boş." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return json({ error: "Dosya çok büyük (en fazla 8 MB)." }, { status: 413 });
  }

  const key = crypto.randomUUID() + "." + ext;
  await env.SITE_IMAGES.put(key, bytes, { httpMetadata: { contentType } });

  return json({ ok: true, url: "/api/images/" + key });
}
