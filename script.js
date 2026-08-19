/* =========================================================
   WEATHERSTATION — script.js
   Talks to WeatherAPI's forecast endpoint, then renders
   an instrument-panel style dashboard: dial gauges, an
   hourly trend chart, and a 3-day forecast strip.
   ========================================================= */

const API_KEY = "ENTER YOUR API KEY HERE"; // EX: 06b1686ab3625533207
const API_BASE = "https://api.weatherapi.com/v1/forecast.json";

// ---------- state ----------
let unit = localStorage.getItem("wx_unit") || "c"; // 'c' | 'f'
let lastData = null;

// ---------- element refs ----------
const el = (id) => document.getElementById(id);
const loc = el("loc");
const searchBtn = el("x");
const locateBtn = el("locate");
const errorBanner = el("errorBanner");
const recentsRow = el("recents");
const unitCBtn = el("unitC");
const unitFBtn = el("unitF");

// ============================================================
// ICONS — small hand-built line-art set, not stock emoji.
// Each returns an <svg> string. `stroke` lets callers recolor.
// ============================================================
const ICONS = {
  sun: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><circle cx="50" cy="50" r="20"/><path d="M50 10v10M50 80v10M10 50h10M80 50h10M22 22l7 7M71 71l7 7M78 22l-7 7M29 71l-7 7"/></svg>`,
  moon: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M65 20a32 32 0 100 60 26 26 0 01-24-38 26 26 0 0124-22z" fill="currentColor" fill-opacity="0.12"/></svg>`,
  cloud: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 68a17 17 0 010-34 22 22 0 0142-8 16 16 0 015 31H28z"/></svg>`,
  cloudSun: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="32" r="12" fill="currentColor" fill-opacity="0.15"/><path d="M34 12v6M18 32h-6M50 32h6M22 20l4 4M46 20l-4 4"/><path d="M35 72a17 17 0 010-34 22 22 0 0142-8 16 16 0 015 31H35z"/></svg>`,
  rain: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M25 54a17 17 0 010-34 22 22 0 0142-8 16 16 0 015 31H25z"/><path d="M32 70l-5 10M50 70l-5 10M68 70l-5 10" stroke="var(--cyan,#5FC3D9)"/></svg>`,
  thunder: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M25 52a17 17 0 010-34 22 22 0 0142-8 16 16 0 015 31H25z"/><path d="M54 62L40 82h12l-8 16" stroke="var(--amber,#F0A84E)" fill="none"/></svg>`,
  snow: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M25 52a17 17 0 010-34 22 22 0 0142-8 16 16 0 015 31H25z"/><path d="M35 72v14M28 79h14M60 72v14M53 79h14" stroke="var(--cyan,#5FC3D9)"/></svg>`,
  fog: `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M18 40h64M12 54h76M18 68h64M28 82h44"/></svg>`
};

function iconForCondition(text, isDay){
  const t = (text || "").toLowerCase();
  if (/thunder/.test(t)) return ICONS.thunder;
  if (/snow|sleet|ice|blizzard/.test(t)) return ICONS.snow;
  if (/rain|drizzle|shower/.test(t)) return ICONS.rain;
  if (/mist|fog|haze/.test(t)) return ICONS.fog;
  if (/overcast|cloud/.test(t)) return isDay ? ICONS.cloudSun : ICONS.cloud;
  if (/clear|sunny/.test(t)) return isDay ? ICONS.sun : ICONS.moon;
  return isDay ? ICONS.cloudSun : ICONS.cloud;
}

// ============================================================
// GAUGES — analog dial widgets rendered as SVG (270° sweep)
// ============================================================
function polar(cx, cy, r, angleDeg){
  const a = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx, cy, r, a0, a1){
  const s = polar(cx, cy, r, a1);
  const e = polar(cx, cy, r, a0);
  const largeArc = (a1 - a0) <= 180 ? 0 : 1;
  return `M ${e.x.toFixed(2)} ${e.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${s.x.toFixed(2)} ${s.y.toFixed(2)}`;
}

function gaugeSVG({ value, min, max, color, id }){
  const start = -135, end = 135, range = end - start;
  const frac = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const valueAngle = start + frac * range;
  const cx = 60, cy = 60, r = 46;

  let ticks = "";
  for (let i = 0; i <= 8; i++){
    const a = start + (range / 8) * i;
    const p1 = polar(cx, cy, r + 6, a);
    const p2 = polar(cx, cy, r + 1, a);
    ticks += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="var(--border)" stroke-width="2"/>`;
  }

  const needleEnd = polar(cx, cy, r - 8, start); // initial rest position

  return `
  <svg viewBox="0 0 120 90" data-gauge="${id}">
    <path d="${arcPath(cx, cy, r, start, end)}" fill="none" stroke="var(--border)" stroke-width="7" stroke-linecap="round"/>
    <path d="${arcPath(cx, cy, r, start, valueAngle)}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
    ${ticks}
    <line class="needle" data-angle="${valueAngle}" x1="${cx}" y1="${cy}" x2="${needleEnd.x}" y2="${needleEnd.y}" stroke="var(--paper)" stroke-width="2.5" stroke-linecap="round" transform="rotate(0 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--paper)"/>
  </svg>`;
}

function animateNeedles(){
  document.querySelectorAll(".needle").forEach((n) => {
    const angle = parseFloat(n.dataset.angle);
    const restAngle = -135;
    const cx = 60, cy = 60;
    requestAnimationFrame(() => {
      n.style.transform = `rotate(${angle - restAngle}deg)`;
    });
  });
}

function renderGauges(current){
  const items = [
    { id: "uv", label: "UV Index", value: current.uv, min: 0, max: 11, color: "var(--amber)", fmt: (v) => v.toFixed(1) },
    { id: "wind", label: unit === "c" ? "Wind kph" : "Wind mph", value: unit === "c" ? current.wind_kph : current.wind_mph, min: 0, max: unit === "c" ? 80 : 50, color: "var(--cyan)", fmt: (v) => Math.round(v) },
    { id: "humidity", label: "Humidity %", value: current.humidity, min: 0, max: 100, color: "var(--cyan)", fmt: (v) => Math.round(v) },
    { id: "pressure", label: "Pressure mb", value: current.pressure_mb, min: 970, max: 1050, color: "var(--paper)", fmt: (v) => Math.round(v) },
    { id: "visibility", label: unit === "c" ? "Visibility km" : "Visibility mi", value: unit === "c" ? current.vis_km : current.vis_miles, min: 0, max: unit === "c" ? 20 : 12, color: "var(--amber)", fmt: (v) => v.toFixed(1) },
    { id: "gust", label: unit === "c" ? "Gust kph" : "Gust mph", value: unit === "c" ? current.gust_kph : current.gust_mph, min: 0, max: unit === "c" ? 100 : 62, color: "var(--danger)", fmt: (v) => Math.round(v) }
  ];

  el("gauges").innerHTML = items.map((it) => `
    <div class="gauge-card">
      ${gaugeSVG(it)}
      <div class="g-value">${it.fmt(it.value)}</div>
      <div class="g-label">${it.label}</div>
    </div>
  `).join("");

  animateNeedles();
}

// ============================================================
// AIR QUALITY
// ============================================================
const EPA_LEVELS = [
  { max: 1, label: "GOOD", color: "#5FC3D9" },
  { max: 2, label: "MODERATE", color: "#F0A84E" },
  { max: 3, label: "SENSITIVE", color: "#e8934e" },
  { max: 4, label: "UNHEALTHY", color: "#E8615D" },
  { max: 5, label: "VERY UNHEALTHY", color: "#b25de8" },
  { max: 6, label: "HAZARDOUS", color: "#8a2f2f" }
];

function renderAirQuality(aq){
  el("air_quality").innerText = Math.round(aq.co);
  const idx = Math.min(6, Math.max(1, Math.round(aq["us-epa-index"] || 1)));
  const level = EPA_LEVELS.find((l) => idx <= l.max) || EPA_LEVELS[EPA_LEVELS.length - 1];
  const badge = el("aqBadge");
  badge.innerText = level.label;
  badge.style.background = level.color;
  const pct = ((idx - 1) / 5) * 100;
  requestAnimationFrame(() => { el("aqMarker").style.left = pct + "%"; });
}

// ============================================================
// HOURLY CHART
// ============================================================
function renderChart(hours, nowEpoch){
  const svg = el("graph");
  const W = 800, H = 180, PAD = 24;
  const temps = hours.map((h) => (unit === "c" ? h.temp_c : h.temp_f));
  const min = Math.min(...temps), max = Math.max(...temps);
  const span = Math.max(1, max - min);

  const points = hours.map((h, i) => {
    const x = PAD + (i / (hours.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((temps[i] - min) / span) * (H - PAD * 2 - 20);
    return { x, y, h };
  });

  const linePath = points.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`;

  let currentIdx = 0;
  let bestDiff = Infinity;
  hours.forEach((h, i) => {
    const diff = Math.abs(h.time_epoch - nowEpoch);
    if (diff < bestDiff){ bestDiff = diff; currentIdx = i; }
  });
  const cur = points[currentIdx];

  const labelIdx = [0, 6, 12, 18, hours.length - 1];
  const labels = labelIdx.map((i) => {
    const p = points[i];
    const hh = new Date(hours[i].time.replace(" ", "T")).getHours();
    return `<text x="${p.x}" y="${H - 4}" class="chart-tooltip" text-anchor="middle">${hh}:00</text>`;
  }).join("");

  svg.innerHTML = `
    <defs>
      <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--cyan)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#chartFill)" stroke="none"/>
    <path d="${linePath}" fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${cur.x}" y1="${PAD}" x2="${cur.x}" y2="${H - PAD}" stroke="var(--amber)" stroke-width="1" stroke-dasharray="3 3"/>
    <circle cx="${cur.x}" cy="${cur.y}" r="4.5" fill="var(--amber)"/>
    <text x="${cur.x}" y="${cur.y - 10}" class="chart-tooltip" text-anchor="middle" fill="var(--amber)">${Math.round(temps[currentIdx])}°</text>
    ${labels}
  `;
}

// ============================================================
// FORECAST STRIP
// ============================================================
function renderForecast(days){
  el("forecast").innerHTML = days.map((d, i) => {
    const date = new Date(d.date + "T00:00:00");
    const label = i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
    const maxT = unit === "c" ? d.day.maxtemp_c : d.day.maxtemp_f;
    const minT = unit === "c" ? d.day.mintemp_c : d.day.mintemp_f;
    return `
    <div class="fc-card">
      <div>${iconForCondition(d.day.condition.text, 1)}</div>
      <div>
        <div class="fc-day">${label}</div>
        <div class="fc-cond">${d.day.condition.text}</div>
        <div class="fc-temps"><span class="max">${Math.round(maxT)}°</span> <span class="min">${Math.round(minT)}°</span></div>
        <div class="fc-rain">☂ ${d.day.daily_chance_of_rain}% rain</div>
      </div>
    </div>`;
  }).join("");
}

// ============================================================
// CLOCK / GREETING / BACKGROUND MOOD
// ============================================================
let clockTimer = null;
function startClock(tzId, isDay, conditionText){
  if (clockTimer) clearInterval(clockTimer);
  const update = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: tzId }));
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    el("day").innerText = `${hh}:${mm}`;

    const hour = now.getHours();
    let greeting = "GOOD EVENING";
    if (hour < 12) greeting = "GOOD MORNING";
    else if (hour < 18) greeting = "GOOD AFTERNOON";
    el("greeting").innerText = greeting;
  };
  update();
  clockTimer = setInterval(update, 15000);

  document.body.dataset.tod = isDay ? "day" : "night";
  document.body.dataset.mood = /rain|drizzle|shower|thunder/i.test(conditionText || "") ? "rain" : "";
}

