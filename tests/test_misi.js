// Test papan misi: tulisan ngikutin status Vesper.
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

s.addAgent({ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 });
assert.ok(s._misiText.includes("santai"), `misi awal (idle): ${s._misiText}`);

const expected = {
  working: "fokus",
  meeting: "rapat",
  sleeping: "besok aja",
  idle: "santai",
};
Object.keys(expected).forEach((st) => {
  s.setAgentState("vesper", st);
  s._tickFns.forEach((fn) => fn(0.1, 1)); // mode tick R7 mendeteksi transisi
  assert.ok(s._misiText.includes(expected[st]), `misi ${st}: ${s._misiText}`);
  console.log(`misi ${st} OK`);
});

console.log("misi tests PASS");
