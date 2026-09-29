// js/office.js — Scene 3D kantor (Three.js r128 UMD).
// Task 5: ruangan + furniture + kamera. Task 6 menambah avatar.
(function (global) {
  "use strict";

  function OfficeScene(containerId) {
    this.containerId = containerId;
    this.agents = {}; // id -> { group, parts, state, ... } (diisi Task 6)
    this._clickCb = null;
    this._tickFns = []; // fungsi animasi per-frame: fn(dt, elapsed)
    this._monitorOn = false; // monitor menyala? (dipakai flicker ambient)
    this._leaves = null; // daun tanaman (digoyang ambient)
    this.clickables = []; // perabot bisa diklik: {name, root, action, bounce}
    this._propCb = null; // callback toast saat perabot diklik
    this._screenColor = 0x9fd8ff;
    this._screenIdx = 0;
    this._steamBurst = 0;
    this._leafWiggle = 0;
    this._targetGoal = null; // kamera: target yang dituju (tombol pindah ruangan)
    this._activeRoom = "kantor";
    this._lampOn = true; // lampu gantung utama
    this._lampManual = false; // true kalau user pernah utak-atik manual
    this._sun = null;
    this._glassMat = null; // kaca jendela (diwarnai siklus siang-malam)
    this._cloudMat = null;
    this._dayNightStamp = -1;
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
    this._hemi = new THREE.HemisphereLight(0xfff2df, 0x334, 0.85); // diredupkan saat lampu dimatikan
    this.scene.add(this._hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(6, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    this.scene.add(sun);
    this._sun = sun; // dipakai siklus siang-malam

    this._buildRoom();
    this._buildDeskArea();
    this._buildSofaArea();
    this._buildDecor();
    this._buildAmbient();
    this._buildMeetingRoom();
    this._buildDining();
    this._buildAquarium();
    this._buildInteractive();
    this._buildDayNight();
    this._buildWeather();
    this._updateModes();

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
    this._glassMat = glass.material; // diwarnai siklus siang-malam
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
    this._screenMesh = screen; // bisa diklik (ganti wallpaper)
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
    this._cup = cup; // bisa diklik (sruput kopi)
    // Piring kue di sebelah cangkir (bisa diklik → kasih makan Mochi)
    var plate = new THREE.Group();
    plate.position.set(-2.55, 0.46, 2.95);
    var dish = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.04, 16), mat(0xf5f0e6));
    dish.castShadow = true;
    plate.add(dish);
    [[-0.07, 0], [0.08, 0.05], [0, -0.08]].forEach(function (p) {
      var cookie = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), mat(0xc98d4e));
      cookie.position.set(p[0], 0.045, p[1]);
      cookie.castShadow = true;
      plate.add(cookie);
    });
    g.add(plate);
    this._plate = plate;
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
    this._leaves = leaves; // digoyang angin di _buildAmbient
  };

  // ============ Ambient life: bikin kantor berasa hidup ============
  // Debu melayang, lampu gantung bergoyang, uap kopi, jam dinding
  // real-time, tanaman bergoyang, awan di jendela, monitor flicker.
  OfficeScene.prototype._buildAmbient = function () {
    var self = this;

    // ---- 1. Debu melayang di udara ----
    var DUST = 70;
    var dpos = new Float32Array(DUST * 3);
    var dseed = [];
    for (var i = 0; i < DUST; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 10;
      dpos[i * 3 + 1] = 0.3 + Math.random() * 3.2;
      dpos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      dseed.push(Math.random() * Math.PI * 2);
    }
    var dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    var dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xfff3d6, size: 0.035, transparent: true,
        opacity: 0.45, sizeAttenuation: true, depthWrite: false,
      })
    );
    this.scene.add(dust);
    this.onTick(function (dt, t) {
      var p = dustGeo.attributes.position.array;
      for (var j = 0; j < DUST; j++) {
        p[j * 3] += Math.sin(t * 0.4 + dseed[j]) * 0.0015;
        p[j * 3 + 1] += Math.cos(t * 0.3 + dseed[j] * 1.7) * 0.0012;
      }
      dustGeo.attributes.position.needsUpdate = true;
    });

    // ---- 2. Lampu gantung bergoyang pelan ----
    var lampG = new THREE.Group();
    lampG.position.set(0, 4, 0.5);
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), mat(0x22242e));
    cord.position.y = -0.55;
    var shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.42, 0.35, 16, 1, true),
      mat(0xe08a4e)
    );
    shade.position.y = -1.25;
    shade.castShadow = true;
    var bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0 })
    );
    bulb.position.y = -1.38;
    var glow = new THREE.PointLight(0xffd9a0, 0.85, 11);
    glow.position.y = -1.4;
    lampG.add(cord, shade, bulb, glow);
    this.scene.add(lampG);
    this._lampGroup = lampG;
    this._lampGlow = glow;
    this._lampBulb = bulb;
    this.onTick(function (dt, t) {
      lampG.rotation.z = Math.sin(t * 0.7) * 0.07;
      lampG.rotation.x = Math.sin(t * 0.53 + 1.2) * 0.05;
    });

    // ---- 3. Uap naik dari cangkir kopi ----
    var steams = [];
    for (var s = 0; s < 6; s++) {
      var sm = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      sm.position.set(-3, 0.62, 2.9);
      this.scene.add(sm);
      steams.push({ m: sm, ph: s / 6 });
    }
    this._steamMeshes = steams;
    this.onTick(function (dt, t) {
      for (var k = 0; k < steams.length; k++) {
        var st = steams[k];
        var ph = (t * 0.25 + st.ph) % 1;
        st.m.position.y = 0.62 + ph * 0.75;
        st.m.position.x = -3 + Math.sin((t + st.ph * 6) * 2) * 0.05 * ph;
        st.m.material.opacity = 0.45 * Math.sin(ph * Math.PI) * (1 + self._steamBurst);
        var sc = 0.6 + ph * 1.4;
        st.m.scale.set(sc, sc, sc);
      }
    });

    // ---- 4. Jam dinding real-time ----
    var clockG = new THREE.Group();
    clockG.position.set(4.3, 2.7, -4.88);
    var face = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 24), mat(0xf5f0e6));
    face.rotation.x = Math.PI / 2;
    clockG.add(face);
    for (var tk = 0; tk < 12; tk++) {
      var tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, tk % 3 === 0 ? 0.07 : 0.04, 0.01),
        new THREE.MeshBasicMaterial({ color: 0x22242e })
      );
      var ang = (tk / 12) * Math.PI * 2;
      tick.position.set(Math.sin(ang) * 0.28, Math.cos(ang) * 0.28, 0.035);
      tick.rotation.z = -ang;
      clockG.add(tick);
    }
    function hand(len, w, color, z) {
      var g = new THREE.Group();
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.015), new THREE.MeshBasicMaterial({ color: color }));
      m.position.y = len / 2 - 0.04;
      g.add(m);
      g.position.z = z;
      return g;
    }
    var hourH = hand(0.16, 0.045, 0x22242e, 0.04);
    var minH = hand(0.24, 0.03, 0x22242e, 0.05);
    var secH = hand(0.26, 0.012, 0xe06c5b, 0.06);
    clockG.add(hourH, minH, secH);
    this.scene.add(clockG);
    this._clockGroup = clockG;
    var lastSec = -1;
    this.onTick(function () {
      var now = new Date();
      var sec = now.getSeconds() + now.getMilliseconds() / 1000;
      if (Math.floor(sec) === lastSec) return;
      lastSec = Math.floor(sec);
      var mnt = now.getMinutes() + sec / 60;
      var hr = (now.getHours() % 12) + mnt / 60;
      secH.rotation.z = -(sec / 60) * Math.PI * 2;
      minH.rotation.z = -(mnt / 60) * Math.PI * 2;
      hourH.rotation.z = -(hr / 12) * Math.PI * 2;
    });

    // ---- 5. Daun tanaman bergoyang ----
    if (this._leaves) {
      var leaves = this._leaves;
      this.onTick(function (dt, t) {
        leaves.rotation.z = Math.sin(t * 1.3) * 0.06 + Math.sin(t * 22) * 0.25 * self._leafWiggle;
        leaves.rotation.x = Math.cos(t * 0.9) * 0.04 + Math.cos(t * 19) * 0.2 * self._leafWiggle;
      });
    }

    // ---- 6. Awan bergerak di balik jendela ----
    var clouds = [];
    var cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
    this._cloudMat = cloudMat; // diredupkan saat malam
    for (var c = 0; c < 3; c++) {
      var cg = new THREE.Group();
      for (var pf = 0; pf < 3; pf++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 - pf * 0.04, 10, 8), cloudMat);
        puff.position.set(pf * 0.28 - 0.28, (pf % 2) * 0.1, 0);
        puff.scale.y = 0.6;
        cg.add(puff);
      }
      cg.position.set(-2.8 + c * 1.4, 2.2 + (c % 2) * 0.35, -4.86);
      this.scene.add(cg);
      clouds.push({ g: cg, speed: 0.08 + c * 0.03 });
    }
    this.onTick(function (dt) {
      for (var ci = 0; ci < clouds.length; ci++) {
        var cl = clouds[ci];
        cl.g.position.x += cl.speed * dt;
        if (cl.g.position.x > 0.6) cl.g.position.x = -3.2;
      }
    });

    // ---- 7. Monitor flicker halus saat kerja ----
    this.onTick(function (dt, t) {
      if (self._monitorOn) {
        self.monitorMat.color.setHex(self._screenColor).offsetHSL(0, 0, Math.sin(t * 6.3) * 0.025);
      }
    });
  };

  // ============ Ruang rapat (ekstensi timur, x 6..11) ============
  OfficeScene.prototype._buildMeetingRoom = function () {
    var self = this;
    var g = new THREE.Group();

    // Lantai
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 10), mat(0x74604a));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(8.5, 0, 0);
    floor.receiveShadow = true;
    g.add(floor);

    // Dinding penyekat x=6 dengan pintu (z -0.8..0.8)
    var wallMat = mat(0x2e3348);
    [-2.9, 2.9].forEach(function (z) {
      var seg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 4.2), wallMat);
      seg.position.set(6, 2, z);
      seg.receiveShadow = true;
      g.add(seg);
    });
    var header = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 1.6), wallMat);
    header.position.set(6, 3.3, 0);
    g.add(header);

    // Dinding belakang lanjutan (x 6..11) & dinding timur (x=11)
    var back2 = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 0.2), wallMat);
    back2.position.set(8.5, 2, -5);
    back2.receiveShadow = true;
    g.add(back2);
    var east = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 10), wallMat);
    east.position.set(11, 2, 0);
    east.receiveShadow = true;
    g.add(east);

    // Karpet bundar di bawah meja
    var rug = new THREE.Mesh(new THREE.CircleGeometry(2.1, 28), mat(0x4a5b6b));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(8.5, 0.01, 0);
    rug.receiveShadow = true;
    g.add(rug);

    // Meja rapat: top + 4 kaki
    g.add(box(1.5, 0.1, 2.8, 0x8a6f4d, 8.5, 0.72, 0, null));
    [[7.9, -1.25], [9.1, -1.25], [7.9, 1.25], [9.1, 1.25]].forEach(function (p) {
      g.add(box(0.1, 0.72, 0.1, 0x5d4c36, p[0], 0.36, p[1], null));
    });

    // 6 kursi (3 per sisi), warna selang-seling
    var chairColors = [0x3b4a6b, 0xb3552f];
    var ci = 0;
    [-0.95, 0, 0.95].forEach(function (z) {
      [[7.55, 1], [9.45, -1]].forEach(function (s) {
        var cc = chairColors[ci++ % 2];
        g.add(box(0.5, 0.08, 0.5, cc, s[0], 0.45, z, null)); // dudukan
        g.add(box(0.5, 0.55, 0.08, cc, s[0] - s[1] * 0.27, 0.75, z, null)); // sandaran
      });
    });
    this._meetingChairs = 6;

    // Whiteboard di dinding timur + coretan spidol
    var wb = new THREE.Group();
    wb.add(box(0.06, 1.4, 2.4, 0x8a6f4d, 10.88, 1.9, 0, null)); // bingkai
    var board = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), mat(0xf2f2ec));
    board.rotation.y = -Math.PI / 2;
    board.position.set(10.84, 1.9, 0);
    wb.add(board);
    wb.add(box(0.012, 0.05, 0.7, 0xe06c5b, 10.82, 2.15, -0.45, null)); // garis merah
    wb.add(box(0.012, 0.05, 0.5, 0x5b9de0, 10.82, 2.0, -0.55, null)); // garis biru
    wb.add(box(0.012, 0.3, 0.12, 0x7fd08a, 10.82, 1.75, 0.35, null)); // batang 1
    wb.add(box(0.012, 0.45, 0.12, 0x5b9de0, 10.82, 1.82, 0.55, null)); // batang 2
    wb.add(box(0.012, 0.6, 0.12, 0xe0c25b, 10.82, 1.9, 0.75, null)); // batang 3
    wb.add(box(0.12, 0.04, 1.0, 0x8a6f4d, 10.8, 1.18, 0, null)); // tray spidol
    g.add(wb);
    this._whiteboard = board;

    // Poster di dinding belakang
    g.add(box(1.3, 1.0, 0.06, 0x22242e, 8.5, 2.3, -4.88, null));
    var poster = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), mat(0x2dd4bf));
    poster.position.set(8.5, 2.3, -4.84);
    g.add(poster);

    // Tanaman sudut
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12), mat(0xa3552f));
    pot.position.set(10.4, 0.2, -4.3);
    pot.castShadow = true;
    var leaves2 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), mat(0x3f8f4f));
    leaves2.position.set(10.4, 0.95, -4.3);
    leaves2.castShadow = true;
    g.add(pot, leaves2);
    this._plantRapat = leaves2; // ronde 6: ikut goyang
    this.onTick(function (dt, t) {
      leaves2.rotation.z = Math.sin(t * 1.1 + 2) * 0.06;
      leaves2.rotation.x = Math.cos(t * 0.8 + 1) * 0.04;
    });

    // Lampu gantung #2 di atas meja rapat
    var lampG = new THREE.Group();
    lampG.position.set(8.5, 4, 0);
    var cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), mat(0x22242e));
    cord.position.y = -0.55;
    var shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.42, 0.35, 16, 1, true),
      mat(0x4e9de0)
    );
    shade.position.y = -1.25;
    var bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffe6b0 })
    );
    bulb.position.y = -1.38;
    var glow = new THREE.PointLight(0xffd9a0, 0.85, 7);
    glow.position.y = -1.4;
    lampG.add(cord, shade, bulb, glow);
    g.add(lampG);
    this._lampRapat = { group: lampG, glow: glow, bulb: bulb };

    this.scene.add(g);
    this._meetingRoomG = g;

    // Kamera: lerp target saat pindah ruangan
    this.onTick(function (dt) {
      if (self._targetGoal) {
        self.controls.target.lerp(self._targetGoal, Math.min(1, dt * 3));
        if (self.controls.target.distanceTo(self._targetGoal) < 0.02) {
          self._targetGoal = null;
        }
      }
    });
  };

  // Pindah fokus kamera antar ruangan (dipanggil tombol UI).
  OfficeScene.prototype.focusRoom = function (name) {
    this._activeRoom = name;
    this._targetGoal =
      name === "rapat" ? new THREE.Vector3(8.5, 1, 0) : new THREE.Vector3(0, 1, 0);
  };

  // ============ Perabot interaktif (klik-klik) ============
  OfficeScene.prototype._buildInteractive = function () {
    var self = this;
    function reg(root, name, action) {
      if (!root) return;
      root.traverse(function (o) { o.userData.clickName = name; });
      self.clickables.push({ name: name, root: root, action: action, bounce: 0 });
    }

    // Lampu gantung: nyala/mati (manual override — siklus siang-malam nggak ikut campur lagi)
    reg(this._lampGroup, "lampu", function () {
      self.setLamp(!self._lampOn, true);
      return self._lampOn ? "💡 lampu dinyalakan" : "💡 lampu dimatikan — hemat listrik";
    });

    // Monitor: ganti wallpaper (cuma pas Jolly kerja)
    var palette = [0x9fd8ff, 0x7fe0c3, 0xc9a7f5, 0xffd27f];
    var palNames = ["biru", "mint", "ungu", "senja"];
    reg(this._screenMesh, "monitor", function () {
      if (!self._monitorOn) return "🖥️ monitor mati — tunggu Jolly kerja dulu";
      self._screenIdx = (self._screenIdx + 1) % palette.length;
      self._screenColor = palette[self._screenIdx];
      return "🖥️ wallpaper ganti: " + palNames[self._screenIdx];
    });

    // Kopi: sruput → uap ngebul
    reg(this._cup, "kopi", function () {
      self._steamBurst = 1.6;
      return "☕ sruput kopi — mantap";
    });

    // Kue: ambil camilan → mode kasih makan, klik Mochi buat nyuapin
    reg(this._plate, "kue", function () {
      self._feeding = !self._feeding;
      return self._feeding
        ? "🍪 ambil camilan… sekarang klik Mochi!"
        : "🍪 camilannya dibalikin lagi";
    });

    // Jam: kasih tau jam sekarang
    reg(this._clockGroup, "jam", function () {
      var n = new Date();
      var hh = String(n.getHours()).padStart(2, "0");
      var mm = String(n.getMinutes()).padStart(2, "0");
      return "🕐 sekarang jam " + hh + "." + mm;
    });

    // Tanaman: disenggol → goyang heboh
    reg(this._leaves, "tanaman", function () {
      self._leafWiggle = 1.4;
      return "🌱 tanamannya disenggol";
    });

    // Lampu ruang rapat: nyala/mati (independen dari lampu utama)
    var lampRapatOn = true;
    reg(this._lampRapat.group, "lampu rapat", function () {
      lampRapatOn = !lampRapatOn;
      self._lampRapat.glow.intensity = lampRapatOn ? 0.85 : 0;
      self._lampRapat.bulb.material.color.setHex(lampRapatOn ? 0xffe6b0 : 0x4a4438);
      return lampRapatOn ? "💡 lampu rapat dinyalakan" : "💡 lampu rapat dimatikan";
    });

    // Akuarium: klik → sapa ikan
    reg(this._aquarium, "akuarium", function () {
      return "🐠 ikannya lagi santai berenang…";
    });

    // Bounce feedback + decay efek sementara
    this.onTick(function (dt) {
      for (var i = 0; i < self.clickables.length; i++) {
        var c = self.clickables[i];
        if (c.bounce > 0) {
          c.bounce -= dt * 2.2;
          var k = Math.max(0, c.bounce);
          var s = 1 + Math.sin(k * Math.PI) * 0.12;
          c.root.scale.set(s, s, s);
          if (c.bounce <= 0) c.root.scale.set(1, 1, 1);
        }
      }
      if (self._steamBurst > 0) self._steamBurst = Math.max(0, self._steamBurst - dt * 1.2);
      if (self._leafWiggle > 0) self._leafWiggle = Math.max(0, self._leafWiggle - dt * 1.5);
    });
  };

  // ============ Siklus siang-malam (ngikutin jam asli user) ============
  // Keyframe per jam: warna langit, intensitas cahaya, kaca jendela,
  // opacity awan, dan status otomatis lampu.
  var DAY_KEYS = [
    { h: 0,   sky: 0x0b0e1a, hemi: 0.35, sun: 0.08, glass: 0x16233f, cloud: 0.25, lamp: true },
    { h: 5,   sky: 0x131a30, hemi: 0.40, sun: 0.12, glass: 0x1c2c4d, cloud: 0.30, lamp: true },
    { h: 6.5, sky: 0xf0a35e, hemi: 0.70, sun: 0.50, glass: 0xffd9a8, cloud: 0.70, lamp: false },
    { h: 9,   sky: 0xa8d4f0, hemi: 0.95, sun: 0.85, glass: 0xbfe3ff, cloud: 0.90, lamp: false },
    { h: 12,  sky: 0x9fd0f5, hemi: 1.00, sun: 1.00, glass: 0xbfe3ff, cloud: 0.90, lamp: false },
    { h: 16,  sky: 0xa8c8ec, hemi: 0.90, sun: 0.80, glass: 0xbfe3ff, cloud: 0.90, lamp: false },
    { h: 17.5,sky: 0xf08a5e, hemi: 0.65, sun: 0.45, glass: 0xffc890, cloud: 0.70, lamp: false },
    { h: 19,  sky: 0x2a2a4a, hemi: 0.45, sun: 0.15, glass: 0x2a3a5e, cloud: 0.35, lamp: true },
    { h: 21,  sky: 0x0b0e1a, hemi: 0.35, sun: 0.08, glass: 0x16233f, cloud: 0.25, lamp: true },
    { h: 24,  sky: 0x0b0e1a, hemi: 0.35, sun: 0.08, glass: 0x16233f, cloud: 0.25, lamp: true },
  ];

  function daySegment(hour) {
    var h = ((hour % 24) + 24) % 24;
    var a = DAY_KEYS[0], b = DAY_KEYS[DAY_KEYS.length - 1];
    for (var i = 0; i < DAY_KEYS.length - 1; i++) {
      if (h >= DAY_KEYS[i].h && h <= DAY_KEYS[i + 1].h) { a = DAY_KEYS[i]; b = DAY_KEYS[i + 1]; break; }
    }
    var span = b.h - a.h || 1;
    return { a: a, b: b, k: (h - a.h) / span };
  }

  OfficeScene.prototype.setLamp = function (on, manual) {
    this._lampOn = !!on;
    if (manual) this._lampManual = true;
    if (this._lampGlow) this._lampGlow.intensity = this._lampOn ? 0.85 : 0;
    if (this._lampBulb) this._lampBulb.material.color.setHex(this._lampOn ? 0xffe6b0 : 0x4a4438);
  };

  // Terapkan suasana sesuai jam (bisa dipanggil dengan jam eksplisit — dipakai test).
  OfficeScene.prototype.applyTimeOfDay = function (hour) {
    var seg = daySegment(hour), a = seg.a, b = seg.b, k = seg.k;
    function mix(ca, cb) {
      return new THREE.Color(ca).lerp(new THREE.Color(cb), k);
    }
    var sky = mix(a.sky, b.sky);
    this.scene.background.copy(sky);
    if (this.scene.fog) this.scene.fog.color.copy(sky);
    this._hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
    if (this._sun) this._sun.intensity = a.sun + (b.sun - a.sun) * k;
    if (this._glassMat) this._glassMat.color.copy(mix(a.glass, b.glass));
    this._glassBase = this._glassMat ? this._glassMat.color.clone() : null; // cuaca mengalikan dari sini
    if (this._cloudMat) this._cloudMat.opacity = a.cloud + (b.cloud - a.cloud) * k;
    // Lampu otomatis nyala saat gelap — kecuali user sudah atur manual.
    if (!this._lampManual) this.setLamp(k < 0.5 ? a.lamp : b.lamp, false);
  };

  OfficeScene.prototype._buildDayNight = function () {
    var self = this;
    var now = new Date();
    this._dayNightStamp = now.getHours() * 60 + now.getMinutes();
    this.applyTimeOfDay(now.getHours() + now.getMinutes() / 60);
    // Cek ulang tiap menit saja (bukan tiap frame).
    this.onTick(function () {
      var n = new Date();
      var stamp = n.getHours() * 60 + n.getMinutes();
      if (stamp !== self._dayNightStamp) {
        self._dayNightStamp = stamp;
        self.applyTimeOfDay(n.getHours() + n.getMinutes() / 60);
      }
    });
  };

  // ============ Kasih makan Mochi ============
  // Klik piring kue → mode feeding; klik Mochi → dia loncat kegirangan + hati-hati.
  OfficeScene.prototype.tryFeed = function (id) {
    this._feeding = false;
    var a = this.agents[id];
    if (id === "mochi" && a) {
      a._happy = 2.5;
      this._spawnHeart(a);
      return "🍪 Mochi dikasih makan! dia seneng banget 🍡";
    }
    return "eh, yang dikasih makan Mochi 😅";
  };

  OfficeScene.prototype._spawnHeart = function (a) {
    var self = this;
    var heart = textSprite("❤️", 44);
    heart.position.copy(a.group.position);
    heart.position.y = 2.3;
    this.scene.add(heart);
    this._hearts = this._hearts || [];
    this._hearts.push({ m: heart, life: 0 });
    if (!this._heartsTick) {
      this._heartsTick = true;
      this.onTick(function (dt) {
        for (var i = self._hearts.length - 1; i >= 0; i--) {
          var h = self._hearts[i];
          h.life += dt;
          h.m.position.y += dt * 0.8;
          h.m.material.opacity = Math.max(0, 1 - h.life / 1.6);
          if (h.life > 1.6) {
            self.scene.remove(h.m);
            self._hearts.splice(i, 1);
          }
        }
      });
    }
  };

  // ============ Cuaca di balik jendela (acak, berubah sendiri) ============
  // Hujan: rintik Points tepat di depan kaca + petir sesekali + awan menggelap.
  var _wxTmp = null; // temp color biar nggak alokasi tiap frame
  OfficeScene.prototype._buildWeather = function () {
    var self = this;
    this.weather = "cerah";
    this._weatherTimer = 60 + Math.random() * 120;

    // Rintik hujan (di depan kaca jendela: x -3.1..0.1, y 1.3..3.1, z -4.8..-4.6)
    var RAIN = 350;
    var rpos = new Float32Array(RAIN * 3);
    for (var i = 0; i < RAIN; i++) {
      rpos[i * 3] = -3.1 + Math.random() * 3.2;
      rpos[i * 3 + 1] = 1.3 + Math.random() * 1.8;
      rpos[i * 3 + 2] = -4.8 + Math.random() * 0.2;
    }
    var rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
    var rainMat = new THREE.PointsMaterial({
      color: 0xa8c8e8, size: 0.05, transparent: true, opacity: 0, depthWrite: false,
    });
    var rain = new THREE.Points(rainGeo, rainMat);
    rain.visible = false;
    this.scene.add(rain);
    this._rain = rain;
    this._rainMat = rainMat;

    // Kilat petir di luar jendela
    var bolt = new THREE.PointLight(0xdfe8ff, 0, 20);
    bolt.position.set(-1.5, 3, -6);
    this.scene.add(bolt);
    this._bolt = bolt;
    this._flash = 0;
    this._nextFlash = 4;

    this.onTick(function (dt, t) {
      // Hujan jatuh, reset ke atas
      if (rainMat.opacity > 0.02) {
        var p = rainGeo.attributes.position.array;
        for (var j = 0; j < RAIN; j++) {
          p[j * 3 + 1] -= 6 * dt;
          if (p[j * 3 + 1] < 1.2) p[j * 3 + 1] = 3.1;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      // Fade hujan sesuai cuaca
      var target = self.weather === "hujan" ? 0.85 : 0;
      rainMat.opacity += (target - rainMat.opacity) * Math.min(1, dt * 1.5);
      rain.visible = rainMat.opacity > 0.02;
      // Awan menggelap saat hujan/mendung
      if (self._cloudMat) {
        var cc = self.weather === "hujan" ? 0x5a6478 : self.weather === "mendung" ? 0xc9d2e2 : 0xffffff;
        self._cloudMat.color.lerp(new THREE.Color(cc), Math.min(1, dt * 1.5));
      }
      // Kaca jendela ikut redup saat cuaca buruk (base dari siklus siang-malam)
      if (self._glassMat && self._glassBase) {
        if (!_wxTmp) _wxTmp = new THREE.Color();
        var f = self.weather === "hujan" ? 0.5 : self.weather === "mendung" ? 0.75 : 1;
        _wxTmp.copy(self._glassBase).multiplyScalar(f);
        self._glassMat.color.lerp(_wxTmp, Math.min(1, dt * 1.5));
      }
      // Petir: cuma saat hujan, tiap 2–11 detik
      if (self.weather === "hujan" && t > self._nextFlash) {
        self._flash = 1;
        self._nextFlash = t + 2 + Math.random() * 9;
      }
      self._flash *= Math.exp(-9 * dt);
      bolt.intensity = self._flash * 5;
      // Ganti cuaca otomatis tiap 1.5–4 menit
      self._weatherTimer -= dt;
      if (self._weatherTimer <= 0) self._rollWeather();
    });
  };

  OfficeScene.prototype._rollWeather = function () {
    var r = Math.random();
    this.setWeather(r < 0.5 ? "cerah" : r < 0.8 ? "mendung" : "hujan");
  };

  // Paksa cuaca (dipakai test & bisa dipanggil manual).
  OfficeScene.prototype.setWeather = function (w) {
    if (w !== "cerah" && w !== "mendung" && w !== "hujan") return;
    if (this.weather === w) return;
    this.weather = w;
    this._weatherTimer = 90 + Math.random() * 150;
    if (this._propCb) {
      this._propCb(
        w === "hujan" ? "🌧️ eh, di luar hujan…" :
        w === "mendung" ? "⛅ mendung nih di luar" : "☀️ cerah lagi di luar"
      );
    }
  };

  OfficeScene.prototype.onPropClick = function (cb) {
    this._propCb = cb;
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
    // Hover: kursor pointer di atas avatar / perabot interaktif (throttle ringan).
    var lastHover = 0;
    this.renderer.domElement.addEventListener("pointermove", function (e) {
      var now = Date.now();
      if (now - lastHover < 120) return;
      lastHover = now;
      var rect = self.renderer.domElement.getBoundingClientRect();
      var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      var ray = new THREE.Raycaster();
      ray.setFromCamera({ x: nx, y: ny }, self.camera);
      var targets = Object.keys(self.agents)
        .map(function (id) {
          return self.agents[id].group;
        })
        .concat(
          self.clickables.map(function (c) {
            return c.root;
          })
        );
      var hits = targets.length ? ray.intersectObjects(targets, true) : [];
      self.renderer.domElement.style.cursor = hits.length ? "pointer" : "";
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

  function stubLimb(r, len, px, py, pz, color) {
    // Pivot + kapsul (bola di-scale) — tangan/kaki buntung ala Jolly.
    var g = new THREE.Group();
    g.position.set(px, py, pz);
    var m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat(color === undefined ? JOLLY_CREAM : color));
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

    // Warna badan: Vesper tetap krem klasik; agent lain pakai warnanya sendiri.
    var bodyHex = agent.id === "vesper" || !agent.warna ? JOLLY_CREAM : agent.warna;
    var faceHex = JOLLY_FACE;
    if (bodyHex !== JOLLY_CREAM) {
      faceHex = new THREE.Color(bodyHex).lerp(new THREE.Color(0xffffff), 0.5).getHex();
    }

    // Badan kentang
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), mat(bodyHex));
    body.scale.set(1, 1.12, 0.92);
    body.position.y = 0.95;
    body.castShadow = true;
    body.userData.baseScale = body.scale.clone();

    // Grup muka (dianggukkan saat tidur)
    var head = new THREE.Group();
    head.position.set(0, 1.02, 0.1);
    var face = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), mat(faceHex));
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
    var armL = stubLimb(0.15, 0.42, -0.55, 0.95, 0, bodyHex);
    var armR = stubLimb(0.15, 0.42, 0.55, 0.95, 0, bodyHex);
    var legL = stubLimb(0.17, 0.3, -0.2, 0.42, 0.08, bodyHex);
    var legR = stubLimb(0.17, 0.3, 0.2, 0.42, 0.08, bodyHex);

    var tag = textSprite(agent.nama || agent.id, 30);
    tag.position.y = 1.95;

    var zzz = textSprite("Z z z", 34);
    zzz.scale.set(0.9, 0.225, 1);
    zzz.position.y = 2.2;
    zzz.visible = false;

    g.add(body, head, armL, armR, legL, legR, tag, zzz);

    var rec = {
      id: agent.id,
      group: g,
      parts: { body: body, head: head, armL: armL, armR: armR, legL: legL, legR: legR },
      tag: tag,
      zzz: zzz,
      state: "idle",
      targetPos: this.sofaSitPos.clone(),
      wander: !!agent.wander,
      wanderIfIdle: agent.id === "vesper", // Vesper ikut jalan-jalan pas lagi santai
    };
    this.agents[agent.id] = rec;
    if (agent.wander) {
      // Mochi: spawn di tengah ruangan, langsung jalan-jalan.
      g.position.set(0, 0, 2.5);
      rec.targetPos.set(0, 0, 2.5);
      this._applyPose(rec);
      this._setupWander(rec);
    } else {
      g.position.copy(this.sofaSitPos);
      this._applyPose(rec);
    }
    this.scene.add(g);

    var self = this;
    this.onTick(function (dt, t) {
      var a = self.agents[agent.id];
      if (!a) return;
      var ov = self._seatOverride && self._seatOverride[a.id];
      if (ov) {
        // Ronde 6 — duduk paksa: makan siang / rapat. Abaikan targetPos biasa.
        a.group.position.lerp(ov.pos, 1 - Math.exp(-3 * dt));
        a.group.rotation.y = ov.rotY;
        a.group.position.y = 0;
        a.group.rotation.z = 0;
        a.parts.legL.rotation.x = -1.2;
        a.parts.legR.rotation.x = -1.2;
        a.parts.armL.rotation.x = -0.5;
        a.parts.armR.rotation.x = -0.5;
        a.parts.body.rotation.x = 0;
        a.parts.head.rotation.x = 0;
        return;
      }
      // Lerp posisi ~1 detik + lompat-lompat biar nggak nge-glide kayak hantu.
      var dist = a.group.position.distanceTo(a.targetPos);
      a.group.position.lerp(a.targetPos, 1 - Math.exp(-3 * dt));
      if (dist > 0.15) {
        a.group.position.y = Math.abs(Math.sin(t * 9)) * 0.28;
        a.group.rotation.z = Math.sin(t * 9) * 0.06;
      } else {
        a.group.position.y = 0;
        a.group.rotation.z = 0;
      }
      if (a._happy > 0) {
        // Habis dikasih makan: loncat tinggi + tangan ke atas kegirangan.
        a._happy -= dt;
        a.group.position.y = Math.abs(Math.sin(t * 14)) * 0.7;
        a.parts.armL.rotation.z = 2.6;
        a.parts.armR.rotation.z = -2.6;
        a._wasHappy = true;
      } else if (a._wasHappy) {
        a._wasHappy = false;
        a.parts.armL.rotation.z = 0;
        a.parts.armR.rotation.z = 0;
      }
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
    if (a.wander || (a.wanderIfIdle && a._wanderInit && a.state === "idle")) {
      // Penjelajah / Vesper santai: pose berdiri. targetPos diatur _setupWander — jangan disentuh.
      // (sebelum status idle pertama kali diterapkan, Vesper tetap duduk di sofa)
      P.legL.rotation.x = -0.08;
      P.legR.rotation.x = -0.08;
      P.armL.rotation.x = -0.2;
      P.armR.rotation.x = -0.2;
      a.zzz.visible = false;
      return;
    }
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
      this._screenColor = 0x9fd8ff;
      this._screenIdx = 0;
      this.monitorMat.color.setHex(this._screenColor); // monitor menyala
      this._monitorOn = true;
    } else if (a.state === "idle") {
      a.targetPos.copy(this.sofaSitPos);
      a.group.rotation.y = 0; // menghadap kamera (+z)
      P.legL.rotation.x = -1.2;
      P.legR.rotation.x = -1.2;
      P.armL.rotation.x = -0.25;
      P.armR.rotation.x = -0.25;
      P.body.rotation.x = 0.1; // selonjor santai
      a.zzz.visible = false;
      this._screenColor = 0x2a2f3d;
      this.monitorMat.color.setHex(this._screenColor);
      this._monitorOn = false;
    } else if (a.state === "meeting") {
      // Ronde 6 — rapat: duduk di kursi meja rapat, hadap meja (+x).
      a.targetPos.set(7.55, 0, 0);
      a.group.rotation.y = Math.PI / 2;
      P.legL.rotation.x = -1.2;
      P.legR.rotation.x = -1.2;
      P.armL.rotation.x = -0.4;
      P.armR.rotation.x = -0.4;
      P.body.rotation.x = 0;
      P.head.rotation.x = 0.1;
      a.zzz.visible = false;
      this._screenColor = 0x2a2f3d;
      this.monitorMat.color.setHex(this._screenColor);
      this._monitorOn = false;
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
      this._screenColor = 0x2a2f3d;
      this.monitorMat.color.setHex(this._screenColor);
      this._monitorOn = false;
    }
  };

  OfficeScene.prototype.setAgentState = function (id, state) {
    var a = this.agents[id];
    if (!a || (state !== "working" && state !== "idle" && state !== "sleeping" && state !== "meeting")) return;
    if (a.wander) return; // Mochi jalan terus, nggak ikut status kerja/tidur
    if (a.wanderIfIdle && state === "idle" && !a._wanderInit) {
      a._wanderInit = true;
      this._setupWander(a); // Vesper mulai jalan-jalan pas santai
    }
    a.state = state;
    this._applyPose(a);
  };

  // Mochi jalan-jalan: pilih titik acak di lantai tengah, jalan ke sana
  // (lompat-lompat via tick umum addAgent), diam sebentar, ulangi.
  // Selalu menghadap arah jalan.
  OfficeScene.prototype._setupWander = function (a) {
    var self = this;
    var wait = 1.5;
    function pickTarget() {
      var x = -1.2 + Math.random() * 2.4;
      var z = -3.5 + Math.random() * 7.5;
      var dx = x - a.group.position.x,
        dz = z - a.group.position.z;
      if (dx * dx + dz * dz > 0.0025) a.group.rotation.y = Math.atan2(dx, dz);
      a.targetPos.set(x, 0, z);
    }
    pickTarget();
    this.onTick(function (dt) {
      if (!self.agents[a.id]) return;
      if (a.wanderIfIdle && a.state !== "idle") return; // Vesper: cuma jalan pas santai
      if (self._seatOverride && self._seatOverride[a.id]) return; // ronde 6: lagi duduk (makan/rapat)
      var dx = a.targetPos.x - a.group.position.x,
        dz = a.targetPos.z - a.group.position.z;
      if (dx * dx + dz * dz < 0.09) {
        wait -= dt;
        if (wait <= 0) {
          wait = 2 + Math.random() * 3;
          pickTarget();
        }
      }
    });
  };

  // Raycast tap → id agent ATAU aksi perabot (dipanggil dari render() saat tap terdeteksi).
  OfficeScene.prototype._pickAgent = function (e) {
    var rect = this.renderer.domElement.getBoundingClientRect();
    var nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    var ray = new THREE.Raycaster();
    ray.setFromCamera({ x: nx, y: ny }, this.camera);
    var self = this;
    // 1. Avatar dulu (perilaku lama).
    var groups = Object.keys(this.agents).map(function (id) {
      return self.agents[id].group;
    });
    var hits = ray.intersectObjects(groups, true);
    if (hits.length && this._clickCb) {
      var o = hits[0].object;
      while (o && !o.userData.agentId) o = o.parent;
      if (o) {
        this._clickCb(o.userData.agentId);
        return;
      }
    }
    // 2. Perabot interaktif.
    if (!this.clickables.length) return;
    var roots = this.clickables.map(function (c) {
      return c.root;
    });
    var ph = ray.intersectObjects(roots, true);
    if (ph.length) {
      var p = ph[0].object;
      while (p && !p.userData.clickName) p = p.parent;
      if (p) {
        for (var i = 0; i < this.clickables.length; i++) {
          var c = this.clickables[i];
          if (c.name === p.userData.clickName) {
            c.bounce = 1;
            var msg = c.action();
            if (msg && this._propCb) this._propCb(msg);
            return;
          }
        }
      }
    }
  };

  // ============ RONDE 6 ============

  // ---- Sudut makan: meja bundar + 2 dingklik + makanan beruap (muncul jam 12-13) ----
  OfficeScene.prototype._buildDining = function () {
    var TX = -4.3,
      TZ = -3.3; // pusat meja
    var g = new THREE.Group();
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 20), mat(0x8a6f4d));
    top.position.set(TX, 0.6, TZ);
    top.castShadow = true;
    var leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.6, 10), mat(0x5d4c36));
    leg.position.set(TX, 0.3, TZ);
    g.add(top, leg);
    [
      [-4.3, -2.55],
      [-3.55, -3.3],
    ].forEach(function (p) {
      var st = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.42, 12), mat(0x3b4a6b));
      st.position.set(p[0], 0.21, p[1]);
      st.castShadow = true;
      g.add(st);
    });
    // Makanan: 2 mangkok nasi + ikan bakar, disembunyikan di luar jam makan
    var food = new THREE.Group();
    [
      [-4.48, -3.3],
      [-4.12, -3.3],
    ].forEach(function (p) {
      var bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 14), mat(0xf5f0e6));
      bowl.position.set(p[0], 0.7, p[1]);
      var rice = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), mat(0xfffdf5));
      rice.scale.y = 0.45;
      rice.position.set(p[0], 0.76, p[1]);
      food.add(bowl, rice);
    });
    var fish = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat(0xd08a3e));
    fish.scale.set(1.6, 0.5, 0.7);
    fish.position.set(TX, 0.68, TZ);
    food.add(fish);
    var steams = [];
    for (var s = 0; s < 8; s++) {
      var sm = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      sm.position.set(TX, 0.8, TZ);
      food.add(sm);
      steams.push({ m: sm, ph: s / 8, ox: ((s % 3) - 1) * 0.18 });
    }
    food.visible = false;
    g.add(food);
    this.scene.add(g);
    this._foodGroup = food;
    this.onTick(function (dt, t) {
      if (!food.visible) return;
      for (var k = 0; k < steams.length; k++) {
        var st = steams[k];
        var ph = (t * 0.35 + st.ph) % 1;
        st.m.position.y = 0.8 + ph * 0.9;
        st.m.position.x = TX + st.ox + Math.sin((t + st.ph * 6) * 2) * 0.06 * ph;
        st.m.material.opacity = 0.4 * Math.sin(ph * Math.PI);
        var sc = 0.7 + ph * 1.6;
        st.m.scale.set(sc, sc, sc);
      }
    });
  };

  // ---- Akuarium: 5 ikan berenang + gelembung + rumput laut goyang ----
  OfficeScene.prototype._buildAquarium = function () {
    var AX = 5.2,
      AZ = 3.8;
    var g = new THREE.Group();
    var stand = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), mat(0x5d4c36));
    stand.position.set(AX, 0.275, AZ);
    stand.castShadow = true;
    g.add(stand);
    var glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.95, 0.8),
      new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.18 })
    );
    glass.position.set(AX, 1.05, AZ);
    var water = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.85, 0.72),
      new THREE.MeshBasicMaterial({ color: 0x2e7fd0, transparent: true, opacity: 0.45 })
    );
    water.position.set(AX, 1.02, AZ);
    g.add(glass, water);
    var sand = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 0.72), mat(0xd8c48a));
    sand.position.set(AX, 0.62, AZ);
    g.add(sand);
    var weeds = [];
    for (var w = 0; w < 3; w++) {
      var weed = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 6), mat(0x3f8f4f));
      weed.position.set(AX - 0.5 + w * 0.5, 0.85, AZ + (w % 2) * 0.2 - 0.1);
      g.add(weed);
      weeds.push({ m: weed, ph: w * 2.1 });
    }
    var fishes = [];
    var fishCols = [0xff9f43, 0xff6b6b, 0xffd93d, 0x6bcbff, 0xff9f43];
    for (var f = 0; f < 5; f++) {
      var fg = new THREE.Group();
      var fb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(fishCols[f]));
      fb.scale.set(1.4, 0.8, 0.6);
      var tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), mat(fishCols[f]));
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.16;
      fg.add(fb, tail);
      g.add(fg);
      fishes.push({
        g: fg,
        tail: tail,
        r: 0.35 + (f % 3) * 0.14,
        sp: 0.5 + f * 0.13,
        ph: f * 1.3,
        y: 0.95 + (f % 2) * 0.22,
      });
    }
    var bubbles = [];
    for (var b = 0; b < 10; b++) {
      var bb = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
      );
      bb.position.set(AX, 0.7, AZ);
      g.add(bb);
      bubbles.push({ m: bb, ph: b / 10, ox: (((b * 37) % 10) - 5) * 0.09 });
    }
    this.scene.add(g);
    this._aquarium = g;
    this._fishes = fishes;
    this.onTick(function (dt, t) {
      for (var i = 0; i < fishes.length; i++) {
        var fi = fishes[i];
        var a = t * fi.sp + fi.ph;
        fi.g.position.set(
          AX + Math.cos(a) * fi.r,
          fi.y + Math.sin(t * 2 + fi.ph) * 0.05,
          AZ + Math.sin(a) * fi.r * 0.55
        );
        fi.g.rotation.y = -a;
        fi.tail.rotation.y = Math.sin(t * 12 + fi.ph) * 0.5;
      }
      for (var j = 0; j < bubbles.length; j++) {
        var bu = bubbles[j];
        var ph = (t * 0.4 + bu.ph) % 1;
        bu.m.position.y = 0.7 + ph * 0.7;
        bu.m.position.x = AX + bu.ox;
      }
      for (var k = 0; k < weeds.length; k++) {
        weeds[k].m.rotation.z = Math.sin(t * 1.8 + weeds[k].ph) * 0.15;
      }
    });
  };

  // ---- Mode manager: makan siang (12-13) + rapat + tamu misterius ----
  OfficeScene.prototype._lunchHour = function () {
    return new Date().getHours();
  };

  OfficeScene.prototype._toast = function (msg) {
    if (this._propCb) this._propCb(msg);
  };

  OfficeScene.prototype._updateModes = function () {
    var self = this;
    this._seatOverride = null;
    this._lunchOn = false;
    this._meetingOn = false;
    this._guestIn = 150 + Math.random() * 150; // tamu pertama: 2.5–5 mnt
    var slides = ["📊 Rapat Q3", "💡 3 ide baru", "🚀 gas minggu depan"];
    this.onTick(function (dt, t) {
      var v = self.agents["vesper"];
      var m = self.agents["mochi"];
      var ov = null;
      var h = self._lunchHour();
      var lunchNow = h >= 12 && h < 13 && v && v.state !== "sleeping" && v.state !== "meeting";
      if (lunchNow) {
        ov = {
          vesper: { pos: new THREE.Vector3(-4.3, 0, -2.55), rotY: Math.PI },
          mochi: m ? { pos: new THREE.Vector3(-3.55, 0, -3.3), rotY: -Math.PI / 2 } : null,
        };
        if (!self._lunchOn) {
          self._lunchOn = true;
          self._foodGroup.visible = true;
          if (m) m.targetPos.copy(ov.mochi.pos);
          if (v) v.targetPos.copy(ov.vesper.pos);
          self._toast("🍱 jam makan siang! Vesper & Mochi pindah ke meja makan");
        }
      } else if (self._lunchOn) {
        self._lunchOn = false;
        self._foodGroup.visible = false;
        if (v) self._applyPose(v); // kembalikan targetPos sesuai state
        self._toast("💼 makan siang selesai — balik kerja!");
      }
      var meetingNow = !lunchNow && v && v.state === "meeting";
      if (meetingNow) {
        ov = {
          vesper: { pos: new THREE.Vector3(7.55, 0, 0), rotY: Math.PI / 2 },
          mochi: m ? { pos: new THREE.Vector3(9.45, 0, 0.95), rotY: -Math.PI / 2 } : null,
        };
        if (!self._meetingOn) {
          self._meetingOn = true;
          self._showSlides(true);
          if (m) m.targetPos.copy(ov.mochi.pos);
          self._toast("📊 rapat dimulai di ruang rapat");
        }
        // Slide presentasi ganti tiap 8 detik
        if (self._slideSprite) {
          self._slideTimer += dt;
          if (self._slideTimer > 8) {
            self._slideTimer = 0;
            self._slideIdx = (self._slideIdx + 1) % slides.length;
            self.scene.remove(self._slideSprite);
            var sp = textSprite(slides[self._slideIdx], 34);
            sp.scale.set(2.2, 0.55, 1);
            sp.position.set(10.7, 1.9, 0);
            self.scene.add(sp);
            self._slideSprite = sp;
          }
        }
      } else if (self._meetingOn) {
        self._meetingOn = false;
        self._showSlides(false);
        if (v) self._applyPose(v);
        self._toast("✅ rapat selesai");
      }
      self._seatOverride = ov;
      // Tamu misterius tiap 4–8 menit (tidak saat Vesper tidur)
      if (!self.agents["tamu"]) {
        self._guestIn -= dt;
        if (self._guestIn <= 0) {
          self._guestIn = 240 + Math.random() * 240;
          if (!v || v.state !== "sleeping") self._spawnGuest();
        }
      }
    });
  };

  OfficeScene.prototype._showSlides = function (on) {
    if (on && !this._slideSprite) {
      var sp = textSprite("📊 Rapat Q3", 34);
      sp.scale.set(2.2, 0.55, 1);
      sp.position.set(10.7, 1.9, 0);
      this.scene.add(sp);
      this._slideSprite = sp;
      this._slideIdx = 0;
      this._slideTimer = 0;
    }
    if (this._slideSprite) this._slideSprite.visible = on;
  };

  // ---- Tamu misterius: datang → ngobrol (bubble ...) → pulang ----
  OfficeScene.prototype._spawnGuest = function () {
    var self = this;
    if (this.agents["tamu"]) return null;
    var names = ["Tamu", "Pak Bos", "Kurir", "Tetangga"];
    var colors = ["#e0a35b", "#9db4e0", "#c9a7f5", "#7fd08a"];
    var i = Math.floor(Math.random() * names.length);
    var rec = this.addAgent({ id: "tamu", nama: names[i], warna: colors[i] });
    rec.guest = true;
    rec.state = "idle";
    rec.group.position.set(5.5, 0, 4.6);
    rec.group.rotation.y = Math.atan2(2.0 - 5.5, 0.6 - 4.6);
    rec.targetPos.set(2.0, 0, 0.6);
    rec.parts.legL.rotation.x = -0.08; // berdiri, bukan duduk
    rec.parts.legR.rotation.x = -0.08;
    var bubble = textSprite("💬 ...", 40);
    bubble.position.y = 2.3;
    bubble.visible = false;
    rec.group.add(bubble);
    rec._bubble = bubble;
    rec._gPhase = "datang";
    rec._gT = 0;
    this._toast("👋 eh, ada tamu mampir!");
    this.onTick(function (dt) {
      var a = self.agents["tamu"];
      if (!a) return;
      if (a._gPhase === "datang") {
        if (a.group.position.distanceTo(a.targetPos) < 0.35) {
          a._gPhase = "ngobrol";
          a._gT = 9;
          a._bubble.visible = true;
        }
      } else if (a._gPhase === "ngobrol") {
        a._gT -= dt;
        var v = self.agents["vesper"];
        if (v) {
          var dx = v.group.position.x - a.group.position.x;
          var dz = v.group.position.z - a.group.position.z;
          a.group.rotation.y = Math.atan2(dx, dz);
        }
        if (a._gT <= 0) {
          a._gPhase = "pulang";
          a._bubble.visible = false;
          a.targetPos.set(5.5, 0, 4.6);
        }
      } else if (a._gPhase === "pulang") {
        if (a.group.position.distanceTo(a.targetPos) < 0.35) {
          self.scene.remove(a.group);
          delete self.agents["tamu"];
        }
      }
    });
    return rec;
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { OfficeScene: OfficeScene };
  } else {
    global.OfficeScene = OfficeScene;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
