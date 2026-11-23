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
// Dans l'éditeur de scénario, les fiches sont un brouillon du scénario : rien n'est écrit, le scénario est « modifié ».
var save = function() { if (S.editing) { S.editing.dirty = true; return; } try { localStorage.setItem(KEY, JSON.stringify(S.heroBoards())); } catch (x) {} };
var undo = [];
var snap = function() { undo.push(JSON.stringify(S.heroBoards())); if (undo.length > 100) undo.shift(); };
var hlog = function(msg) { var b = S.heroBoards(); b.log = b.log || []; b.log.unshift({msg: msg, ts: Date.now()}); if (b.log.length > 300) b.log.length = 300; };
var commit = function(msg) { if (msg) hlog(msg); save(); S.renderHeroes(); };
var byUid = function(uid) { return S.heroBoards().heroes.filter(function(h) { return h.uid == uid; })[0] || null; };
var heroData = function(ref) { return ((typeof Encyclopedia != "undefined" && Encyclopedia.heroes && Encyclopedia.heroes.list) || []).filter(function(x) { return x.id == ref; })[0] || null; };
var heroName = function(h) { var c = (S.heroCatalog() || []).filter(function(x) { return x.ref == h.ref; })[0]; return c ? c.name : h.name || h.ref; };
var sat = function(h, k) { var d = heroData(h.ref), f = d && SAT_KEY[k] && d[SAT_KEY[k]]; return f && f.exertion ? +f.exertion : 0; };
// Chaque carte a un identifiant (pour la zone de retour des gemmes rouges, qui la suit même si l'ordre change).
var cardsOf = function(h) {
    var l = h.cards || (h.cards = []);
    l.forEach(function(c) { if (!c.id) c.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); });
    return l;
};
// Zones : life, fatigue, wounds, act:<case>, card:<rang>, reserve (les bols du studio, inépuisables).
// Gemmes rouges (gemme de scénario, par exemple réservée aux objets) : le joueur les gère ; elles se comptent à part
// (h.red par zone, c.red sur une carte), hors du total bleu. Aucune au départ.
var rmap = function(h) { return h.red || (h.red = {}); };
var count = function(h, z, red) {
    if (z == "reserve") return BOWL_MAX;
    if (z.indexOf("card:") == 0) { var c = cardsOf(h)[+z.slice(5)]; return c ? (red ? c.red : c.gems) || 0 : 0; }
    if (red) return rmap(h)[z] || 0;
    if (z.indexOf("act:") == 0) return h.act[z.slice(4)] || 0;
    return h[z] || 0;
};
var put = function(h, z, n, red) {
    if (z == "reserve") return;
    if (z.indexOf("card:") == 0) { var c = cardsOf(h)[+z.slice(5)]; if (c) c[red ? "red" : "gems"] = n; }
    else if (red) rmap(h)[z] = n;
    else if (z.indexOf("act:") == 0) h.act[z.slice(4)] = n;
    else h[z] = n;
};
// Zone de retour des gemmes rouges : là où le studio les a posées (h.redHome : zone ou « c:<carte> » → nombre).
// Chaque déplacement d'une gemme rouge en mode studio la redéfinit ; l'entretien et la récupération y ramènent les rouges.
var redSnap = function(h) {
    var o = {}, m = rmap(h);
    for (var k in m) if (m[k]) o[k] = m[k];
    cardsOf(h).forEach(function(c) { if (c.red) o["c:" + c.id] = c.red; });
    return o;
};
var redGoHome = function(h) {
    if (!h.redHome) return false;
    var cards = {}; cardsOf(h).forEach(function(c) { cards[c.id] = c; c.red = 0; });
    var m = h.red = {}, lost = 0;
    for (var k in h.redHome) {
        var n = h.redHome[k] || 0;
        if (k.indexOf("c:") == 0) { if (cards[k.slice(2)]) cards[k.slice(2)].red = n; else lost += n; }
        else m[k] = n;
    }
    if (lost) m.life = (m.life || 0) + lost;   // carte disparue : ses rouges reviennent dans la Vie
    return true;
};
var redTotal = function(h) { var n = 0, m = rmap(h); for (var k in m) n += m[k] || 0; cardsOf(h).forEach(function(c) { n += c.red || 0; }); return n; };
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

// ---------- Encombrement ----------
// Poids porté : la somme des objets du héros (cartes d'équipement ; sorts et tuiles ne pèsent rien).
// Seuils de la fiche (encyclopédie : [maximum, −1 au mouvement, −2 au mouvement]) ; une compétence est perdue dès que
// l'encombrement atteint son chiffre. Rien n'est bloqué : la fiche le montre, et un dépassement du maximum est signalé.
var cardWeight = function(c) {
    if (c.kind != "eq") return 0;
    var q = ((typeof Encyclopedia != "undefined" && Encyclopedia.equipments && Encyclopedia.equipments.list) || []).filter(function(x) { return x.id == c.ref; })[0];
    return q && q.encumbrance ? +q.encumbrance || 0 : 0;
};
var encOf = function(h) {
    var d = heroData(h.ref), en = (d && d.encumbrance) || [], w = cardsOf(h).reduce(function(a, c) { return a + cardWeight(c); }, 0);
    var max = +en[0] || 0, m1 = +en[1] || 0, m2 = +en[2] || 0;
    return {w: w, max: max, mov: m2 && w >= m2 ? -2 : m1 && w >= m1 ? -1 : 0, over: !!(max && w > max)};
};
// La fiche du Compagnon, annotée : compétences perdues grisées, seuil de mouvement atteint entouré, mouvement réduit,
// poids porté sur le pictogramme de l'encombrement (en rouge au-delà du maximum).
var encSheet = function(code, h) {
    var en = encOf(h), d = heroData(h.ref), sk = (d && d.skills) || [], i = 0;
    code = code.replace(/<div class="skill">/g, function(m) { var x = sk[i++]; return x && x.exertion && en.w >= +x.exertion ? '<div class="skill sk-hoff">' : m; });
    code = code.replace(/<div class="encumbrance">(\d+)<\/div>/, function(m, n) {
        var tip = t("hb_enc_title", en.w, n) + (en.mov ? " — " + t("hb_enc_mov", en.mov) : "") + (en.over ? " — " + t("hb_enc_over_short") : "");
        return '<div class="encumbrance' + (en.over ? ' sk-hover' : '') + '">' + n
            + '<b class="sk-hencw' + (en.over ? ' over' : '') + '" title="' + e(tip) + '" aria-label="' + e(tip) + '">' + en.w + '</b></div>';
    });
    if (en.mov) {
        code = code.replace('<div class="encumbrance_movement-' + (-en.mov) + '">', '<div class="encumbrance_movement-' + (-en.mov) + ' sk-hon">');
        code = code.replace(/(<div class="base movement">[\s\S]*?<div class="dice">)(\d+)(<\/div>)/, function(m, a, n, b) {
            return a.replace('<div class="dice">', '<div class="dice sk-hmov">') + Math.max(0, +n + en.mov) + b;
        });
    }
    return code;
};
var encWarn = function(h) { var en = encOf(h); if (en.over) warn(t("hb_enc_over", heroName(h), en.w, en.max)); };

