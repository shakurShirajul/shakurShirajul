// Builds the static README images that match the contribution city style:
// the section header bars (images/headers/*.svg), the about and now cards (images/about.svg,
// images/now.svg) and the tech stack card (images/tech-stack.svg).
//
// Usage: node scripts/readme-art.mjs
// Edit SECTIONS, ABOUT, NOW or STACK below, re-run, and commit the regenerated images.
// Text is monospace and wrapped by hand, so keep each line within the widths noted below.
// Icons are downloaded from skillicons.dev at build time and embedded, so the card has no live dependency.

import { mkdir, readFile, writeFile } from "node:fs/promises";

const W = 820;
const BG = "#0C1014";
const LINE = "#1C2226";
const TEXT = "#f0f3f6";
const MUTED = "#8b949e";
const DIM = "#5b6570";
const ACCENT = "#2AA889";
const ACCENT_HI = "#6ff0c8";
const font = `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"`;

const SECTIONS = [
  { file: "about", title: "about me", note: "who's behind the commits" },
  { file: "now", title: "what i'm up to", note: "current focus" },
  { file: "stack", title: "tech stack", note: "what i build with" },
  { file: "stats", title: "github stats", note: "one building per day" },
];

// icon: a skillicons.dev id, or a local file in images/logo/. daily: marked as a daily driver.
const STACK = [
  {
    label: "languages",
    items: [
      { name: "JavaScript", icon: "js" },
      { name: "TypeScript", icon: "ts", daily: true },
      { name: "Python", icon: "python" },
      { name: "PHP", icon: "php", daily: true },
      { name: "C#", icon: "cs" },
      { name: "C", icon: "c" },
      { name: "C++", icon: "cpp" },
      { name: "HTML", icon: "html" },
      { name: "CSS", icon: "css" },
    ],
  },
  {
    label: "frontend",
    items: [
      { name: "React", icon: "react" },
      { name: "Redux", icon: "redux" },
      { name: "Zustand", icon: "images/logo/zustand-tile.svg" },
      { name: "Tailwind", icon: "tailwind" },
      { name: "Bootstrap", icon: "bootstrap" },
    ],
  },
  {
    label: "backend",
    items: [
      { name: "Node.js", icon: "nodejs" },
      { name: "Express", icon: "express" },
      { name: "NestJS", icon: "nestjs" },
      { name: "Laravel", icon: "laravel" },
      { name: "WordPress", icon: "wordpress", daily: true },
    ],
  },
  {
    label: "database",
    items: [
      { name: "MongoDB", icon: "mongodb" },
      { name: "MySQL", icon: "mysql" },
      { name: "PostgreSQL", icon: "postgres" },
      { name: "Prisma", icon: "prisma" },
      { name: "Firebase", icon: "firebase" },
    ],
  },
  {
    label: "tools & deploy",
    items: [
      { name: "Git", icon: "git" },
      { name: "GitHub", icon: "github" },
      { name: "VS Code", icon: "vscode" },
      { name: "Postman", icon: "postman" },
      { name: "Figma", icon: "figma" },
      { name: "Vercel", icon: "vercel" },
      { name: "Netlify", icon: "netlify" },
      { name: "Coolify", icon: "images/logo/coolify-tile.png" },
    ],
  },
  {
    label: "ai tools",
    items: [
      { name: "Claude", icon: "images/logo/claude-tile.svg" },
      { name: "Codex", icon: "images/logo/codex-tile.svg" },
    ],
  },
];

// About card. Each line is a list of [text, colour] pieces; left column fits ~46 characters per line.
const ABOUT = {
  name: "shirajul islam shakur",
  tagline: "full-stack developer · bangladesh",
  intro: [
    [["I build dynamic web apps with the ", MUTED], ["MERN stack", TEXT]],
    [["and ", MUTED], ["PHP Laravel", TEXT], [". These days I write a lot", MUTED]],
    [["of ", MUTED], ["TypeScript", TEXT], [" and ", MUTED], ["PHP", TEXT], [", building WordPress", MUTED]],
    [["plugins at ", MUTED], ["@Bit-Apps-Pro", ACCENT_HI], [".", MUTED]],
  ],
  quote: [
    "I like work that starts messy and ends",
    "obvious: taking a tangled problem, finding",
    "the clean shape underneath it, and",
    "building that properly.",
  ],
  // Shown in the editor panel; fits ~50 characters per line.
  code: [
    "const shakur = {",
    '  role: "Full-Stack Developer",',
    '  stack: ["React", "Node.js", "Express",',
    '          "MongoDB", "Laravel", "MySQL"],',
    '  daily: ["TypeScript", "PHP",',
    '          "WordPress Plugins"],',
    '  offDuty: ["Gaming"],',
    '  mantra: "Learn it, build it, ship it, repeat.",',
    "};",
  ],
};

