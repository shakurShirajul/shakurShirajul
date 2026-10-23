// Draws the last year of GitHub contributions as an isometric night-time city.
// Each day is one building: the more contributions, the taller and brighter it is.
//
// Usage: node scripts/contribution-city.mjs <github-user> <output-dir>
// Writes city-teal.svg, city-green.svg and city-blue.svg into <output-dir>.
// No token needed: data comes from the public contributions calendar page.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [user = "shakurShirajul", outDir = "dist"] = process.argv.slice(2);

const THEMES = {
  // Matches the README palette (#0C1014 background, #2AA889 accent).
  teal: {
    roofs: ["#1c2a2e", "#16604f", "#1f8c72", "#2fbf98", "#6ff0c8"],
    window: "#ffd98a",
  },
  green: {
    roofs: ["#1b232c", "#0e4429", "#006d32", "#26a641", "#39d353"],
    window: "#ffd98a",
  },
  blue: {
    roofs: ["#1b232c", "#0b3a7a", "#1158c7", "#2f81f7", "#3fd0ff"],
    window: "#a5ecff",
  },
};

const BG = "#0C1014";
const WALL = "#1d2731"; // walls are mostly this, tinted slightly by the roof colour

// Layout. Grid point (i = week, j = weekday) maps to screen with a 2:1 isometric projection.
const TW = 12.5; // half the width of one grid cell on screen
const TH = TW / 2;
const MAX_H = 84; // tallest building, in px
const FOOT = 0.8; // building footprint as a share of its cell (the rest is street)
const W = 820;
const H = 620;
const OX = 48 + 7 * TW;
const OY = 190;

const r1 = (n) => Math.round(n * 10) / 10;
const P = (i, j, z = 0) => [OX + (i - j) * TW, OY + (i + j) * TH - z];
const pt = ([x, y]) => `${r1(x)},${r1(y)}`;
const poly = (pts, fill) => `<polygon points="${pts.map(pt).join(" ")}" fill="${fill}"/>`;