// ---------- Dessin ----------
// Pendant une animation, une bande (Fatigue, Vie) garde son ancien nombre jusqu'à l'arrivée des gemmes.
var holds = {};
var shown = function(h, k) { var v = holds[h.uid + "|" + k]; return v != null ? v : h[k] || 0; };
var box = function(r) { return "left:" + r[0] + "%;top:" + r[1] + "%;width:" + r[2] + "%;height:" + r[3] + "%"; };
// Gemmes en tas de trois, comme sur le livre ; le tas rétrécit quand il y en a beaucoup (taille en cqw de la fiche ou de la carte).
var heap = function(n, r, seed, sizes) {
    if (!n && !r) return "";
    var g = Math.ceil(n / 3) + Math.ceil(r / 3), sz = sizes[sizes.length - 1][1];
    for (var i = 0; i < sizes.length; i++) if (g <= sizes[i][0]) { sz = sizes[i][1]; break; }
    return "<span class='sk-hzgems' style='--g:" + sz + "cqw'>" + S.gemGroupsCode(n, gemBlue(), "sk-mgem", seed)
        + S.gemGroupsCode(r, gemRed(), "sk-mgem sk-mgem-r", seed + "r") + "</span>";
};
// Compteur d'une zone : les bleues, puis « / » et les rouges en rouge ; les rouges seules si elles sont seules.
var badge = function(n, r, over) {
    if (!n && !r) return "";
    return "<b class='sk-hzn" + (over ? " over" : "") + "'>" + (n ? n : "") + (n && r ? " / " : "") + (r ? "<span class='sk-hzr'>" + r + "</span>" : "") + "</b>";
};
var ariaN = function(n, r) { return n + (r ? " + " + t("hb_red_n", r) : ""); };
var BAND_SZ = [[4, 3.4], [6, 2.8], [9, 2.2], [99, 1.7]], ACT_SZ = [[1, 3.3], [2, 2.9], [4, 2.2], [6, 1.8], [99, 1.4]], CARD_SZ = [[2, 15], [4, 11], [99, 8]];
// open : la vue d'ensemble, où un appui sur le buste du héros (hors zones de jeu) ouvre sa fiche en grand.
var boardCode = function(h, open) {
    var full = S.heroSheetFull(h.ref), name = heroName(h), z = "";
    if (full) full = encSheet(full, h);
    Object.keys(BANDS).forEach(function(k) {
        var n = shown(h, k), r = count(h, k, true);
        z += "<div class='sk-hz sk-hzband sk-hz-" + k + (n || r ? "" : " empty") + "' data-hz='" + k + "' style='" + box(BANDS[k]) + "' role='group' aria-label='" + e(zoneName(h, k) + " : " + ariaN(n, r)) + "'"
            + " title='" + e(t("hb_" + k + "_hint")) + "'>" + heap(n, r, h.uid + k, BAND_SZ) + badge(n, r) + "</div>";
    });
    ACT_ORDER.forEach(function(k) {
        var n = h.act[k] || 0, r = count(h, "act:" + k, true), s = sat(h, k), over = s && n + r > s;
        z += "<div class='sk-hz sk-hzact" + (n || r ? "" : " empty") + (over ? " over" : "") + "' data-hz='act:" + k + "' style='" + box(ACTS[k]) + "' role='group' aria-label='"
            + e(zoneName(h, "act:" + k) + " : " + ariaN(n, r) + (s ? " / " + s : "")) + "'>" + heap(n, r, h.uid + k, ACT_SZ)
            + (over || r ? badge(n, r, over) : "") + "</div>";
    });
    Object.keys(REC).forEach(function(v) {
        // La gemme rouge se glisse d'une case à l'autre ; au clavier, Entrée sur une case l'y pose.
        z += "<div class='sk-hrec" + (h.rec == v ? " on" : "") + "' data-hrec='" + v + "' style='top:" + REC[v] + "%' role='button' tabindex='0' aria-label='" + e(t("hb_rec", v)) + "' aria-pressed='" + (h.rec == v) + "'>"
            + (h.rec == v ? "<img class='sk-hmark' data-hmark src='" + gemRed() + "' alt='' draggable='false' title='" + e(t("hb_mark_hint")) + "'>" : "") + "</div>";
    });
    return "<div class='sk-hb live'>"
        + (full ? "<span class='sk-hsheetscale'>" + full + "</span>" : "<span class='sk-hbnone'>" + e(name) + "</span>")
        + "<div class='sk-hzones'>" + z + "</div>"
        + (open ? "<button class='sk-hbopen' data-hopen='" + h.uid + "' aria-label='" + e(t("hb_open", name)) + "' title='" + e(t("hb_open", name)) + "'></button>" : "") + "</div>";
};
// Cartes du héros (équipements, sorts), sous la fiche ; chacune reçoit des gemmes. En studio, une poubelle la retire.
// add : en studio dans la vue d'ensemble, une carte fantôme « + » ouvre le choix des cartes de ce héros.
var cardCode = function(h, c, i) {
        var n = c.gems || 0, r = c.red || 0, name = S.itemName(c.kind, c.ref), z = "card:" + i;
        var face = S.realCardCode(c.kind, c.ref) || "<span class='sk-upcard sk-k-" + c.kind + "'><b>" + e(name) + "</b></span>";
        return "<div class='sk-hz sk-hbcardc" + (n || r ? "" : " empty") + "' data-hz='" + z + "' data-kind='" + c.kind + "' data-hcard='" + i + "' role='group' aria-label='" + e(name + " : " + ariaN(n, r)) + "' title='" + e(t("hb_card_hint", name)) + "'>"
            + "<span class='sk-cardscale'>" + face + "</span>" + heap(n, r, h.uid + z, CARD_SZ) + badge(n, r)
            + (S.hStudio ? "<button class='sk-zoomrm sk-hbcrm' data-hcrm='" + i + "' aria-label='" + e(t("hb_card_remove", name)) + "' title='" + e(t("hb_card_remove", name)) + "'>&#xf2ed;</button>" : "")
            + "</div>";
};
var addCardCode = function() { return "<button class='sk-hbcadd' data-hcards title='" + e(t("hb_cards_hint")) + "' aria-label='" + e(t("hb_cards_hint")) + "'><b>+</b><small>" + e(t("hb_cards")) + "</small></button>"; };
// Héros seul : la fiche reste la fiche, et les cartes sont les plus lisibles possible. Selon la place et le nombre de cartes,
// on retient la meilleure disposition : des deux côtés (sorts à gauche, objets à droite), d'un seul côté, ou dessous.
var GAP = 8;
var layouts = function(W, H, kL, kR) {
    var k = kL + kR, Smax = Math.min(W, H * 1.75), out = [];
    if (!k) return [{lay: "none", sw: Smax, cw: 0}];
    [1, 2, 3, 4].forEach(function(r) {
        var ch = (H - (r - 1) * GAP) / r, cw = ch * .67;
        var side = function(cols) { return Math.min(H * 1.75, W - cols * (cw + GAP) - GAP); };
        out.push({lay: "sides", rows: r, cw: cw, sw: side(Math.ceil(kL / r) + Math.ceil(kR / r))});
        out.push({lay: "right", rows: r, cw: cw, sw: side(Math.ceil(k / r))});
    });
    [1, 2].forEach(function(r) {
        for (var f = 1; f >= .5; f -= .05) {
            var sw = Smax * f, ch = (H - sw / 1.75 - r * GAP) / r, per = Math.ceil(k / r);
            var cw = Math.min(ch * .67, (W - (per - 1) * GAP) / per);
            if (cw > 0) out.push({lay: "below", rows: r, cw: cw, sw: sw});
        }
    });
    // La fiche garde au moins 70 % de sa taille possible ; parmi ces dispositions, les cartes les plus grandes, puis la plus grande fiche.
    var ok = out.filter(function(x) { return x.sw >= Smax * .7 && x.cw > 0; });
    if (!ok.length) ok = out.filter(function(x) { return x.cw > 0; }).sort(function(a, b) { return b.sw - a.sw; }).slice(0, 1);
    ok.sort(function(a, b) { return Math.round(b.cw) - Math.round(a.cw) || b.sw - a.sw; });
    return ok;
};
// Le héros seul occupe toute la hauteur utile ; dans la compagnie, chaque héros a sa case de la grille (deux rangées dès
// trois héros), et la même optimisation y place ses cartes à côté de la fiche ou dessous pour que tout tienne à l'écran.
var layoutSolo = function() {
    var all = S.root ? [].slice.call(S.root.querySelectorAll(".sk-hbsolo")) : []; if (!all.length) return;
    var probe = document.createElement("div"); probe.style.cssText = "position:absolute;visibility:hidden;height:var(--hbH)"; all[0].appendChild(probe);
    var H = Math.max(160, probe.offsetHeight); probe.remove();
    var comp = S.root.querySelector(".sk-hbcompany");
    if (comp) {
        var grid = getComputedStyle(comp).display == "grid", n = comp.querySelectorAll(".sk-hbhero, .sk-hbadd").length;
        if (grid && n > 2) H = Math.max(120, (H - 14) / 2);
    }
    all.forEach(function(solo) { layoutOne(solo, H); });
};
var layoutOne = function(solo, H) {
    var W = solo.clientWidth, cards = [].slice.call(solo.querySelectorAll(".sk-hbcardc, .sk-hbcadd"));
    var isL = function(c) { return c.dataset.kind == "sp"; };
    var kL = cards.filter(isL).length, best = layouts(W, H, kL, cards.length - kL)[0];
    var sheet = solo.querySelector(".sk-hbsheet");
    solo.querySelectorAll(".sk-hbcol").forEach(function(c) { c.remove(); });
    solo.dataset.lay = best.lay;
    solo.style.setProperty("--cw", Math.floor(best.cw) + "px");
    sheet.style.width = Math.floor(best.sw) + "px";
    var col = function(cls, list, rows) {
        var d = document.createElement("div"); d.className = "sk-hbcol " + cls;
        if (rows) d.style.gridTemplateRows = "repeat(" + rows + ", auto)";
        list.forEach(function(c) { d.appendChild(c); }); return d;
    };
    if (best.lay == "sides") {
        if (kL) solo.insertBefore(col("left", cards.filter(isL), best.rows), sheet);
        if (cards.length - kL) solo.appendChild(col("right", cards.filter(function(c) { return !isL(c); }), best.rows));
    } else if (best.lay == "right") solo.appendChild(col("right", cards, best.rows));
    else if (best.lay == "below") solo.appendChild(col("below", cards));
};
var resizeT = null;
window.addEventListener("resize", function() { clearTimeout(resizeT); resizeT = setTimeout(function() { if (S.screen == "heroes") layoutSolo(); }, 120); });
// Studio : le bol de gemmes (photo du livre) à gauche, le tas de cartes à droite.
// Deux bols : gemmes bleues, et gemmes rouges (photo d'origine du livre).
var bowlCode = function() {
    var one = function(red) {
        var nm = t(red ? "hb_bowl_red" : "hb_bowl_blue");
        return "<div class='sk-hz sk-hbbowl" + (red ? " red" : "") + "' data-hz='reserve'" + (red ? " data-red='1'" : "") + " role='group' aria-label='" + e(nm) + "' title='" + e(t(red ? "hb_reserve_red_hint" : "hb_reserve_hint")) + "'>"
            + "<img class='sk-mbowlimg' src='skelos/img/fond/" + (red ? "bol_gemmes.webp" : "bol_gemmes_bleues.webp") + "' alt='' draggable='false'><span class='sk-hbobj'>" + e(nm) + "</span></div>";
    };
    return "<div class='sk-hbside'>" + one(false) + one(true) + "</div>";
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
        return "<div class='sk-hbcard sk-hbhero' data-huid='" + x.uid + "'><div class='sk-hbsolo'><div class='sk-hbsheet'>" + boardCode(x, true) + "</div>"
            + cardsOf(x).map(function(c, i) { return cardCode(x, c, i); }).join("")
            + (S.hStudio ? addCardCode() : "") + "</div>"
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
        ? "<div class='sk-hbzoom' data-huid='" + cur.uid + "'><button class='sk-hbback' data-hback aria-label='" + e(t("hb_back")) + "' title='" + e(t("hb_back")) + "'>&#xf060;</button>"
            + "<div class='sk-hbdesk'>" + (S.hStudio ? bowlCode() : "") + "<div class='sk-hbmain sk-hbhero sk-hbsolo' data-huid='" + cur.uid + "'><div class='sk-hbsheet'>" + boardCode(cur, false) + "</div>"
            + cardsOf(cur).map(function(c, i) { return cardCode(cur, c, i); }).join("") + "</div>" + (S.hStudio ? pileCode() : "") + "</div></div>"
        : companyCode();
    // Le redessin ne fait pas remonter l'écran : on garde la position de défilement (page, écran, compagnie sur téléphone).
    var keep = [], el = S.root;
    for (; el; el = el.parentElement) if (el.scrollTop || el.scrollLeft) keep.push([el, el.scrollTop, el.scrollLeft]);
    var se = document.scrollingElement; if (se) keep.push([se, se.scrollTop, se.scrollLeft]);
    var inner0 = S.root.querySelector(".sk-heroes"), sTop = inner0 ? inner0.scrollTop : 0, comp = S.root.querySelector(".sk-hbcompany"), cLeft = comp ? comp.scrollLeft : 0;
    S.mount("<div class='skelos-game sk-screen sk-heroes" + (S.hStudio ? " sk-hstudio" : "") + "'><div class='sk-hbwrap'>" + inner + "</div></div>"
        + "<div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>");
    bind(S.root.querySelector(".sk-heroes"));
    layoutSolo();
    keep.forEach(function(k) { k[0].scrollTop = k[1]; k[0].scrollLeft = k[2]; });
    var in1 = S.root.querySelector(".sk-heroes"); if (in1 && sTop) in1.scrollTop = sTop;
    var c1 = S.root.querySelector(".sk-hbcompany"); if (c1 && cLeft) c1.scrollLeft = cLeft;
    if (S._htoast && Date.now() < S._htoastUntil) S.toast(S._htoast);
};
var warn = function(msg) { S._htoast = msg; S._htoastUntil = Date.now() + 2500; };

