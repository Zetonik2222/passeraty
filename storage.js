/* Passeraty – ukladanie údajov priamo v mobile (localStorage)
   a denné ceny palív zo súboru prices.json, ktorý každé ráno aktualizuje GitHub. */
(function () {
  var KEY = "passeraty-data-v1";
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { store = {}; }
  var subs = [];
  var seq = 0;

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { console.warn("Údaje sa nepodarilo uložiť", e); throw e; }
  }
  function col(name) { if (!store[name]) store[name] = {}; return store[name]; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function snapshot(name, q) {
    var c = col(name);
    var docs = Object.keys(c).map(function (id) {
      var data = c[id];
      return { id: id, data: function () { return clone(data); } };
    });
    if (q.ord) {
      docs.sort(function (a, b) {
        var x = a.data()[q.ord], y = b.data()[q.ord];
        var r = x < y ? -1 : x > y ? 1 : 0;
        return q.dir === "desc" ? -r : r;
      });
    }
    if (q.lim) docs = docs.slice(0, q.lim);
    return { docs: docs };
  }
  function notify(name) {
    subs.forEach(function (s) {
      if (s.name === name) setTimeout(function () { s.cb(snapshot(name, s.q)); }, 0);
    });
  }

  function collection(name) {
    var q = { ord: null, dir: "asc", lim: 0 };
    var api = {
      orderBy: function (f, d) { q.ord = f; q.dir = d || "asc"; return api; },
      limit: function (n) { q.lim = n; return api; },
      onSnapshot: function (cb) {
        var sub = { name: name, q: { ord: q.ord, dir: q.dir, lim: q.lim }, cb: cb };
        subs.push(sub);
        setTimeout(function () { cb(snapshot(name, sub.q)); }, 0);
        return function () { subs = subs.filter(function (x) { return x !== sub; }); };
      },
      add: function (data) {
        var id = Date.now().toString(36) + "-" + (++seq);
        col(name)[id] = clone(data); persist(); notify(name);
        return Promise.resolve({ id: id });
      },
      doc: function (id) {
        return {
          set: function (data) { col(name)[id] = clone(data); persist(); notify(name); return Promise.resolve(); },
          delete: function () { delete col(name)[id]; persist(); notify(name); return Promise.resolve(); }
        };
      }
    };
    return api;
  }

  var db = { collection: collection };

  // Ceny zo servera: dopĺňajú sa do lokálnej histórie, ručne zadaná cena v daný deň ostáva.
  function syncPrices() {
    return fetch("prices.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var list = (j && j.ceny) || [];
        var c = col("ceny"), changed = false;
        list.forEach(function (p) {
          if (!p || !p.datum || typeof p.nafta !== "number") return;
          var cur = c[p.datum];
          if (cur && cur.rucne) return;
          var rec = { datum: p.datum, nafta: p.nafta, pumpa: "Slovnaft (cenník MOL Group / Slovnaft)", zdroj: "cenník Slovnaftu" };
          ["natural95", "premium", "premiumDiesel"].forEach(function (k) { if (typeof p[k] === "number") rec[k] = p[k]; });
          if (!cur || JSON.stringify(cur) !== JSON.stringify(rec)) { c[p.datum] = rec; changed = true; }
        });
        if (changed) { try { persist(); } catch (e) {} notify("ceny"); }
      })
      .catch(function () { /* bez internetu ostáva posledná uložená cena */ });
  }
  syncPrices();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncPrices(); });

  window.passeratyStore = {
    exportData: function () { return clone(store); },
    importData: function (data) {
      if (!data || typeof data !== "object") throw new Error("bad");
      ["ceny", "tankovania", "umyvanie"].forEach(function (k) {
        if (data[k] && typeof data[k] !== "object") throw new Error("bad");
      });
      store = clone(data); persist();
      ["ceny", "tankovania", "umyvanie"].forEach(notify);
    }
  };

  // Rovnaké rozhranie, aké appka používala v Claude: dostupné je len ukladanie.
  window.claude = {
    use: function (name) {
      return new Promise(function (res) { setTimeout(function () { res(name === "db" ? db : null); }, 0); });
    }
  };
})();
