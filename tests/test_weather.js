// Test cuaca: hujan muncul, petir nyala, awan menggelap, ganti otomatis.
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

// Awal: cerah, hujan tidak terlihat
assert.strictEqual(s.weather, "cerah", "cuaca awal cerah");
assert.strictEqual(s._rain.visible, false, "hujan awal tidak terlihat");
assert.strictEqual(s._bolt.intensity, 0, "petir awal mati");
console.log("awal OK");

const toasts = [];
s.onPropClick((m) => toasts.push(m));

// Paksa hujan → rintik muncul (fade), toast keluar
s.setWeather("hujan");
assert.strictEqual(s.weather, "hujan", "cuaca jadi hujan");
assert.ok(toasts.some((m) => m.includes("hujan")), `toast hujan: ${toasts}`);
for (let i = 0; i < 40; i++) s._tickFns.forEach((fn) => fn(0.2, i * 0.2));
assert.ok(s._rainMat.opacity > 0.5, `rintik terlihat (opacity ${s._rainMat.opacity.toFixed(2)})`);
assert.strictEqual(s._rain.visible, true, "rain visible");
// Hujan jatuh: set satu tetes di atas, tick sekali, harus turun (tanpa wrap)
s._rain.geometry.attributes.position.array[1] = 3.0;
s._tickFns.forEach((fn) => fn(0.2, 99));
const y1 = s._rain.geometry.attributes.position.array[1];
assert.ok(y1 < 3.0 && y1 > 1.2, `rintik jatuh ke bawah: ${y1.toFixed(2)}`);
console.log("hujan OK");

// Petir: paksa timer → kilat menyala lalu redup
// (flash langsung di-decay dalam tick yang sama: exp(-9*0.05) ≈ 0.64)
s._nextFlash = 0.01;
s._tickFns.forEach((fn) => fn(0.05, 0.1));
assert.ok(s._flash > 0.5, `kilat menyambar: ${s._flash.toFixed(2)}`);
assert.ok(s._bolt.intensity > 3, `lampu kilat nyala: ${s._bolt.intensity.toFixed(1)}`);
const flashBefore = s._flash;
for (let i = 0; i < 20; i++) s._tickFns.forEach((fn) => fn(0.2, 10 + i * 0.2));
assert.ok(s._flash < flashBefore * 0.2, "kilat meredup");
console.log("petir OK");

// Awan menggelap saat hujan
assert.ok(s._cloudMat.color.getHex() < 0xffffff, `awan gelap: ${s._cloudMat.color.getHex().toString(16)}`);
console.log("awan OK");

// Balik cerah → hujan memudar, awan balik putih
s.setWeather("cerah");
for (let i = 0; i < 60; i++) s._tickFns.forEach((fn) => fn(0.2, 100 + i * 0.2));
assert.ok(s._rainMat.opacity < 0.05, `hujan memudar: ${s._rainMat.opacity.toFixed(3)}`);
assert.strictEqual(s._rain.visible, false, "rain hidden");
assert.ok(s._cloudMat.color.getHex() > 0xf0f0f0, "awan balik putih");
console.log("cerah OK");

// Cuaca tidak valid ditolak
s.setWeather("salju");
assert.strictEqual(s.weather, "cerah", "cuaca aneh ditolak");

// Ganti otomatis: timer habis → cuaca berubah + timer reset
const wBefore = s.weather;
s._weatherTimer = 0.01;
s._tickFns.forEach((fn) => fn(0.1, 500));
assert.ok(s._weatherTimer > 60, `timer reset: ${s._weatherTimer.toFixed(0)}`);
// (cuaca bisa kebetulan sama — yang penting timer jalan; paksa beda via roll berkali-kali)
let changed = s.weather !== wBefore;
for (let i = 0; i < 10 && !changed; i++) { s._rollWeather(); changed = s.weather !== wBefore; }
assert.ok(changed, "roll cuaca bisa menghasilkan cuaca beda");
console.log("otomatis OK");

console.log("weather tests PASS");