// ---------- Actions ----------
S.heroMoveGems = function(uid, from, to, n, red) {
    var h = byUid(uid); if (!h || from == to) return;
    n = Math.min(n, count(h, from, red)); if (n <= 0) return;
    snap();
    put(h, from, count(h, from, red) - n, red); put(h, to, count(h, to, red) + n, red);
    if (to.indexOf("act:") == 0) {
        var k = to.slice(4), s = sat(h, k), m = count(h, to) + count(h, to, true);
        if (s && m > s) warn(t("hb_sat", zoneName(h, to), m, s));
    }
    var msg = from == "reserve" ? t("hb_log_bowl_take", heroName(h), n, zoneName(h, to)) : to == "reserve" ? t("hb_log_bowl_put", heroName(h), n, zoneName(h, from))
        : t("hb_log_move", heroName(h), n, zoneName(h, from), zoneName(h, to));
    if (red && S.hStudio) h.redHome = redSnap(h);
    commit(red ? msg + " (" + t("hb_red_n", n) + ")" : msg);
};
// ---------- Animations ----------
// Les gemmes volent en arc d'une zone à l'autre, comme sur le livre (réglage « Animations », et moins d'animations demandé).
var calm = function() { return S.prefs().noAnim || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); };
var zoneEl = function(uid, z) { return S.root && S.root.querySelector(".sk-heroes [data-huid='" + uid + "'] [data-hz='" + z + "']"); };
var rectZ = function(uid, z) { var el = zoneEl(uid, z); return el ? el.getBoundingClientRect() : null; };
var fly = function(src, from, to, n, delay) {
    if (!from || !to || calm() || !document.body.animate || !n) return 0;
    var k = Math.min(n, 12), size = Math.max(18, Math.min(30, to.width / 6));
    var j = function(r, f) { return (Math.random() - .5) * r.width * f; };
    for (var i = 0; i < k; i++) (function(i) {
        var img = document.createElement("img");
        img.className = "sk-mfly"; img.src = src; img.alt = "";
        img.style.width = img.style.height = size + "px";
        document.body.appendChild(img);
        var x0 = from.left + from.width / 2 + j(from, .4) - size / 2, y0 = from.top + from.height / 2 + j(from, .2) - size / 2;
        var x1 = to.left + to.width / 2 + j(to, .5) - size / 2, y1 = to.top + to.height / 2 + j(to, .25) - size / 2;
        var mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 50 - Math.random() * 40;
        var at = function(x, y, sc, r) { return "translate(" + x + "px," + y + "px) scale(" + sc + ") rotate(" + r + "deg)"; };
        var a = img.animate([
            {transform: at(x0, y0, 1, 0), opacity: 0},
            {transform: at(x0, y0, 1.15, 0), opacity: 1, offset: .08},
            {transform: at(mx, my, 1.3, Math.random() * 180 - 90), opacity: 1, offset: .5},
            {transform: at(x1, y1, 1, Math.random() * 60 - 30), opacity: 1, offset: .92},
            {transform: at(x1, y1, .9, 0), opacity: 0}
        ], {duration: 620, delay: delay + i * 45, easing: "ease-in-out", fill: "both"});
        a.onfinish = a.oncancel = function() { img.remove(); };
    })(i);
    return delay + (k - 1) * 45 + 620;
};
// Photo de toutes les zones d'un héros avant une action : nombre de bleues, de rouges, et position à l'écran.
var zonesOf = function(h) { return ["life", "fatigue", "wounds"].concat(ACT_ORDER.map(function(k) { return "act:" + k; }), cardsOf(h).map(function(c, i) { return "card:" + i; })); };
var shot = function(h) {
    var o = {}; zonesOf(h).forEach(function(z) { o[z] = {n: count(h, z), r: count(h, z, true), rect: rectZ(h.uid, z)}; });
    cardsOf(h).forEach(function(c, i) { o["card:" + i].id = c.id; });
    return o;
};
// Les gemmes rouges qui ont bougé : chaque zone qui en a perdu les envoie vers celles qui en ont gagné.
var flyRed = function(h, before, delay) {
    var src = [], dst = [], end = 0;
    zonesOf(h).forEach(function(z) {
        var b = before[z] ? before[z].r : 0, a = count(h, z, true);
        if (a > b) dst.push({z: z, k: a - b});
    });
    for (var z in before) { var a2 = zonesOf(h).indexOf(z) >= 0 ? count(h, z, true) : 0; if (before[z].r > a2) src.push({rect: before[z].rect, k: before[z].r - a2}); }
    src.forEach(function(sx) {
        while (sx.k > 0 && dst.length) {
            var d = dst[0], m = Math.min(sx.k, d.k);
            end = Math.max(end, fly(gemRed(), sx.rect, rectZ(h.uid, d.z), m, delay));
            sx.k -= m; d.k -= m; if (!d.k) dst.shift();
        }
    });
    return end;
};
var animGen = 0;
// Entretien animé : les bleues des cases d'action et des cartes volent vers la Fatigue ; rec > 0 : puis la récupération
// repart de la Fatigue vers la Vie. La Fatigue et la Vie gardent leur nombre jusqu'à l'arrivée des gemmes.
var animUpkeep = function(h, before, rec) {
    var g = ++animGen, d = 0, t1 = 0, fat = rectZ(h.uid, "fatigue"), life = rectZ(h.uid, "life");
    for (var z in before) if (z != "life" && z != "fatigue" && z != "wounds" && before[z].n) { t1 = Math.max(t1, fly(gemBlue(), before[z].rect, fat, before[z].n, d)); d += 90; }
    var tr = flyRed(h, before, 0), t2 = rec ? fly(gemBlue(), fat, life, rec, t1 ? t1 + 250 : 0) : 0;
    if (!t1 && !t2 && !tr) return;
    var fat1 = before.fatigue.n + (t1 ? Object.keys(before).reduce(function(a, z) { return a + (z != "life" && z != "fatigue" && z != "wounds" ? before[z].n : 0); }, 0) : 0);
    if (t1) { holds[h.uid + "|fatigue"] = before.fatigue.n; setTimeout(function() { if (g == animGen && rec) { holds[h.uid + "|fatigue"] = fat1; S.renderHeroes(); } }, t1); }
    if (t2) holds[h.uid + "|life"] = before.life.n;
    var end = Math.max(t1, t2, tr);
    S.renderHeroes();
    setTimeout(function() { if (g != animGen) return; delete holds[h.uid + "|fatigue"]; delete holds[h.uid + "|life"]; if (S.screen == "heroes") S.renderHeroes(); }, end);
};

