// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Ce module n'ajoute aucune image ni donnée de Monolith :
// il utilise celles déjà chargées par le Compagnon (Encyclopedia, Tile, jetons du dossier data/).
//
// Livre de Skelos manuel (réglage « Livre de Skelos manuel ») : le plateau se joue comme le vrai livre.
// Rien n'est calculé : les gemmes, les jetons, les tuiles, le sablier et la fin de partie se déplacent à la main.
// Le bureau porte la piste des tours ; le livre a quatre bandes, du haut vers le bas :
//   1. Mouvement, Défense active, Relance   2. Énergie disponible, tuile de repos, Fatigue
//   3. pions gemmes rouges numérotés        4. espace des tuiles, sans séparation.
// Coop : les jetons non tirés sont dans la zone verte ; un jeton tiré se pose sur Mouvement, Défense, Relance,
// Fatigue, puis est mis de côté. Les gemmes et les jetons restent dans l'état de partie habituel
// (energy, fatigue, boosts, pool, used) : on peut passer d'un plateau à l'autre en cours de partie.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };

var BAND1 = ["move", "defense", "reroll"];
var LONG = 380, STEP = 260, MOVE = 9;

S.manualOn = function() { return S.prefs().board == "manual" && !!S.state && !S.editing; };
var coop = function() { return S.state.mode == "solo"; };

// ---------- Gemmes : nombre par zone ----------
var count = function(z) {
    var st = S.state;
    if (z == "energy") return st.energy;
    if (z == "fatigue") return st.fatigue;
    return (st.boosts && st.boosts[z]) || 0;
};
var setCount = function(z, v) {
    var st = S.state;
    if (z == "energy") st.energy = v; else if (z == "fatigue") st.fatigue = v; else st.boosts[z] = v;
};
var zoneLabel = function(z) {
    if (z == "energy") return t(S.state && coop() ? "tokens_pool" : "energy");
    if (z == "fatigue") return t("fatigue");
    if (z == "aside") return t("man_aside");
    return t("boost_" + z);
};

// Groupes de 3 pour compter d'un coup d'œil, posés un peu en désordre comme un vrai tas.
// Le désordre est tiré d'un nombre fixe par zone et par gemme : le tas ne bouge pas d'un affichage à l'autre.
var jitter = function(seed) {
    var x = 0; for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) | 0;
    return function() { x = (x * 1103515245 + 12345) | 0; return ((x >>> 8) & 0xffff) / 0xffff - .5; };
};
var groupsCode = function(n, src, cls, seed) {
    var h = "", r = function(v) { return Math.round(v * 100) / 100; };
    for (var i = 0; i < n; i += 3) {
        var k = Math.min(3, n - i), rnd = jitter((seed || "") + ":" + i), gems = "";
        var gs = "--gr:" + r(rnd() * 40) + "deg;--gx:" + r(rnd() * .5) + ";--gy:" + r(rnd() * .7);
        for (var j = 0; j < k; j++) gems += "<img class='" + (cls || "") + "' src='" + src + "' alt='' draggable='false' style='--r:" + r(rnd() * 70) + "deg;--x:" + r(rnd() * .3) + ";--y:" + r(rnd() * .3) + "'>";
        h += "<span class='sk-mg3 n" + k + "' style='" + gs + "'>" + gems + "</span>";
    }
    return h;
};

// ---------- Jetons du mode Coop ----------
var live = function(uid) { return S.state.removed.indexOf(uid) < 0; };
var tokLoc = function(uid) {
    var st = S.state;
    if (st.pool.indexOf(uid) >= 0) return "energy";
    return (st.tokLoc && st.tokLoc[uid]) || "aside";
};
var tokensIn = function(z) {
    return S.state.river.filter(function(s) { return live(s.uid) && tokLoc(s.uid) == z; });
};
var poolCount = function() { return S.state.pool.filter(live).length; };
var tokCode = function(s) {
    return "<img class='sk-mtok' data-tok='" + s.uid + "' src='" + S.marker(s.token) + "' alt='" + s.token + "' draggable='false' title='" + e(S.tileName(s)) + "'>";
};

