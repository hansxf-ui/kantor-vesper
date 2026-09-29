// Test rapat: state "meeting" → duduk di ruang rapat + slide presentasi.
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
s._lunchHour = () => 9; // bukan jam makan
s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 });
s.addAgent({ id: "mochi", nama: "Mochi", warna: "#7fe0c3", wander: true });

// State meeting diterima
s.setAgentState("vesper", "meeting");
assert.strictEqual(s.agents["vesper"].state, "meeting", "state meeting diterima");
console.log("meeting state OK");

// Mode rapat aktif: override kursi + slide
s._tickFns.forEach((fn) => fn(0.1, 1));
assert.ok(s._seatOverride && s._seatOverride.vesper, "override vesper saat rapat");
assert.ok(s._seatOverride.mochi, "mochi ikut rapat");
assert.ok(
  Math.abs(s._seatOverride.vesper.pos.x - 7.55) < 1e-9,
  "kursi rapat Vesper benar"
);
assert.ok(s._slideSprite && s._slideSprite.visible, "slide presentasi tampil");
assert.ok(toasts.some((m) => m.includes("rapat dimulai")), `toast rapat: ${toasts}`);
console.log("meeting start OK");

// Vesper jalan ke ruang rapat
const v = s.agents["vesper"];
for (let i = 0; i < 40; i++) s._tickFns.forEach((fn) => fn(0.1, 2 + i * 0.1));
assert.ok(v.group.position.distanceTo(s._seatOverride.vesper.pos) < 0.5, "Vesper sampai di ruang rapat");
console.log("meeting walk OK");

// Slide ganti tiap 8 detik
const sp0 = s._slideSprite;
for (let i = 0; i < 90; i++) s._tickFns.forEach((fn) => fn(0.1, 50 + i * 0.1));
assert.notStrictEqual(s._slideSprite, sp0, "slide berganti");
console.log("slide cycle OK");

// Kembali working → rapat selesai
toasts.length = 0;
s.setAgentState("vesper", "working");
s._tickFns.forEach((fn) => fn(0.1, 999));
assert.strictEqual(s._seatOverride, null, "override hilang");
assert.strictEqual(s._slideSprite.visible, false, "slide disembunyikan");
assert.ok(toasts.some((m) => m.includes("rapat selesai")), "toast rapat selesai");
console.log("meeting end OK");

console.log("meeting tests PASS");