// Entretien (double appui sur la Fatigue) : les gemmes des cases d'action et des cartes du héros y retournent ;
// les Blessures ne bougent pas. Les rouges retournent à leur zone de retour (studio), sinon en Fatigue avec les autres.
var collect = function(h) {
    var n = 0, m = rmap(h), home = !!h.redHome;
    ACT_ORDER.forEach(function(k) { n += h.act[k] || 0; h.act[k] = 0; m.fatigue = (m.fatigue || 0) + (m["act:" + k] || 0); m["act:" + k] = 0; });
    cardsOf(h).forEach(function(c) { n += c.gems || 0; m.fatigue = (m.fatigue || 0) + (c.red || 0); c.gems = 0; c.red = 0; });
    h.fatigue += n;
    if (home) redGoHome(h);
    return n;
};
S.heroCollect = function(uid) {
    var h = byUid(uid); if (!h) return;
    var before = shot(h);
    snap(); var n = collect(h);
    commit(t("hb_log_collect", heroName(h), n));
    animUpkeep(h, before, 0);
};
// Récupération (double appui sur la Vie) : l'entretien, puis la récupération choisie passe de la Fatigue à la Vie.
S.heroRecover = function(uid) {
    var h = byUid(uid); if (!h) return;
    var before = shot(h);
    snap(); collect(h);
    var n = Math.min(h.rec, h.fatigue); h.fatigue -= n; h.life += n;
    // Les gemmes rouges de la Fatigue reviennent aussi dans la Vie, en plus de la récupération.
    if (!h.redHome) { var m = rmap(h); m.life = (m.life || 0) + (m.fatigue || 0); m.fatigue = 0; }
    if (n < h.rec) warn(t("hb_rec_short", h.rec, n));
    commit(t("hb_log_recover", heroName(h), n));
    animUpkeep(h, before, n);
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
            var n = total(h), r = redTotal(h);
            h.life = n; h.fatigue = 0; h.wounds = 0; h.rec = 2; h.red = r ? {life: r} : {};
            ACT_ORDER.forEach(function(k) { h.act[k] = 0; }); cardsOf(h).forEach(function(c) { c.gems = 0; c.red = 0; });
            redGoHome(h);
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
    S.openItemPicker({title: t("add_cards"), kind: "eq", kinds: ["eq", "sp", "tile"], tiles: true, tilesLast: true,
        onClose: function() { S.renderHeroes(); },
        onAdd: function(sel) {
            var h = byUid(uid); if (!h || !sel.length) { S.renderHeroes(); return; }
            snap();
            sel.forEach(function(x) { cardsOf(h).push({kind: x.kind, ref: x.ref, gems: 0}); });
            encWarn(h);
            commit(t("hb_log_cards", heroName(h), sel.map(function(x) { return S.itemName(x.kind, x.ref); }).join(", ")));
        }});
};
// Une carte retirée rend ses gemmes à la Vie.
var removeCard = function(uid, i) {
    var h = byUid(uid), c = h && cardsOf(h)[i]; if (!c) return;
    snap();
    h.life += c.gems || 0; rmap(h).life = (rmap(h).life || 0) + (c.red || 0); cardsOf(h).splice(i, 1);
    if (h.redHome) h.redHome = redSnap(h);
    commit(t("hb_log_card_rm", heroName(h), S.itemName(c.kind, c.ref)));
};