// ---------- Rendu ----------
var zoneCode = function(z, inner, title) {
    var n, content;
    if (coop() && z == "energy") { n = poolCount(); content = groupsCode(n, S.icon("tokenback"), "sk-mback", z); }
    else if (coop()) { var l = tokensIn(z); n = l.length; content = l.map(tokCode).join(""); }
    else { n = count(z); content = groupsCode(n, S.icon("gem"), "sk-mgem", z); }
    var label = zoneLabel(z) + " · " + n;
    return "<div class='sk-mz sk-mz-" + z + (n ? "" : " empty") + "' data-zone='" + z + "' role='group' aria-label='" + e(label) + "' title='" + e(label) + "'>"
        + (inner || "") + (title ? "<span class='sk-mtitle'>" + e(title) + "</span>" : "")
        + "<div class='sk-mgems'>" + content + "</div>"
        + (n ? "<span class='sk-mcount' aria-hidden='true'>" + n + "</span>" : "") + "</div>";
};

// ---------- Points de vie des tuiles sur la piste des tours (réglage, par défaut) ----------
// Une tuile glissée sur la piste y pose sa pastille, sur la case de ses points de vie ; la pastille se déplace
// ensuite sur la piste pour changer les PV. Le cœur disparaît alors de la tuile. Une pastille par groupe de PV partagés.
S.hpOnTrack = function() { return S.prefs().hpPlace != "tile"; };
var SOCLE = {gray: "#8a8a8a", red: "#b3161b", green: "#2e8b3e", blue: "#2a63ad", purple: "#7a3d9a", orange: "#e07a1f", black: "#222"};
var trackHp = function() {
    var st = S.state, seen = {};
    return (st.hpTrack || []).map(function(u) { return S.slotByUid(u); }).filter(function(s) {
        if (!s || S.isEvent(s)) return false;
        var g = S.hpGroup(s), key = g.map(function(x) { return x.uid; }).sort().join(",");
        if (seen[key]) return false; seen[key] = true; return true;
    });
};
var onTrack = function(s) { return S.hpOnTrack() && trackHp().some(function(x) { return S.hpGroup(x).indexOf(s) >= 0; }); };
var hpMarkerCode = function(s, k) {
    var tile = S.tileOf(s), label = t("man_hpm", S.tileName(s), s.lp || 0);
    return "<span class='sk-mhpm" + (s.dead ? " dead" : "") + "' data-hpm='" + s.uid + "' role='img' aria-label='" + e(label) + "' title='" + e(label) + "' style='--k:" + k
        + ";--c:" + (SOCLE[s.color] || "#8a8a8a") + ";background-image:url(\"" + S.asset(tile ? tile.image : "") + "\")'></span>";
};

var trackCode = function() {
    var st = S.state, hp = S.hpOnTrack() ? trackHp() : [];
    var last = Math.max(15, st.turns || 0, st.turn || 0, Math.max.apply(Math, [0].concat(hp.map(function(s) { return s.lp || 0; })))), h = "";
    var hour = "<img class='sk-mpiece sk-mhour' data-piece='turn' src='" + S.icon("time") + "' alt='" + e(t("man_hourglass")) + "' title='" + e(t("man_hourglass")) + "' draggable='false'>";
    var end = function(both) { return "<img class='sk-mpiece sk-mend" + (both ? " both" : "") + "' data-piece='end' src='" + S.icon("alarm") + "' alt='" + e(t("man_end")) + "' title='" + e(t("man_end")) + "' draggable='false'>"; };
    for (var i = 0; i <= last; i++) {
        var isEnd = st.turns && st.turns == i;
        var here = hp.filter(function(s) { return (s.lp || 0) == i; });
        h += "<span class='sk-mcell" + (isEnd ? " end" : "") + "' data-cell='" + i + "'><b>" + i + "</b>" + (st.turn == i ? hour : "") + (isEnd ? end(st.turn == i) : "")
            + here.map(hpMarkerCode).join("") + "</span>";
    }
    // Sans limite de tours, le marqueur de fin attend à droite de la piste.
    h += "<span class='sk-mpark' data-cell='none' title='" + e(t("turn_limit_none")) + "'>" + (st.turns ? "" : end(false)) + "</span>";
    return "<div class='sk-mtrack' role='group' aria-label='" + e(t("man_track") + " · " + t("turn") + " " + st.turn + (st.turns ? " / " + st.turns : "")) + "'>" + h + "</div>";
};

