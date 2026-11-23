// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon ;
// le module reprend celles du Compagnon (Encyclopedia, HeroSheet, gemmes de resources/img).
//
// Onglet Héros : la fiche de chaque héros, telle que le Compagnon la dessine, sert de plateau. Ses zones sont actives :
// Vie (gemmes disponibles), Fatigue, Blessures, les six cases d'action et la colonne soleil / lune où la gemme rouge
// choisit la récupération (actif 2, 3, 4 ; inactif 5, 6, 7). Deux vues : la compagnie (toutes les fiches) et un héros seul.
// Comme pour le livre, rien ne bloque : la saturation d'une case d'action dépassée est seulement signalée.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
var KEY = Application + "_SkelosHeroes", MAX = 4, LONG = 380, STEP = 260, MOVE = 9;

// Zones de la fiche, en pourcentage de la fiche (calque background_layer_3 du Compagnon : 107 % de large, décalé de −3,5 % / −6,1 %).
var BANDS = {life: [1.1, 69.7, 31.3, 28.2], fatigue: [34.7, 69.7, 30.9, 28.2], wounds: [67.6, 69.7, 31.3, 28.2]};
var ACTS = {melee: [46.2, 2.3, 13.2, 21.9], ranged: [61.7, 2.3, 13.2, 21.9], defense: [77.2, 2.3, 13.3, 21.9],
            move: [46.2, 27.3, 13.2, 21.9], manip: [61.7, 27.3, 13.2, 21.9], reroll: [77.3, 27.3, 11.7, 19.9]};
var ACT_ORDER = ["melee", "ranged", "defense", "move", "manip", "reroll"];
// Saturation (chiffre rouge de la case) : la limite d'effort de l'encyclopédie ; la défense et la relance n'en ont pas.
var SAT_KEY = {melee: "melee", ranged: "ranged", move: "movement", manip: "manipulation"};
// Colonne soleil (actif 2, 3, 4) et lune (inactif 5, 6, 7) : centre vertical de chaque case.
var REC = {2: 12.6, 3: 18.8, 4: 24.7, 5: 40.7, 6: 46.9, 7: 53.0};

// ---------- Données ----------
var load = function() { try { var o = JSON.parse(localStorage.getItem(KEY)); if (o && o.heroes) return o; } catch (x) {} return {heroes: [], cur: null, log: []}; };
S.heroBoards = function() { if (!S._hb) S._hb = load(); return S._hb; };
var save = function() { try { localStorage.setItem(KEY, JSON.stringify(S.heroBoards())); } catch (x) {} };
var undo = [];
var snap = function() { undo.push(JSON.stringify(S.heroBoards())); if (undo.length > 100) undo.shift(); };
var hlog = function(msg) { var b = S.heroBoards(); b.log = b.log || []; b.log.unshift({msg: msg, ts: Date.now()}); if (b.log.length > 300) b.log.length = 300; };
var commit = function(msg) { if (msg) hlog(msg); save(); S.renderHeroes(); };
var byUid = function(uid) { return S.heroBoards().heroes.filter(function(h) { return h.uid == uid; })[0] || null; };
var heroData = function(ref) { return ((typeof Encyclopedia != "undefined" && Encyclopedia.heroes && Encyclopedia.heroes.list) || []).filter(function(x) { return x.id == ref; })[0] || null; };
var heroName = function(h) { var c = (S.heroCatalog() || []).filter(function(x) { return x.ref == h.ref; })[0]; return c ? c.name : h.name || h.ref; };
var sat = function(h, k) { var d = heroData(h.ref), f = d && SAT_KEY[k] && d[SAT_KEY[k]]; return f && f.exertion ? +f.exertion : 0; };
var count = function(h, z) { return z.indexOf("act:") == 0 ? (h.act[z.slice(4)] || 0) : (h[z] || 0); };
var put = function(h, z, n) { if (z.indexOf("act:") == 0) h.act[z.slice(4)] = n; else h[z] = n; };
var zoneName = function(z) { return t(z.indexOf("act:") == 0 ? "hb_act_" + z.slice(4) : "hb_" + z); };
var newHero = function(ref, name) {
    var d = heroData(ref), n = d ? +d.gems || 0 : 0;
    return {uid: "hb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ref: ref, name: name, total: n, life: n, fatigue: 0, wounds: 0,
            act: {melee: 0, ranged: 0, defense: 0, move: 0, manip: 0, reroll: 0}, rec: 2};
};
var autoOn = function(k) { return !S.hStudio && S.auto(k); };
var gemBlue = function() { return S.asset("resources/img/gem_blue.webp"); };
var gemRed = function() { return S.asset("resources/img/gem_red.webp"); };

