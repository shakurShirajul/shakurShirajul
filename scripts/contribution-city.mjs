// Draws the last year of GitHub contributions as an isometric night-time city.
// Each day is one building: the more contributions, the taller and brighter it is.
//
// Usage: node scripts/contribution-city.mjs <github-user> <output-dir>
// Also draws a matching stats card (total contributions, current and longest streak).
// Writes city-<theme>.svg and stats-<theme>.svg for the teal, green and blue themes into <output-dir>.
// No token needed: data comes from the public contributions calendar pages. If GITHUB_TOKEN
// is set it is only used for the one API call that looks up the join date.

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

const font = `font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"`;
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

function parseCalendar(html) {
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

async function fetchCalendar(login, query = "") {
  const res = await fetch(`https://github.com/users/${login}/contributions${query}`, {
    headers: { "User-Agent": "contribution-city" },
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} for ${login}`);
  return parseCalendar(await res.text());
}

async function joinDate(login) {
  const headers = { "User-Agent": "contribution-city" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${login}`, { headers });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${login}`);
  return (await res.json()).created_at.slice(0, 10);
}

// Every day from the join date to today, oldest first.
async function fetchHistory(login, today) {
  const joined = await joinDate(login);
  const years = [];
  for (let y = Number(joined.slice(0, 4)); y <= Number(today.slice(0, 4)); y++) years.push(y);
  const calendars = await Promise.all(years.map((y) => fetchCalendar(login, `?from=${y}-01-01&to=${y}-12-31`)));
  const byDate = new Map();
  for (const d of calendars.flat()) if (d.date >= joined && d.date <= today) byDate.set(d.date, d);
  return { joined, days: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)) };
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

function renderCity(days, theme) {
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
    if (x < 260 && y > H - 56) continue; // keep the legend clear
    const size = rand(`ss${k}`) < 0.15 ? 1.4 : 0.8;
    const twinkle = rand(`st${k}`) < 0.35 ? ` class="t" style="animation-delay:-${r1(rand(`sd${k}`) * 4)}s"` : "";
    stars.push(`<circle cx="${x}" cy="${y}" r="${size}" fill="#c9d1d9"${twinkle}/>`);
  }

  const ground = [P(-0.3, -0.3), P(weeks + 0.3, -0.3), P(weeks + 0.3, 7.3), P(-0.3, 7.3)];
  const groundEdgeR = [P(weeks + 0.3, -0.3), P(weeks + 0.3, 7.3), P(weeks + 0.3, 7.3, -6), P(weeks + 0.3, -0.3, -6)];
  const groundEdgeL = [P(-0.3, 7.3), P(weeks + 0.3, 7.3), P(weeks + 0.3, 7.3, -6), P(-0.3, 7.3, -6)];

  const legend = theme.roofs
    .map((c, k) => `<rect x="${76 + k * 14}" y="${H - 34}" width="10" height="10" rx="2" fill="${c}"/>`)
    .join("");

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
<text x="${76 + 5 * 14 + 6}" y="${H - 25}" ${font} font-size="11" fill="#8b949e">skyscraper</text>
</svg>
`;
}

function streaks(days) {
  // A streak still counts if today has no contributions yet; it only breaks once a whole day is missed.
  let end = days.length - 1;
  if (days[end].count === 0) end--;
  let start = end + 1;
  while (start > 0 && days[start - 1].count > 0) start--;
  const current = { length: end - start + 1, from: days[start]?.date, to: days[end]?.date };

  let longest = { length: 0 };
  let runStart = 0;
  days.forEach((d, k) => {
    if (d.count === 0) return void (runStart = k + 1);
    if (k - runStart + 1 > longest.length) longest = { length: k - runStart + 1, from: days[runStart].date, to: d.date };
  });
  return { current, longest };
}

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
function fmtDate(iso, withYear) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ""}`;
}
function fmtRange(from, to, today) {
  if (!from) return "start one today";
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const end = to === today ? "today" : fmtDate(to, !sameYear || to.slice(0, 4) !== today.slice(0, 4));
  return from === to ? fmtDate(from, true) : `${fmtDate(from, !sameYear)} – ${end}`;
}

// Stats card that sits under the city: same width, palette and type.
function renderStats(history, theme, today) {
  const { joined, days } = history;
  const { current, longest } = streaks(days);
  const total = days.reduce((s, d) => s + d.count, 0);
  const accent = theme.roofs[4];
  const SH = 176;
  const col = W / 3;
  const x0 = (k) => k * col + 32;

  // Column 1: contributions per year as small bars.
  const perYear = new Map();
  for (const d of days) perYear.set(d.date.slice(0, 4), (perYear.get(d.date.slice(0, 4)) ?? 0) + d.count);
  const years = [...perYear.entries()];
  const maxYear = Math.max(1, ...years.map(([, n]) => n));
  const bw = Math.min(22, (col - 64 - (years.length - 1) * 6) / years.length);
  const bars = years
    .map(([y, n], k) => {
      const h = Math.max(2, r1((n / maxYear) * 30));
      const x = r1(x0(0) + k * (bw + 6));
      const fill = k === years.length - 1 ? accent : theme.roofs[2];
      return `<rect x="${x}" y="${150 - h}" width="${r1(bw)}" height="${h}" rx="2" fill="${fill}"><title>${y}: ${n.toLocaleString("en-US")}</title></rect>`;
    })
    .join("");
  const yearLabels = `<text x="${x0(0)}" y="164" ${font} font-size="9" fill="#5b6570">${years[0][0]}</text><text x="${r1(x0(0) + years.length * (bw + 6) - 6)}" y="164" ${font} font-size="9" fill="#5b6570" text-anchor="end">${years.at(-1)[0]}</text>`;

  // Column 2: the last 14 days, one square each, with the current streak outlined.
  const recent = days.slice(-14);
  const streakDates = new Set(current.length ? days.slice(days.findIndex((d) => d.date === current.from), days.findIndex((d) => d.date === current.to) + 1).map((d) => d.date) : []);
  const squares = recent
    .map((d, k) => {
      const x = x0(1) + k * 15;
      const ring = streakDates.has(d.date) ? ` stroke="${accent}" stroke-width="1"` : "";
      return `<rect x="${x}" y="138" width="11" height="11" rx="2" fill="${theme.roofs[d.level]}"${ring}/>`;
    })
    .join("");

  // Column 3: how close the current streak is to the record.
  const barW = col - 64;
  const progress = longest.length ? Math.min(1, current.length / longest.length) : 0;
  const toBeat = longest.length - current.length + 1;
  const progressNote = current.length >= longest.length && current.length > 0 ? "this is your record" : `${toBeat} more day${toBeat === 1 ? "" : "s"} to beat it`;

  const label = (k, text) => `<text x="${x0(k)}" y="40" ${font} font-size="11" fill="#8b949e" letter-spacing=".5">${text}</text>`;
  const big = (k, value, unit, fill) =>
    `<text x="${x0(k)}" y="84" ${font} font-size="34" font-weight="700" fill="${fill}">${value}<tspan font-size="13" font-weight="400" fill="#8b949e" dx="6">${unit}</tspan></text>`;
  const sub = (k, text) => `<text x="${x0(k)}" y="108" ${font} font-size="11" fill="#8b949e">${text}</text>`;
  const live = current.length
    ? `<circle cx="${x0(1) + 112}" cy="36" r="3" fill="${accent}"/><circle cx="${x0(1) + 112}" cy="36" r="3" fill="none" stroke="${accent}" class="p"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${SH}" width="${W}" height="${SH}" role="img" aria-label="${total} total contributions, current streak ${current.length} days, longest streak ${longest.length} days">
