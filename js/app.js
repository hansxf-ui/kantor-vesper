// js/app.js — Wiring: data.json → UI + avatar 3D.
(function () {
  "use strict";

  var STATE_LABEL = { working: "kerja", idle: "santai", sleeping: "tidur" };

  function el(id) {
    return document.getElementById(id);
  }

  function fmtClock(iso) {
    var d = new Date(iso);
    return (
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0")
    );
  }

  function init() {
    if (typeof THREE === "undefined" || typeof OfficeScene === "undefined") return;
    var scene = new OfficeScene("scene-container");
    if (!scene.init()) return; // pesan fallback WebGL sudah ditampilkan init()
    el("loading").classList.add("hidden");

    var client = new DataClient(".");
    var hasGoodData = false;

    function renderStatus(agent, status) {
      el("agent-name").textContent = agent.nama || agent.id;
      var badge = el("state-badge");
      badge.textContent = STATE_LABEL[status.state] || status.state;
      badge.className = status.state;
      el("activity-text").textContent = "lagi " + (status.activity || "—");
      el("updated-text").textContent = "update " + timeAgo(status.updated_at);
    }

    function renderFeed(feed) {
      var ul = el("feed-list");
      ul.innerHTML = "";
      (feed || []).forEach(function (e) {
        var li = document.createElement("li");
        var t = document.createElement("span");
        t.className = "t";
        t.textContent = fmtClock(e.t);
        var m = document.createElement("span");
        m.textContent = e.msg;
        li.appendChild(t);
        li.appendChild(m);
        ul.appendChild(li);
      });
    }

    function showError(msg) {
      el("error-text").textContent = msg;
      el("error-bar").classList.add("show");
    }
    function hideError() {
      el("error-bar").classList.remove("show");
    }

    function applyData(data) {
      hasGoodData = true;
      hideError();
      data.agents.forEach(function (agent) {
        if (!scene.agents[agent.id]) scene.addAgent(agent);
        var st = data.statuses[agent.id];
        if (st) scene.setAgentState(agent.id, st.state);
      });
      var first = data.agents[0];
      if (first) {
        var st0 = data.statuses[first.id];
        if (st0) renderStatus(first, st0);
        renderFeed(data.feeds[first.id] || []);
      }
    }

    function onPollError() {
      showError(
        hasGoodData
          ? "⚠️ koneksi terputus. Menampilkan data terakhir."
          : "⚠️ gagal memuat data. Periksa koneksi lalu coba lagi."
      );
    }

    // Klik avatar → sorot kartu status (Vesper) / sapa (Mochi).
    // Kalau lagi bawa camilan, klik avatar = nyuapin.
    scene.onAgentClick(function (id) {
      if (scene._feeding) {
        showToast(scene.tryFeed(id));
        return;
      }
      if (id === "mochi") {
        showToast("🍡 Mochi lagi jalan-jalan keliling kantor");
        return;
      }
      var card = el("status-card");
      card.style.background = "rgba(45,212,191,0.15)";
      card.style.borderRadius = "10px";
      setTimeout(function () {
        card.style.background = "";
      }, 900);
      el("sheet").scrollTo({ top: 0, behavior: "smooth" });
    });

    // Toast notifikasi (dipakai klik perabot & sapa Mochi).
    var toastTimer = null;
    function showToast(msg) {
      var t = el("toast");
      t.textContent = msg;
      t.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        t.classList.remove("show");
      }, 1800);
    }
    scene.onPropClick(showToast);

    el("retry-btn").addEventListener("click", function () {
      client
        .loadAll()
        .then(applyData)
        .catch(onPollError);
    });

    // Tombol pindah ruangan → geser fokus kamera.
    var btnKantor = el("btn-kantor"),
      btnRapat = el("btn-rapat");
    function setRoom(name) {
      scene.focusRoom(name);
      if (btnKantor) btnKantor.classList.toggle("active", name === "kantor");
      if (btnRapat) btnRapat.classList.toggle("active", name === "rapat");
    }
    if (btnKantor) btnKantor.addEventListener("click", function () { setRoom("kantor"); });
    if (btnRapat) btnRapat.addEventListener("click", function () { setRoom("rapat"); });

    // Lipat/buka kolom bawah biar pandangan 3D lega (pilihan diingat).
    var sheetEl = el("sheet"),
      sheetHandle = el("sheet-handle");
    function applySheet(collapsed) {
      if (!sheetEl) return;
      sheetEl.classList.toggle("collapsed", collapsed);
      try {
        localStorage.setItem("kantor-vesper-sheet", collapsed ? "1" : "0");
      } catch (e) {}
    }
    if (sheetHandle)
      sheetHandle.addEventListener("click", function () {
        applySheet(!sheetEl.classList.contains("collapsed"));
      });
    try {
      if (localStorage.getItem("kantor-vesper-sheet") === "1") applySheet(true);
    } catch (e) {}

    client.loadAll().then(applyData).catch(onPollError);
    client.startPolling(applyData, onPollError);
    scene.render();
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { init: init };
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
