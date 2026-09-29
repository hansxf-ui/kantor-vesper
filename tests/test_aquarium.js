// Test akuarium: ikan berenang, gelembung naik, bisa diklik.
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

// 5 ikan ada
assert.ok(s._fishes, "ikan terdaftar");
assert.strictEqual(s._fishes.length, 5, "5 ikan");
assert.ok(s._aquarium, "akuarium ada di scene");
console.log("aquarium build OK");

// Ikan bergerak saat tick
const p0 = s._fishes[0].g.position.clone();
s._tickFns.forEach((fn) => fn(0.5, 1));
const p1 = s._fishes[0].g.position.clone();
assert.ok(p0.distanceTo(p1) > 0.01, `ikan berenang: ${p0.distanceTo(p1).toFixed(3)}`);
console.log("fish swim OK");

// Ikan tetap di dalam tank (x 4.45..5.95, y 0.6..1.5)
for (let i = 0; i < 40; i++) s._tickFns.forEach((fn) => fn(0.5, 2 + i * 0.5));
s._fishes.forEach((fi, i) => {
  const p = fi.g.position;
  assert.ok(p.x > 4.4 && p.x < 6.0 && p.y > 0.6 && p.y < 1.5,
    `ikan ${i} di dalam tank: ${p.x.toFixed(2)},${p.y.toFixed(2)}`);
});
console.log("fish bounds OK");

// Klik akuarium → toast
const aq = s.clickables.find((c) => c.name === "akuarium");
assert.ok(aq, "akuarium terdaftar clickable");
assert.ok(aq.action().includes("🐠"), "toast akuarium");
console.log("aquarium click OK");

console.log("aquarium tests PASS");
