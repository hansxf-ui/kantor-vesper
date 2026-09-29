// Test lembur: kerja jam 22-05 → lampu meja + kopi extra, Mochi tidur di karpet.
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
s._lunchHour = () => 23; // jam 11 malam
s._today = () => 3; // Rabu (bukan Minggu)
s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 });
s.addAgent({ id: "mochi", nama: "Mochi", warna: "#7fe0c3", wander: true });
s.setAgentState("vesper", "working");

s._tickFns.forEach((fn) => fn(0.1, 1));
assert.strictEqual(s._overtimeOn, true, "mode lembur aktif jam 23");
assert.strictEqual(s._otLamp.glow.intensity, 5, "lampu meja menyala");
assert.strictEqual(s._otLamp.haloMat.opacity, 0.6, "halo menyala");
assert.strictEqual(s._otCup.visible, true, "kopi extra muncul");
assert.ok(toasts.some((m) => m.includes("lembur")), `toast lembur: ${toasts}`);
console.log("overtime start OK");

// Mochi tidur di karpet
for (let i = 0; i < 30; i++) s._tickFns.forEach((fn) => fn(0.1, 2 + i * 0.1));
const mo = s.agents["mochi"];
assert.ok(mo.group.position.distanceTo(new THREE.Vector3(-2.0, 0, 2.6)) < 0.5, "Mochi di karpet");
assert.strictEqual(mo.zzz.visible, true, "Mochi tidur (Zzz)");
console.log("mochi sleep OK");

// Jam 15 → lembur selesai
toasts.length = 0;
s._lunchHour = () => 15;
s._tickFns.forEach((fn) => fn(0.1, 999));
assert.strictEqual(s._overtimeOn, false, "lembur mati siang hari");
assert.strictEqual(s._otLamp.glow.intensity, 0, "lampu meja mati");
assert.strictEqual(s._otCup.visible, false, "kopi extra hilang");
assert.strictEqual(mo.zzz.visible, false, "Mochi bangun");
console.log("overtime end OK");

// Santai jam 23 → tidak lembur
s._lunchHour = () => 23;
s.setAgentState("vesper", "idle");
s._tickFns.forEach((fn) => fn(0.1, 1999));
assert.strictEqual(s._overtimeOn, false, "tidak lembur saat santai");
console.log("overtime skip saat santai OK");

console.log("overtime tests PASS");