// ============================================================
// RECENTS (localStorage)
// ============================================================
function getRecents(){
  try { return JSON.parse(localStorage.getItem("wx_recents") || "[]"); }
  catch { return []; }
}
function pushRecent(name){
  let list = getRecents().filter((c) => c.toLowerCase() !== name.toLowerCase());
  list.unshift(name);
  list = list.slice(0, 5);
  localStorage.setItem("wx_recents", JSON.stringify(list));
  renderRecents();
}
function renderRecents(){
  const list = getRecents();
  recentsRow.innerHTML = list.map((c) => `<button data-city="${c}">${c}</button>`).join("");
  recentsRow.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      loc.value = btn.dataset.city;
      fetchAndRender(btn.dataset.city);
    });
  });
}

// ============================================================
// MAIN RENDER
// ============================================================
function renderAll(data){
  lastData = data;
  const { location, current, forecast } = data;
  const today = forecast.forecastday[0];

  el("location").innerText = location.name;
  el("region").innerText = [location.region, location.country].filter(Boolean).join(", ");
  el("tz").innerText = current.is_day ? "CURRENT CONDITIONS · DAY" : "CURRENT CONDITIONS · NIGHT";

  el("condIcon").innerHTML = iconForCondition(current.condition.text, current.is_day);
  el("cast").innerText = current.condition.text;

  const temp = unit === "c" ? current.temp_c : current.temp_f;
  const feels = unit === "c" ? current.feelslike_c : current.feelslike_f;
  el("temp").innerText = Math.round(temp);
  el("tempUnit").innerText = unit === "c" ? "°C" : "°F";
  el("feel").innerText = Math.round(feels);
  el("feelUnit").innerText = unit === "c" ? "°C" : "°F";

  const maxT = unit === "c" ? today.day.maxtemp_c : today.day.maxtemp_f;
  const minT = unit === "c" ? today.day.mintemp_c : today.day.mintemp_f;
  el("hiTemp").innerText = Math.round(maxT) + "°";
  el("loTemp").innerText = Math.round(minT) + "°";
  el("rainChance").innerText = today.day.daily_chance_of_rain + "%";

  el("sunrise").innerText = today.astro.sunrise;
  el("sunset").innerText = today.astro.sunset;

  renderGauges(current);
  renderAirQuality(current.air_quality);
  renderChart(today.hour, current.last_updated_epoch);
  renderForecast(forecast.forecastday);
  startClock(location.tz_id, current.is_day, current.condition.text);

  document.title = `${Math.round(temp)}° ${unit === "c" ? "C" : "F"} · ${location.name} — Weatherstation`;
}

