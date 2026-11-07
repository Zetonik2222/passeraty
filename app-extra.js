/* Passeraty – záloha, obnova, inštalácia a offline režim */
(function () {
  function $(id) { return document.getElementById(id); }
  function msg(t) { $("bkMsg").textContent = t; $("bkMsg").hidden = !t; }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  // Záloha do súboru
  $("bkSave").addEventListener("click", function () {
    try {
      var data = window.passeratyStore.exportData();
      data._zaloha = { appka: "Passeraty", vytvorena: new Date().toISOString() };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "passeraty-zaloha-" + today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      msg("Záloha je uložená v priečinku Stiahnuté (Downloads).");
    } catch (e) { msg("Zálohu sa nepodarilo vytvoriť."); }
  });

  // Obnova zo zálohy (s potvrdením druhým ťuknutím)
  var armed = false;
  $("bkLoad").addEventListener("click", function () {
    if (!armed) {
      armed = true; $("bkLoad").textContent = "Naozaj? Prepíše súčasné údaje";
      setTimeout(function () { armed = false; $("bkLoad").textContent = "Obnoviť zo zálohy"; }, 5000);
      return;
    }
    armed = false; $("bkLoad").textContent = "Obnoviť zo zálohy";
    $("bkFile").value = ""; $("bkFile").click();
  });
  $("bkFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var data = JSON.parse(r.result);
        if (!data._zaloha || data._zaloha.appka !== "Passeraty") throw new Error("not ours");
        delete data._zaloha;
        window.passeratyStore.importData(data);
        msg("Údaje sú obnovené zo zálohy.");
      } catch (e) { msg("Tento súbor nie je záloha Passeraty. Vyber súbor passeraty-zaloha-….json."); }
    };
    r.readAsText(f);
  });

  // Inštalácia na plochu
  var deferred = null;
  var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferred = e;
    if (!standalone) $("installBar").hidden = false;
  });
  $("installBtn").addEventListener("click", function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; $("installBar").hidden = true; });
  });
  window.addEventListener("appinstalled", function () { $("installBar").hidden = true; });
  // iPhone nemá tlačidlo inštalácie – ukáž návod
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && !standalone) {
    $("installTxt").textContent = "Na iPhone: ťukni na Zdieľať a vyber „Pridať na plochu“.";
    $("installBtn").hidden = true; $("installBar").hidden = false;
  }

  // Offline režim
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