// Now card: six tiles. Tile text fits ~27 characters per line, up to 3 lines.
const NOW = [
  { label: "building", live: true, lines: ["WordPress plugins with", "TypeScript + PHP at", "@Bit-Apps-Pro"] },
  { label: "learning", lines: ["Going deeper on PHP", "Laravel and backend", "architecture"] },
  { label: "infra", lines: ["Postgres, Prisma and", "Coolify on the", "infrastructure side"] },
  { label: "ask me about", lines: ["JavaScript, React,", "Laravel, or anything", "MERN"] },
  { label: "reach me", lines: ["shiirajullisllam", "@gmail.com"] },
  { label: "off the clock", lines: ["You'll probably find", "me gaming"] },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Tiny isometric block, the same shape as a building in the city.
function cube(cx, cy, s) {
  const k = s * 0.866;
  const p = (pts) => pts.map(([x, y]) => `${+x.toFixed(1)},${+y.toFixed(1)}`).join(" ");
  return (
    `<polygon points="${p([[cx, cy - s], [cx + k, cy - s / 2], [cx, cy], [cx - k, cy - s / 2]])}" fill="${ACCENT_HI}"/>` +
    `<polygon points="${p([[cx - k, cy - s / 2], [cx, cy], [cx, cy + s], [cx - k, cy + s / 2]])}" fill="#1f8c72"/>` +
    `<polygon points="${p([[cx + k, cy - s / 2], [cx, cy], [cx, cy + s], [cx + k, cy + s / 2]])}" fill="#16604f"/>`
  );
}

function header({ title, note }, index, count) {
  const H = 56;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(title)}">
<defs>
<linearGradient id="u" x1="0" x2="1"><stop offset="0" stop-color="${ACCENT}"/><stop offset=".45" stop-color="${ACCENT}" stop-opacity=".25"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></linearGradient>
<clipPath id="c"><rect width="${W}" height="${H}" rx="12"/></clipPath>
</defs>
<g clip-path="url(#c)">
<rect width="${W}" height="${H}" fill="${BG}"/>
<rect y="${H - 2}" width="${W}" height="2" fill="url(#u)"/>
</g>
${cube(32, 28, 9)}
<text x="54" y="34" ${font} font-size="18" font-weight="700" fill="${TEXT}">${esc(title)}<tspan dx="14" font-size="12" font-weight="400" fill="${DIM}">// ${esc(note)}</tspan></text>
<text x="${W - 60}" y="33" ${font} font-size="11" fill="${ACCENT}" text-anchor="end">${String(index + 1).padStart(2, "0")}</text>
<text x="${W - 28}" y="33" ${font} font-size="11" fill="${DIM}" text-anchor="end">/ ${String(count).padStart(2, "0")}</text>
</svg>
`;
}

async function iconDataUri(icon) {
  if (icon.includes("/")) {
    const type = icon.endsWith(".png") ? "image/png" : "image/svg+xml";
    return `data:${type};base64,${(await readFile(icon)).toString("base64")}`;
  }
  const res = await fetch(`https://skillicons.dev/icons?i=${icon}&theme=dark`);
  if (!res.ok) throw new Error(`skillicons.dev returned ${res.status} for ${icon}`);
  return `data:image/svg+xml;base64,${Buffer.from(await res.text()).toString("base64")}`;
}

