#!/usr/bin/env node
// 选题同步：git pull Obsidian 库 → 解析「flever/花艺师的选题.md」→ 写 topics 表（整体覆盖）
// 服务器 cron 每小时跑一次；手动跑：node scripts/sync-topics.js
// 笔记格式（每张卡一节，顺序即展示顺序）：
//   ## 「山茶与雾」
//   主题 —— 静 ｜ 克制的美，不需要喧哗
//   以山茶的沉稳为骨，雾灰色的桔梗作烟。适合安静、内敛的表达。
//   ![[绘画-山茶与雾.png]]   ← 可选，绘画笔记图片
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const VAULT_DIR = process.env.VAULT_DIR || '/var/lib/flever/vault';
const VAULT_REPO = process.env.VAULT_REPO || 'git@github.com-obsidian:ookiisparrow/obsidian.git';
const NOTE_PATH = process.env.TOPIC_NOTE || 'flever/花艺师的选题.md';
const IMG_DIR = require('../src/config').uploadDir.replace(/uploads$/, 'topic-img');

function sh(cmd, cwd) { execSync(cmd, { stdio: 'pipe', cwd }); }

// 1. 拉库（幂等）
if (fs.existsSync(path.join(VAULT_DIR, '.git'))) {
  sh('git fetch origin main && git reset --hard origin/main', VAULT_DIR);
} else {
  fs.mkdirSync(path.dirname(VAULT_DIR), { recursive: true });
  sh(`git clone -b main --depth 1 ${JSON.stringify(VAULT_REPO)} ${JSON.stringify(VAULT_DIR)}`);
}

// 2. 解析笔记
const noteFile = path.join(VAULT_DIR, NOTE_PATH);
if (!fs.existsSync(noteFile)) { console.error(`笔记不存在：${NOTE_PATH}`); process.exit(1); }
const md = fs.readFileSync(noteFile, 'utf8');
const findInVault = (name) => {
  const hit = execSync(
    `find . -type f -name ${JSON.stringify(name)} -not -path './.git/*' | head -1`,
    { cwd: VAULT_DIR, stdio: ['pipe', 'pipe', 'ignore'] }
  ).toString().trim();
  return hit ? path.join(VAULT_DIR, hit) : null;
};

const topics = [];
for (const block of md.split(/\n(?=## )/).slice(1)) {
  const name = (block.match(/^## (.+)$/m) || [])[1]?.trim();
  if (!name) continue;
  const philLine = (block.match(/^主题\s*(?:——|-|—)\s*(.+)$/m) || [])[1] || '';
  const [phil, ...ideaRest] = philLine.split('｜');
  const imgRef = (block.match(/!\[\[([^\]]+)\]\]/) || [])[1];
  let img = null;
  if (imgRef) {
    const src = findInVault(path.basename(imgRef.trim()));
    if (src) {
      fs.mkdirSync(IMG_DIR, { recursive: true });
      const fname = name.replace(/[「」/\\?%*:|"<>]/g, '') + path.extname(src);
      fs.copyFileSync(src, path.join(IMG_DIR, fname));
      img = '/topic-img/' + encodeURIComponent(fname);
    }
  }
  const desc = block.split('\n')
    .filter(l => l && !/^##|^主题|!\[\[/.test(l.trim()))
    .join(' ').trim();
  topics.push({ name, phil: phil.trim(), idea: ideaRest.join('｜').trim(), desc, img });
}
if (!topics.length) { console.error('笔记里没解析到任何 ## 小节'); process.exit(1); }

// 3. 写库（整体覆盖，顺序即笔记顺序）
const db = require('../src/db');
const tx = db.transaction(() => {
  db.prepare('DELETE FROM topics').run();
  const ins = db.prepare('INSERT INTO topics (pos, name, phil, idea, desc, img) VALUES (?,?,?,?,?,?)');
  topics.forEach((t, i) => ins.run(i, t.name, t.phil, t.idea, t.desc, t.img));
});
tx();
console.log(`已同步 ${topics.length} 个选题：${topics.map(t => t.name).join(' / ')}`);