// Une carte glissée sur un autre héros change de main, avec ses gemmes.
S.heroMoveCard = function(fromUid, i, toUid) {
    var a = byUid(fromUid), b = byUid(toUid), c = a && cardsOf(a)[i]; if (!c || !b || a === b) return;
    snap();
    cardsOf(a).splice(i, 1); cardsOf(b).push(c);
    // La zone de retour des rouges posées sur la carte suit la carte.
    var hk = "c:" + c.id, hn = a.redHome && a.redHome[hk];
    if (hn) { delete a.redHome[hk]; b.redHome = b.redHome || redSnap(b); b.redHome[hk] = hn; }
    encWarn(b);
    commit(t("hb_log_card_move", S.itemName(c.kind, c.ref), heroName(a), heroName(b)));
};

// Carte en grand (double appui) : la carte seule, ses gemmes dans la languette centrée en haut, comme sur le livre.
var gemPill = function(n, r) {
    if (!n && !r) return "";
    var ic = function(k, cls) { return k <= 6 ? new Array(k + 1).join("<i class='" + cls + "'>&#xf3a5;</i>") : "<i class='" + cls + "'>&#xf3a5;</i><b>" + k + "</b>"; };
    return "<span class='sk-gpips sk-hgpips' role='img' aria-label='" + e(t("gems_word") + " " + ariaN(n, r)) + "'>" + (n ? ic(n, "b") : "") + (r ? ic(r, "r") : "") + "</span>";
};
var cardZoom = function(uid, i) {
    var h = byUid(uid), c = h && cardsOf(h)[i]; if (!c) return;
    var name = S.itemName(c.kind, c.ref), face = S.realCardCode(c.kind, c.ref) || "<span class='sk-upcard sk-k-" + c.kind + "'><b>" + e(name) + "</b></span>";
    var ov = S.root.querySelector("#sk-overlay");
    ov.innerHTML = "<div class='sk-hcz" + (c.kind == "ti" ? " tile" : "") + "' role='dialog' aria-modal='true' aria-label='" + e(name) + "'>"
        + "<div class='sk-hczcard'>" + (c.kind == "ti" ? face : "<span class='sk-cardscale'>" + face + "</span>") + gemPill(c.gems || 0, c.red || 0) + "</div>"
        + "<button class='sk-hczx' data-hczx aria-label='" + e(t("close")) + "'>×</button></div>";
    ov.classList.add("on");
    ov.onclick = function(ev) { if (ev.target === ov || ev.target.closest("[data-hczx]")) { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; } };
    var x = ov.querySelector("[data-hczx]"); if (x) x.focus();
};

