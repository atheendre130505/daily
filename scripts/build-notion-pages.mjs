// Converts import/notion/pages-raw.txt (Notion-flavoured markdown) into import/notion/pages.json
// (plain markdown per page, images pointing at /notion-images/). Run: node scripts/build-notion-pages.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const raw = readFileSync("import/notion/pages-raw.txt", "utf8").replace(/\r\n/g, "\n");
const chunks = raw.split(/^=== /m).slice(1);

export function notionToMarkdown(src) {
  let s = src;
  // images → local files saved by download-notion-images.mjs
  s = s.replace(/<image source="notion-file-block:\/\/[^/]+\/([0-9a-f-]+)\?[^"]*?name=([^"&]+)"\s*\/>/g, (_m, fileId, name) => {
    const ext = (name.match(/\.[a-z0-9]+$/i) ?? [".png"])[0];
    const file = `public/notion-images/${fileId}${ext}`;
    if (!existsSync(file)) console.warn("missing image", file);
    return `\n\n![](/notion-images/${fileId}${ext})\n\n`;
  });
  // lists written as HTML (one item per line, no blank lines between items)
  s = s.replace(/<li>\s*([\s\S]*?)\s*<\/li>\s*/g, (_m, body) => `- ${body.replace(/\s*\n\s*/g, " ").trim()}\n`);
  s = s.replace(/<\/?ul>\n?/g, "");
  // inline formatting
  s = s.replace(/<b>([\s\S]*?)<\/b>/g, "**$1**").replace(/<i>([\s\S]*?)<\/i>/g, "*$1*");
  // paragraphs and breaks
  s = s.replace(/<p \/>/g, "").replace(/<\/?p>/g, "\n");
  s = s.replace(/(?:<br \/>\s*){2,}/g, "\n\n");
  s = s.replace(/^[ \t]*<br \/>/gm, "").replace(/<br \/>[ \t]*$/gm, "");
  s = s.replace(/<br \/>/g, "  \n");
  // tidy: trim line starts that came from indented HTML, collapse blank runs
  s = s
    .split("\n")
    .map((l) => (l.startsWith(" ") && !l.startsWith("  -") ? l.trimStart() : l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

const pages = chunks.map((chunk) => {
  const nl = chunk.indexOf("\n");
  const [id, parent, icon, title, flags] = chunk.slice(0, nl).split(" | ").map((x) => x.trim());
  return {
    notion_id: id,
    parent_notion_id: parent === "-" ? null : parent,
    title,
    icon: icon === "-" ? null : icon,
    is_template: flags === "template",
    markdown: notionToMarkdown(chunk.slice(nl + 1)),
  };
});

writeFileSync(
  "import/notion/pages.json",
  JSON.stringify({ source: "Notion private pages, exported 2026-11-18", pages }, null, 2) + "\n",
);
console.log(`${pages.length} pages written to import/notion/pages.json`);
