// js/office.js — Scene 3D kantor (Three.js r128 UMD).
// Task 5: ruangan + furniture + kamera. Task 6 menambah avatar.
(function (global) {
  "use strict";

  function OfficeScene(containerId) {
    this.containerId = containerId;
    this.agents = {}; // id -> { group, parts, state, ... } (diisi Task 6)
    this._clickCb = null;
    this._tickFns = []; // fungsi animasi per-frame: fn(dt, elapsed)
  }

  function mat(color) {
    return new THREE.MeshLambertMaterial({ color: color });
  }

  function box(w, h, d, color, x, y, z, parent) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    (parent || null);
    return m;
  }

  OfficeScene.prototype.init = function () {
    var container = document.getElementById(this.containerId);
    if (!container) return false;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
      container.innerHTML =
        '<div style="color:#9aa0b4;text-align:center;padding:40px 20px">' +
        "😢 Perangkatmu tidak mendukung 3D (WebGL).<br>Coba buka di Chrome versi baru ya.</div>";
      return false;
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b1e2a);
    this.scene.fog = new THREE.Fog(0x1b1e2a, 18, 40);

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(7.5, 6, 10);

    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.minDistance = 4;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = 1.45;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;

    // Cahaya
    this.scene.add(new THREE.HemisphereLight(0xfff2df, 0x334, 0.85));
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(6, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    this.scene.add(sun);

    this._buildRoom();
    this._buildDeskArea();
    this._buildSofaArea();
    this._buildDecor();

    // Titik duduk avatar (dipakai Task 6)
    this.deskSitPos = new THREE.Vector3(3, 0, -0.6);
    this.sofaSitPos = new THREE.Vector3(-3, 0, 1.6);

    var self = this;
    window.addEventListener("resize", function () {
      self.camera.aspect = container.clientWidth / container.clientHeight;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(container.clientWidth, container.clientHeight);
    });

    return true;
  };

  OfficeScene.prototype._buildRoom = function () {
    // Lantai 12x10
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 10), mat(0x6b5b45));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Dinding belakang (z=-5) & kiri (x=-6), tinggi 4
    var wallMat = mat(0x2e3348);
    var back = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 0.2), wallMat);
    back.position.set(0, 2, -5);
    back.receiveShadow = true;
    this.scene.add(back);
    var left = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 10), wallMat);
    left.position.set(-6, 2, 0);
    left.receiveShadow = true;
    this.scene.add(left);

    // Jendela di dinding belakang: bingkai + kaca menyala lembut
    var frame = box(3.4, 2.2, 0.12, 0x8a6f4d, -1.5, 2.2, -4.95, this.scene);
    var glass = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 1.8),
      new THREE.MeshBasicMaterial({ color: 0xbfe3ff })
    );
    glass.position.set(-1.5, 2.2, -4.88);
    this.scene.add(frame, glass);
  };

  OfficeScene.prototype._buildDeskArea = function () {
    var g = new THREE.Group();
    // Meja: top + 4 kaki
    g.add(box(2.6, 0.12, 1.3, 0x8a6f4d, 3, 0.74, -2, null));
    [[1.85, -1.5], [4.15, -1.5], [1.85, -2.5], [4.15, -2.5]].forEach(function (p) {
      g.add(box(0.1, 0.74, 0.1, 0x5d4c36, p[0], 0.37, p[1], null));
    });
    // Monitor: tiang + layar + screen (emissive, redup dulu)
    g.add(box(0.12, 0.4, 0.12, 0x22242e, 3, 1.0, -2.2, null));
    g.add(box(1.3, 0.85, 0.08, 0x22242e, 3, 1.5, -2.2, null));
    this.monitorMat = new THREE.MeshBasicMaterial({ color: 0x2a2f3d });
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.7), this.monitorMat);
    screen.position.set(3, 1.5, -2.15);
    g.add(screen);
    // Keyboard
    g.add(box(0.9, 0.04, 0.3, 0x30343f, 3, 0.82, -1.5, null));
    // Kursi: dudukan + sandaran + tiang
    g.add(box(0.7, 0.12, 0.7, 0x3b4a6b, 3, 0.45, -0.6, null));
    g.add(box(0.7, 0.8, 0.12, 0x3b4a6b, 3, 0.9, -0.28, null));
    var stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 10), mat(0x22242e));
    stem.position.set(3, 0.2, -0.6);
    g.add(stem);
    this.scene.add(g);
  };

  OfficeScene.prototype._buildSofaArea = function () {
    var g = new THREE.Group();
    var c = 0xb3552f; // sofa oranye hangat
    // Dudukan + sandaran + 2 lengan
    g.add(box(2.2, 0.45, 1.0, c, -3, 0.32, 1.6, null));
    g.add(box(2.2, 0.7, 0.25, c, -3, 0.75, 1.15, null));
    g.add(box(0.25, 0.65, 1.0, c, -4.0, 0.5, 1.6, null));
    g.add(box(0.25, 0.65, 1.0, c, -2.0, 0.5, 1.6, null));
    // Meja kopi + cangkir
    g.add(box(1.2, 0.08, 0.7, 0x8a6f4d, -3, 0.42, 2.9, null));
    [[-3.5, 2.65], [-2.5, 2.65], [-3.5, 3.15], [-2.5, 3.15]].forEach(function (p) {
      g.add(box(0.08, 0.42, 0.08, 0x5d4c36, p[0], 0.21, p[1], null));
    });
    var cup = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 12), mat(0xf5f0e6));
    cup.position.set(-3, 0.54, 2.9);
    cup.castShadow = true;
    g.add(cup);
    // Karpet
    var rug = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), mat(0x51456b));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-3, 0.01, 2.2);
    rug.receiveShadow = true;
    g.add(rug);
    this.scene.add(g);
  };

  OfficeScene.prototype._buildDecor = function () {
    // Rak buku di dinding belakang
    var g = new THREE.Group();
    g.add(box(1.6, 1.8, 0.4, 0x5d4c36, 1.8, 0.9, -4.7, null));
    var colors = [0xe06c5b, 0x5b9de0, 0x7fd08a, 0xe0c25b, 0xb48ae0];
    for (var i = 0; i < 5; i++) {
      g.add(box(0.18, 0.5, 0.28, colors[i], 1.25 + i * 0.28, 1.15, -4.7, null));
    }
    // Tanaman sudut
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12), mat(0xa3552f));
    pot.position.set(5, 0.2, -4);
    pot.castShadow = true;
    var leaves = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8), mat(0x3f8f4f));
    leaves.position.set(5, 1.0, -4);
    leaves.castShadow = true;
    g.add(pot, leaves);
    this.scene.add(g);
  };

  // Daftarkan fungsi animasi per-frame (dipakai Task 6 untuk avatar).
  OfficeScene.prototype.onTick = function (fn) {
    this._tickFns.push(fn);
  };

  OfficeScene.prototype.onAgentClick = function (cb) {
    this._clickCb = cb;
  };

  OfficeScene.prototype.render = function () {
    var self = this;
    var clock = new THREE.Clock();
    // Tap (bukan drag) pada avatar → callback klik. Dipakai penuh di Task 6.
    var downX = 0, downY = 0;
    this.renderer.domElement.addEventListener("pointerdown", function (e) {
      downX = e.clientX; downY = e.clientY;
    });
    this.renderer.domElement.addEventListener("pointerup", function (e) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // drag, bukan tap
      if (self._pickAgent) self._pickAgent(e);
    });
    (function loop() {
      requestAnimationFrame(loop);
      var dt = Math.min(clock.getDelta(), 0.05);
      var t = clock.elapsedTime;
      self.controls.update();
      for (var i = 0; i < self._tickFns.length; i++) self._tickFns[i](dt, t);
      self.renderer.render(self.scene, self.camera);
    })();
  };

  // ============ Avatar Jolly 3D ============
  // Blob krem bulet ala avatar Vesper: badan kentang, muka + mata item +
  // senyum + pipi pink, tangan-kaki buntung. Low-poly, tanpa bulu.

  var JOLLY_CREAM = 0xf2e6c9; // bulu krem
  var JOLLY_FACE = 0xfdf3dd; // muka lebih terang

  function stubLimb(r, len, px, py, pz) {
    // Pivot + kapsul (bola di-scale) — tangan/kaki buntung ala Jolly.
    var g = new THREE.Group();
    g.position.set(px, py, pz);
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(JOLLY_CREAM));
    m.scale.set(1, len / r, 1);
    m.position.y = -len / 2;
    m.castShadow = true;
    g.add(m);
    return g;
  }

  function textSprite(text, fontPx, padX) {
    var c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(10,12,20,0.6)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold " + fontPx + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128 + (padX || 0), 34);
    var tex = new THREE.CanvasTexture(c);
    var sp = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    sp.scale.set(1.5, 0.375, 1);
    return sp;
  }

  OfficeScene.prototype.addAgent = function (agent) {
    var g = new THREE.Group();
    g.userData.agentId = agent.id;

    // Badan kentang
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), mat(JOLLY_CREAM));
    body.scale.set(1, 1.12, 0.92);
    body.position.y = 0.95;
    body.castShadow = true;
    body.userData.baseScale = body.scale.clone();

    // Grup muka (dianggukkan saat tidur)
    var head = new THREE.Group();
    head.position.set(0, 1.02, 0.1);
    var face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), mat(JOLLY_FACE));
    face.scale.set(1, 1.05, 0.55);
    face.position.set(0, 0.03, 0.22);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b1e2a });
    var eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), eyeMat);
    eyeL.position.set(-0.16, 0.16, 0.46);
    var eyeR = eyeL.clone();
    eyeR.position.x = 0.16;
    // Senyum: setengah donat, lengkung bawah
    var smile = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.018, 8, 20, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x1b1e2a })
    );
    smile.position.set(0, 0.08, 0.47);
    smile.rotation.z = Math.PI;
    var blushMat = new THREE.MeshBasicMaterial({ color: 0xf2a0a0 });
    var blushL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), blushMat);
    blushL.scale.set(1, 0.7, 0.4);
    blushL.position.set(-0.28, 0.06, 0.45);
    var blushR = blushL.clone();
    blushR.position.x = 0.28;
    head.add(face, eyeL, eyeR, smile, blushL, blushR);

    // Tangan & kaki buntung
    var armL = stubLimb(0.15, 0.42, -0.55, 0.95, 0);
    var armR = stubLimb(0.15, 0.42, 0.55, 0.95, 0);
    var legL = stubLimb(0.17, 0.3, -0.2, 0.42, 0.08);
    var legR = stubLimb(0.17, 0.3, 0.2, 0.42, 0.08);

    var tag = textSprite(agent.nama || agent.id, 30);
    tag.position.y = 1.95;

    var zzz = textSprite("Z z z", 34);
    zzz.scale.set(0.9, 0.225, 1);
    zzz.position.y = 2.2;
    zzz.visible = false;

    g.add(body, head, armL, armR, legL, legR, tag, zzz);
    g.position.copy(this.sofaSitPos);
    this.scene.add(g);

    var rec = {
      id: agent.id,
      group: g,
      parts: { body: body, head: head, armL: armL, armR: armR, legL: legL, legR: legR },
      tag: tag,
      zzz: zzz,
      state: "idle",
      targetPos: this.sofaSitPos.clone(),
    };
    this.agents[agent.id] = rec;
    this._applyPose(rec);

    var self = this;
    this.onTick(function (dt, t) {
      var a = self.agents[agent.id];
      if (!a) return;
      // Lerp posisi ~1 detik (tidak teleport).
      a.group.position.lerp(a.targetPos, 1 - Math.exp(-3 * dt));
      if (a.state === "working") {
        a.parts.armL.rotation.x = -0.9 + Math.sin(t * 10) * 0.18;
        a.parts.armR.rotation.x = -0.9 + Math.sin(t * 10 + 1.3) * 0.18;
      } else if (a.state === "idle") {
        // Napas: scale terhadap baseScale (jangan reset bentuk kentang).
        var bs = a.parts.body.userData.baseScale;
        var br = 1 + Math.sin(t * 2) * 0.02;
        a.parts.body.scale.set(bs.x, bs.y * br, bs.z);
      } else if (a.state === "sleeping") {
        var ph = (t * 0.45) % 1;
        a.zzz.position.y = 2.25 + ph * 0.9;
        a.zzz.material.opacity = 1 - ph;
      }
    });
    return rec;
  };

  OfficeScene.prototype._applyPose = function (a) {
    var P = a.parts;
    // Reset dulu (scale kembali ke bentuk kentang)
    P.body.scale.copy(P.body.userData.baseScale);
    P.body.rotation.x = 0;
    P.head.rotation.x = 0;
    if (a.state === "working") {
      a.targetPos.copy(this.deskSitPos);
      a.group.rotation.y = Math.PI; // menghadap meja (-z)
      P.legL.rotation.x = -1.2;
      P.legR.rotation.x = -1.2;
      P.armL.rotation.x = -0.9;
      P.armR.rotation.x = -0.9;
      P.body.rotation.x = -0.06; // sedikit membungkuk ke monitor
      P.head.rotation.x = 0.15; // menatap layar
      a.zzz.visible = false;
      this.monitorMat.color.setHex(0x9fd8ff); // monitor menyala
    } else if (a.state === "idle") {
      a.targetPos.copy(this.sofaSitPos);
      a.group.rotation.y = 0; // menghadap kamera (+z)
      P.legL.rotation.x = -1.2;
      P.legR.rotation.x = -1.2;
      P.armL.rotation.x = -0.25;
      P.armR.rotation.x = -0.25;
      P.body.rotation.x = 0.1; // selonjor santai
      a.zzz.visible = false;
      this.monitorMat.color.setHex(0x2a2f3d);
    } else {
      // sleeping
      a.targetPos.copy(this.sofaSitPos);
      a.group.rotation.y = 0;
      P.legL.rotation.x = -1.2;
      P.legR.rotation.x = -1.2;
      P.armL.rotation.x = -0.15;
      P.armR.rotation.x = -0.15;
      P.body.rotation.x = 0.15;
      P.head.rotation.x = 0.35; // muka terkulai
      a.zzz.visible = true;
      this.monitorMat.color.setHex(0x2a2f3d);
    }
  };

  OfficeScene.prototype.setAgentState = function (id, state) {
    var a = this.agents[id];
    if (!a || (state !== "working" && state !== "idle" && state !== "sleeping")) return;
    a.state = state;
    this._applyPose(a);
  };

  // Raycast tap → id agent (dipanggil dari render() saat tap terdeteksi).
  OfficeScene.prototype._pickAgent = function (e) {
    var rect = this.renderer.domElement.getBoundingClientRect();
    var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, this.camera);
    var groups = Object.keys(this.agents).map(
      function (id) { return this.agents[id].group; }.bind(this)
    );
    var hits = ray.intersectObjects(groups, true);
    if (hits.length && this._clickCb) {
      var o = hits[0].object;
      while (o && !o.userData.agentId) o = o.parent;
      if (o) this._clickCb(o.userData.agentId);
    }
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { OfficeScene: OfficeScene };
  } else {
    global.OfficeScene = OfficeScene;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