// ---------- Gestes ----------
// Comme sur le livre : glisser emmène une gemme ; appui long, puis glisser ou lâcher, en emmène plusieurs
// (lâchées sans bouger, elles restent en main jusqu'au prochain appui sur une zone).
var hand = null, hinted = false;
var showHand = function() {
    var el = document.getElementById("sk-hhand");
    if (!hand || S.screen != "heroes") { if (el) el.remove(); if (S.screen != "heroes") hand = null; return; }
    if (!el) { document.body.insertAdjacentHTML("beforeend", "<div id='sk-hhand' class='sk-mhand sk-hhand' role='status' aria-live='polite'></div>"); el = document.getElementById("sk-hhand"); }
    el.innerHTML = "<img src='" + (hand.red ? gemRed() : gemBlue()) + "' alt=''><b>" + hand.n + "</b>";
    el.setAttribute("aria-label", t("man_hand", hand.n));
    el.classList.toggle("pinned", !!hand.pinned);
    el.style.left = hand.x + "px"; el.style.top = hand.y + "px";
};
var dropHand = function() { hand = null; showHand(); };
var bump = function() { var el = document.getElementById("sk-hhand"); if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); };
var under = function(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest(".sk-heroes") ? el.closest("[data-hz]") : null; };
var uidOf = function(el) { var x = el && el.closest("[data-huid]"); return x ? x.dataset.huid : null; };
// Dépose de gemmes : dans un même héros, ou entre le bol et un héros.
var drop = function(src, srcUid, to, n, red) {
    if (!to) return;
    var z = to.dataset.hz, toUid = uidOf(to);
    if (src == "reserve") { if (toUid) S.heroMoveGems(toUid, src, z, n, red); return; }
    if (z == "reserve" || toUid == srcUid) S.heroMoveGems(srcUid, src, z, n, red);
};
// Gemme rouge de récupération : elle suit le doigt et se pose sur la case soleil / lune où on la lâche.
var markDrag = function(ev, mk) {
    var uid = uidOf(mk), ghost = null, x0 = ev.clientX, y0 = ev.clientY;
    var cellAt = function(x, y) { var el = document.elementFromPoint(x, y), c = el && el.closest("[data-hrec]"); return c && uidOf(c) == uid ? c : null; };
    var on = function(e2) {
        if (e2.pointerId != ev.pointerId) return;
        if (!ghost && (Math.abs(e2.clientX - x0) > 4 || Math.abs(e2.clientY - y0) > 4)) {
            var r = mk.getBoundingClientRect();
            ghost = mk.cloneNode(true); ghost.className = "sk-hmarkghost"; ghost.style.width = r.width * 1.3 + "px"; ghost.style.height = r.height * 1.3 + "px";
            document.body.appendChild(ghost); mk.style.opacity = ".3";
        }
        if (!ghost) return;
        ghost.style.left = e2.clientX + "px"; ghost.style.top = e2.clientY + "px";
        mark(cellAt(e2.clientX, e2.clientY));
    };
    var off = function(e2) {
        if (e2.pointerId != ev.pointerId) return;
        document.removeEventListener("pointermove", on); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off);
        mark(null);
        if (!ghost) return;
        var c = e2.type == "pointerup" && cellAt(e2.clientX, e2.clientY);
        ghost.remove(); mk.style.opacity = "";
        if (c) S.heroSetRec(uid, +c.dataset.hrec);
    };
    document.addEventListener("pointermove", on); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
};
// Carte glissée : son image suit le doigt ; lâchée sur un autre héros, elle passe chez lui.
var cardDrag = function(ev, card, uid) {
    var x0 = ev.clientX, y0 = ev.clientY, ghost = null, i = +card.dataset.hz.slice(5);
    var heroAt = function(x, y) { var el = document.elementFromPoint(x, y); return el && el.closest(".sk-heroes [data-huid]"); };
    var on = function(e2) {
        if (e2.pointerId != ev.pointerId) return;
        if (!ghost && (Math.abs(e2.clientX - x0) > MOVE || Math.abs(e2.clientY - y0) > MOVE)) {
            var r = card.getBoundingClientRect();
            ghost = card.cloneNode(true); ghost.className = "sk-hbghost"; ghost.style.width = r.width + "px";
            document.body.appendChild(ghost); card.classList.add("sk-hbdragging");
        }
        if (!ghost) return;
        ghost.style.left = e2.clientX + "px"; ghost.style.top = e2.clientY + "px";
        var hb = heroAt(e2.clientX, e2.clientY);
        document.querySelectorAll(".sk-heroes .sk-hbdrop").forEach(function(x) { if (x !== hb) x.classList.remove("sk-hbdrop"); });
        if (hb && hb.dataset.huid != uid) hb.classList.add("sk-hbdrop");
    };
    var off = function(e2) {
        if (e2.pointerId != ev.pointerId) return;
        document.removeEventListener("pointermove", on); document.removeEventListener("pointerup", off); document.removeEventListener("pointercancel", off);
        document.querySelectorAll(".sk-heroes .sk-hbdrop").forEach(function(x) { x.classList.remove("sk-hbdrop"); });
        if (!ghost) return;
        ghost.style.display = "none";
        var hb = e2.type == "pointerup" && heroAt(e2.clientX, e2.clientY);
        ghost.remove(); card.classList.remove("sk-hbdragging");
        if (hb && hb.dataset.huid != uid) S.heroMoveCard(uid, i, hb.dataset.huid);
    };
    document.addEventListener("pointermove", on); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
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
        var cd = ev.target.closest(".sk-hbcardc");
        if (cd && !ev.target.closest("button")) {
            var t0 = Date.now();
            if (last.z == "card" && last.el === cd && t0 - last.at < 400) { last.z = null; cardZoom(uid, +cd.dataset.hcard); }
            else last = {z: "card", el: cd, at: t0};
            return;
        }
        if (ev.target.closest("[data-hcards]")) { addCards(uid); return; }
        var cr = ev.target.closest("[data-hcrm]"); if (cr) { removeCard(uid, +cr.dataset.hcrm); return; }
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
    scr.addEventListener("keydown", function(ev) {
        var rc = ev.target.closest && ev.target.closest("[data-hrec]");
        if (rc && (ev.key == "Enter" || ev.key == " ")) { ev.preventDefault(); S.heroSetRec(uidOf(rc), +rc.dataset.hrec); }
    });
    scr.addEventListener("pointerdown", function(ev) {
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        var mk = ev.target.closest("[data-hmark]"); if (mk) { ev.preventDefault(); markDrag(ev, mk); return; }
        if (ev.target.closest("button")) return;
        var zone = ev.target.closest("[data-hz]"), uid = uidOf(zone), h = uid && byUid(uid), x0 = ev.clientX, y0 = ev.clientY;
        if (hand && hand.pinned) {
            if (!zone) return;
            ev.preventDefault();
            var from = hand.from, fu = hand.uid, n = hand.n, hr = hand.red, hx = hand.x, hy = hand.y; dropHand();
            if (zone.dataset.hz != from || uid != fu) {
                drop(from, fu, zone, n, hr);
                fly(hr ? gemRed() : gemBlue(), {left: hx - 15, top: hy - 60, width: 30, height: 30}, rectZ(uid || fu, zone.dataset.hz) || zone.getBoundingClientRect(), n, 0);
            }
            return;
        }
        if (!zone) return;
        var src = zone.dataset.hz, onGem = ev.target.classList && ev.target.classList.contains("sk-mgem");
        // Sur une carte, hors de ses gemmes : c'est la carte qu'on emmène.
        if (src.indexOf("card:") == 0 && !onGem) { ev.preventDefault(); cardDrag(ev, zone, uid); return; }
        // Couleur : celle du bol, ou de la gemme touchée ; une zone qui n'a que des rouges donne une rouge.
        var red = src == "reserve" ? zone.dataset.red == "1" : onGem ? ev.target.classList.contains("sk-mgem-r") : !count(h, src) && count(h, src, true) > 0;
        if (src != "reserve" && (!h || count(h, src, red) <= 0)) return;
        ev.preventDefault();
        var max = count(h || {}, src, red), g = {moved: false, timer: null, tick: null};
        g.timer = setTimeout(function() {
            hand = {from: src, uid: uid, red: red, n: 1, x: x0, y: y0, pinned: false}; showHand(); bump();
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
                if (!hand) hand = {from: src, uid: uid, red: red, n: 1, pinned: false};
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
                drop(src, uid, to, n, red);
            } else if (hand) { hand.pinned = true; showHand(); S.toast(t("man_hand_hint")); }
            else if (!hinted && src != "life" && src != "fatigue") { hinted = true; S.toast(t("man_gem_hint")); }
        };
        document.addEventListener("pointermove", on); document.addEventListener("pointerup", off); document.addEventListener("pointercancel", off);
    });
};
// Un appui hors des zones repose les gemmes en main.
document.addEventListener("pointerdown", function(ev) { if (hand && hand.pinned && !ev.target.closest(".sk-heroes [data-hz]")) dropHand(); }, true);

