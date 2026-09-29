// Test tamu misterius: spawn → jalan ke meja → ngobrol (bubble) → pulang → hilang.
const assert = require("assert");

const fakeCtx = {
  fillRect: () => {}, fillText: () => {},
  set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
};
const fakeCanvas = {
  addEventListener: () => {}, style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 }),
  getContext: () => fakeCtx,
  width: 256, height: 64,
};
const fakeContainer = {
  clientWidth: 1280, clientHeight: 800,
  appendChild: () => {}, innerHTML: "",
};
global.window = { devicePixelRatio: 1, addEventListener: () => {} };
global.document = {
  getElementById: (id) => (id === "scene-container" ? fakeContainer : null),
  createElement: (tag) => (tag === "canvas" ? fakeCanvas : {}),
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
global.requestAnimationFrame = () => {};

const { OfficeScene } = require("../js/office.js");
const s = new OfficeScene("scene-container");
assert.strictEqual(s.init(), true);

const toasts = [];
s._propCb = (m) => toasts.push(m);
s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 });
s.setAgentState("vesper", "working");

// Spawn tamu
const rec = s._spawnGuest();
assert.ok(rec, "tamu ter-spawn");
assert.ok(s.agents["tamu"], "tamu terdaftar");
assert.strictEqual(rec.guest, true, "flag guest");
assert.ok(toasts.some((m) => m.includes("tamu")), `toast tamu: ${toasts}`);
assert.ok(rec.targetPos.distanceTo(new THREE.Vector3(2.0, 0, 0.6)) < 1e-9, "tamu menuju meja Vesper");
// Tidak bisa double-spawn
assert.strictEqual(s._spawnGuest(), null, "tidak double spawn");
console.log("guest spawn OK");

// Tamu jalan sampai dekat meja → fase ngobrol + bubble muncul
let phase = "";
for (let i = 0; i < 60 && phase !== "ngobrol"; i++) {
  s._tickFns.forEach((fn) => fn(0.2, i * 0.2));
  phase = s.agents["tamu"] ? s.agents["tamu"]._gPhase : "";
}
assert.strictEqual(phase, "ngobrol", "tamu sampai & ngobrol");
assert.strictEqual(s.agents["tamu"]._bubble.visible, true, "bubble ... tampil");
console.log("guest chat OK");

// Waktu habis → pulang → hilang dari scene
s.agents["tamu"]._gT = 0.01;
for (let i = 0; i < 120 && s.agents["tamu"]; i++) {
  s._tickFns.forEach((fn) => fn(0.2, 100 + i * 0.2));
}
assert.ok(!s.agents["tamu"], "tamu pulang & terhapus");
console.log("guest leave OK");

console.log("guest tests PASS");