var restCode = function() {
    var st = S.state;
    if (coop()) return "<div class='sk-mrest'><span class='sk-mresttitle'>" + e(t("heroes")) + "</span>"
        + "<div class='sk-mstep'><button class='sk-pstep' data-mact='heroes' data-n='-1' aria-label='" + e(t("aria_heroes_minus")) + "'>−</button>"
        + S.token("heroes", st.heroes) + "<button class='sk-pstep' data-mact='heroes' data-n='1' aria-label='" + e(t("aria_heroes_plus")) + "'>+</button></div></div>";
    return "<div class='sk-mrest'><span class='sk-mresttitle'>" + e(t("recovery")) + "</span>" + S.token("recover", st.recovery)
        + "<div class='sk-mstep'><button class='sk-pstep' data-mact='recovery' data-n='-1' aria-label='" + e(t("aria_recovery_minus")) + "'>−</button>"
        + "<button class='sk-pstep' data-mact='recovery' data-n='1' aria-label='" + e(t("aria_recovery_plus")) + "'>+</button></div>"
        + "<span class='sk-mtotal'>" + e(t("gem_total", S.gemTotal())) + "</span></div>";
};

// Bande 3 : un pion gemme rouge numéroté au-dessus de chaque case de tuile.
var holesCode = function() {
    var h = "";
    for (var i = 0; i < S.RIVER_SIZE; i++) h += "<span class='sk-mhole'>" + S.rankToken(i + 1, "sk-mrank") + "</span>";
    return h;
};

// Pastille des cartes portées par une tuile (sorts, équipements), comme sur le plateau automatique.
var cardsBadge = function(s) {
    var sp = S.slotCards(s, "sp").length, eq = S.slotCards(s, "eq").length;
    if (!sp && !eq) return "";
    return "<span class='sk-cardsbadge' role='img' aria-label='" + e(t("cards_badge", sp, eq)) + "' title='" + e(t("cards_badge", sp, eq)) + "'>"
        + (sp ? "<i class='sk-cb-sp'>&#xf0d0;</i>" + sp : "") + (eq ? "<i class='sk-cb-eq'>&#xf3ed;</i>" + eq : "") + "</span>";
};

var tilesCode = function() {
    var st = S.state;
    return "<div class='sk-mb4' data-band='tiles'>" + st.river.map(function(s) {
        return "<div class='sk-mtile sk-tilebox" + (s.dead ? " dead" : "") + "' data-mtile='" + s.uid + "'" + (S.isEvent(s) ? " data-eventuid='" + s.uid + "'" : "")
            + " role='img' aria-label='" + e(S.tileName(s)) + "'>" + S.tileCode(s)
            + (s.dead ? "<span class='sk-deadmark'>" + t("dead") + "</span>" : "")
            + (s.lpMax && !S.hpOnTrack() ? S.hpBadge(s) : "") + cardsBadge(s) + "</div>";
    }).join("") + "</div>";
};

S.renderManual = function() {
    var st = S.state, root = S.root;
    var keep = S.screen == "game" && S._lastScreen == "game" ? root.scrollTop : null;
    S.screen = "game"; S.studio = false; S.selected = null;
    var h = "<div class='skelos-game sk-manual" + (coop() ? " solo" : "") + "'><div class='sk-desk'>" + trackCode()
        + "<div class='sk-book'>"
        + "<div class='sk-mb1'>" + BAND1.map(function(z) { return zoneCode(z, "<img class='sk-mico' src='" + S.icon(z) + "' alt='' draggable='false'>"); }).join("") + "</div>"
        + "<div class='sk-mb2'>" + zoneCode("energy", "", coop() ? t("tokens_pool") : t("energy")) + restCode() + zoneCode("fatigue", "", t("fatigue")) + "</div>"
        + "<div class='sk-mb3'>" + holesCode() + "</div>"
        + tilesCode() + "</div>"
        + (coop() ? zoneCode("aside", "", t("man_aside")) : "")
        + "</div></div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>";
    root.innerHTML = h;
    S._lastScreen = "game";
    S.placeTabs();
    // Pas de mode studio sur le livre manuel (il se règle à la main) : seul l'interrupteur Aventure / Coop reste
    // dans la barre des onglets (le clic est pris en charge par S.placeTabs → S.switchMode).
    var tools = root.querySelector(":scope > .sk-tabs .sk-tabtools");
    if (tools) tools.innerHTML = "<div class='sk-modesw' role='radiogroup' aria-label='" + e(t("mode_switch")) + "'>" + [["classic", "mode_adventure"], ["solo", "mode_coop"]].map(function(m) {
        var on = st.mode == m[0];
        return "<button role='radio' aria-checked='" + on + "' class='" + (on ? "on" : "") + "' data-studio='mode' data-mode='" + m[0] + "'>" + e(t(m[1])) + "</button>";
    }).join("") + "</div>";
    S.syncFullscreenButton();
    S.fitDesk();
    if (keep != null) root.scrollTop = keep;
    bind(root.querySelector(".sk-manual"));
    bindZoomHp();
    showHand();
};

