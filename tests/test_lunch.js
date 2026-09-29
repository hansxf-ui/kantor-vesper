// Test makan siang: jam 12-13 Vesper & Mochi pindah ke meja makan, di luar itu tidak.
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
s.addAgent({ id: "mochi", nama: "Mochi", warna: "#7fe0c3", wander: true });
s.setAgentState("vesper", "working");

// Jam 12: mode makan siang aktif
s._lunchHour = () => 12;
s._tickFns.forEach((fn) => fn(0.1, 1));
assert.ok(s._seatOverride && s._seatOverride.vesper, "override vesper saat jam 12");
assert.ok(s._seatOverride.mochi, "override mochi saat jam 12");
assert.ok(
  Math.abs(s._seatOverride.vesper.pos.x - -4.3) < 1e-9 &&
  Math.abs(s._seatOverride.vesper.pos.z - -2.55) < 1e-9,
  "kursi makan Vesper benar"
);
assert.strictEqual(s._foodGroup.visible, true, "makanan muncul");
assert.ok(toasts.some((m) => m.includes("makan siang")), `toast makan siang: ${toasts}`);
console.log("lunch start OK");

// Vesper jalan ke kursi makan
const v = s.agents["vesper"];
for (let i = 0; i < 30; i++) s._tickFns.forEach((fn) => fn(0.1, 2 + i * 0.1));
assert.ok(v.group.position.distanceTo(s._seatOverride.vesper.pos) < 0.5, "Vesper sampai di meja makan");
assert.strictEqual(v.parts.legL.rotation.x, -1.2, "Vesper duduk");
console.log("lunch seat OK");

// Jam 14: mode selesai, balik normal
toasts.length = 0;
s._lunchHour = () => 14;
s._tickFns.forEach((fn) => fn(0.1, 99));
assert.strictEqual(s._seatOverride, null, "override hilang di luar jam makan");
assert.strictEqual(s._foodGroup.visible, false, "makanan disembunyikan");
assert.ok(v.targetPos.distanceTo(s.deskSitPos) < 1e-6, "targetPos balik ke meja (working)");
assert.ok(toasts.some((m) => m.includes("selesai")), "toast selesai makan");
console.log("lunch end OK");

// Tidur → tidak ikut makan siang
s.setAgentState("vesper", "sleeping");
s._lunchHour = () => 12;
s._tickFns.forEach((fn) => fn(0.1, 199));
assert.strictEqual(s._seatOverride, null, "tidak makan siang saat tidur");
console.log("lunch skip saat tidur OK");

console.log("lunch tests PASS");
