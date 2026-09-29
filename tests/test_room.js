// Test ruang rapat: struktur, lampu rapat, dan fokus kamera.
// Stub seperti test_interactive.js, tapi FakeControls pakai Vector3 asli
// supaya lerp target kamera bisa diuji.
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
  constructor() { this.target = new THREE.Vector3(0, 1, 0); }
  update() {}
}
THREE.WebGLRenderer = FakeRenderer;
THREE.OrbitControls = FakeControls;
global.THREE = THREE;
global.requestAnimationFrame = () => {};

const { OfficeScene } = require("../js/office.js");
const s = new OfficeScene("scene-container");
assert.strictEqual(s.init(), true);

// Struktur ruang rapat ada
assert.ok(s._meetingRoomG, "grup ruang rapat harus ada");
assert.ok(s.scene.children.includes(s._meetingRoomG), "grup masuk scene");
assert.strictEqual(s._meetingChairs, 6, "6 kursi rapat");
assert.ok(s._whiteboard, "whiteboard ada");
console.log("struktur ruang rapat OK");

// Lampu rapat terdaftar sebagai perabot klik + toggle independen
const names = s.clickables.map((c) => c.name);
assert.ok(names.includes("lampu rapat"), `clickables harus ada 'lampu rapat': ${names}`);
assert.strictEqual(names.length, 6, "total 6 perabot klik");
const lr = s.clickables.find((c) => c.name === "lampu rapat");
assert.strictEqual(s._lampRapat.glow.intensity, 0.85, "glow rapat awal nyala");
const hemiBefore = s._hemi.intensity; // milik siklus siang-malam, bukan nilai tetap
lr.action();
assert.strictEqual(s._lampRapat.glow.intensity, 0, "glow rapat mati setelah toggle");
assert.strictEqual(s._hemi.intensity, hemiBefore, "lampu utama tidak ikut terpengaruh");
lr.action();
assert.strictEqual(s._lampRapat.glow.intensity, 0.85, "glow rapat nyala lagi");
console.log("lampu rapat OK");

// Fokus kamera: rapat → target (8.5,1,0)
s.focusRoom("rapat");
assert.strictEqual(s._activeRoom, "rapat");
assert.ok(s._targetGoal.distanceTo(new THREE.Vector3(8.5, 1, 0)) < 1e-9, "target goal rapat");
for (let i = 0; i < 5; i++) s._tickFns.forEach((fn) => fn(0.5, i * 0.5));
assert.ok(
  s.controls.target.distanceTo(new THREE.Vector3(8.5, 1, 0)) < 0.05,
  `kamera harus geser ke rapat, dapat ${s.controls.target.toArray()}`
);
assert.strictEqual(s._targetGoal, null, "goal dibersihkan setelah sampai");
console.log("focus rapat OK");

// Balik ke kantor → target (0,1,0)
s.focusRoom("kantor");
assert.strictEqual(s._activeRoom, "kantor");
for (let i = 0; i < 5; i++) s._tickFns.forEach((fn) => fn(0.5, i * 0.5));
assert.ok(
  s.controls.target.distanceTo(new THREE.Vector3(0, 1, 0)) < 0.05,
  `kamera harus balik ke kantor, dapat ${s.controls.target.toArray()}`
);
console.log("focus kantor OK");

console.log("room tests PASS");