async function techStack() {
  const ICON = 40;
  const STEP = 62;
  const ROW = 78;
  const TOP = 30;
  const LEFT = 196;
  const H = TOP + STACK.length * ROW + 34;

  const uris = new Map();
  await Promise.all(STACK.flatMap((g) => g.items).map(async (it) => uris.set(it.icon, await iconDataUri(it.icon))));

  const rows = STACK.map((group, r) => {
    const y = TOP + r * ROW;
    const divider = r ? `<path d="M32 ${y - 12}H${W - 32}" stroke="${LINE}"/>` : "";
    const label =
      cube(38, y + 20, 5) +
      `<text x="52" y="${y + 24}" ${font} font-size="12" fill="${MUTED}">${esc(group.label)}</text>` +
      `<text x="52" y="${y + 40}" ${font} font-size="10" fill="${DIM}">${String(group.items.length).padStart(2, "0")} tools</text>`;
    const icons = group.items
      .map((it, k) => {
        const x = LEFT + k * STEP;
        const dot = it.daily
          ? `<circle cx="${x + ICON - 1}" cy="${y + 1}" r="4.5" fill="${ACCENT_HI}" stroke="${BG}" stroke-width="2"/>`
          : "";
        return (
          `<image x="${x}" y="${y}" width="${ICON}" height="${ICON}" href="${uris.get(it.icon)}"/>${dot}` +
          `<text x="${x + ICON / 2}" y="${y + ICON + 15}" ${font} font-size="9.5" fill="${MUTED}" text-anchor="middle">${esc(it.name)}</text>`
        );
      })
      .join("");
    return divider + label + icons;
  }).join("\n");

  const names = STACK.flatMap((g) => g.items.map((it) => it.name)).join(", ");
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Tech stack: ${esc(names)}">
<rect width="${W}" height="${H}" rx="12" fill="${BG}"/>
${rows}
<circle cx="${W - 120}" cy="${H - 22}" r="4" fill="${ACCENT_HI}"/>
<text x="${W - 110}" y="${H - 18.5}" ${font} font-size="10" fill="${DIM}">daily driver</text>
</svg>
`;
}

const pieces = (parts) => parts.map(([t, c]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join("");

// Colours code like an editor, reusing the city palette: keywords teal, keys mint, strings window-yellow.
function highlight(line) {
  let out = "";
  for (const m of line.matchAll(/("[^"]*")|\b(const)\b|(\w+)(?=:)|(\w+)|(\s+)|(.)/g)) {
    const [tok, str, kw, key, word, space] = m;
    const colour = str ? "#ffd98a" : kw ? ACCENT : key ? "#99D1CE" : word ? TEXT : space ? null : MUTED;
    out += colour ? `<tspan fill="${colour}">${esc(tok)}</tspan>` : tok;
  }
  return out;
}

function aboutCard() {
  const LH = 19;
  const panelX = 404;
  const panelW = W - 32 - panelX;
  const codeTop = 32 + 34; // below the panel's title bar
  const H = Math.max(codeTop + ABOUT.code.length * LH + 28, 300);

  const intro = ABOUT.intro
    .map((parts, k) => `<text x="32" y="${108 + k * LH}" ${font} font-size="12">${pieces(parts)}</text>`)
    .join("");
  const quoteTop = 108 + ABOUT.intro.length * LH + 18;
  const quote = ABOUT.quote
    .map((t, k) => `<text x="46" y="${quoteTop + 4 + k * LH}" ${font} font-size="12" font-style="italic" fill="#c9d1d9">${esc(t)}</text>`)
    .join("");

  const code = ABOUT.code
    .map((l, k) => {
      const y = codeTop + 22 + k * LH;
      return (
        `<text x="${panelX + 30}" y="${y}" ${font} font-size="11" fill="${DIM}" text-anchor="end">${k + 1}</text>` +
        `<text x="${panelX + 42}" y="${y}" ${font} font-size="11" xml:space="preserve">${highlight(l)}</text>`
      );
    })
    .join("");
  const lastY = codeTop + 22 + (ABOUT.code.length - 1) * LH;
  const cursorX = panelX + 42 + ABOUT.code.at(-1).length * 6.6 + 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(
    [ABOUT.name, ABOUT.tagline, ...ABOUT.intro.map((l) => l.map(([t]) => t).join("")), ...ABOUT.quote].join(" "),
  )}">
<style>.c{animation:b 1.1s steps(1) infinite}@keyframes b{50%{opacity:0}}</style>
<rect width="${W}" height="${H}" rx="12" fill="${BG}"/>
${cube(40, 46, 8)}
<text x="60" y="52" ${font} font-size="18" font-weight="700" fill="${TEXT}">${esc(ABOUT.name)}</text>
<text x="32" y="78" ${font} font-size="12" fill="${ACCENT}">${esc(ABOUT.tagline)}</text>
${intro}
<rect x="32" y="${quoteTop - 10}" width="2" height="${ABOUT.quote.length * LH}" rx="1" fill="${ACCENT}"/>
${quote}
<rect x="${panelX}" y="32" width="${panelW}" height="${H - 64}" rx="10" fill="#11171c" stroke="${LINE}"/>
<path d="M${panelX} ${codeTop}H${panelX + panelW}" stroke="${LINE}"/>
<circle cx="${panelX + 18}" cy="${32 + 17}" r="4.5" fill="#ff5f57" opacity=".85"/>
<circle cx="${panelX + 33}" cy="${32 + 17}" r="4.5" fill="#febc2e" opacity=".85"/>
<circle cx="${panelX + 48}" cy="${32 + 17}" r="4.5" fill="#28c840" opacity=".85"/>
<text x="${panelX + panelW / 2}" y="${32 + 21}" ${font} font-size="11" fill="${MUTED}" text-anchor="middle">shakur.js</text>
${code}
<rect class="c" x="${cursorX}" y="${lastY - 10}" width="7" height="13" fill="${ACCENT_HI}"/>
</svg>
`;
}

