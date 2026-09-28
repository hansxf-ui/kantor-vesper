// js/data.js — DataClient: polling JSON kantor (agents, status, feed).
// Berjalan di browser (global) dan node (module.exports untuk test).
(function (global) {
  "use strict";

  var POLL_MS = 30000;
  var FEED_MAX = 30;

  // Ambil max 30 entri valid, urut newest-first.
  function parseFeed(json) {
    var list = json && Array.isArray(json.feed) ? json.feed : [];
    return list
      .filter(function (e) {
        return e && typeof e.t === "string" && typeof e.msg === "string";
      })
      .sort(function (a, b) {
        return a.t < b.t ? 1 : a.t > b.t ? -1 : 0;
      })
      .slice(0, FEED_MAX);
  }

  // "5 mnt lalu" — Bahasa Indonesia.
  function timeAgo(iso) {
    var diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff) || diff < 0) return "baru saja";
    var m = Math.floor(diff / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return m + " mnt lalu";
    var h = Math.floor(m / 60);
    if (h < 24) return h + " jam lalu";
    return Math.floor(h / 24) + " hari lalu";
  }

  function DataClient(baseUrl, fetchImpl) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, "");
    this.fetchImpl =
      fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(global) : null);
  }

  // Selalu tambah ?t= agar CDN Pages tidak menyajikan JSON basi.
  DataClient.prototype.buildUrl = function (path) {
    return this.baseUrl + "/" + path + "?t=" + Date.now();
  };

  DataClient.prototype.fetchJson = async function (path) {
    if (!this.fetchImpl) throw new Error("fetch tidak tersedia");
    var res;
    try {
      res = await this.fetchImpl(this.buildUrl(path));
    } catch (e) {
      throw new Error("gagal memuat " + path);
    }
    if (!res.ok) throw new Error("gagal memuat " + path);
    return res.json();
  };

  DataClient.prototype.loadAll = async function () {
    var data = await this.fetchJson("agents.json");
    var agents = (data && data.agents) || [];
    var statuses = {};
    var feeds = {};
    for (var i = 0; i < agents.length; i++) {
      var id = agents[i].id;
      statuses[id] = await this.fetchJson("status/" + id + ".json");
      feeds[id] = parseFeed(await this.fetchJson("feed/" + id + ".json"));
    }
    return { agents: agents, statuses: statuses, feeds: feeds };
  };

  // onUpdate({agents, statuses, feeds}); onError(err). Error tidak
  // menghentikan interval — polling berikutnya tetap jalan.
  DataClient.prototype.startPolling = function (onUpdate, onError, intervalMs) {
    var self = this;
    var ms = intervalMs || POLL_MS;
    async function tick() {
      try {
        onUpdate(await self.loadAll());
      } catch (e) {
        if (onError) onError(e);
      }
    }
    tick();
    var timer = setInterval(tick, ms);
    return function stop() {
      clearInterval(timer);
    };
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DataClient: DataClient, parseFeed: parseFeed, timeAgo: timeAgo };
  } else {
    global.DataClient = DataClient;
    global.parseFeed = parseFeed;
    global.timeAgo = timeAgo;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
