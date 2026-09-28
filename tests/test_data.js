// Unit test untuk js/data.js — node, tanpa DOM.
const assert = require("assert");
const { DataClient, parseFeed, timeAgo } = require("../js/data.js");

// --- parseFeed: potong 50 -> 30 ---
{
  const many = [];
  for (let i = 0; i < 50; i++) {
    many.push({ t: `2026-09-28T15:${String(i).padStart(2, "0")}:00+08:00`, msg: `pesan ${i}` });
  }
  const out = parseFeed({ feed: many });
  assert.strictEqual(out.length, 30, "parseFeed harus memotong ke 30");
}

// --- parseFeed: buang entri tanpa t/msg, urut newest-first ---
{
  const out = parseFeed({ feed: [
    { t: "2026-09-28T15:02:00+08:00", msg: "kedua" },
    { msg: "tanpa waktu" },
    { t: "tanpa pesan" },
    { t: "2026-09-28T15:05:00+08:00", msg: "pertama" },
  ]});
  assert.strictEqual(out.length, 2, "entri rusak harus dibuang");
  assert.strictEqual(out[0].msg, "pertama", "harus newest-first");
  assert.strictEqual(out[1].msg, "kedua");
}

// --- timeAgo: 5 menit lalu ---
{
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const s = timeAgo(fiveMinAgo);
  assert.ok(s.includes("mnt"), `timeAgo 5 mnt harus mengandung "mnt", dapat: ${s}`);
}

// --- buildUrl: ada cache-buster ?t= ---
{
  const c = new DataClient("https://example.com/");
  const u = c.buildUrl("status/vesper.json");
  assert.ok(u.includes("status/vesper.json?t="), `URL harus ada ?t=, dapat: ${u}`);
}

// --- loadAll: fetch dipanggil dengan URL cache-busted, hasil diparsing ---
{
  const calls = [];
  const stubFetch = async (url) => {
    calls.push(url);
    return {
      ok: true,
      json: async () => {
        if (url.includes("agents.json")) return { agents: [{ id: "vesper", nama: "Vesper", warna: "#2dd4bf", meja: 1 }] };
        if (url.includes("status/")) return { state: "working", activity: "ngoding", since: "x", updated_at: "x" };
        if (url.includes("feed/")) return { feed: [{ t: "2026-09-28T15:00:00+08:00", msg: "halo" }] };
        throw new Error("unexpected " + url);
      },
    };
  };
  const c = new DataClient("https://example.com", stubFetch);
  c.loadAll().then(({ agents, statuses, feeds }) => {
    assert.strictEqual(agents.length, 1);
    assert.strictEqual(statuses.vesper.state, "working");
    assert.strictEqual(feeds.vesper.length, 1);
    assert.ok(calls.every((u) => u.includes("?t=")), "semua fetch harus cache-busted");
    console.log("semua test data.js PASS");
  }).catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
}