function nowCard() {
  const COLS = 3;
  const GAP = 14;
  const TW = (W - 64 - GAP * (COLS - 1)) / COLS;
  const TH = 112;
  const rows = Math.ceil(NOW.length / COLS);
  const H = 32 + rows * TH + (rows - 1) * GAP + 32;

  const tiles = NOW.map((t, k) => {
    const x = 32 + (k % COLS) * (TW + GAP);
    const y = 32 + Math.floor(k / COLS) * (TH + GAP);
    const live = t.live
      ? `<circle cx="${x + TW - 22}" cy="${y + 24}" r="3" fill="${ACCENT_HI}"/><circle cx="${x + TW - 22}" cy="${y + 24}" r="3" fill="none" stroke="${ACCENT_HI}" class="p" style="transform-origin:${x + TW - 22}px ${y + 24}px"/>`
      : `<text x="${x + TW - 18}" y="${y + 28}" ${font} font-size="10" fill="${DIM}" text-anchor="end">${String(k + 1).padStart(2, "0")}</text>`;
    const lines = t.lines
      .map((l, i) => `<text x="${x + 18}" y="${y + 56 + i * 18}" ${font} font-size="12" fill="${l.startsWith("@") ? ACCENT_HI : TEXT}">${esc(l)}</text>`)
      .join("");
    return (
      `<rect x="${x}" y="${y}" width="${TW}" height="${TH}" rx="10" fill="#11171c" stroke="${LINE}"/>` +
      cube(x + 23, y + 24, 5) +
      `<text x="${x + 34}" y="${y + 28}" ${font} font-size="10.5" fill="${ACCENT}" letter-spacing=".5">${esc(t.label)}</text>` +
      live +
      lines
    );
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(
    NOW.map((t) => `${t.label}: ${t.lines.join(" ")}`).join(". "),
  )}">
<style>.p{animation:p 2s ease-out infinite}@keyframes p{from{transform:scale(1);opacity:.9}to{transform:scale(3.2);opacity:0}}</style>
<rect width="${W}" height="${H}" rx="12" fill="${BG}"/>
${tiles}
</svg>
`;
}

await mkdir("images/headers", { recursive: true });
for (const [i, s] of SECTIONS.entries()) {
  await writeFile(`images/headers/${s.file}.svg`, header(s, i, SECTIONS.length));
  console.log(`wrote images/headers/${s.file}.svg`);
}
await writeFile("images/about.svg", aboutCard());
console.log("wrote images/about.svg");
await writeFile("images/now.svg", nowCard());
console.log("wrote images/now.svg");
await writeFile("images/tech-stack.svg", await techStack());
console.log("wrote images/tech-stack.svg");
