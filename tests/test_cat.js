// Test kucing jendela: muncul, bisa diklik, hilang setelah 25 detik.
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

assert.strictEqual(s._cat.visible, false, "kucing awalnya sembunyi");

// Munculkan manual
s._showCat();
assert.strictEqual(s._cat.visible, true, "kucing nongol");
assert.ok(toasts.some((m) => m.includes("kucing")), `toast kucing: ${toasts}`);
console.log("cat show OK");

// Klik → meong
const kc = s.clickables.find((c) => c.name === "kucing");
assert.ok(kc, "kucing terdaftar clickable");
assert.ok(kc.action().includes("meong"), "klik kucing = meong");
console.log("cat click OK");

// Setelah 25 detik → hilang sendiri
for (let i = 0; i < 30; i++) s._tickFns.forEach((fn) => fn(1, i));
assert.strictEqual(s._cat.visible, false, "kucing pergi setelah 25 detik");
console.log("cat hide OK");

// Spawn otomatis via timer
s._catTimer = 0.01;
s._tickFns.forEach((fn) => fn(0.1, 999));
assert.strictEqual(s._cat.visible, true, "kucing muncul otomatis via timer");
console.log("cat auto OK");

console.log("cat tests PASS");