// ---------- Dessin ----------
var box = function(r) { return "left:" + r[0] + "%;top:" + r[1] + "%;width:" + r[2] + "%;height:" + r[3] + "%"; };
var gemsCode = function(n) { var h = ""; for (var i = 0; i < n; i++) h += "<img src='" + gemBlue() + "' alt='' draggable='false'>"; return h; };
// Case d'action : les gemmes elles-mêmes (six au plus, puis un compteur), la saturation dépassée en rouge.
var pips = function(n, over) {
    if (!n) return "";
    return "<span class='sk-hzgems'>" + gemsCode(Math.min(n, 6)) + "</span>" + (n > 6 || over ? "<b class='sk-hzn" + (over ? " over" : "") + "'>" + n + "</b>" : "");
};
var boardCode = function(h, live) {
    var full = S.heroSheetFull(h.ref), name = heroName(h), z = "";
    Object.keys(BANDS).forEach(function(k) {
        var n = h[k] || 0;
        z += "<div class='sk-hz sk-hzband sk-hz-" + k + (n ? "" : " empty") + "' data-hz='" + k + "' style='" + box(BANDS[k]) + "' role='group' aria-label='" + e(zoneName(k) + " : " + n) + "'"
            + (live ? " title='" + e(t("hb_" + k + "_hint")) + "'" : "") + "><span class='sk-hzgems'>" + gemsCode(n) + "</span>"
            + (n ? "<b class='sk-hzn'>" + n + "</b>" : "")
            + (live && S.hStudio && k == "life" ? "<span class='sk-hzstep'><button data-hgems='-1' aria-label='" + e(t("hb_gems_minus")) + "'>−</button><button data-hgems='1' aria-label='" + e(t("hb_gems_plus")) + "'>+</button></span>" : "")
            + "</div>";
    });
    ACT_ORDER.forEach(function(k) {
        var n = h.act[k] || 0, s = sat(h, k), over = s && n > s;
        z += "<div class='sk-hz sk-hzact" + (n ? "" : " empty") + (over ? " over" : "") + "' data-hz='act:" + k + "' style='" + box(ACTS[k]) + "' role='group' aria-label='"
            + e(zoneName("act:" + k) + " : " + n + (s ? " / " + s : "")) + "'>" + pips(n, over) + "</div>";
    });
    Object.keys(REC).forEach(function(v) {
        z += "<button class='sk-hrec" + (h.rec == v ? " on" : "") + "' data-hrec='" + v + "' style='top:" + REC[v] + "%' aria-label='" + e(t("hb_rec", v)) + "' aria-pressed='" + (h.rec == v) + "'"
            + (live ? "" : " tabindex='-1'") + ">" + (h.rec == v ? "<img src='" + gemRed() + "' alt='' draggable='false'>" : "") + "</button>";
    });
    return "<div class='sk-hb" + (live ? " live" : "") + "' data-huid='" + h.uid + "'>"
        + (full ? "<span class='sk-hsheetscale'>" + full + "</span>" : "<span class='sk-hbnone'>" + e(name) + "</span>")
        + "<div class='sk-hzones'>" + z + "</div></div>";
};
var companyCode = function() {
    var b = S.heroBoards(), h = "";
    if (!b.heroes.length && !S.hStudio) return "<div class='sk-hbempty'><p>" + e(t("hb_empty")) + "</p><button class='sk-btn sk-primary' data-hstudio>" + e(t("hb_empty_go")) + "</button></div>";
    h += b.heroes.map(function(x) {
        var nm = heroName(x);
        return "<div class='sk-hbcard'>" + boardCode(x, false)
            + "<button class='sk-hbopen' data-hopen='" + x.uid + "' aria-label='" + e(t("hb_open", nm)) + "' title='" + e(t("hb_open", nm)) + "'></button>"
            + (S.hStudio ? "<button class='sk-zoomrm sk-hbrm' data-hrm='" + x.uid + "' aria-label='" + e(t("hb_remove", nm)) + "' title='" + e(t("hb_remove", nm)) + "'>&#xf2ed;</button>" : "") + "</div>";
    }).join("");
    if (S.hStudio && b.heroes.length < MAX) h += "<button class='sk-hbcard sk-hbadd' data-hadd><span aria-hidden='true'>+</span><small>" + e(t("add_hero")) + "</small></button>";
    return "<div class='sk-hbcompany'>" + h + "</div>";
};
S.renderHeroes = function() {
    var b = S.heroBoards(), cur = b.cur && byUid(b.cur);
    if (b.cur && !cur) b.cur = null;
    S.screen = "heroes";
    var inner = cur
        ? "<div class='sk-hbzoom'><button class='sk-hbback' data-hback aria-label='" + e(t("hb_back")) + "' title='" + e(t("hb_back")) + "'>&#xf060;</button>" + boardCode(cur, true) + "</div>"
        : companyCode();
    S.mount("<div class='skelos-game sk-screen sk-heroes" + (S.hStudio ? " sk-hstudio" : "") + "'><div class='sk-hbwrap'>" + inner + "</div></div>"
        + "<div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>");
    bind(S.root.querySelector(".sk-heroes"));
    if (S._htoast && Date.now() < S._htoastUntil) S.toast(S._htoast);
};
var warn = function(msg) { S._htoast = msg; S._htoastUntil = Date.now() + 2500; };

