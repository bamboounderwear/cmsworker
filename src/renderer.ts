import type { Env } from "./env";

export type RenderInput = {
  templateFile: string; // e.g. "home.html"
  data: Record<string, any>;
};

/**
 * Use ASSETS binding to fetch a file from /public.
 * We use https://assets.local as the origin for the binding.
 */
function assetUrl(path: string): URL {
  return new URL(path, "https://assets.local");
}

async function getAssetText(env: Env, path: string): Promise<string> {
  const res = await env.ASSETS.fetch(assetUrl(path));
  if (!res.ok) throw new Error(`Asset not found: ${path}`);
  return await res.text();
}

/**
 * Render flow:
 * 1) Load template from /public/_templates/<templateFile>
 * 2) Replace blocks: {{> header }} pulls from /public/_blocks/header.html
 * 3) Replace data: {{ hero_title }} pulls from page JSON data
 *
 * Note: This is intentionally minimal and does not escape HTML by default.
 */
export async function renderPageHtml(env: Env, input: RenderInput): Promise<string> {
  // 1) Load template
  let html = await getAssetText(env, `/_templates/${input.templateFile}`);

  // 2) Blocks: gather unique block names from template
  const blockNames = new Set<string>();
  for (const match of html.matchAll(/{{\s*>\s*(\w+)\s*}}/g)) {
    blockNames.add(match[1]);
  }

  const blockMap: Record<string, string> = {};
  await Promise.all(
    [...blockNames].map(async (name) => {
      const blockHtml = await getAssetText(env, `/_blocks/${name}.html`);
      blockMap[name] = blockHtml;
    })
  );

  html = html.replace(/{{\s*>\s*(\w+)\s*}}/g, (_, name: string) => blockMap[name] ?? "");

  // 3) Data injection
  html = html.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => {
    const val = input.data?.[key];
    return val == null ? "" : String(val);
  });

  return html;
}
