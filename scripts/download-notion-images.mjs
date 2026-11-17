// Downloads Notion images (signed S3 links that expire after 5 minutes) into public/notion-images/<fileId>.<ext>.
// Usage: node scripts/download-notion-images.mjs batch.json
// batch.json = { cred, date, token, files: [[fileId, name, signature], ...] }  (space id is fixed below)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const SPACE = "f8be3255-91ea-8105-9904-00036cffe658";
const OUT = path.resolve("public/notion-images");
mkdirSync(OUT, { recursive: true });

const batch = JSON.parse(readFileSync(process.argv[2], "utf8"));
let ok = 0;
for (const [fileId, name, sig] of batch.files) {
  const ext = path.extname(name) || ".png";
  const dest = path.join(OUT, fileId + ext);
  if (existsSync(dest)) {
    ok++;
    continue;
  }
  // cred and token are kept exactly as they appear (already URL-encoded) in Notion's link.
  const q =
    `X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=${batch.cred}` +
    `&X-Amz-Date=${batch.date}&X-Amz-Expires=300&X-Amz-Security-Token=${batch.token}&X-Amz-Signature=${sig}` +
    `&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject`;
  const url = `https://prod-files-secure.s3.us-west-2.amazonaws.com/${SPACE}/${fileId}/${name}?${q}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("FAILED", fileId, res.status);
    continue;
  }
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  ok++;
}
console.log(`${ok}/${batch.files.length} images saved to public/notion-images`);
