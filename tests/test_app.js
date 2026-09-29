// Test wiring app.js: data → UI + avatar, error states, recovery.
// Fake DOM + stub fetch; THREE/WebGL di-stub seperti test sebelumnya.
const assert = require("assert");
const fs = require("fs");

class FakeEl {
  constructor() {
    this.textContent = "";
    this.className = "";
    this.innerHTML = "";
    this.children = [];
    this.style = {};
    this._listeners = {};
    this._cls = new Set();
  }
  get classList() {
    const self = this;
    return {
      add: (c) => self._cls.add(c),
      remove: (c) => self._cls.delete(c),
      toggle: (c, force) => {
        const on = force === undefined ? !self._cls.has(c) : !!force;
        if (on) self._cls.add(c); else self._cls.delete(c);
      },
      contains: (c) => self._cls.has(c),
    };
  }
  appendChild(ch) { this.children.push(ch); }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  scrollTo() {}
}

const fakeCtx = {
  fillRect: () => {}, fillText: () => {},
  set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
};
const fakeCanvas = {
  addEventListener: () => {}, style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  getContext: () => fakeCtx, width: 256, height: 64,
};

const THREE = require("../vendor/three.min.js");
class FakeRenderer {
  constructor() { this.domElement = fakeCanvas; this.shadowMap = {}; }
  setPixelRatio() {} setSize() {} render() {}
}
class FakeControls {
  constructor() { this.target = { set: () => {} }; }
  update() {}
}
THREE.WebGLRenderer = FakeRenderer;
THREE.OrbitControls = FakeControls;
global.THREE = THREE;
global.window = { devicePixelRatio: 1, addEventListener: () => {} };
global.requestAnimationFrame = () => {};

const IDS = ["scene-container", "loading", "sheet", "status-card", "agent-name",
  "state-badge", "activity-text", "updated-text", "feed-list", "feed-title",
  "error-bar", "error-text", "retry-btn", "hint", "toast",
  "room-btns", "btn-kantor", "btn-rapat", "sheet-handle"];

let els = {};
function freshDom() {
  els = {};
  IDS.forEach((id) => { els[id] = new FakeEl(); });
  els["scene-container"].clientWidth = 1280;
  els["scene-container"].clientHeight = 800;
  global.document = {
    getElementById: (id) => els[id] || null,
    createElement: (tag) => (tag === "canvas" ? fakeCanvas : new FakeEl()),
    readyState: "complete",
    addEventListener: () => {},
  };
}

function freshModules() {
  ["../js/data.js", "../js/office.js", "../js/app.js"].forEach((p) => {
    delete require.cache[require.resolve(p)];
  });
  const dc = require("../js/data.js");
  const off = require("../js/office.js");
  // Cerminkan environment browser: script tag menaruh semuanya di global.
  global.DataClient = dc.DataClient;
  global.parseFeed = dc.parseFeed;
  global.timeAgo = dc.timeAgo;
  global.OfficeScene = off.OfficeScene;
  let captured = null;
  const setStateCalls = [];
  const clickCbs = [];
  dc.DataClient.prototype.startPolling = function (onUpdate, onError) {
    captured = { onUpdate, onError };
    return () => {};
  };
  const origSet = off.OfficeScene.prototype.setAgentState;
  off.OfficeScene.prototype.setAgentState = function (id, state) {
    setStateCalls.push([id, state]);
    return origSet.call(this, id, state);
  };
  const origClick = off.OfficeScene.prototype.onAgentClick;
  off.OfficeScene.prototype.onAgentClick = function (cb) {
    clickCbs.push(cb);
    return origClick.call(this, cb);
  };
  const focusCalls = [];
  const origFocus = off.OfficeScene.prototype.focusRoom;
  off.OfficeScene.prototype.focusRoom = function (name) {
    focusCalls.push(name);
    return origFocus.call(this, name);
  };
  const app = require("../js/app.js");
  return { app, getCaptured: () => captured, setStateCalls, clickCbs, focusCalls };
}

const repo = __dirname + "/..";
const agentsData = JSON.parse(fs.readFileSync(repo + "/agents.json", "utf8"));
const statusData = JSON.parse(fs.readFileSync(repo + "/status/vesper.json", "utf8"));
const feedData = JSON.parse(fs.readFileSync(repo + "/feed/vesper.json", "utf8"));
const mochiStatus = JSON.parse(fs.readFileSync(repo + "/status/mochi.json", "utf8"));
const mochiFeed = JSON.parse(fs.readFileSync(repo + "/feed/mochi.json", "utf8"));

