// Test Vesper jalan-jalan pas santai: idle → berdiri & keliling,
// working → balik duduk di meja, sleeping → tetap di sofa.
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
const v = s.agents["vesper"];
const sofa = s.sofaSitPos, desk = s.deskSitPos;

// Idle → pose berdiri + mulai jalan meninggalkan sofa
s.setAgentState("vesper", "idle");
assert.strictEqual(v.state, "idle");
assert.ok(v._wanderInit, "wander diinisialisasi saat idle");
assert.ok(
  Math.abs(v.parts.legL.rotation.x - -0.08) < 1e-9,
  `kaki berdiri (idle): ${v.parts.legL.rotation.x}`
);
let maxDist = 0;
for (let i = 0; i < 500; i++) {
  s._tickFns.forEach((fn) => fn(0.2, i * 0.2));
  const d = Math.hypot(v.group.position.x - sofa.x, v.group.position.z - sofa.z);
  if (d > maxDist) maxDist = d;
}
assert.ok(maxDist > 0.8, `vesper jalan-jalan pas santai (maxDist ${maxDist.toFixed(2)})`);
console.log("idle wander OK");

// Working → balik duduk di meja, wander dikunci
s.setAgentState("vesper", "working");
assert.ok(
  v.targetPos.distanceTo(desk) < 1e-9,
  "target balik ke meja"
);
assert.ok(
  Math.abs(v.parts.legL.rotation.x - -1.2) < 1e-9,
  `kaki duduk (working): ${v.parts.legL.rotation.x}`
);
const px = v.group.position.x, pz = v.group.position.z;
for (let i = 0; i < 200; i++) s._tickFns.forEach((fn) => fn(0.2, 500 + i * 0.2));
// Setelah lerp selesai, posisi harus di meja dan diam (wander dikunci)
assert.ok(
  v.group.position.distanceTo(desk) < 0.15,
  `vesper sampai di meja: ${v.group.position.toArray()}`
);
console.log("working OK");

// Idle lagi → jalan lagi (tanpa re-register tick ganda)
const ticksBefore = s._tickFns.length;
s.setAgentState("vesper", "idle");
assert.strictEqual(s._tickFns.length, ticksBefore, "tidak ada tick ganda");
assert.ok(
  Math.abs(v.parts.legL.rotation.x - -0.08) < 1e-9,
  "pose berdiri lagi"
);
console.log("idle lagi OK");

// Sleeping → tetap di sofa, nggak jalan
s.setAgentState("vesper", "sleeping");
assert.ok(v.targetPos.distanceTo(sofa) < 1e-9, "target ke sofa");
assert.ok(v.zzz.visible, "Zzz tampil");
for (let i = 0; i < 100; i++) s._tickFns.forEach((fn) => fn(0.2, 900 + i * 0.2));
assert.ok(
  v.group.position.distanceTo(sofa) < 0.3,
  `vesper tetap di sofa: ${v.group.position.toArray()}`
);
console.log("sleeping OK");

console.log("vesper wander tests PASS");