// Tout le bureau doit tenir dans la hauteur visible (iPad en paysage) : on ne glisse pas une gemme vers une zone
// hors de l'écran. La largeur du bureau est réduite en conséquence ; sur un écran étroit (téléphone en portrait),
// le livre garde toute la largeur et la page défile.
S.fitDesk = function() {
    var root = S.root, desk = root && root.querySelector(".sk-manual .sk-desk"); if (!desk) return;
    desk.style.maxWidth = "";
    var w = desk.offsetWidth, h = desk.offsetHeight; if (!w || !h) return;
    var top = desk.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    var avail = root.clientHeight - top - 16, ratio = h / w;
    if (window.innerWidth < 700 || avail < 200 || h <= avail) return;
    desk.style.maxWidth = Math.max(560, Math.floor(avail / ratio)) + "px";
};
var fitT = null;
window.addEventListener("resize", function() { clearTimeout(fitT); fitT = setTimeout(function() { if (S.screen == "game" && S.manualOn()) S.fitDesk(); }, 120); });
var baseFull = S.toggleFullscreen;
S.toggleFullscreen = function() { var r = baseFull.apply(S, arguments); if (S.screen == "game" && S.manualOn()) requestAnimationFrame(S.fitDesk); return r; };
document.addEventListener("fullscreenchange", function() { setTimeout(function() { if (S.screen == "game" && S.manualOn()) S.fitDesk(); }, 150); });

// ---------- Actions (une étape d'annulation et une ligne de Journal chacune) ----------
var commit = function(msg) { if (msg) S.log(msg); S.save(); S.renderGame(); };

S.manualMoveGems = function(from, to, n) {
    n = Math.min(n, count(from));
    if (!to || to == from || n <= 0) return;
    S.snapshot();
    setCount(from, count(from) - n); setCount(to, count(to) + n);
    commit(t("man_log_gems", n, zoneLabel(from), zoneLabel(to)));
};

S.manualMoveToken = function(uid, to) {
    var st = S.state, s = S.slotByUid(uid), from = tokLoc(uid);
    if (!s || !to || to == from) return;
    S.snapshot();
    st.tokLoc = st.tokLoc || {};
    if (to == "energy") {
        st.used = st.used.filter(function(u) { return u != uid; });
        if (st.pool.indexOf(uid) < 0) st.pool.push(uid);
        delete st.tokLoc[uid];
    } else {
        if (from == "energy") { st.pool = st.pool.filter(function(u) { return u != uid; }); if (st.used.indexOf(uid) < 0) st.used.push(uid); }
        st.tokLoc[uid] = to;
    }
    commit(t(from == "energy" ? "man_log_draw" : "man_log_token", s.token, S.tileName(s), zoneLabel(to)));
};

// Un jeton tiré au hasard parmi ceux de la zone verte.
var drawRandom = function() {
    var l = S.state.pool.filter(live);
    return l.length ? l[Math.floor(Math.random() * l.length)] : null;
};

S.manualMoveTile = function(uid, idx) {
    var st = S.state, i = st.river.findIndex(function(s) { return s.uid == uid; });
    idx = Math.max(0, Math.min(st.river.length - 1, idx));
    if (i < 0 || idx == i) return;
    S.snapshot();
    var s = st.river.splice(i, 1)[0]; st.river.splice(idx, 0, s);
    commit(t("man_log_tile", S.tileName(s), idx + 1));
};