// ---------- Actions ----------
S.heroMoveGems = function(uid, from, to, n) {
    var h = byUid(uid); if (!h || from == to) return;
    n = Math.min(n, count(h, from)); if (n <= 0) return;
    snap();
    put(h, from, count(h, from) - n); put(h, to, count(h, to) + n);
    if (to.indexOf("act:") == 0) {
        var k = to.slice(4), s = sat(h, k);
        if (s && h.act[k] > s) warn(t("hb_sat", zoneName(to), h.act[k], s));
    }
    commit(t("hb_log_move", heroName(h), n, zoneName(from), zoneName(to)));
};
// Entretien (double appui sur la Fatigue) : les gemmes des cases d'action y retournent ; les Blessures ne bougent pas.
var collect = function(h) {
    var n = 0; ACT_ORDER.forEach(function(k) { n += h.act[k] || 0; h.act[k] = 0; });
    h.fatigue += n; return n;
};
S.heroCollect = function(uid) {
    var h = byUid(uid); if (!h) return;
    snap(); var n = collect(h);
    commit(t("hb_log_collect", heroName(h), n));
};
// Récupération (double appui sur la Vie) : l'entretien, puis la récupération choisie passe de la Fatigue à la Vie.
S.heroRecover = function(uid) {
    var h = byUid(uid); if (!h) return;
    snap(); collect(h);
    var n = Math.min(h.rec, h.fatigue); h.fatigue -= n; h.life += n;
    if (n < h.rec) warn(t("hb_rec_short", h.rec, n));
    commit(t("hb_log_recover", heroName(h), n));
};
S.heroSetRec = function(uid, v) {
    var h = byUid(uid); if (!h || h.rec == v) return;
    snap(); h.rec = +v;
    commit(t("hb_log_rec", heroName(h), v));
};
// Studio : nombre total de gemmes du héros (ajoutées à la Vie ou retirées de la Vie).
S.heroGems = function(uid, d) {
    var h = byUid(uid); if (!h) return;
    if (d < 0 && !h.life) { S.toast(t("hb_gems_none")); return; }
    snap(); h.life += d; h.total = Math.max(0, (h.total || 0) + d);
    commit(t("hb_log_gems", heroName(h), h.total));
};
S.heroUndo = function() {
    if (!undo.length) { S.toast(t("hb_undo_none")); return; }
    var cur = S.heroBoards().cur;
    S._hb = JSON.parse(undo.pop()); S._hb.cur = cur; save(); S.renderHeroes();
};
S.toggleHeroStudio = function(on) { S.hStudio = on == null ? !S.hStudio : !!on; S.renderHeroes(); };
var addHeroes = function() {
    var b = S.heroBoards(), have = {};
    b.heroes.forEach(function(h) { have[S.norm(heroName(h))] = true; });
    S.openHeroPicker(null, {free: MAX - b.heroes.length, have: have, onAdd: function(picked) {
        snap();
        picked.forEach(function(k) { b.heroes.push(newHero(k.ref, k.name)); hlog(t("hb_log_add", k.name)); });
        commit();
    }});
};
var removeHero = function(uid) {
    var h = byUid(uid); if (!h) return;
    S.ask(t("hb_confirm_remove", heroName(h)), t("hb_remove_yes"), function() {
        var b = S.heroBoards(); snap();
        b.heroes = b.heroes.filter(function(x) { return x.uid != uid; });
        commit(t("hb_log_remove", heroName(h)));
    });
};

