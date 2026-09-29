// Test avatar + state machine (node, tanpa WebGL).
// Stub sama seperti test_scene.js + canvas 2d.
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
global.requestAnimationFrame = () => {}; // tidak perlu loop di test ini

const { OfficeScene } = require("../js/office.js");
const s = new OfficeScene("scene-container");
assert.strictEqual(s.init(), true);

// --- addAgent ---
const rec = s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 });
assert.ok(rec.group, "group avatar harus ada");
assert.ok(rec.parts.body && rec.parts.head && rec.parts.armL && rec.parts.legL, "parts lengkap");
assert.strictEqual(rec.group.userData.agentId, "vesper");
assert.strictEqual(rec.zzz.visible, false, "Zzz sembunyi saat idle");
console.log("addAgent OK");

// --- working: target meja, monitor nyala ---
s.setAgentState("vesper", "working");
assert.strictEqual(rec.state, "working");
assert.ok(rec.targetPos.distanceTo(s.deskSitPos) < 1e-6, "target harus deskSitPos");
assert.strictEqual(rec.group.rotation.y, Math.PI, "menghadap meja");
assert.strictEqual(s.monitorMat.color.getHex(), 0x9fd8ff, "monitor menyala saat working");
assert.strictEqual(rec.zzz.visible, false);
console.log("working OK");

// --- lerp posisi: dari sofa menuju meja ---
rec.group.position.copy(s.sofaSitPos);
const d0 = rec.group.position.distanceTo(s.deskSitPos);
// simulasikan tick manual: panggil semua _tickFns dengan dt=0.5
for (let i = 0; i < 4; i++) s._tickFns.forEach((fn) => fn(0.5, i * 0.5));
const d1 = rec.group.position.distanceTo(s.deskSitPos);
assert.ok(d1 < d0, `posisi harus mendekat ke meja (d0=${d0.toFixed(2)} d1=${d1.toFixed(2)})`);
// lengan mengetik: di sekitar -0.9 ± 0.18
assert.ok(Math.abs(rec.parts.armL.rotation.x + 0.9) <= 0.2, "lengan animasi mengetik");
console.log("lerp + typing OK");

// --- sleeping: Zzz muncul, kepala terkulai, monitor redup ---
s.setAgentState("vesper", "sleeping");
assert.strictEqual(rec.zzz.visible, true, "Zzz tampil saat sleeping");
assert.strictEqual(rec.parts.head.rotation.x, 0.35);
assert.strictEqual(s.monitorMat.color.getHex(), 0x2a2f3d, "monitor redup saat sleeping");
console.log("sleeping OK");

// --- idle kembali: Vesper jalan-jalan (pose berdiri, target = waypoint acak) ---
s.setAgentState("vesper", "idle");
assert.strictEqual(rec.zzz.visible, false);
assert.ok(
  Math.abs(rec.parts.legL.rotation.x - -0.08) < 1e-9,
  `kaki berdiri saat idle: ${rec.parts.legL.rotation.x}`
);
assert.ok(rec.targetPos.distanceTo(s.sofaSitPos) > 0.1, "target bukan sofa (lagi jalan-jalan)");
console.log("idle OK");

// --- klik avatar via raycast ---
s.camera.lookAt(0, 1, 0);
s.camera.updateMatrixWorld(true);
s.scene.updateMatrixWorld(true);
rec.group.position.copy(rec.targetPos); // snap ke sofa
s.scene.updateMatrixWorld(true);
const v = new THREE.Vector3();
rec.parts.head.getWorldPosition(v);
v.project(s.camera);
const cx = ((v.x + 1) / 2) * 1280;
const cy = ((1 - v.y) / 2) * 800;
let clicked = null;
s.onAgentClick((id) => { clicked = id; });
s._pickAgent({ clientX: cx, clientY: cy });
assert.strictEqual(clicked, "vesper", `klik avatar harus mengembalikan id, dapat ${clicked}`);
console.log("raycast click OK");

console.log("avatar tests PASS");