S.manualPiece = function(which, cell) {
    var st = S.state;
    if (which == "turn") {
        if (cell == "none" || +cell == st.turn) return;
        S.snapshot(); st.turn = +cell;
        commit(t("man_log_turn", st.turn));
    } else {
        var v = cell == "none" ? 0 : +cell;
        if (v == (st.turns || 0)) return;
        S.snapshot(); st.turns = v; if (st.scenario) st.scenario.turns = v;
        commit(v ? t("man_log_limit", v) : t("turn_limit_none"));
    }
};

// Points de vie fixés à la main (pastille sur la piste, ou − / + du zoom) : tout le groupe de PV partagés suit.
// 0 = toutes les unités sont mortes ; remonter au-dessus de 0 réactive la tuile. La tuile ne change pas de place.
S.manualSetHp = function(uid, v) {
    var s = S.slotByUid(uid); if (!s || S.isEvent(s)) return;
    v = Math.max(0, Math.min(40, v));
    var cur = s.lp || 0, group = S.hpGroup(s), name = S.tileName(s);
    if (v == cur && s.lpMax) return;
    S.snapshot();
    group.forEach(function(g) { g.lp = v; if (!g.lpMax || v > g.lpMax) g.lpMax = Math.max(v, g.lpMax || 0) || null; });
    S.log(t("log_hp", name, cur, v));
    if (v == 0) group.forEach(function(g) { if (!g.dead) S.killSlot(g); });
    else if (group.some(function(g) { return g.dead; })) { group.forEach(function(g) { g.dead = false; }); S.log(t("log_reinforce", name)); }
    commit();
};
// Une tuile posée sur la piste : sa pastille va sur la case de ses PV ; une tuile sans PV prend la case où on l'a lâchée.
S.manualTrackTile = function(uid, cell) {
    var st = S.state, s = S.slotByUid(uid); if (!s || S.isEvent(s)) return;
    if (onTrack(s)) { S.toast(t("man_hp_already", S.tileName(s))); return; }
    S.snapshot();
    st.hpTrack = (st.hpTrack || []).concat([uid]);
    if (!s.lpMax && cell != null && cell != "none") S.hpGroup(s).forEach(function(g) { g.lp = +cell; g.lpMax = +cell || null; });
    commit(t("man_log_hp_on", S.tileName(s), s.lp || 0));
};
S.manualUntrack = function(uid) {
    var st = S.state, s = S.slotByUid(uid); if (!s) return;
    var group = S.hpGroup(s).map(function(g) { return g.uid; });
    S.snapshot();
    st.hpTrack = (st.hpTrack || []).filter(function(u) { return group.indexOf(u) < 0; });
    commit(t("man_log_hp_off", S.tileName(s)));
};

// ---------- Main : gemmes ramassées ----------
// Appui long dans une zone : le nombre de gemmes prises monte tant que le doigt reste posé.
// Glisser ensuite les emmène ; lâcher sans bouger les garde « en main » jusqu'au prochain appui sur une zone.
var hand = null;      // {from, n, x, y, pinned}
var handEl = function() {
    var el = document.getElementById("sk-mhand");
    if (!el) { document.body.insertAdjacentHTML("beforeend", "<div id='sk-mhand' class='sk-mhand' role='status' aria-live='polite'></div>"); el = document.getElementById("sk-mhand"); }
    return el;
};
var showHand = function() {
    var el = document.getElementById("sk-mhand");
    if (!hand || !S.manualOn() || S.screen != "game") { if (el) el.remove(); if (!S.manualOn()) hand = null; return; }
    el = handEl();
    el.innerHTML = "<img src='" + S.icon("gem") + "' alt=''><b>" + hand.n + "</b>";
    el.setAttribute("aria-label", t("man_hand", hand.n));
    el.classList.toggle("pinned", !!hand.pinned);
    el.style.left = hand.x + "px"; el.style.top = hand.y + "px";
};
var dropHand = function() { hand = null; showHand(); };

