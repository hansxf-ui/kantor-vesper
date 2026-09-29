// Test kasih makan Mochi: klik kue → mode feeding → klik Mochi → happy jump + hati.
// Stub sama seperti test_interactive.js.
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
s.addAgent({ id: "vesper", nama: "Vesper" });
s.addAgent({ id: "mochi", nama: "Mochi", warna: "#7fe0c3", wander: true });

const toasts = [];
s.onPropClick((m) => toasts.push(m));

// Piring kue terdaftar & ada di meja kopi
const kue = s.clickables.find((c) => c.name === "kue");
assert.ok(kue, "clickable 'kue' ada");
assert.ok(s._plate, "piring kue ada di scene");
assert.ok(
  Math.abs(s._plate.position.x - -2.55) < 0.01 && Math.abs(s._plate.position.z - 2.95) < 0.01,
  "piring di meja kopi"
);
console.log("piring OK");

// Klik kue → mode feeding nyala
let msg = kue.action();
assert.strictEqual(s._feeding, true, "mode feeding nyala");
assert.ok(msg.includes("Mochi"), `toast ajak klik Mochi: ${msg}`);

// Klik kue lagi → batal
msg = kue.action();
assert.strictEqual(s._feeding, false, "mode feeding mati (toggle)");
console.log("toggle OK");

// tryFeed Mochi → happy jump + hati + pesan bener
kue.action(); // feeding nyala lagi
assert.strictEqual(s._feeding, true);
msg = s.tryFeed("mochi");
const mochi = s.agents["mochi"];
assert.strictEqual(s._feeding, false, "feeding mati setelah nyuapin");
assert.ok(msg.includes("seneng banget"), `pesan nyuapin: ${msg}`);
assert.ok(mochi._happy > 2, `happy timer jalan: ${mochi._happy}`);
assert.strictEqual(s._hearts.length, 1, "hati muncul 1");
console.log("nyuapin OK");

// Happy jump: lompat lebih tinggi dari jalan biasa (0.28) + tangan ke atas
let maxY = 0;
for (let i = 0; i < 10; i++) {
  s._tickFns.forEach((fn) => fn(0.05, i * 0.05));
  if (mochi.group.position.y > maxY) maxY = mochi.group.position.y;
}
assert.ok(maxY > 0.5, `lompat kegirangan tinggi (maxY ${maxY.toFixed(2)})`);
assert.ok(mochi._happy < 2.5, "happy timer berkurang");
// Hati naik dulu sebelum memudar
assert.ok(s._hearts.length === 1 && s._hearts[0].m.position.y > 2.3, "hati naik");
for (let i = 0; i < 60; i++) s._tickFns.forEach((fn) => fn(0.05, 10 + i * 0.05));
assert.strictEqual(s._hearts.length, 0, "hati hilang setelah 1.6 dtk");
console.log("happy jump OK");

// Happy selesai → tangan balik normal
assert.ok(Math.abs(mochi.parts.armL.rotation.z) < 0.01, "tangan kiri balik");
assert.ok(Math.abs(mochi.parts.armR.rotation.z) < 0.01, "tangan kanan balik");
console.log("reset tangan OK");

// tryFeed ke Vesper (salah sasaran) → batal + pesan koreksi
kue.action();
msg = s.tryFeed("vesper");
assert.strictEqual(s._feeding, false, "feeding mati");
assert.ok(msg.includes("Mochi"), `pesan koreksi: ${msg}`);
assert.ok(!(s.agents["vesper"]._happy > 0), "vesper nggak ikut happy");
console.log("salah sasaran OK");

console.log("feeding tests PASS");