// ---------- Gestes ----------
// Comme sur le livre : glisser emmène une gemme ; appui long, puis glisser ou lâcher, en emmène plusieurs
// (lâchées sans bouger, elles restent en main jusqu'au prochain appui sur une zone).
var hand = null, hinted = false;
var showHand = function() {
    var el = document.getElementById("sk-hhand");
    if (!hand || S.screen != "heroes") { if (el) el.remove(); hand = hand && S.screen == "heroes" ? hand : null; return; }
    if (!el) { document.body.insertAdjacentHTML("beforeend", "<div id='sk-hhand' class='sk-mhand sk-hhand' role='status' aria-live='polite'></div>"); el = document.getElementById("sk-hhand"); }
    el.innerHTML = "<img src='" + gemBlue() + "' alt=''><b>" + hand.n + "</b>";
    el.setAttribute("aria-label", t("man_hand", hand.n));
    el.classList.toggle("pinned", !!hand.pinned);
    el.style.left = hand.x + "px"; el.style.top = hand.y + "px";
};
var dropHand = function() { hand = null; showHand(); };
var bump = function() { var el = document.getElementById("sk-hhand"); if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };
var under = function(x, y, sel) { var el = document.elementFromPoint(x, y); return el && el.closest(".sk-hb.live") ? el.closest(sel) : null; };
var mark = function(el) {
    document.querySelectorAll(".sk-heroes .sk-mtarget").forEach(function(n) { if (n !== el) n.classList.remove("sk-mtarget"); });
    if (el) el.classList.add("sk-mtarget");
};
var last = {z: null, at: 0};
var bind = function(scr) {
    if (!scr) return;
    scr.addEventListener("click", function(ev) {
        if (ev.target.closest("[data-hstudio]")) { S.toggleHeroStudio(true); return; }
        if (ev.target.closest("[data-hadd]")) { addHeroes(); return; }
        var rm = ev.target.closest("[data-hrm]"); if (rm) { removeHero(rm.dataset.hrm); return; }
        var op = ev.target.closest("[data-hopen]"); if (op) { S.heroBoards().cur = op.dataset.hopen; save(); S.renderHeroes(); return; }
        if (ev.target.closest("[data-hback]")) { S.heroBoards().cur = null; save(); dropHand(); S.renderHeroes(); return; }
        var b = ev.target.closest(".sk-hb.live"); if (!b) return;
        var uid = b.dataset.huid;
        var gs = ev.target.closest("[data-hgems]"); if (gs) { S.heroGems(uid, +gs.dataset.hgems); return; }
        var rc = ev.target.closest("[data-hrec]"); if (rc) { S.heroSetRec(uid, +rc.dataset.hrec); return; }
        // Double appui : sur la Fatigue, l'entretien ; sur la Vie, l'entretien puis la récupération.
        var z = ev.target.closest("[data-hz='life'], [data-hz='fatigue']"); if (!z) return;
        var now = Date.now(), k = z.dataset.hz;
        if (last.z == k && now - last.at < 400) {
            last.z = null;
            if (k == "fatigue") { if (autoOn("collect")) S.heroCollect(uid); }
            else if (autoOn("recover")) S.heroRecover(uid);
            return;
        }
        last = {z: k, at: now};
    });
    scr.addEventListener("pointerdown", function(ev) {
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        var b = ev.target.closest(".sk-hb.live"); if (!b || ev.target.closest("button")) return;
        var uid = b.dataset.huid, h = byUid(uid), zone = ev.target.closest("[data-hz]"), x0 = ev.clientX, y0 = ev.clientY;
        if (!h) return;
        if (hand && hand.pinned) {
            ev.preventDefault();
            var from = hand.from, n = hand.n; dropHand();
            if (zone && zone.dataset.hz != from) S.heroMoveGems(uid, from, zone.dataset.hz, n);
            return;
        }
        if (!zone || count(h, zone.dataset.hz) <= 0) return;
        ev.preventDefault();
        var src = zone.dataset.hz, max = count(h, src), g = {moved: false, timer: null, tick: null};
        g.timer = setTimeout(function() {
            hand = {from: src, n: 1, x: x0, y: y0, pinned: false}; showHand(); bump();
            if (navigator.vibrate) navigator.vibrate(15);
            g.tick = setInterval(function() {
                if (g.moved || !hand || hand.n >= max) { clearInterval(g.tick); return; }
                hand.n++; showHand(); bump();
            }, STEP);
        }, LONG);
        var on = function(e2) {
            if (e2.pointerId != ev.pointerId) return;
            if (!g.moved && (Math.abs(e2.clientX - x0) > MOVE || Math.abs(e2.clientY - y0) > MOVE)) {
                g.moved = true; clearTimeout(g.timer); clearInterval(g.tick);
                if (!hand) hand = {from: src, n: 1, pinned: false};
            }
            if (g.moved && hand) { hand.x = e2.clientX; hand.y = e2.clientY; showHand(); mark(under(e2.clientX, e2.clientY, "[data-hz]")); }
        };
        var off = function(e2) {
            if (e2.pointerId != ev.pointerId) return;
            document.removeEventListener("pointermove", on); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off);
            clearTimeout(g.timer); clearInterval(g.tick); mark(null);
            if (e2.type == "pointercancel") { dropHand(); return; }
            if (g.moved && hand) {
                var to = under(e2.clientX, e2.clientY, "[data-hz]"), n = hand.n; dropHand();
                if (to) S.heroMoveGems(uid, src, to.dataset.hz, n);
            } else if (hand) { hand.pinned = true; showHand(); S.toast(t("man_hand_hint")); }
            else if (!hinted && src != "life" && src != "fatigue") { hinted = true; S.toast(t("man_gem_hint")); }
        };
        document.addEventListener("pointermove", on); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
    });
};
// Un appui hors de la fiche repose les gemmes en main.
document.addEventListener("pointerdown", function(ev) { if (hand && hand.pinned && !ev.target.closest(".sk-hb.live")) dropHand(); }, true);