// ---------- Fantôme d'une pièce glissée (jeton, sablier, tuile) ----------
var ghost = null;
var ghostStart = function(src, x, y, html) {
    var r = src.getBoundingClientRect();
    ghost = document.createElement("div");
    ghost.className = "sk-mghost";
    ghost.style.width = r.width + "px"; ghost.style.height = r.height + "px";
    ghost.innerHTML = html || src.outerHTML;
    document.body.appendChild(ghost);
    ghostMove(x, y);
};
var ghostMove = function(x, y) { if (ghost) { ghost.style.left = x + "px"; ghost.style.top = y + "px"; } };
var ghostEnd = function() { if (ghost) ghost.remove(); ghost = null; };

var under = function(x, y, sel) {
    var el = document.elementFromPoint(x, y);
    return el && el.closest(".sk-manual") ? el.closest(sel) : null;
};
var markTarget = function(el) {
    document.querySelectorAll(".sk-manual .sk-mtarget").forEach(function(n) { if (n !== el) n.classList.remove("sk-mtarget"); });
    if (el) el.classList.add("sk-mtarget");
};
var tileIndexAt = function(x) {
    var band = S.root.querySelector(".sk-mb4"); if (!band) return -1;
    var r = band.getBoundingClientRect(), w = r.width / S.RIVER_SIZE;
    return Math.floor((x - r.left) / w);
};

// ---------- Gestes ----------
var lastTap = {uid: null, at: 0};
var hinted = false;

