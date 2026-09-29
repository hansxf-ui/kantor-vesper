// Test robot vacuum: muncul Minggu jam 8-10, jalan-jalan, hilang di luar itu.
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
s._lunchHour = () => 9;
s._today = () => 0; // Minggu
s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 });
s.setAgentState("vesper", "idle");

s._tickFns.forEach((fn) => fn(0.1, 1));
assert.strictEqual(s._vacuumOn, true, "vacuum aktif Minggu jam 9");
assert.strictEqual(s._vacuum.visible, true, "vacuum terlihat");
assert.ok(toasts.some((m) => m.includes("vacuum")), `toast vacuum: ${toasts}`);
console.log("vacuum start OK");

// Vacuum bergerak
const p0 = s._vacuum.position.clone();
for (let i = 0; i < 20; i++) s._tickFns.forEach((fn) => fn(0.2, 2 + i * 0.2));
assert.ok(s._vacuum.position.distanceTo(p0) > 0.3, "vacuum jalan-jalan");
console.log("vacuum move OK");

// Hari Rabu → tidak aktif
s._today = () => 3;
s._tickFns.forEach((fn) => fn(0.1, 999));
assert.strictEqual(s._vacuumOn, false, "vacuum mati hari Rabu");
assert.strictEqual(s._vacuum.visible, false, "vacuum disembunyikan");
console.log("vacuum off OK");

console.log("vacuum tests PASS");
