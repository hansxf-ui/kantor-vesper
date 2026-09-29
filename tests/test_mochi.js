// Test Mochi: warna custom, jalan-jalan, kebal status, bisa diklik.
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

// Vesper tetap krem klasik walau agents.json punya warna
s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf" });
const vBody = s.agents["vesper"].parts.body.material.color.getHex();
assert.strictEqual(vBody, 0xf2e6c9, `badan vesper krem: ${vBody.toString(16)}`);

// Mochi: badan mint, muka lebih terang dari badan
s.addAgent({ id: "mochi", nama: "Mochi", warna: "#7fe0c3", wander: true });
const mochi = s.agents["mochi"];
assert.ok(mochi, "mochi terdaftar");
assert.ok(mochi.wander, "flag wander");
const mBody = mochi.parts.body.material.color.getHex();
assert.strictEqual(mBody, 0x7fe0c3, "badan mochi mint");
const mFace = mochi.parts.head.children[0].material.color.getHex();
assert.notStrictEqual(mFace, mBody, "muka beda dari badan");
assert.ok(mFace > mBody, `muka (${mFace.toString(16)}) lebih terang dari badan`);
console.log("warna OK");

// Spawn di tengah ruangan, menghadap target pertama
assert.deepStrictEqual(
  [mochi.group.position.x, mochi.group.position.z], [0, 2.5], "spawn tengah"
);
const wantRot = Math.atan2(mochi.targetPos.x - 0, mochi.targetPos.z - 2.5);
assert.ok(
  Math.abs(mochi.group.rotation.y - wantRot) < 1e-9, "menghadap target jalan"
);
console.log("spawn OK");

// Jalan: simulasi 100 detik, posisi harus menjauh dari spawn
let maxDist = 0;
for (let i = 0; i < 500; i++) {
  s._tickFns.forEach((fn) => fn(0.2, i * 0.2));
  const d = Math.hypot(mochi.group.position.x - 0, mochi.group.position.z - 2.5);
  if (d > maxDist) maxDist = d;
}
assert.ok(maxDist > 0.8, `mochi jalan-jalan (maxDist ${maxDist.toFixed(2)})`);
// Tetap di area lantai tengah (nggak nabrak perabot / keluar ruangan)
assert.ok(mochi.group.position.x > -1.5 && mochi.group.position.x < 1.5, "x dalam area");
assert.ok(mochi.group.position.z > -3.8 && mochi.group.position.z < 4.3, "z dalam area");
console.log("wander OK");

// Kebal status: setAgentState diabaikan untuk wanderer
s.setAgentState("mochi", "working");
assert.strictEqual(mochi.state, "idle", "state tetap idle");
assert.ok(
  Math.abs(mochi.targetPos.x - s.deskSitPos.x) > 0.5, "target bukan meja kerja"
);
console.log("kebal status OK");

// Klik Mochi → onAgentClick dapat id "mochi"
const ids = [];
s.onAgentClick((id) => ids.push(id));
s.camera.lookAt(0, 1, 0);
s.scene.updateMatrixWorld(true);
s.camera.updateMatrixWorld(true);
const pv = mochi.group.position.clone();
pv.y = 1;
const pp = pv.project(s.camera);
s._pickAgent({
  clientX: ((pp.x + 1) / 2) * 1280,
  clientY: ((1 - pp.y) / 2) * 800,
});
assert.deepStrictEqual(ids, ["mochi"], `klik mochi, dapat: ${ids}`);
console.log("klik mochi OK");

console.log("mochi tests PASS");