var bind = function(board) {
    if (!board) return;
    board.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-mact]"); if (!b) return;
        var f = b.dataset.mact, v = Math.max(f == "heroes" ? 1 : 0, (S.state[f] || 0) + +b.dataset.n);
        if (f == "heroes") v = Math.min(4, v);
        if (v == S.state[f]) return;
        S.snapshot(); S.state[f] = v; commit();
    });
    board.addEventListener("contextmenu", function(ev) { if (ev.target.closest("[data-zone], [data-mtile], [data-piece], [data-tok]")) ev.preventDefault(); });
    board.addEventListener("pointerdown", function(ev) {
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        if (ev.target.closest("button, .sk-hpwrap, [data-hp], [data-skill]")) return;
        var x0 = ev.clientX, y0 = ev.clientY;
        var zone = ev.target.closest("[data-zone]");

        // Gemmes en main : l'appui suivant les pose dans la zone touchée, ou les repose.
        if (hand && hand.pinned) {
            ev.preventDefault();
            var from = hand.from, n = hand.n; dropHand();
            if (zone && zone.dataset.zone != from) S.manualMoveGems(from, zone.dataset.zone, n);
            return;
        }

        S.hideTip();
        var piece = ev.target.closest("[data-piece]"), tok = ev.target.closest("[data-tok]"), tile = ev.target.closest("[data-mtile]"), hpm = ev.target.closest("[data-hpm]");
        var g = {moved: false, timer: null, tick: null};
        var far = function(e2) { return Math.abs(e2.clientX - x0) > MOVE || Math.abs(e2.clientY - y0) > MOVE; };
        var on, off;
        var listen = function(move, up) {
            on = function(e2) { if (e2.pointerId == ev.pointerId) move(e2); };
            off = function(e2) {
                if (e2.pointerId != ev.pointerId) return;
                document.removeEventListener("pointermove", on); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off);
                clearTimeout(g.timer); clearInterval(g.tick); markTarget(null);
                up(e2, e2.type == "pointercancel");
            };
            document.addEventListener("pointermove", on); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
        };

        // Pastille de PV d'une tuile : glissée sur une case de la piste, elle fixe les PV ; lâchée hors de la piste, elle la quitte.
        if (hpm) {
            ev.preventDefault();
            listen(function(e2) {
                if (!g.moved && far(e2)) { g.moved = true; hpm.classList.add("sk-mdragging"); ghostStart(hpm, e2.clientX, e2.clientY); }
                if (g.moved) { ghostMove(e2.clientX, e2.clientY); markTarget(under(e2.clientX, e2.clientY, "[data-cell]")); }
            }, function(e2, cancel) {
                ghostEnd(); hpm.classList.remove("sk-mdragging");
                if (cancel || !g.moved) return;
                var cell = under(e2.clientX, e2.clientY, "[data-cell]");
                if (cell && cell.dataset.cell != "none") S.manualSetHp(hpm.dataset.hpm, +cell.dataset.cell);
                else if (!under(e2.clientX, e2.clientY, ".sk-mtrack")) S.manualUntrack(hpm.dataset.hpm);
            });
            return;
        }

        // Sablier et fin de partie : sur la piste des tours.
        if (piece) {
            ev.preventDefault();
            listen(function(e2) {
                if (!g.moved && far(e2)) { g.moved = true; piece.classList.add("sk-mdragging"); ghostStart(piece, e2.clientX, e2.clientY); }
                if (g.moved) { ghostMove(e2.clientX, e2.clientY); markTarget(under(e2.clientX, e2.clientY, "[data-cell]")); }
            }, function(e2, cancel) {
                var cell = !cancel && g.moved ? under(e2.clientX, e2.clientY, "[data-cell]") : null;
                ghostEnd(); piece.classList.remove("sk-mdragging");
                if (cell) S.manualPiece(piece.dataset.piece, cell.dataset.cell);
            });
            return;
        }

        // Coop : un jeton posé se déplace ; un jeton pris dans la zone verte est tiré au hasard.
        if (coop() && (tok || (zone && zone.dataset.zone == "energy" && poolCount()))) {
            ev.preventDefault();
            var src = tok || zone.querySelector(".sk-mback");
            if (!src) return;
            listen(function(e2) {
                if (!g.moved && far(e2)) {
                    g.moved = true;
                    if (tok) tok.classList.add("sk-mdragging");
                    ghostStart(src, e2.clientX, e2.clientY, "<img src='" + (tok ? tok.src : S.icon("tokenback")) + "' alt=''>");
                }
                if (g.moved) { ghostMove(e2.clientX, e2.clientY); markTarget(under(e2.clientX, e2.clientY, "[data-zone]")); }
            }, function(e2, cancel) {
                var to = !cancel && g.moved ? under(e2.clientX, e2.clientY, "[data-zone]") : null;
                ghostEnd(); if (tok) tok.classList.remove("sk-mdragging");
                if (!to) return;
                var uid = tok ? tok.dataset.tok : (to.dataset.zone != "energy" ? drawRandom() : null);
                if (uid) S.manualMoveToken(uid, to.dataset.zone);
            });
            return;
        }

        // Gemmes : glisser en emmène une ; appui long, puis glisser ou lâcher, en emmène plusieurs.
        if (zone && !coop() && count(zone.dataset.zone) > 0) {
            ev.preventDefault();
            var from = zone.dataset.zone, max = count(from);
            var charge = function() {
                hand = {from: from, n: 1, x: x0, y: y0, pinned: false}; showHand();
                if (navigator.vibrate) navigator.vibrate(15);
                g.tick = setInterval(function() {
                    if (g.moved || !hand || hand.n >= max) { clearInterval(g.tick); return; }
                    hand.n++; showHand();
                    if (navigator.vibrate) navigator.vibrate(8);
                }, STEP);
            };
            g.timer = setTimeout(charge, LONG);
            listen(function(e2) {
                if (!g.moved && far(e2)) {
                    g.moved = true; clearTimeout(g.timer); clearInterval(g.tick);
                    if (!hand) hand = {from: from, n: 1, pinned: false};
                }
                if (g.moved && hand) { hand.x = e2.clientX; hand.y = e2.clientY; showHand(); markTarget(under(e2.clientX, e2.clientY, "[data-zone]")); }
            }, function(e2, cancel) {
                if (cancel) { dropHand(); return; }
                if (g.moved && hand) {
                    var to = under(e2.clientX, e2.clientY, "[data-zone]"), n = hand.n;
                    dropHand();
                    if (to) S.manualMoveGems(from, to.dataset.zone, n);
                } else if (hand) { hand.pinned = true; showHand(); S.toast(t("man_hand_hint")); }
                else if (!hinted) { hinted = true; S.toast(t("man_gem_hint")); }
            });
            return;
        }

        // Tuiles : glisser pour les déplacer, appui long pour le menu, double appui pour l'agrandir.
        if (tile) {
            var uid = tile.dataset.mtile, long = false;
            if (!tile.hasAttribute("data-eventuid")) g.timer = setTimeout(function() { long = true; S._suppressClick = true; S.openTileMenu(uid); }, 450);
            listen(function(e2) {
                if (!g.moved && !long && far(e2)) { g.moved = true; clearTimeout(g.timer); tile.classList.add("sk-dragging"); ghostStart(tile, e2.clientX, e2.clientY); }
                if (g.moved) {
                    e2.preventDefault(); ghostMove(e2.clientX, e2.clientY);
                    markTarget(S.hpOnTrack() && !tile.hasAttribute("data-eventuid") ? under(e2.clientX, e2.clientY, "[data-cell]") : null);
                }
            }, function(e2, cancel) {
                ghostEnd(); tile.classList.remove("sk-dragging");
                if (cancel || long) return;
                if (g.moved) {
                    if (under(e2.clientX, e2.clientY, ".sk-mb4")) S.manualMoveTile(uid, tileIndexAt(e2.clientX));
                    else if (S.hpOnTrack() && under(e2.clientX, e2.clientY, ".sk-mtrack")) {
                        var c = under(e2.clientX, e2.clientY, "[data-cell]");
                        S.manualTrackTile(uid, c ? c.dataset.cell : null);
                    }
                    return;
                }
                // Double appui : le texte d'une tuile Événement se modifie ; une autre tuile s'agrandit, avec ses cartes.
                var now = Date.now();
                if (lastTap.uid == uid && now - lastTap.at < 400) {
                    lastTap.uid = null;
                    if (tile.hasAttribute("data-eventuid")) S.editEventText(uid); else S.zoomTile(uid);
                }
                else { lastTap.uid = uid; lastTap.at = now; }
            });
        }
    });
    // La description d'un Événement s'efface dès que la souris quitte la tuile.
    board.addEventListener("mouseout", function(ev) {
        var ev1 = ev.target.closest("[data-eventuid]"); if (!ev1) return;
        if (ev.relatedTarget && ev1.contains(ev.relatedTarget)) return;
        S.hideTip();
    });
};

