/* ============================================================
   KONFIGURASI: tempel URL Web App dari Google Apps Script di sini
   Contoh: "https://script.google.com/macros/s/AKfycb.../exec"
   Jika dikosongkan, website berjalan dalam MODE DEMO (data lokal).
   ============================================================ */
const WEB_APP_URL = "";

const CITIES = [
  { name: "Yogyakarta", prov: "DI Yogyakarta", emoji: "🏯", region: "jawa", g: ["#2b6f9e", "#8fd3f7"] },
  { name: "Bandung", prov: "Jawa Barat", emoji: "⛰️", region: "jawa", g: ["#1c5d86", "#6cc6e8"] },
  { name: "Jakarta", prov: "DKI Jakarta", emoji: "🏙️", region: "jawa", g: ["#173f5f", "#4fb3ea"] },
  { name: "Malang", prov: "Jawa Timur", emoji: "🌋", region: "jawa", g: ["#2a7fae", "#b5e3fa"] },
  { name: "Surabaya", prov: "Jawa Timur", emoji: "🦈", region: "jawa", g: ["#1f5f8b", "#7ccbf0"] },
  { name: "Denpasar", prov: "Bali", emoji: "🛕", region: "luar", g: ["#2f86b8", "#a5dcf7"] },
  { name: "Medan", prov: "Sumatera Utara", emoji: "🌴", region: "luar", g: ["#195373", "#5bbbe8"] },
  { name: "Makassar", prov: "Sulawesi Selatan", emoji: "⛵", region: "luar", g: ["#236a96", "#93d5f4"] }
];
const cityOf = n => CITIES.find(c => c.name === n);
const emojiOf = n => (cityOf(n) || { emoji: "📍" }).emoji;
const $ = id => document.getElementById(id);
const DEMO_KEY = "lokakota_demo_votes";
let state = { counts: {}, total: 0, recent: [] };
let filter = "all";

/* ---------- Scroll reveal ---------- */
const io = "IntersectionObserver" in window
  ? new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("show"); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" })
  : null;
function reveal(root = document) {
  root.querySelectorAll(".reveal:not(.show)").forEach(el => io ? io.observe(el) : el.classList.add("show"));
}

