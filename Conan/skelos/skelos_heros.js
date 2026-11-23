// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon ;
// le module reprend celles du Compagnon (Encyclopedia, HeroSheet, CardEquipment, CardSpell, gemmes de resources/img).
//
// Onglet Héros : la fiche de chaque héros, telle que le Compagnon la dessine, sert de plateau. Ses zones sont actives :
// Vie (gemmes disponibles), Fatigue, Blessures, les six cases d'action et la colonne soleil / lune où la gemme rouge
// choisit la récupération (actif 2, 3, 4 ; inactif 5, 6, 7). Deux vues : la compagnie (toutes les fiches) et un héros seul.
// Comme sur le livre de l'onglet Partie : gemmes en tas de trois, menu d'outils, et en mode studio le bol de gemmes à
// gauche et le tas de cartes à droite. Rien ne bloque : la saturation d'une case d'action dépassée est seulement signalée.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
var KEY = Application + "_SkelosHeroes", MAX = 4, LONG = 380, STEP = 260, MOVE = 9, BOWL_MAX = 30;

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
var cardsOf = function(h) { return h.cards || (h.cards = []); };
// Zones : life, fatigue, wounds, act:<case>, card:<rang>, reserve (le bol du studio, inépuisable).
var count = function(h, z) {
    if (z == "reserve") return BOWL_MAX;
    if (z.indexOf("act:") == 0) return h.act[z.slice(4)] || 0;
    if (z.indexOf("card:") == 0) { var c = cardsOf(h)[+z.slice(5)]; return c ? c.gems || 0 : 0; }
    return h[z] || 0;
};
var put = function(h, z, n) {
    if (z == "reserve") return;
    if (z.indexOf("act:") == 0) h.act[z.slice(4)] = n;
    else if (z.indexOf("card:") == 0) { var c = cardsOf(h)[+z.slice(5)]; if (c) c.gems = n; }
    else h[z] = n;
};
var zoneName = function(h, z) {
    if (z.indexOf("act:") == 0) return t("hb_act_" + z.slice(4));
    if (z.indexOf("card:") == 0) { var c = cardsOf(h)[+z.slice(5)]; return c ? S.itemName(c.kind, c.ref) : "?"; }
    return t(z == "reserve" ? "man_reserve" : "hb_" + z);
};
var total = function(h) { var n = (h.life || 0) + (h.fatigue || 0) + (h.wounds || 0); ACT_ORDER.forEach(function(k) { n += h.act[k] || 0; }); cardsOf(h).forEach(function(c) { n += c.gems || 0; }); return n; };
var newHero = function(ref, name) {
    var d = heroData(ref), n = d ? +d.gems || 0 : 0;
    return {uid: "hb" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ref: ref, name: name, life: n, fatigue: 0, wounds: 0,
            act: {melee: 0, ranged: 0, defense: 0, move: 0, manip: 0, reroll: 0}, rec: 2, cards: []};
};
var autoOn = function(k) { return !S.hStudio && S.auto(k); };
var gemBlue = function() { return S.asset("resources/img/gem_blue.webp"); };
var gemRed = function() { return S.asset("resources/img/gem_red.webp"); };

