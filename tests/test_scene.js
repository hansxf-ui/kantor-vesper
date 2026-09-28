// Smoke test scene 3D (node, tanpa WebGL).
// three.js r128 bisa membangun scene graph tanpa GL; WebGLRenderer,
// OrbitControls, dan DOM di-stub. Memastikan konstruksi scene tidak
// error dan objek kunci ada di posisi yang benar.
const assert = require("assert");

// --- Stub DOM minimal ---
const fakeCanvas = { addEventListener: () => {}, style: {} };
const fakeContainer = {
  clientWidth: 1280,
  clientHeight: 800,
  appendChild: () => {},
  innerHTML: "",
};
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
};
global.document = {
  getElementById: (id) => (id === "scene-container" ? fakeContainer : null),
};

// --- THREE + stub WebGL/controls ---
const THREE = require("../vendor/three.min.js");
let renderCalls = 0;
class FakeRenderer {
  constructor() {
    this.domElement = fakeCanvas;
    this.shadowMap = {};
  }
  setPixelRatio() {}
  setSize() {}
  render() { renderCalls++; }
}
class FakeControls {
  constructor() { this.target = { set: () => {} }; }
  update() {}
}
THREE.WebGLRenderer = FakeRenderer;
THREE.OrbitControls = FakeControls;
global.THREE = THREE;

// --- rAF: jalankan 6 frame lalu berhenti ---
let frames = 0;
global.requestAnimationFrame = (fn) => {
  if (frames++ < 6) setImmediate(fn);
};

const { OfficeScene } = require("../js/office.js");

const s = new OfficeScene("scene-container");
assert.strictEqual(s.init(), true, "init() harus true");

// Kumpulkan semua mesh + posisinya
const meshPos = [];
s.scene.traverse((o) => {
  if (o.isMesh) meshPos.push(o.position);
});
assert.ok(meshPos.length > 20, `scene harus punya >20 mesh, dapat ${meshPos.length}`);

function near(x, y, z, tol = 0.6) {
  return meshPos.some(
    (p) => Math.abs(p.x - x) <= tol && Math.abs(p.y - y) <= tol && Math.abs(p.z - z) <= tol
  );
}
assert.ok(near(3, 0.74, -2), "meja kerja harus di sekitar (3, 0.74, -2)");
assert.ok(near(3, 1.5, -2.2), "monitor harus di sekitar (3, 1.5, -2.2)");
assert.ok(near(-3, 0.32, 1.6), "sofa harus di sekitar (-3, 0.32, 1.6)");
assert.ok(near(-3, 0.54, 2.9), "cangkir harus di sekitar (-3, 0.54, 2.9)");
assert.ok(near(1.8, 0.9, -4.7), "rak harus di sekitar (1.8, 0.9, -4.7)");
assert.ok(near(5, 1.0, -4), "tanaman harus di sekitar (5, 1.0, -4)");

// Referensi yang dipakai Task 6
assert.ok(s.monitorMat, "monitorMat harus ada");
assert.ok(s.deskSitPos && s.sofaSitPos, "deskSitPos/sofaSitPos harus ada");
assert.ok(s.camera && s.controls, "kamera + controls harus ada");

// Loop render jalan tanpa error
s.render();
setTimeout(() => {
  assert.ok(renderCalls >= 5, `render() harus dipanggil >=5x, dapat ${renderCalls}`);
  console.log(`scene smoke PASS: ${meshPos.length} mesh, render ${renderCalls}x, semua posisi benar`);
}, 500);