// ---------- Onglet, outils, sauvegarde ----------
S.TABS.push(["heroes", "tab_heroes"]);
S.TAB_OF.heroes = "heroes";
var baseNav = S.navClick;
S.navClick = function(ev) {
    var n = ev.target.closest("[data-nav]");
    if (n && n.dataset.nav == "heroes" && !S.editing) { dropHand(); S.renderHeroes(); return; }
    return baseNav.apply(this, arguments);
};
// Barre des onglets : Annuler et Studio, comme sur le plateau de l'Overlord.
var basePlace = S.placeTabs;
S.placeTabs = function() {
    basePlace.apply(S, arguments);
    var nav = S.root && S.root.querySelector(":scope > .sk-tabs");
    if (!nav || S.screen != "heroes") return;
    nav.classList.add("withtools"); nav.classList.toggle("studio", !!S.hStudio);
    nav.insertAdjacentHTML("beforeend", "<div class='sk-tabtools'>"
        + "<button class='sk-tabico' data-htool='undo' title='" + e(t("undo")) + "' aria-label='" + e(t("undo")) + "'>&#xf0e2;</button>"
        + "<button class='sk-tabico" + (S.hStudio ? " on" : "") + "' data-htool='studio' aria-pressed='" + !!S.hStudio + "' title='" + e(t("hb_studio_hint")) + "' aria-label='" + e(t("studio")) + "'>&#xf591;</button></div>");
    nav.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-htool]"); if (!b) return;
        ev.stopPropagation();
        if (b.dataset.htool == "undo") S.heroUndo(); else S.toggleHeroStudio();
    });
};
var baseAll = S.allData;
S.allData = function() { var o = baseAll.apply(S, arguments); o.heroes = S.heroBoards(); return o; };
var baseRestore = S.restoreData;
S.restoreData = function(o) { baseRestore.apply(S, arguments); if (o && o.heroes && o.heroes.heroes) { S._hb = o.heroes; save(); } };
})();
