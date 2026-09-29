// Test siklus siang-malam: keyframe per jam, lerp, lampu otomatis, manual override.
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

// Siang (12): langit terang, cahaya penuh, lampu mati otomatis
s.applyTimeOfDay(12);
assert.strictEqual(s.scene.background.getHex(), 0x9fd0f5, "langit siang");
assert.strictEqual(s.scene.fog.color.getHex(), 0x9fd0f5, "fog ikut langit");
assert.strictEqual(s._hemi.intensity, 1.0, "hemi penuh");
assert.strictEqual(s._sun.intensity, 1.0, "matahari penuh");
assert.strictEqual(s._lampGlow.intensity, 0, "lampu mati otomatis siang hari");
assert.strictEqual(s._glassMat.color.getHex(), 0xbfe3ff, "kaca terang");
console.log("siang OK");

// Malam (0): gelap, lampu nyala otomatis
s.applyTimeOfDay(0);
assert.strictEqual(s.scene.background.getHex(), 0x0b0e1a, "langit malam");
assert.strictEqual(s._hemi.intensity, 0.35, "hemi redup");
assert.strictEqual(s._sun.intensity, 0.08, "matahari padam");
assert.strictEqual(s._lampGlow.intensity, 0.85, "lampu nyala otomatis malam hari");
assert.strictEqual(s._lampBulb.material.color.getHex(), 0xffe6b0, "bohlam hangat");
assert.strictEqual(s._glassMat.color.getHex(), 0x16233f, "kaca gelap");
assert.ok(s._cloudMat.opacity < 0.3, "awan meredup");
console.log("malam OK");

// Lerp antar keyframe: 10.5 → hemi di antara 0.95 dan 1.0
s.applyTimeOfDay(10.5);
assert.ok(s._hemi.intensity > 0.95 && s._hemi.intensity < 1.0, `hemi lerp: ${s._hemi.intensity}`);
console.log("lerp OK");

// Senja (17.5): langit oranye
s.applyTimeOfDay(17.5);
assert.strictEqual(s.scene.background.getHex(), 0xf08a5e, "langit senja");
console.log("senja OK");

// Manual override: user matikan lampu saat malam → tetap mati walau jam berubah
s.applyTimeOfDay(0);
assert.strictEqual(s._lampGlow.intensity, 0.85, "lampu nyala dulu (otomatis)");
s.setLamp(false, true);
assert.strictEqual(s._lampManual, true, "flag manual diset");
s.applyTimeOfDay(2);
assert.strictEqual(s._lampGlow.intensity, 0, "lampu tetap mati (manual)");
s.applyTimeOfDay(12);
assert.strictEqual(s._lampGlow.intensity, 0, "siang juga tetap mati (manual)");
s._lampManual = false; // reset untuk kebersihan state
console.log("manual override OK");

console.log("daynight tests PASS");