// Small deterministic hash so window lights and stars don't change between runs.
function rand(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function mix(a, b, t) {
  const p = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
  const [ca, cb] = [p(a), p(b)];
  return "#" + ca.map((v, k) => Math.round(v + (cb[k] - v) * t).toString(16).padStart(2, "0")).join("");
}

async function fetchDays(login) {
  const res = await fetch(`https://github.com/users/${login}/contributions`, {
    headers: { "User-Agent": "contribution-city" },
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${login}`);
  const html = await res.text();

  const counts = new Map();
  for (const m of html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2].match(/^(\d[\d,]*) contribution/);
    counts.set(m[1], n ? Number(n[1].replace(/,/g, "")) : 0);
  }

  const days = [];
  for (const m of html.matchAll(/<td[^>]*data-date="([\d-]+)"[^>]*id="(contribution-day-component-(\d+)-(\d+))"[^>]*data-level="(\d)"/g)) {
    days.push({
      date: m[1],
      weekday: Number(m[3]),
      week: Number(m[4]),
      level: Number(m[5]),
      count: counts.get(m[2]) ?? 0,
    });
  }
  if (days.length < 300) throw new Error(`Only parsed ${days.length} days; GitHub's page layout may have changed`);
  return days;
}

function building(day, theme, maxCount) {
  const { week: i0, weekday: j0, level, count, date } = day;
  const pad = (1 - FOOT) / 2;
  const [a, b] = [i0 + pad, j0 + pad];
  const [c, d] = [a + FOOT, b + FOOT];

  const h = level === 0 ? 2 : 12 + (MAX_H - 12) * Math.sqrt(count / maxCount) + rand(date) * 6;
  const roof = theme.roofs[level];
  const wallR = mix(WALL, roof, level === 0 ? 0 : 0.18);
  const wallL = mix(wallR, "#000000", 0.28);

  const out = [];
  // Visible walls face the viewer: the i = c side (right) and the j = d side (left).
  out.push(poly([P(c, b), P(c, d), P(c, d, h), P(c, b, h)], wallR));
  out.push(poly([P(a, d), P(c, d), P(c, d, h), P(a, d, h)], wallL));
  out.push(poly([P(a, b, h), P(c, b, h), P(c, d, h), P(a, d, h)], roof));

  if (level > 0 && h > 14) {
    // Windows: two columns per wall, one row every 7px, about half of them lit.
    let lit = "";
    let flicker = "";
    const ww = FOOT * 0.2; // window width in grid units
    for (let z = 5; z + 4 <= h - 4; z += 7) {
      for (const [side, col] of [["r", 0.18], ["r", 0.58], ["l", 0.18], ["l", 0.58]]) {
        const r = rand(`${date}${side}${col}${z}`);
        if (r > 0.55) continue;
        const start = side === "r" ? P(c, b + FOOT * col, z) : P(a + FOOT * col, d, z);
        // Moving along a wall by ww grid units shifts the screen point by (±TW, TH) * ww.
        const dx = r1((side === "r" ? -TW : TW) * ww);
        const dy = r1(TH * ww);
        const sub = `M${pt(start)}l${dx},${dy}v-3.5l${-dx},${-dy}z`;
        if (r < 0.03) flicker += sub;
        else lit += sub;
      }
    }
    if (lit) out.push(`<path d="${lit}" fill="${theme.window}"/>`);
    if (flicker) out.push(`<path class="f" style="animation-delay:-${r1(rand(date + "f") * 6)}s" d="${flicker}" fill="${theme.window}"/>`);
  }
  return out.join("");
}

function render(days, theme) {
  const total = days.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const weeks = Math.max(...days.map((d) => d.week)) + 1;

  // Painter's order: back of the city (small i + j) first.
  const ordered = [...days].sort((x, y) => x.week + x.weekday - (y.week + y.weekday) || x.week - y.week);

  const stars = [];
  for (let k = 0; k < 90; k++) {
    const x = r1(rand(`sx${k}`) * W);
    const y = r1(rand(`sy${k}`) * H);
    // Keep the sky out of the ground strip and away from the title.
    const [gx0, gy0] = P(0, 0);
    if (y > gy0 + ((x - gx0) * TH) / TW - 40 && y < gy0 + ((x - gx0) * TH) / TW + 7 * 2 * TH + 40) continue;
    if (x < 470 && y < 70) continue;
    const size = rand(`ss${k}`) < 0.15 ? 1.4 : 0.8;
    const twinkle = rand(`st${k}`) < 0.35 ? ` class="t" style="animation-delay:-${r1(rand(`sd${k}`) * 4)}s"` : "";
    stars.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="#c9d1d9"${twinkle}/>`);
  }

  const ground = [P(-0.3, -0.3), P(weeks + 0.3, -0.3), P(weeks + 0.3, 7.3), P(-0.3, 7.3)];
  const groundEdgeR = [P(weeks + 0.3, -0.3), P(weeks + 0.3, 7.3), P(weeks + 0.3, 7.3, -6), P(weeks + 0.3, -0.3, -6)];
  const groundEdgeL = [P(-0.3, 7.3), P(weeks + 0.3, 7.3), P(weeks + 0.3, 7.3, -6), P(-0.3, 7.3, -6)];

  const legend = theme.roofs
    .map((c, k) => `<rect x="${66 + k * 14}" y="${H - 34}" width="10" height="10" rx="2" fill="${c}"/>`)
    .join("");

  const font = `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Contribution city: ${total} contributions in the last 12 months">
<style>
.t{animation:t 4s ease-in-out infinite}
.f{animation:f 6s steps(1) infinite}
@keyframes t{50%{opacity:.15}}
@keyframes f{0%,40%{opacity:1}41%,70%{opacity:.1}71%{opacity:1}}
</style>
<defs><radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" rx="12" fill="${BG}"/>
${stars.join("")}
<circle cx="${W - 70}" cy="62" r="34" fill="url(#glow)"/>
<circle cx="${W - 70}" cy="62" r="13" fill="#f0f3f6"/>
<circle cx="${W - 64}" cy="57" r="11.5" fill="${BG}"/>
<text x="32" y="44" ${font} font-size="20" font-weight="700" fill="#f0f3f6">contribution city</text>
<text x="32" y="66" ${font} font-size="12" fill="#8b949e">${total.toLocaleString("en-US")} contributions · last 12 months · 1 building = 1 day</text>
${poly(groundEdgeL, "#0a0d10")}${poly(groundEdgeR, "#070a0c")}${poly(ground, "#161d24")}
${ordered.map((d) => building(d, theme, maxCount)).join("\n")}
<text x="32" y="${H - 25}" ${font} font-size="11" fill="#8b949e">quiet</text>
${legend}
<text x="${66 + 5 * 14 + 4}" y="${H - 25}" ${font} font-size="11" fill="#8b949e">skyscraper</text>
</svg>
`;
}

const days = await fetchDays(user);
await mkdir(outDir, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  const file = join(outDir, `city-${name}.svg`);
  await writeFile(file, render(days, theme));
  console.log(`wrote ${file}`);
}
