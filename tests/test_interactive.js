// Test perabot interaktif: klik via raycast → aksi + toast.
// Stub sama seperti test_avatar.js.
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

// 6 perabot terdaftar (5 lama + lampu rapat)
const names = s.clickables.map((c) => c.name).sort();
assert.deepStrictEqual(names, ["jam", "kopi", "kue", "lampu", "lampu rapat", "monitor", "tanaman"], `clickables: ${names}`);
console.log("registrasi 5 perabot OK");

const msgs = [];
s.onPropClick((m) => msgs.push(m));
s.camera.lookAt(0, 1, 0);

function clickAt(worldPos) {
  s.scene.updateMatrixWorld(true);
  s.camera.updateMatrixWorld(true);
  const v = worldPos.clone().project(s.camera);
  const cx = ((v.x + 1) / 2) * 1280;
  const cy = ((1 - v.y) / 2) * 800;
  msgs.length = 0;
  s._pickAgent({ clientX: cx, clientY: cy });
  return msgs[0] || null;
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// Lampu: toggle mati → nyala
let m = clickAt(V3(0, 2.6, 0.5));
assert.ok(m && m.includes("dimatikan"), `lampu mati, dapat: ${m}`);
assert.strictEqual(s._lampGlow.intensity, 0, "glow mati");
m = clickAt(V3(0, 2.6, 0.5));
assert.ok(m && m.includes("dinyalakan"), `lampu nyala, dapat: ${m}`);
assert.strictEqual(s._lampGlow.intensity, 0.85, "glow nyala lagi");
console.log("lampu toggle OK");

// Kopi: sruput → steam burst
m = clickAt(V3(-3, 0.6, 2.9));
assert.ok(m && m.includes("sruput"), `kopi, dapat: ${m}`);
assert.ok(s._steamBurst > 0, "steam burst aktif");
console.log("kopi OK");

// Jam: kasih tau jam
m = clickAt(V3(4.3, 2.7, -4.88));
assert.ok(m && /^🕐 sekarang jam \d{2}\.\d{2}$/.test(m), `jam, dapat: ${m}`);
console.log("jam OK");

// Monitor: mati saat idle → ganti wallpaper saat working
m = clickAt(V3(3, 1.5, -2.1));
assert.ok(m && m.includes("monitor mati"), `monitor idle, dapat: ${m}`);
s.addAgent({ id: "vesper", nama: "Vesper" });
s.setAgentState("vesper", "working");
m = clickAt(V3(3, 1.5, -2.1));
assert.ok(m && m.includes("mint"), `monitor wallpaper, dapat: ${m}`);
assert.strictEqual(s._screenColor, 0x7fe0c3, "warna layar jadi mint");
console.log("monitor OK");

// Tanaman: disenggol → goyang
m = clickAt(V3(5, 1.0, -4));
assert.ok(m && m.includes("disenggol"), `tanaman, dapat: ${m}`);
assert.ok(s._leafWiggle > 0, "leaf wiggle aktif");
console.log("tanaman OK");

// Bounce feedback: klik set bounce=1, tick mengembalikannya
const lamp = s.clickables.find((c) => c.name === "lampu");
assert.strictEqual(lamp.bounce, 1, "bounce diset saat klik");
s._tickFns.forEach((fn) => fn(0.6, 1));
assert.ok(lamp.bounce < 1, "bounce decay setelah tick");
console.log("bounce feedback OK");

console.log("interactive tests PASS");