// ---------- Vues de l'onglet Partie, outils, sauvegarde ----------
// Une partie, c'est le livre de l'Overlord et les fiches des héros : l'onglet Partie a deux vues, et une bascule
// « Overlord | Héros » dans la barre des onglets passe de l'une à l'autre. La dernière vue est retenue (réglages).
S.TAB_OF.heroes = "home";
S.partView = function() { return S.prefs().partView == "heroes" ? "heroes" : "overlord"; };
S.showPartView = function(v) {
    var pr = S.prefs(); if (pr.partView != v && !S.editing) { pr.partView = v; S.savePrefs(); }
    dropHand();
    // Le mode studio est commun aux deux vues : on le retrouve en passant de l'une à l'autre.
    var st = S.screen == "heroes" ? !!S.hStudio : !!S.studio;
    if (v == "heroes") { S.hStudio = st; S.renderHeroes(); }
    else if (S.editing) S.renderGame();   // éditeur : le livre reste en studio
    else { if (!!S.studio != st) { S.studio = st; if (S.closeHp) S.closeHp(); S.selected = null; } S.ctx = S.ctx || null; S.renderHome(); }
};
var baseHome = S.renderHome;
S.renderHome = function() { if (S.partView() == "heroes") { S.renderHeroes(); return; } return baseHome.apply(this, arguments); };
var viewSwitch = function() {
    var v = S.screen == "heroes" ? "heroes" : "overlord";
    return "<div class='sk-modesw sk-viewsw' role='radiogroup' aria-label='" + e(t("view_switch")) + "'>" + [["overlord", "view_overlord"], ["heroes", "view_heroes"]].map(function(m) {
        return "<button role='radio' aria-checked='" + (v == m[0]) + "' class='" + (v == m[0] ? "on" : "") + "' data-pview='" + m[0] + "'>" + e(t(m[1])) + "</button>";
    }).join("") + "</div>";
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
// La bascule se pose à gauche des outils, sur le plateau comme sur les fiches (pas dans l'éditeur de scénario).
var baseTabs = S.placeTabs;
S.placeTabs = function() {
    baseTabs.apply(S, arguments);
    var nav = S.root && S.root.querySelector(":scope > .sk-tabs"), tools = nav && nav.querySelector(".sk-tabtools");
    if (!tools || (S.screen != "game" && S.screen != "heroes")) return;
    tools.insertAdjacentHTML("afterbegin", viewSwitch()
        + (S.editing && S.screen == "heroes" ? "<button class='sk-tabico' data-hsave title='" + e(t("save_title")) + "' aria-label='" + e(t("save_title")) + "'>&#xf0c7;</button>" : ""));
    var sv = tools.querySelector("[data-hsave]"); if (sv) sv.addEventListener("click", function(ev) { ev.stopPropagation(); S.openSaveScenario(); });
    nav.classList.add("withview");
    tools.querySelector(".sk-viewsw").addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-pview]"); if (!b) return;
        ev.stopPropagation();
        if ((b.dataset.pview == "heroes") != (S.screen == "heroes")) S.showPartView(b.dataset.pview);
    });
};
// ---------- Volet Héros des scénarios ----------
// Un scénario peut préparer ses héros (fiches, cartes, gemmes de départ, gemmes rouges) : sc.heroBoards.heroes.
// Dans l'éditeur, la vue Héros travaille sur ce brouillon ; les fiches de la partie sont mises de côté et reviennent à la sortie.
var cleanHeroes = function(l) { return JSON.parse(JSON.stringify(l || [])); };
var baseOpenEd = S.openEditor;
S.openEditor = function(sc) {
    if (!S.editing) S._hbBackup = {hb: S.heroBoards(), undo: undo.slice(), studio: S.hStudio};
    S._hb = {heroes: cleanHeroes(sc && sc.heroBoards && sc.heroBoards.heroes), cur: null, log: []};
    undo.length = 0; S.hStudio = true; dropHand();
    return baseOpenEd.apply(this, arguments);
};
var baseCloseEd = S.closeEditor;
S.closeEditor = function() {
    var b = S._hbBackup;
    if (b) { S._hb = b.hb; undo.length = 0; [].push.apply(undo, b.undo); S.hStudio = b.studio; S._hbBackup = null; }
    dropHand();
    return baseCloseEd.apply(this, arguments);
};
var baseFromState = S.scenarioFromState;
S.scenarioFromState = function() {
    var d = baseFromState.apply(this, arguments), l = S.heroBoards().heroes;
    if (l.length) d.heroBoards = {heroes: cleanHeroes(l)}; else delete d.heroBoards;
    return d;
};
var baseCard = S.scenarioCardCode;
S.scenarioCardCode = function(sc) {
    var h = baseCard.apply(this, arguments), l = sc.heroBoards && sc.heroBoards.heroes;
    if (!l || !l.length) return h;
    var names = l.map(function(x) { return heroName(x); }).join(", ");
    return h.replace("<p class='sk-sinfo'>", "<p class='sk-sheroes' title='" + e(t("hb_sc_heroes_title")) + "'><i aria-hidden='true'>&#xf0c0;</i> " + e(names) + "</p><p class='sk-sinfo'>");
};

var baseAll = S.allData;
S.allData = function() { var o = baseAll.apply(S, arguments); o.heroes = S.heroBoards(); return o; };
var baseRestore = S.restoreData;
S.restoreData = function(o) { baseRestore.apply(S, arguments); if (o && o.heroes && o.heroes.heroes) { S._hb = o.heroes; save(); } };
})();