// ---------- Dessin ----------
var box = function(r) { return "left:" + r[0] + "%;top:" + r[1] + "%;width:" + r[2] + "%;height:" + r[3] + "%"; };
// Gemmes en tas de trois, comme sur le livre ; le tas rétrécit quand il y en a beaucoup (taille en cqw de la fiche ou de la carte).
var heap = function(n, seed, sizes) {
    if (!n) return "";
    var g = Math.ceil(n / 3), sz = sizes[sizes.length - 1][1];
    for (var i = 0; i < sizes.length; i++) if (g <= sizes[i][0]) { sz = sizes[i][1]; break; }
    return "<span class='sk-hzgems' style='--g:" + sz + "cqw'>" + S.gemGroupsCode(n, gemBlue(), "sk-mgem", seed) + "</span>";
};
var BAND_SZ = [[4, 3.4], [6, 2.8], [9, 2.2], [99, 1.7]], ACT_SZ = [[1, 3.3], [2, 2.9], [4, 2.2], [6, 1.8], [99, 1.4]], CARD_SZ = [[2, 15], [4, 11], [99, 8]];
// open : la vue d'ensemble, où un appui sur le buste du héros (hors zones de jeu) ouvre sa fiche en grand.
var boardCode = function(h, open) {
    var full = S.heroSheetFull(h.ref), name = heroName(h), z = "";
    Object.keys(BANDS).forEach(function(k) {
        var n = h[k] || 0;
        z += "<div class='sk-hz sk-hzband sk-hz-" + k + (n ? "" : " empty") + "' data-hz='" + k + "' style='" + box(BANDS[k]) + "' role='group' aria-label='" + e(zoneName(h, k) + " : " + n) + "'"
            + " title='" + e(t("hb_" + k + "_hint")) + "'>" + heap(n, h.uid + k, BAND_SZ) + (n ? "<b class='sk-hzn'>" + n + "</b>" : "") + "</div>";
    });
    ACT_ORDER.forEach(function(k) {
        var n = h.act[k] || 0, s = sat(h, k), over = s && n > s;
        z += "<div class='sk-hz sk-hzact" + (n ? "" : " empty") + (over ? " over" : "") + "' data-hz='act:" + k + "' style='" + box(ACTS[k]) + "' role='group' aria-label='"
            + e(zoneName(h, "act:" + k) + " : " + n + (s ? " / " + s : "")) + "'>" + heap(n, h.uid + k, ACT_SZ)
            + (over ? "<b class='sk-hzn over'>" + n + "</b>" : "") + "</div>";
    });
    Object.keys(REC).forEach(function(v) {
        z += "<button class='sk-hrec" + (h.rec == v ? " on" : "") + "' data-hrec='" + v + "' style='top:" + REC[v] + "%' aria-label='" + e(t("hb_rec", v)) + "' aria-pressed='" + (h.rec == v) + "'"
            + ">" + (h.rec == v ? "<img src='" + gemRed() + "' alt='' draggable='false'>" : "") + "</button>";
    });
    return "<div class='sk-hb live'>"
        + (full ? "<span class='sk-hsheetscale'>" + full + "</span>" : "<span class='sk-hbnone'>" + e(name) + "</span>")
        + "<div class='sk-hzones'>" + z + "</div>"
        + (open ? "<button class='sk-hbopen' data-hopen='" + h.uid + "' aria-label='" + e(t("hb_open", name)) + "' title='" + e(t("hb_open", name)) + "'></button>" : "") + "</div>";
};
// Cartes du héros (équipements, sorts), sous la fiche ; chacune reçoit des gemmes. En studio, une poubelle la retire.
// add : en studio dans la vue d'ensemble, une carte fantôme « + » ouvre le choix des cartes de ce héros.
var cardsCode = function(h, add) {
    var l = cardsOf(h); if (!l.length && !add) return "";
    return "<div class='sk-hbcards'>" + l.map(function(c, i) {
        var n = c.gems || 0, name = S.itemName(c.kind, c.ref), z = "card:" + i;
        var face = S.realCardCode(c.kind, c.ref) || "<span class='sk-upcard sk-k-" + c.kind + "'><b>" + e(name) + "</b></span>";
        return "<div class='sk-hz sk-hbcardc" + (n ? "" : " empty") + "' data-hz='" + z + "' role='group' aria-label='" + e(name + " : " + n) + "' title='" + e(name) + "'>"
            + "<span class='sk-cardscale'>" + face + "</span>" + heap(n, h.uid + z, CARD_SZ) + (n ? "<b class='sk-hzn'>" + n + "</b>" : "")
            + (S.hStudio ? "<button class='sk-zoomrm sk-hbcrm' data-hcrm='" + i + "' aria-label='" + e(t("hb_card_remove", name)) + "' title='" + e(t("hb_card_remove", name)) + "'>&#xf2ed;</button>" : "")
            + "</div>";
    }).join("") + (add ? "<button class='sk-hbcadd' data-hcards title='" + e(t("hb_cards_hint")) + "' aria-label='" + e(t("hb_cards_hint")) + "'><b>+</b><small>" + e(t("hb_cards")) + "</small></button>" : "") + "</div>";
};
// Studio : le bol de gemmes (photo du livre) à gauche, le tas de cartes à droite.
var bowlCode = function() {
    return "<div class='sk-hbside'><div class='sk-hz sk-hbbowl' data-hz='reserve' role='group' aria-label='" + e(t("man_reserve")) + "' title='" + e(t("hb_reserve_hint")) + "'>"
        + "<img class='sk-mbowlimg' src='skelos/img/fond/bol_gemmes_bleues.webp' alt='' draggable='false'><span class='sk-hbobj'>" + e(t("man_reserve")) + "</span></div></div>";
};
var pileCode = function() {
    return "<div class='sk-hbside'><button class='sk-hbpile' data-hcards title='" + e(t("hb_cards_hint")) + "' aria-label='" + e(t("hb_cards_hint")) + "'>"
        + "<span class='sk-hbstack'><i></i><i></i><i></i><i class='top'></i><b>+</b></span><span class='sk-hbobj'>" + e(t("hb_cards")) + "</span></button></div>";
};
var companyCode = function() {
    var b = S.heroBoards(), h = "";
    if (!b.heroes.length && !S.hStudio) return "<div class='sk-hbempty'><p>" + e(t("hb_empty")) + "</p><button class='sk-btn sk-primary' data-hstudio>" + e(t("hb_empty_go")) + "</button></div>";
    // Chaque fiche est aussi active que la fiche en grand : gemmes, gemme rouge, doubles appuis, cartes.
    h += b.heroes.map(function(x) {
        var nm = heroName(x);
        return "<div class='sk-hbcard sk-hbhero' data-huid='" + x.uid + "'>" + boardCode(x, true) + cardsCode(x, S.hStudio)
            + (S.hStudio ? "<button class='sk-zoomrm sk-hbrm' data-hrm='" + x.uid + "' aria-label='" + e(t("hb_remove", nm)) + "' title='" + e(t("hb_remove", nm)) + "'>&#xf2ed;</button>" : "") + "</div>";
    }).join("");
    if (S.hStudio && b.heroes.length < MAX) h += "<button class='sk-hbcard sk-hbadd' data-hadd><span aria-hidden='true'>+</span><small>" + e(t("add_hero")) + "</small></button>";
    h = "<div class='sk-hbcompany'>" + h + "</div>";
    return S.hStudio && b.heroes.length ? "<div class='sk-hbdesk'>" + bowlCode() + "<div class='sk-hbmain'>" + h + "</div></div>" : h;
};
S.renderHeroes = function() {
    var b = S.heroBoards(), cur = b.cur && byUid(b.cur);
    if (b.cur && !cur) b.cur = null;
    S.screen = "heroes";
    var inner = cur
        ? "<div class='sk-hbzoom'><button class='sk-hbback' data-hback aria-label='" + e(t("hb_back")) + "' title='" + e(t("hb_back")) + "'>&#xf060;</button>"
            + "<div class='sk-hbdesk'>" + (S.hStudio ? bowlCode() : "") + "<div class='sk-hbmain sk-hbhero' data-huid='" + cur.uid + "'>" + boardCode(cur, false) + cardsCode(cur) + "</div>" + (S.hStudio ? pileCode() : "") + "</div></div>"
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
        if (s && h.act[k] > s) warn(t("hb_sat", zoneName(h, to), h.act[k], s));
    }
    commit(from == "reserve" ? t("hb_log_bowl_take", heroName(h), n, zoneName(h, to)) : to == "reserve" ? t("hb_log_bowl_put", heroName(h), n, zoneName(h, from))
        : t("hb_log_move", heroName(h), n, zoneName(h, from), zoneName(h, to)));
};
// Entretien (double appui sur la Fatigue) : les gemmes des cases d'action y retournent ; Blessures et cartes ne bougent pas.
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
S.heroUndo = function() {
    if (!undo.length) { S.toast(t("hb_undo_none")); return; }
    var cur = S.heroBoards().cur;
    S._hb = JSON.parse(undo.pop()); S._hb.cur = cur; save(); S.renderHeroes();
};
// Recommencer : toutes les gemmes de chaque héros reviennent dans sa Vie, la gemme rouge sur le 2 actif ; cartes et héros restent.
S.heroRestart = function() {
    S.ask(t("hb_restart_q"), t("restart_game"), function() {
        snap();
        S.heroBoards().heroes.forEach(function(h) {
            var n = total(h);
            h.life = n; h.fatigue = 0; h.wounds = 0; h.rec = 2;
            ACT_ORDER.forEach(function(k) { h.act[k] = 0; }); cardsOf(h).forEach(function(c) { c.gems = 0; });
        });
        commit(t("hb_log_restart"));
    });
};
S.heroJournal = function() {
    var l = S.heroBoards().log || [], h = "<div class='sk-journal'>";
    if (!l.length) h += "<p>" + e(t("journal_empty")) + "</p>";
    else h += "<ol class='sk-jlist'>" + l.map(function(x) {
        var when = x.ts ? new Date(x.ts).toLocaleString(S.locale(), {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}) : "";
        return "<li>" + (when ? "<span class='sk-jtime'>" + e(when) + "</span>" : "") + e(x.msg) + "</li>";
    }).join("") + "</ol>";
    Nav.dialog(e(t("log")), h + "</div>", null, []);
};
S.heroHelp = function() {
    var h = "<div class='sk-journal sk-help-doc'><h1>" + e(t("hb_help_title")) + "</h1><ul>"
        + t("hb_help_items").split("|").map(function(x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul></div>";
    Nav.dialog(e(t("help")), h, null, []);
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
// Studio : cartes du héros, choisies comme celles des tuiles (équipements et sorts).
var addCards = function(uid) {
    S.openItemPicker({title: t("add_cards"), kind: "eq", kinds: ["eq", "sp"],
        onClose: function() { S.renderHeroes(); },
        onAdd: function(sel) {
            var h = byUid(uid); if (!h || !sel.length) { S.renderHeroes(); return; }
            snap();
            sel.forEach(function(x) { cardsOf(h).push({kind: x.kind, ref: x.ref, gems: 0}); });
            commit(t("hb_log_cards", heroName(h), sel.map(function(x) { return S.itemName(x.kind, x.ref); }).join(", ")));
        }});
};
// Une carte retirée rend ses gemmes à la Vie.
var removeCard = function(uid, i) {
    var h = byUid(uid), c = h && cardsOf(h)[i]; if (!c) return;
    snap();
    h.life += c.gems || 0; cardsOf(h).splice(i, 1);
    commit(t("hb_log_card_rm", heroName(h), S.itemName(c.kind, c.ref)));
};

// ---------- Gestes ----------
// Comme sur le livre : glisser emmène une gemme ; appui long, puis glisser ou lâcher, en emmène plusieurs
// (lâchées sans bouger, elles restent en main jusqu'au prochain appui sur une zone).
var hand = null, hinted = false;
var showHand = function() {
    var el = document.getElementById("sk-hhand");
    if (!hand || S.screen != "heroes") { if (el) el.remove(); if (S.screen != "heroes") hand = null; return; }
    if (!el) { document.body.insertAdjacentHTML("beforeend", "<div id='sk-hhand' class='sk-mhand sk-hhand' role='status' aria-live='polite'></div>"); el = document.getElementById("sk-hhand"); }
    el.innerHTML = "<img src='" + gemBlue() + "' alt=''><b>" + hand.n + "</b>";
    el.setAttribute("aria-label", t("man_hand", hand.n));
    el.classList.toggle("pinned", !!hand.pinned);
    el.style.left = hand.x + "px"; el.style.top = hand.y + "px";
};
var dropHand = function() { hand = null; showHand(); };
var bump = function() { var el = document.getElementById("sk-hhand"); if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };
var under = function(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest(".sk-heroes") ? el.closest("[data-hz]") : null; };
var uidOf = function(el) { var x = el && el.closest("[data-huid]"); return x ? x.dataset.huid : null; };
// Dépose de gemmes : dans un même héros, ou entre le bol et un héros.
var drop = function(src, srcUid, to, n) {
    if (!to) return;
    var z = to.dataset.hz, toUid = uidOf(to);
    if (src == "reserve") { if (toUid) S.heroMoveGems(toUid, src, z, n); return; }
    if (z == "reserve" || toUid == srcUid) S.heroMoveGems(srcUid, src, z, n);
};
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
        var uid = uidOf(ev.target); if (!uid) return;
        if (ev.target.closest("[data-hcards]")) { addCards(uid); return; }
        var cr = ev.target.closest("[data-hcrm]"); if (cr) { removeCard(uid, +cr.dataset.hcrm); return; }
        var rc = ev.target.closest("[data-hrec]"); if (rc) { S.heroSetRec(uid, +rc.dataset.hrec); return; }
        // Double appui : sur la Fatigue, l'entretien ; sur la Vie, l'entretien puis la récupération.
        var z = ev.target.closest("[data-hz='life'], [data-hz='fatigue']"); if (!z) return;
        var now = Date.now(), k = z.dataset.hz;
        if (last.z == k && last.uid == uid && now - last.at < 400) {
            last.z = null;
            if (k == "fatigue") { if (autoOn("collect")) S.heroCollect(uid); }
            else if (autoOn("recover")) S.heroRecover(uid);
            return;
        }
        last = {z: k, uid: uid, at: now};
    });
    scr.addEventListener("pointerdown", function(ev) {
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        if (ev.target.closest("button")) return;
        var zone = ev.target.closest("[data-hz]"), uid = uidOf(zone), h = uid && byUid(uid), x0 = ev.clientX, y0 = ev.clientY;
        if (hand && hand.pinned) {
            if (!zone) return;
            ev.preventDefault();
            var from = hand.from, fu = hand.uid, n = hand.n; dropHand();
            if (zone.dataset.hz != from || uid != fu) drop(from, fu, zone, n);
            return;
        }
        if (!zone || (zone.dataset.hz != "reserve" && (!h || count(h, zone.dataset.hz) <= 0))) return;
        ev.preventDefault();
        var src = zone.dataset.hz, max = src == "reserve" ? BOWL_MAX : count(h, src), g = {moved: false, timer: null, tick: null};
        g.timer = setTimeout(function() {
            hand = {from: src, uid: uid, n: 1, x: x0, y: y0, pinned: false}; showHand(); bump();
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
                if (!hand) hand = {from: src, uid: uid, n: 1, pinned: false};
            }
            if (g.moved && hand) { hand.x = e2.clientX; hand.y = e2.clientY; showHand(); mark(under(e2.clientX, e2.clientY)); }
        };
        var off = function(e2) {
            if (e2.pointerId != ev.pointerId) return;
            document.removeEventListener("pointermove", on); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off);
            clearTimeout(g.timer); clearInterval(g.tick); mark(null);
            if (e2.type == "pointercancel") { dropHand(); return; }
            if (g.moved && hand) {
                var to = under(e2.clientX, e2.clientY), n = hand.n; dropHand();
                drop(src, uid, to, n);
            } else if (hand) { hand.pinned = true; showHand(); S.toast(t("man_hand_hint")); }
            else if (!hinted && src != "life" && src != "fatigue") { hinted = true; S.toast(t("man_gem_hint")); }
        };
        document.addEventListener("pointermove", on); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
    });
};
// Un appui hors des zones repose les gemmes en main.
document.addEventListener("pointerdown", function(ev) { if (hand && hand.pinned && !ev.target.closest(".sk-heroes [data-hz]")) dropHand(); }, true);