<style>
.p{animation:p 2s ease-out infinite;transform-origin:${x0(1) + 112}px 36px}
@keyframes p{from{transform:scale(1);opacity:.9}to{transform:scale(3.2);opacity:0}}
</style>
<rect width="${W}" height="${SH}" rx="12" fill="${BG}"/>
<path d="M${r1(col)} 28V148M${r1(col * 2)} 28V148" stroke="#1C2226"/>
${label(0, "total contributions")}
${big(0, total.toLocaleString("en-US"), "", "#f0f3f6")}
${sub(0, `since ${fmtDate(joined, true)}`)}
${bars}${yearLabels}
${label(1, "current streak")}${live}
${big(1, current.length, current.length === 1 ? "day" : "days", accent)}
${sub(1, fmtRange(current.from, current.to, today))}
${squares}
${label(2, "longest streak")}
${big(2, longest.length, longest.length === 1 ? "day" : "days", "#f0f3f6")}
${sub(2, fmtRange(longest.from, longest.to, today))}
<rect x="${x0(2)}" y="138" width="${r1(barW)}" height="6" rx="3" fill="#1c2226"/>
<rect x="${x0(2)}" y="138" width="${r1(Math.max(6, barW * progress))}" height="6" rx="3" fill="${accent}"/>
<text x="${x0(2)}" y="162" ${font} font-size="9" fill="#5b6570">${progressNote}</text>
</svg>
`;
}

const lastYear = await fetchCalendar(user);
const today = lastYear.reduce((max, d) => (d.date > max ? d.date : max), "");
const history = await fetchHistory(user, today);

await mkdir(outDir, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  for (const [kind, svg] of [["city", renderCity(lastYear, theme)], ["stats", renderStats(history, theme, today)]]) {
    const file = join(outDir, `${kind}-${name}.svg`);
    await writeFile(file, svg);
    console.log(`wrote ${file}`);
  }
}
