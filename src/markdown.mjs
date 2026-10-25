// 一个够用就好的 Markdown 渲染器：零依赖，只支持写文档常用的语法。
// 支持：标题、段落、无序/有序列表、引用、代码块、行内代码、粗体、斜体、链接、图片、表格、分割线。

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(input) {
  return String(input == null ? '' : input).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

function safeHref(raw) {
  const url = String(raw || '').trim();
  if (!url) return '#';
  if (/^(javascript|vbscript|data):/i.test(url)) return '#';
  return url;
}

function renderInline(text) {
  const codes = [];
  let s = escapeHtml(text);

  // 行内代码先抽出来，避免里面的 * 和 _ 被当成强调
  s = s.replace(/`([^`]+)`/g, (_m, code) => {
    codes.push('<code>' + code + '</code>');
    return '\u0000' + (codes.length - 1) + '\u0000';
  });

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => {
    return '<img src="' + safeHref(src) + '" alt="' + alt + '" loading="lazy">';
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
    return '<a href="' + safeHref(href) + '">' + label + '</a>';
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

  s = s.replace(/\u0000(\d+)\u0000/g, (_m, idx) => codes[Number(idx)] || '');
  return s;
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line) {
  if (!line || !line.includes('|')) return false;
  return /^[\s|:-]+$/.test(line) && line.includes('-');
}

// 支持 - [ ] / - [x] 任务列表
function renderListItem(text) {
  const task = text.match(/^\[([ xX])\]\s+(.*)$/);
  if (!task) return '<li>' + renderInline(text) + '</li>';
  const done = task[1].toLowerCase() === 'x';
  return '<li class="task' + (done ? ' task-done' : '') + '">' + renderInline(task[2]) + '</li>';
}

function isBlockStart(line) {
  return (
    /^#{1,6}\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line)
  );
}

export function renderMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // 代码块
    const fence = line.match(/^```(\S*)/);
    if (fence) {
      const lang = fence[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // 跳过结束的 ```
      const cls = lang ? ' class="language-' + escapeHtml(lang) + '"' : '';
      out.push('<pre><code' + cls + '>' + escapeHtml(buf.join('\n')) + '</code></pre>');
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
      i++;
      continue;
    }

    // 分割线
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // 表格
    if (line.includes('|') && isTableSeparator(lines[i + 1] || '')) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = '<thead><tr>' + head.map((c) => '<th>' + renderInline(c) + '</th>').join('') + '</tr></thead>';
      const tbody = '<tbody>' + rows
        .map((r) => '<tr>' + r.map((c) => '<td>' + renderInline(c) + '</td>').join('') + '</tr>')
        .join('') + '</tbody>';
      out.push('<table>' + thead + tbody + '</table>');
      continue;
    }

    // 引用
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + renderMarkdown(buf.join('\n')) + '</blockquote>');
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i++;
      }
      out.push('<ul>' + items.map(renderListItem).join('') + '</ul>');
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push('<ol>' + items.map((t) => '<li>' + renderInline(t) + '</li>').join('') + '</ol>');
      continue;
    }

    // 段落：一直吃到空行或下一个块级元素
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i]) && !isTableSeparator(lines[i - 1] || '')) {
      if (lines[i].includes('|') && isTableSeparator(lines[i + 1] || '')) break;
      buf.push(lines[i]);
      i++;
    }
    out.push('<p>' + renderInline(buf.join(' ')) + '</p>');
  }

  return out.join('\n');
}