// ---------- Onglet, outils, sauvegarde ----------
S.TABS.push(["heroes", "tab_heroes"]);
S.TAB_OF.heroes = "heroes";
var baseNav = S.navClick;
S.navClick = function(ev) {
    var n = ev.target.closest("[data-nav]");
    if (n && n.dataset.nav == "heroes" && !S.editing) { dropHand(); S.renderHeroes(); return; }
    return baseNav.apply(this, arguments);
};
// Barre des onglets, comme sur l'onglet Partie : l'icône des outils (Annuler, Recommencer, Journal, Aide) et le Studio.
var basePlace = S.placeTabs;
S.placeTabs = function() {
    basePlace.apply(S, arguments);
    var nav = S.root && S.root.querySelector(":scope > .sk-tabs");
    if (!nav || S.screen != "heroes") return;
    var b = function(act, icon, aria, off) {
        return "<button class='sk-tbtn' data-htool='" + act + "'" + (off ? " disabled" : "") + " title='" + e(t(aria)) + "' aria-label='" + e(t(aria)) + "'>" + icon + "</button>";
    };
    nav.classList.add("withtools"); nav.classList.toggle("studio", !!S.hStudio);
    nav.insertAdjacentHTML("beforeend", "<div class='sk-tabtools'>"
        + "<button class='sk-tabico sk-toolsico" + (S._toolsOpen ? " on" : "") + "' data-htool='tools' aria-expanded='" + !!S._toolsOpen + "' aria-controls='sk-toolbar'"
        + " title='" + e(t("tools_bar")) + "' aria-label='" + e(t("tools_bar")) + "'>&#xf142;</button>"
        + "<button class='sk-tabico" + (S.hStudio ? " on" : "") + "' data-htool='studio' aria-pressed='" + !!S.hStudio + "' title='" + e(t("hb_studio_hint")) + "' aria-label='" + e(t("studio")) + "'>&#xf591;</button></div>"
        + "<div class='sk-toolbar" + (S._toolsOpen ? " on" : "") + "' id='sk-toolbar' role='toolbar' aria-label='" + e(t("tools_bar")) + "'>"
        + b("undo", "&#xf0e2;", "undo", !undo.length) + b("restart", "&#xf2f9;", "restart_game", !S.heroBoards().heroes.length)
        + b("journal", "&#xf02d;", "log") + b("help", "&#xf128;", "help") + "</div>");
    nav.addEventListener("click", function(ev) {
        var x = ev.target.closest("[data-htool]"); if (!x) return;
        ev.stopPropagation();
        switch (x.dataset.htool) {
            case "tools": S._toolsOpen = !S._toolsOpen; S.syncToolbar(); break;
            case "studio": S.toggleHeroStudio(); break;
            case "undo": S.heroUndo(); break;
            case "restart": S.heroRestart(); break;
            case "journal": S.heroJournal(); break;
            case "help": S.heroHelp(); break;
        }
    });
};
var baseAll = S.allData;
S.allData = function() { var o = baseAll.apply(S, arguments); o.heroes = S.heroBoards(); return o; };
var baseRestore = S.restoreData;
S.restoreData = function(o) { baseRestore.apply(S, arguments); if (o && o.heroes && o.heroes.heroes) { S._hb = o.heroes; save(); } };
})();