// ============================================================
// API
// ============================================================
async function getData(query){
  const url = `${API_BASE}?key=${API_KEY}&q=${encodeURIComponent(query)}&days=3&aqi=yes&alerts=no`;
  const res = await fetch(url);
  if (!res.ok){
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Request failed (${res.status})`);
  }
  return res.json();
}

function showError(msg){
  errorBanner.innerText = msg;
  errorBanner.classList.add("show");
}
function clearError(){
  errorBanner.classList.remove("show");
}

async function fetchAndRender(query){
  clearError();
  document.getElementById("heroSection").classList.add("skeleton");
  try{
    const data = await getData(query);
    renderAll(data);
    pushRecent(data.location.name);
    localStorage.setItem("wx_last_city", data.location.name);
  } catch (err){
    showError(err.message || "Couldn't find that location — check the spelling and try again.");
  } finally {
    document.getElementById("heroSection").classList.remove("skeleton");
  }
}

// ============================================================
// EVENTS
// ============================================================
searchBtn.addEventListener("click", () => {
  const value = loc.value.trim();
  if (!value){ showError("Type a city, postcode, or coordinates to search."); return; }
  fetchAndRender(value);
});

loc.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation){
    showError("Geolocation isn't available in this browser.");
    return;
  }
  locateBtn.classList.add("spin");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const q = `${pos.coords.latitude},${pos.coords.longitude}`;
      fetchAndRender(q).finally(() => locateBtn.classList.remove("spin"));
    },
    () => {
      showError("Location permission denied — search for a city instead.");
      locateBtn.classList.remove("spin");
    }
  );
});

function setUnit(next){
  unit = next;
  localStorage.setItem("wx_unit", unit);
  unitCBtn.classList.toggle("active", unit === "c");
  unitCBtn.setAttribute("aria-pressed", unit === "c");
  unitFBtn.classList.toggle("active", unit === "f");
  unitFBtn.setAttribute("aria-pressed", unit === "f");
  if (lastData) renderAll(lastData);
}
unitCBtn.addEventListener("click", () => setUnit("c"));
unitFBtn.addEventListener("click", () => setUnit("f"));

// ============================================================
// INIT
// ============================================================
(function init(){
  setUnit(unit);
  renderRecents();
  const startCity = localStorage.getItem("wx_last_city") || "London";
  loc.value = startCity;
  fetchAndRender(startCity);
})();