function fetchFor(map) {
  return async (url) => {
    const path = url.split("?")[0].replace(/^\.\//, "");
    if (!(path in map)) return { ok: false, status: 404, json: async () => { throw new Error("404"); } };
    const v = map[path];
    if (v instanceof Error) throw v;
    if (v && v.__badJson) return { ok: true, json: async () => { throw new SyntaxError("Unexpected token"); } };
    return { ok: true, json: async () => JSON.parse(JSON.stringify(v)) };
  };
}
const BAD_JSON = { __badJson: true };
const ticks = async (n = 8) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };

// Stub fetch mutable: DataClient mengikat fetch saat konstruksi,
// jadi perilakunya diubah lewat currentMap, bukan ganti global.fetch.
let currentMap = null;
global.fetch = (url) => {
  if (!currentMap) throw new Error("offline");
  return fetchFor(currentMap)(url);
};
// localStorage stub: app.js mengingat pilihan lipat kolom.
global.localStorage = {
  _s: {},
  getItem(k) { return this._s[k] || null; },
  setItem(k, v) { this._s[k] = String(v); },
};
const goodMap = () => ({
  "agents.json": agentsData,
  "status/vesper.json": statusData,
  "feed/vesper.json": feedData,
  "status/mochi.json": mochiStatus,
  "feed/mochi.json": mochiFeed,
});