// Zoom d'une tuile depuis le livre manuel : on y ajoute et retire les cartes (comme en studio) et on règle les PV
// de la partie, sans lancer de sort (les gemmes se déplacent à la main).
var baseZoom = S.zoomTile;
S.zoomTile = function(uid, opts) {
    if (!S.manualOn()) return baseZoom.apply(S, arguments);
    S.studio = true;
    try { baseZoom.apply(S, arguments); } finally { S.studio = false; }
    var ov = S.root.querySelector("#sk-overlay");
    if (ov) ov.querySelectorAll("[data-zlp]").forEach(function(b) { b.removeAttribute("data-zlp"); b.setAttribute("data-zmhp", b.dataset.n); });
};
var zoomBound = false;
var bindZoomHp = function() {
    if (zoomBound || !S.root) return; zoomBound = true;
    S.root.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-zmhp]"); if (!b || !S._zoom) return;
        ev.stopPropagation(); ev.preventDefault();
        var uid = S._zoom.uid, s = S.slotByUid(uid); if (!s) return;
        S.manualSetHp(uid, (s.lp || 0) + +b.dataset.zmhp);
        S.zoomTile(uid, {pos: 0});
    }, true);
};

// Événement sans texte : le survol ne montre rien.
var baseEventTip = S.showEventTip;
S.showEventTip = function(el) {
    var has = S.eventTexts().some(function(v) { return v.uid == el.dataset.eventuid; });
    if (!has) { S.hideTip(); return; }
    return baseEventTip.apply(S, arguments);
};

// Livre manuel : une tuile morte reste à sa place, on la déplace à la main.
var baseKill = S.killSlot;
S.killSlot = function(slot) {
    var st = S.state;
    if (!S.manualOn() || !st || st.mode == "solo") return baseKill.apply(S, arguments);
    st.mode = "solo";
    try { return baseKill.apply(S, arguments); } finally { st.mode = "classic"; }
};

// Un appui hors du livre repose les gemmes en main.
document.addEventListener("pointerdown", function(ev) {
    if (hand && hand.pinned && !ev.target.closest(".sk-manual")) dropHand();
}, true);

// ---------- Branchements ----------
var baseRender = S.renderGame;
S.renderGame = function() {
    if (S.manualOn()) return S.renderManual();
    dropHand();
    return baseRender.apply(S, arguments);
};
// Les autres écrans font disparaître la main.
var baseMount = S.mount;
S.mount = function() { dropHand(); return baseMount.apply(S, arguments); };
})();
