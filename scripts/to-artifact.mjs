// dist-single/index.html(단일 파일 빌드)을 문서 골격 없이 본문만 담은 임베드용 HTML 로 바꾼다.
// 골격(<!doctype>, <html>, <head>, <body>)은 임베드하는 쪽이 감싸 주므로 제목·스타일·스크립트만 남긴다.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'dist-single', 'index.html');
const out = join(root, 'dist-single', 'embed.html');
const html = readFileSync(src, 'utf8');

const pick = (re) => Array.from(html.matchAll(re), (m) => m[0]);
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>학원비교</title>';
const fonts = pick(/<link[^>]+href="https:\/\/fonts\.(googleapis|gstatic)\.com[^"]*"[^>]*>/g);
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g);
const scripts = pick(/<script[^>]*>[\s\S]*?<\/script>/g);
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/) ?? [, ''])[1].replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').trim();

const result = [title, ...fonts, ...styles, body, ...scripts].join('\n');
writeFileSync(out, result);
console.log(`embed.html: ${(result.length / 1024).toFixed(0)} KB`);