(async () => {
  // ===== Lifecycle A: happy path + polling + error + retry =====
  freshDom();
  currentMap = goodMap();
  const { app, getCaptured, setStateCalls, clickCbs, focusCalls } = freshModules();
  app.init();
  await ticks();

  assert.strictEqual(els["agent-name"].textContent, "Vesper", "nama agent tampil");
  // Ekspektasi diturunkan dari isi status/vesper.json (file live, isinya bisa berubah).
  var STATE_LABEL = { working: "kerja", idle: "santai", sleeping: "tidur" };
  var expLabel = STATE_LABEL[statusData.state] || statusData.state;
  assert.strictEqual(els["state-badge"].textContent, expLabel, "badge ikut state file");
  assert.strictEqual(els["state-badge"].className, statusData.state, "badge class ikut state file");
  assert.ok(els["activity-text"].textContent.trim().length > 0, "aktivitas tampil");
  assert.ok(els["updated-text"].textContent.includes("update"), "waktu update tampil");
  assert.strictEqual(els["feed-list"].children.length, global.parseFeed(feedData).length, "feed sesuai data");
  assert.ok(els["loading"].classList.contains("hidden"), "loading hilang");
  assert.ok(!els["error-bar"].classList.contains("show"), "error bar sembunyi");
  assert.ok(setStateCalls.some((c) => c[0] === "vesper" && c[1] === statusData.state), "avatar di-set sesuai state file");
  console.log("happy path OK");

  // Klik avatar → kartu disorot
  assert.strictEqual(clickCbs.length, 1, "click handler terdaftar");
  clickCbs[0]("vesper");
  assert.ok(els["status-card"].style.background.includes("45,212,191"), "kartu disorot saat klik avatar");
  console.log("klik avatar OK");

  // Klik Mochi → toast sapaan (bukan sorot kartu)
  els["toast"].textContent = "";
  clickCbs[0]("mochi");
  assert.ok(els["toast"].textContent.includes("Mochi"), "toast sapa Mochi");
  assert.ok(els["toast"].classList.contains("show"), "toast tampil");
  console.log("klik mochi OK");

  // Tombol ruangan → focusRoom terpanggil + kelas active pindah
  els["btn-rapat"]._listeners.click[0]();
  assert.deepStrictEqual(focusCalls, ["rapat"], "focusRoom('rapat') terpanggil");
  assert.ok(els["btn-rapat"].classList.contains("active"), "btn rapat aktif");
  assert.ok(!els["btn-kantor"].classList.contains("active"), "btn kantor nonaktif");
  els["btn-kantor"]._listeners.click[0]();
  assert.deepStrictEqual(focusCalls, ["rapat", "kantor"], "focusRoom('kantor') terpanggil");
  assert.ok(els["btn-kantor"].classList.contains("active"), "btn kantor aktif lagi");
  console.log("tombol ruangan OK");

  // Handle lipat kolom: klik → collapsed, klik lagi → buka, pilihan tersimpan
  assert.ok(!els["sheet"].classList.contains("collapsed"), "sheet awal terbuka");
  els["sheet-handle"]._listeners.click[0]();
  assert.ok(els["sheet"].classList.contains("collapsed"), "sheet terlipat setelah klik");
  assert.strictEqual(global.localStorage.getItem("kantor-vesper-sheet"), "1", "pilihan tersimpan");
  els["sheet-handle"]._listeners.click[0]();
  assert.ok(!els["sheet"].classList.contains("collapsed"), "sheet terbuka lagi");
  assert.strictEqual(global.localStorage.getItem("kantor-vesper-sheet"), "0", "pilihan terupdate");
  console.log("lipat kolom OK");

  // Polling: state berubah working → sleeping
  const cap = getCaptured();
  assert.ok(cap, "polling callbacks tercapture");
  cap.onUpdate({
    agents: agentsData.agents,
    statuses: { vesper: Object.assign({}, statusData, { state: "sleeping", activity: "tidur" }) },
    feeds: { vesper: global.parseFeed(feedData) },
  });
  assert.strictEqual(els["state-badge"].textContent, "tidur", "badge ikut berubah");
  assert.strictEqual(els["state-badge"].className, "sleeping");
  assert.ok(setStateCalls.some((c) => c[0] === "vesper" && c[1] === "sleeping"), "avatar pose sleeping");
  console.log("polling state change OK");

  // (a) JSON invalid saat retry → error bar muncul, UI TIDAK berubah
  currentMap = Object.assign(goodMap(), { "status/vesper.json": BAD_JSON });
  els["retry-btn"]._listeners.click[0]();
  await ticks();
  assert.ok(els["error-bar"].classList.contains("show"), "error bar muncul saat JSON invalid");
  assert.strictEqual(els["agent-name"].textContent, "Vesper", "UI tidak berubah saat error");
  assert.strictEqual(els["state-badge"].textContent, "tidur", "badge tidak berubah saat error");
  console.log("invalid JSON → error bar OK, UI tidak berubah OK");

  // (b) restore → retry → pulih
  currentMap = goodMap();
  els["retry-btn"]._listeners.click[0]();
  await ticks();
  assert.ok(!els["error-bar"].classList.contains("show"), "error bar hilang setelah pulih");
  assert.strictEqual(els["state-badge"].textContent, expLabel, "data segar tampil lagi");
  console.log("recovery OK");

  // ===== Lifecycle B: fetch gagal total sejak awal =====
  freshDom();
  currentMap = null;
  const m2 = freshModules();
  m2.app.init();
  await ticks();
  assert.ok(els["error-bar"].classList.contains("show"), "error bar muncul saat offline");
  assert.ok(els["error-text"].textContent.includes("coba lagi"), "pesan ajak coba lagi");
  assert.strictEqual(els["agent-name"].textContent, "", "tidak crash, UI tetap kosong");
  console.log("initial offline OK");

  // ===== (c) guard vendor hilang ada di index.html =====
  const html = fs.readFileSync(repo + "/index.html", "utf8");
  assert.ok(html.includes('typeof THREE === "undefined"'), "guard THREE ada");
  assert.ok(html.includes("Three.js gagal dimuat"), "pesan jelas saat vendor hilang");
  assert.ok(html.includes('src="js/app.js"'), "app.js dimuat");
  console.log("vendor guard OK");

  // ===== Lifecycle C: query param demo (?cuaca=hujan&vesper=santai) =====
  freshDom();
  currentMap = goodMap();
  global.location = { search: "?cuaca=hujan&vesper=santai&jam=12&tamu=1&hari=0&kucing=1" };
  const m3 = freshModules();
  m3.app.init();
  await ticks(12);
  const kantor = global.window.__kantor;
  assert.ok(kantor, "__kantor terekspos");
  assert.strictEqual(kantor.weather, "hujan", "?cuaca=hujan diterapkan");
  // Param vesper diterapkan SETELAH state file (override menang)
  const vesperCalls = m3.setStateCalls.filter((c) => c[0] === "vesper").map((c) => c[1]);
  assert.ok(vesperCalls.includes(statusData.state), "state file tetap diterapkan dulu");
  assert.strictEqual(vesperCalls[vesperCalls.length - 1], "santai", "?vesper=santai menang terakhir");
  kantor._tickFns.forEach((fn) => fn(0.1, 1)); // jalankan tick mode manual
  assert.ok(kantor._seatOverride && kantor._seatOverride.vesper, "?jam=12 memicu mode makan siang");
  assert.ok(kantor.agents["tamu"], "?tamu=1 memanggil tamu");
  assert.strictEqual(kantor._today(), 0, "?hari=0 memaksa hari Minggu");
  assert.strictEqual(kantor._cat.visible, true, "?kucing=1 memunculkan kucing");
  delete global.location;
  console.log("query param OK");

  console.log("app wiring tests PASS");
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
