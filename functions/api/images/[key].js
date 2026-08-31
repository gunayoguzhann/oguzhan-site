// Public image serving from R2. Images are content-addressed (random UUID
// filenames) and immutable once uploaded, so they're safe to cache hard.
export async function onRequestGet({ env, params }) {
  const key = params.key;
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|gif)$/.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const obj = await env.SITE_IMAGES.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
