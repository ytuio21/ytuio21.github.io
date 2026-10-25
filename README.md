# AI 时代的求职实验

个人求职时间轴与项目档案馆。访问 **https://ytuio21.github.io** 查看成品。

- 内容全部是 Markdown，写在 `content/` 里
- 构建器是自写的零依赖 Node 脚本，不需要装任何包
- 每次 push 到 `main`，GitHub Actions 自动构建并发布

## 目录结构

```
content/
  timeline/        时间轴条目，一条一个 .md
  notes/           文档/项目记录，一篇一个 .md
  media/           图片（可选，会复制到站点 /media/）
  about.md         「关于」页
src/
  build.mjs        构建脚本：Markdown → docs/
  markdown.mjs     轻量 Markdown 渲染器
  styles.css       全部样式
  site.config.mjs  站点标题、姓名、技能标签
docs/              构建产物（不进 git，由 Actions 生成）
```

## 本地预览

```bash
npm run dev        # 构建 + 起本地服务器 http://localhost:4321
npm run build      # 只构建
```

只用系统自带的 Node（>= 18）和 python3，不需要 `npm install`。

## 写一条时间轴

复制 `content/timeline/_模板.md`，改名成 `2026-03-12-some-slug.md`，然后改开头的字段：

```yaml
---
title: 用 AI 把周报自动化了
date: 2026-03-12
status: 完成          # 进行中 / 完成 / 放弃
tags: [自动化, Prompt]
summary: 一句话说明为什么做、做了什么、结果如何。
---
```

下面的正文就是页面内容。文件名开头的日期决定排序。

## 写一篇文档

同样复制 `content/notes/_模板.md`，改名成 `when-to-automate.md`。多一个 `category` 字段（方法 / 项目 / 工具 / 复盘）。

## 加图片

放到 `content/media/`，在 Markdown 里这样引用：

```markdown
![截图](/media/my-screenshot.png)
```

## 改站点信息

`src/site.config.mjs` 里改标题、姓名、首页大标题、技能标签。

## 部署（只需做一次）

1. 仓库改名为 `ytuio21.github.io`（这样网址是根域名，不带子路径）
2. GitHub → Settings → Pages → Source 选 **GitHub Actions**
3. push 到 `main`，等 Actions 跑完即可

之后每次 push 都会自动更新，通常 1 分钟内上线。

## 在网页上直接写

GitHub 上点进 `content/timeline/` → Add file → Create new file → 写内容 → Commit。
Actions 会自动重新构建，不需要在本地跑任何命令。

## 已知取舍

- 站点使用绝对路径（`/assets/style.css`），所以仓库名必须是 `ytuio21.github.io`。如果换成子路径部署（比如 `ytuio21.github.io/blog/`），需要把 `src/build.mjs` 和 `styles.css` 里的绝对路径改成相对路径。
- Markdown 渲染器只支持常用语法：标题、列表、任务列表、引用、代码块、表格、链接、图片、加粗斜体。不支持的语法会原样显示。
- 没有评论、搜索、RSS。需要的话再单独加。