/* ---------- Helper ---------- */
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
function countUp(el, to) {
  const from = parseInt(el.textContent.replace(/\D/g, "")) || 0;
  if (from === to) { el.textContent = to.toLocaleString("id-ID"); return; }
  const t0 = performance.now(), dur = 900;
  (function step(t) {
    const p = Math.min((t - t0) / dur, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))).toLocaleString("id-ID");
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------- Data ---------- */
let memRows = [];
function demoLoad() {
  try { const r = JSON.parse(localStorage.getItem(DEMO_KEY)); if (Array.isArray(r)) return r; } catch (e) {}
  return memRows;
}
function demoSave(rows) {
  memRows = rows;
  try { localStorage.setItem(DEMO_KEY, JSON.stringify(rows)); } catch (e) {}
}
function summarize(rows) {
  const counts = {};
  CITIES.forEach(c => counts[c.name] = 0);
  rows.forEach(r => { if (r.city in counts) counts[r.city]++; });
  return { counts, total: rows.length, recent: rows.slice(-6).reverse() };
}
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const urlOk = () => /^https:\/\/script\.google\.com\/.+\/exec$/.test(WEB_APP_URL);
const POST_HEAD = { "Content-Type": "text/plain;charset=utf-8" }; // tanpa preflight CORS
async function readJson(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch (e) {
    throw new Error("Respons bukan dari Apps Script. Pastikan deploy Web App memakai 'Who has access: Anyone' dan URL berakhiran /exec");
  }
}
async function loadData() {
  if (!WEB_APP_URL) return summarize(demoLoad());
  if (!urlOk()) throw new Error("URL Web App tidak valid (harus diawali https://script.google.com dan berakhiran /exec)");
  const res = await fetch(WEB_APP_URL + "?t=" + Date.now());
  const d = await readJson(res);
  if (!d || d.ok === false) throw new Error((d && d.error) || "Respons tidak valid");
  return { counts: d.counts || {}, total: d.total || 0, recent: d.recent || [] };
}
async function sendVote(payload) {
  if (!WEB_APP_URL) {
    const rows = demoLoad().slice();
    rows.push(Object.assign({ time: new Date().toISOString() }, payload));
    demoSave(rows);
    return;
  }
  if (!urlOk()) throw new Error("URL Web App tidak valid");
  const body = JSON.stringify(payload);
  try {
    const d = await readJson(await fetch(WEB_APP_URL, { method: "POST", headers: POST_HEAD, body }));
    if (!d.ok) throw new Error(d.error || "Gagal menyimpan");
    return;
  } catch (err) {
    if (err.name !== "TypeError") throw err; // hanya kegagalan jaringan/CORS yang dicoba ulang
  }
  // Cadangan: kirim ulang tanpa membaca respons. Aman karena server menolak ID ganda.
  await fetch(WEB_APP_URL, { method: "POST", mode: "no-cors", headers: POST_HEAD, body });
  await new Promise(r => setTimeout(r, 2500));
  const d = await loadData();
  if (!d.recent.some(r => r.id === payload.id)) {
    throw new Error("Tidak dapat memastikan data masuk. Periksa pengaturan deploy Web App");
  }
}

/* ---------- Render ---------- */
function renderGrid() {
  const list = CITIES.filter(c => filter === "all" || c.region === filter);
  $("grid").innerHTML = list.map((c, i) => `
    <button class="cty reveal" style="--d:${i * 0.08}s" data-c="${c.name}" type="button">
      <div class="art" style="background:linear-gradient(160deg,${c.g[0]},${c.g[1]})"><span>${c.emoji}</span></div>
      <b>${esc(c.name)}, ${esc(c.prov)}</b>
      <small>${(Number(state.counts[c.name]) || 0).toLocaleString("id-ID")} suara · klik untuk memilih</small>
    </button>`).join("");
  reveal($("grid"));
}

function render() {
  renderGrid();
  const list = CITIES.map(c => ({ name: c.name, emoji: c.emoji, v: Number(state.counts[c.name]) || 0 }))
    .sort((a, b) => b.v - a.v);
  const total = list.reduce((s, x) => s + x.v, 0);

  $("rows").innerHTML = list.map((x, i) => {
    const pct = total ? Math.round(x.v / total * 100) : 0;
    return `<div class="row reveal" style="--d:${i * 0.06}s">
      <span class="n">${i + 1}</span><span>${x.emoji} ${esc(x.name)}</span>
      <span class="v">${x.v.toLocaleString("id-ID")} suara · ${pct}%</span>
      <div class="bar"><i data-w="${pct}"></i></div></div>`;
  }).join("");
  reveal($("rows"));
  setTimeout(() => $("rows").querySelectorAll(".bar i").forEach(b => b.style.width = b.dataset.w + "%"), 300);

  countUp($("sTotal"), total);
  if (total) {
    $("iTop").textContent = list[0].emoji;
    $("pTop").textContent = list[0].name;
    $("pTopS").textContent = list[0].v.toLocaleString("id-ID") + " suara";
  } else {
    $("iTop").textContent = "🏆"; $("pTop").textContent = "Belum ada"; $("pTopS").textContent = "Menunggu suara pertama";
  }
  const last = state.recent[0];
  if (last) {
    $("iLast").textContent = emojiOf(last.city);
    $("pLast").textContent = last.city;
    $("pLastS").textContent = last.name ? "dipilih oleh " + last.name : "dipilih oleh Anonim";
  } else {
    $("iLast").textContent = "🕒"; $("pLast").textContent = "Belum ada"; $("pLastS").textContent = "Jadilah yang pertama";
  }
  $("updated").textContent = (WEB_APP_URL ? "Terhubung ke spreadsheet" : "Mode demo (lokal)") +
    " · diperbarui " + new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + ".";

  const withWhy = state.recent.filter(r => r.reason || r.name);
  $("cm").innerHTML = withWhy.length
    ? withWhy.map((r, i) => `<article class="reveal" style="--d:${i * 0.08}s">
        <div class="w">${emojiOf(r.city)} ${esc(r.name || "Anonim")} memilih ${esc(r.city)}</div>
        <p>${r.reason ? esc(r.reason) : "Tanpa alasan, tapi tetap cinta."}</p></article>`).join("")
    : `<div class="empty">Belum ada alasan. Jadilah yang pertama memberi suara!</div>`;
  reveal($("cm"));
}

async function refresh() {
  try { state = await loadData(); }
  catch (e) {
    state = summarize([]);
    console.error(e);
    render();
    $("updated").textContent = "Gagal memuat data: " + e.message;
    return;
  }
  render();
}

/* ---------- Penanda bagian aktif ---------- */
function spy() {
  const links = [...document.querySelectorAll("#dots a")];
  const menu = [...document.querySelectorAll("#menu a")];
  const secs = ["s1", "s2", "s3", "s4", "s5"].map(id => $(id));
  const onScroll = () => {
    const y = window.scrollY + window.innerHeight * 0.4;
    let cur = 0;
    secs.forEach((s, i) => { if (s.offsetTop <= y) cur = i; });
    links.forEach((a, i) => a.classList.toggle("on", i === cur));
    menu.forEach((a, i) => a.classList.toggle("on", i === cur));
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ---------- Init ---------- */
function init() {
  $("fCity").innerHTML = '<option value="">— Pilih kota —</option>' +
    CITIES.map(c => `<option value="${c.name}">${c.emoji} ${c.name}, ${c.prov}</option>`).join("");

  $("pill").addEventListener("click", e => {
    const b = e.target.closest("button[data-f]");
    if (!b) return;
    filter = b.dataset.f;
    $("pill").querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    renderGrid();
  });

  $("grid").addEventListener("click", e => {
    const b = e.target.closest(".cty");
    if (!b) return;
    $("fCity").value = b.dataset.c;
    $("s4").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => $("fCity").focus({ preventScroll: true }), 700);
  });

  $("form").addEventListener("submit", async e => {
    e.preventDefault();
    const msg = $("fMsg"), btn = $("fBtn"), city = $("fCity").value;
    msg.className = "msg";
    if (!city) { msg.textContent = "Pilih salah satu kota terlebih dahulu."; msg.classList.add("err"); return; }
    btn.disabled = true; btn.textContent = "Mengirim…"; msg.textContent = "";
    try {
      await sendVote({ id: newId(), name: $("fName").value.trim(), city, reason: $("fWhy").value.trim() });
      msg.textContent = "Terima kasih! Suaramu untuk " + city + " sudah tersimpan.";
      msg.classList.add("ok");
      $("form").reset();
      await refresh();
    } catch (err) {
      msg.textContent = "Suara belum terkirim: " + err.message + ". Coba lagi.";
      msg.classList.add("err");
    } finally { btn.disabled = false; btn.textContent = "Kirim suara"; }
  });

  reveal();
  spy();
  refresh();
}
document.addEventListener("DOMContentLoaded", init);
