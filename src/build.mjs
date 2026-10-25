// 静态站生成器：把 content/ 里的 Markdown 渲染成 docs/ 里的 HTML。
// 用法：npm run build   （或 node src/build.mjs）
// 预览：npm run dev     （构建后起一个本地服务器）

import { readFile, writeFile, mkdir, rm, readdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderMarkdown, escapeHtml as esc } from './markdown.mjs';
import { site } from './site.config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'docs');

const NAV = [
  { href: '/', label: '首页', key: 'home' },
  { href: '/timeline.html', label: '时间轴', key: 'timeline' },
  { href: '/notes/', label: '文档', key: 'notes' },
  { href: '/about.html', label: '关于', key: 'about' },
];

// ---------- 内容读取 ----------

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, '');
    }
    data[key] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

function toTags(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function readCollection(name) {
  const dir = path.join(contentDir, name);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const items = [];

  for (const file of files) {
    const raw = await readFile(path.join(dir, file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    items.push({
      ...data,
      slug: data.slug || file.replace(/\.md$/, ''),
      title: data.title || file.replace(/\.md$/, ''),
      date: data.date || '',
      tags: toTags(data.tags),
      html: renderMarkdown(body),
    });
  }

  return items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// ---------- 小工具 ----------

function fmtDate(value) {
  const s = String(value || '').slice(0, 10);
  const parts = s.split('-');
  if (parts.length < 2) return s;
  return parts.length === 3 ? `${parts[0]}.${parts[1]}.${parts[2]}` : `${parts[0]}.${parts[1]}`;
}

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;
}

function statusBadge(status) {
  if (!status) return '';
  return `<span class="status" data-status="${esc(status)}">${esc(status)}</span>`;
}

// ---------- 布局 ----------

function header(active) {
  const links = NAV.map(
    (item) =>
      `<a href="${item.href}"${item.key === active ? ' aria-current="page"' : ''}>${item.label}</a>`
  ).join('');
  return `<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="/"><span class="brand-dot"></span>${esc(site.name)}<span class="brand-sub">${esc(site.title)}</span></a>
    <nav>${links}</nav>
  </div>
</header>`;
}

function layout({ title, description, active, body }) {
  const pageTitle = title ? `${title} · ${site.title}` : site.title;
  const desc = description || site.description;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(pageTitle)}">
<meta property="og:description" content="${esc(desc)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<a class="skip" href="#main">跳到正文</a>
${header(active)}
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <p>${esc(site.name)} · <span class="mono">${esc(site.handle)}</span></p>
    <p><a href="https://github.com/${esc(site.handle)}" target="_blank" rel="noopener">GitHub</a></p>
  </div>
</footer>
</body>
</html>`;
}

// ---------- 组件 ----------

function isDemo(item) {
  return String(item.demo) === 'true';
}

function demoBanner(item) {
  return isDemo(item)
    ? '<div class="demo-banner">这是一段示例内容，正式发布前请替换成真实经历。</div>'
    : '';
}

function timelineItem(item) {
  return `<li class="tl-item">
  <div class="tl-head">
    <span class="tl-date mono">${fmtDate(item.date)}</span>
    ${statusBadge(item.status)}
  </div>
  <h3><a href="/timeline/${item.slug}.html">${esc(item.title)}</a></h3>
  ${item.summary ? `<p class="tl-summary">${esc(item.summary)}</p>` : ''}
  ${tagChips(item.tags)}
</li>`;
}

function noteCard(note) {
  return `<a class="card" href="/notes/${note.slug}.html">
  <div class="card-kicker"><span class="mono">${fmtDate(note.date)}</span>${note.category ? ` · ${esc(note.category)}` : ''}</div>
  <h3>${esc(note.title)}</h3>
  ${note.summary ? `<p>${esc(note.summary)}</p>` : ''}
  ${tagChips(note.tags)}
</a>`;
}

function sectionHead(title, moreHref, moreLabel) {
  return `<div class="section-head">
  <h2>${esc(title)}</h2>
  ${moreHref ? `<a class="more" href="${moreHref}">${esc(moreLabel || '查看全部')} →</a>` : ''}
</div>`;
}

// ---------- 页面 ----------

function renderHome(timeline, notes) {
  const recent = timeline.slice(0, 4);
  const docCards = notes.slice(0, 6);

  const body = `<section class="hero wrap">
  <p class="eyebrow">${esc(site.tagline)}</p>
  <h1>${esc(site.headline)}</h1>
  <p class="lead">${esc(site.subheadline)}</p>
  <div class="chips">${site.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}</div>
  <div class="stats">
    <div class="stat"><b>${timeline.length}</b><span>次尝试</span></div>
    <div class="stat"><b>${notes.length}</b><span>份文档</span></div>
    <div class="stat"><b>${timeline.length ? fmtDate(timeline[timeline.length - 1].date).slice(0, 4) : '—'}</b><span>起点</span></div>
  </div>
</section>

<div class="wrap">
  ${recent.length ? `<section class="block">${sectionHead('最近的尝试', '/timeline.html', '完整时间轴')}
    <ol class="timeline">${recent.map(timelineItem).join('')}</ol>
  </section>` : ''}

  ${docCards.length ? `<section class="block">${sectionHead('文档与项目', '/notes/', '全部文档')}
    <div class="cards">${docCards.map(noteCard).join('')}</div>
  </section>` : ''}

  <section class="block">
    <div class="cta">
      <p>如果你也在找工作，或者想看看 AI 到底能帮上多少忙——欢迎从时间轴开始看。</p>
      <a class="btn" href="/timeline.html">从头读时间轴</a>
    </div>
  </section>
</div>`;

  return layout({ active: 'home', body });
}

function renderTimelinePage(timeline) {
  const years = [...new Set(timeline.map((i) => String(i.date).slice(0, 4)))].filter(Boolean);
  const groups = years
    .map((year) => {
      const items = timeline.filter((i) => String(i.date).startsWith(year));
      return `<section class="year-block">
  <h2 class="year mono">${year}</h2>
  <ol class="timeline">${items.map(timelineItem).join('')}</ol>
</section>`;
    })
    .join('');

  const body = `<div class="wrap page">
  <header class="page-head">
    <h1>时间轴</h1>
    <p class="lead">从最近往前排。每一条都是一次具体的尝试，点进去看当时怎么想的、做了什么、结果如何。</p>
  </header>
  ${timeline.length ? groups : '<p class="empty">还没有内容。在 content/timeline/ 里加一个 .md 文件就会出现在这里。</p>'}
</div>`;

  return layout({ title: '时间轴', active: 'timeline', body });
}

function renderTimelineDetail(item) {
  const body = `<div class="wrap page">
  <article class="article">
    <a class="back" href="/timeline.html">← 返回时间轴</a>
    <header class="article-head">
      <div class="tl-head">
        <span class="tl-date mono">${fmtDate(item.date)}</span>
        ${statusBadge(item.status)}
      </div>
      <h1>${esc(item.title)}</h1>
      ${item.summary ? `<p class="lead">${esc(item.summary)}</p>` : ''}
      ${tagChips(item.tags)}
    </header>
    ${demoBanner(item)}
    <div class="prose">${item.html}</div>
  </article>
</div>`;
  return layout({
    title: item.title,
    description: item.summary || site.description,
    active: 'timeline',
    body,
  });
}

function renderNotesPage(notes) {
  const body = `<div class="wrap page">
  <header class="page-head">
    <h1>文档</h1>
    <p class="lead">把过程写下来才算真的学会。这里是我为求职和做项目积累的技术文档、工具用法和复盘。</p>
  </header>
  ${notes.length ? `<div class="cards">${notes.map(noteCard).join('')}</div>` : '<p class="empty">还没有文档。在 content/notes/ 里加一个 .md 文件就会出现在这里。</p>'}
</div>`;
  return layout({ title: '文档', active: 'notes', body });
}

function renderNoteDetail(note, notes) {
  const idx = notes.findIndex((n) => n.slug === note.slug);
  const prev = notes[idx + 1];
  const next = notes[idx - 1];

  const nav = prev || next
    ? `<nav class="post-nav">
    ${prev ? `<a href="/notes/${prev.slug}.html"><span>上一篇</span>${esc(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a class="next" href="/notes/${next.slug}.html"><span>下一篇</span>${esc(next.title)}</a>` : '<span></span>'}
  </nav>`
    : '';

  const body = `<div class="wrap page">
  <article class="article">
    <a class="back" href="/notes/">← 返回文档</a>
    <header class="article-head">
      <div class="card-kicker"><span class="mono">${fmtDate(note.date)}</span>${note.category ? ` · ${esc(note.category)}` : ''}</div>
      <h1>${esc(note.title)}</h1>
      ${note.summary ? `<p class="lead">${esc(note.summary)}</p>` : ''}
      ${tagChips(note.tags)}
    </header>
    ${demoBanner(note)}
    <div class="prose">${note.html}</div>
    ${nav}
  </article>
</div>`;

  return layout({
    title: note.title,
    description: note.summary || site.description,
    active: 'notes',
    body,
  });
}

function renderAbout(about) {
  const body = `<div class="wrap page">
  <article class="article">
    <header class="article-head">
      <h1>${esc(about.data.title || '关于')}</h1>
      ${about.data.summary ? `<p class="lead">${esc(about.data.summary)}</p>` : ''}
    </header>
    <div class="prose">${renderMarkdown(about.body)}</div>
    <p class="back"><a href="https://github.com/${esc(site.handle)}" target="_blank" rel="noopener">在我的 GitHub 上看源码 →</a></p>
  </article>
</div>`;
  return layout({ title: '关于', active: 'about', body });
}

function render404() {
  const body = `<div class="wrap page">
  <header class="page-head">
    <p class="eyebrow mono">404</p>
    <h1>这个页面不存在</h1>
    <p class="lead">可能链接过期了，或者这篇还没写完。</p>
    <p><a class="btn" href="/">回首页</a></p>
  </header>
</div>`;
  return layout({ title: '页面不存在', active: '', body });
}

// ---------- 入口 ----------

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#1f6f5c"/>
  <path d="M8.5 11l3.6 10.5L16 12.8l3.9 8.7L23.5 11" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

async function main() {
  const timeline = await readCollection('timeline');
  const notes = await readCollection('notes');

  const aboutPath = path.join(contentDir, 'about.md');
  const about = existsSync(aboutPath)
    ? { data: parseFrontmatter(await readFile(aboutPath, 'utf8')).data,
        body: parseFrontmatter(await readFile(aboutPath, 'utf8')).body }
    : { data: {}, body: '# 关于\n\n这一段还没写。' };

  await rm(outDir, { recursive: true, force: true });
  await mkdir(path.join(outDir, 'assets'), { recursive: true });
  await mkdir(path.join(outDir, 'notes'), { recursive: true });
  await mkdir(path.join(outDir, 'timeline'), { recursive: true });

  // 静态资源
  const css = await readFile(path.join(here, 'styles.css'), 'utf8');
  await writeFile(path.join(outDir, 'assets', 'style.css'), css);
  await writeFile(path.join(outDir, 'assets', 'favicon.svg'), FAVICON);

  // 图片等媒体文件（可选）
  const mediaDir = path.join(contentDir, 'media');
  if (existsSync(mediaDir)) {
    await cp(mediaDir, path.join(outDir, 'media'), { recursive: true });
  }

  // 页面
  await writeFile(path.join(outDir, 'index.html'), renderHome(timeline, notes));
  await writeFile(path.join(outDir, 'timeline.html'), renderTimelinePage(timeline));
  await writeFile(path.join(outDir, 'notes', 'index.html'), renderNotesPage(notes));
  await writeFile(path.join(outDir, 'about.html'), renderAbout(about));
  await writeFile(path.join(outDir, '404.html'), render404());

  for (const item of timeline) {
    await writeFile(path.join(outDir, 'timeline', `${item.slug}.html`), renderTimelineDetail(item));
  }
  for (const note of notes) {
    await writeFile(path.join(outDir, 'notes', `${note.slug}.html`), renderNoteDetail(note, notes));
  }

  console.log(`✓ 构建完成：${timeline.length} 条时间轴，${notes.length} 篇文档 → docs/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
