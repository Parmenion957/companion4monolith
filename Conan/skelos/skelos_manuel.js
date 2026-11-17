// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon ;
// le module reprend celles du Compagnon (Encyclopedia, Tile, jetons du dossier data/) et ajoute les fonds du livre (img/fond/).
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
var LONG = 380, STEP = 260, MOVE = 9, RESERVE = 20;

S.manualOn = function() { return S.prefs().board == "manual" && !!S.state && !S.editing; };
var coop = function() { return S.state.mode == "solo"; };

// ---------- Gemmes : nombre par zone ----------
// Gemmes posées sur une tuile ou sur une carte qu'elle porte : zone « g:<uid>:<k> », k = -1 pour la tuile elle-même,
// sinon le rang de la carte dans s.cards. Le nombre est gardé sur la tuile (s.gems) ou sur la carte (c.gems).
var carrier = function(z) {
    var p = String(z).split(":"); if (p[0] != "g") return null;
    var s = S.slotByUid(p[1]), k = +p[2]; if (!s) return null;
    return k < 0 ? s : ((s.cards || [])[k] || null);
};
var count = function(z) {
    var st = S.state;
    if (z == "energy") return st.energy;
    if (z == "fatigue") return st.fatigue;
    if (z == "reserve") return RESERVE;   // réserve du mode studio : inépuisable
    if (String(z).indexOf("g:") == 0) { var c = carrier(z); return (c && c.gems) || 0; }
    return (st.boosts && st.boosts[z]) || 0;
};
var setCount = function(z, v) {
    var st = S.state;
    if (z == "reserve") return;
    if (String(z).indexOf("g:") == 0) { var c = carrier(z); if (c) { if (v > 0) c.gems = v; else delete c.gems; } return; }
    if (z == "energy") st.energy = v; else if (z == "fatigue") st.fatigue = v; else st.boosts[z] = v;
};
var tileGems = function(s) { return (s.gems || 0) + (s.cards || []).reduce(function(n, c) { return n + (c.gems || 0); }, 0); };
var zoneLabel = function(z) {
    if (String(z).indexOf("g:") == 0) {
        var p = z.split(":"), s = S.slotByUid(p[1]), c = carrier(z);
        if (!s || !c) return "";
        return +p[2] < 0 ? S.tileName(s) : t("man_on_card", S.itemName(c.kind, c.ref), S.tileName(s));
    }
    if (z == "energy") return t(S.state && coop() ? "tokens_pool" : "energy");
    if (z == "fatigue") return t("fatigue");
    if (z == "aside") return t("man_aside");
    if (z == "reserve") return t("man_reserve");
    return t("boost_" + z);
};

// Groupes de 3 pour compter d'un coup d'œil, posés un peu en désordre comme un vrai tas.
// Le désordre est tiré d'un nombre fixe par zone et par gemme : le tas ne bouge pas d'un affichage à l'autre.
var jitter = function(seed) {
    var x = 0; for (var i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) | 0;
    return function() { x = (x * 1103515245 + 12345) | 0; return ((x >>> 8) & 0xffff) / 0xffff - .5; };
};
// Vue éclatée (zoom, dépose sur une tuile à cartes) : les gemmes en languette, comme les sorts du plateau automatique
// (une gemme rouge par gemme posée ; au-delà de 6, une gemme et le nombre).
var pipsCode = function(n, cls) {
    if (!n) return "";
    var h = "";
    if (n <= 6) for (var i = 0; i < n; i++) h += "<i class='on'>&#xf3a5;</i>";
    else h = "<i class='on'>&#xf3a5;</i><b>" + n + "</b>";
    return "<span class='sk-gpips" + (cls ? " " + cls : "") + "' role='img' aria-label='" + e(t("gems_word") + " " + n) + "'>" + h + "</span>";
};
S.gemPipsCode = pipsCode;
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
    // Plus de zone « Mis de côté » ni de 4e emplacement : un jeton tiré sans place (ou posé là dans une ancienne partie) est en Fatigue.
    var l = st.tokLoc && st.tokLoc[uid];
    return l && l != "aside" && l != "slot4" ? l : "fatigue";
};
var tokensIn = function(z) {
    return S.state.river.filter(function(s) { return live(s.uid) && tokLoc(s.uid) == z; });
};
var poolCount = function() { return S.state.pool.filter(live).length; };
var tokCode = function(s) {
    return "<img class='sk-mtok' data-tok='" + s.uid + "' src='" + S.marker(s.token) + "' alt='" + s.token + "' draggable='false' title='" + e(S.tileName(s)) + "'>";
};

// ---------- Rendu ----------
// nShown : nombre affiché à la place du vrai (pendant une animation, la zone d'arrivée attend les pièces).
var zoneCode = function(z, inner, title, nShown) {
    var n, content;
    // Les fonds vert (Énergie / jetons disponibles) et rouge (Fatigue) ne portent plus de texte : leur nom reste en info-bulle.
    if (z == "energy" || z == "fatigue") title = "";
    // Coop : les jetons (de dos dans la zone verte), et les gemmes en petit tas à part, avec leur nombre.
    if (coop()) {
        var gn = z == "aside" ? 0 : count(z);
        if (z == "energy") { n = nShown != null ? nShown : poolCount(); content = groupsCode(n, S.icon("tokenback"), "sk-mback", z); }
        else { var l = tokensIn(z); n = l.length; content = l.map(tokCode).join(""); }
        content += gn ? "<span class='sk-mcgems'>" + groupsCode(gn, S.icon("gem"), "sk-mgem", z) + "</span>" : "";
        if (gn) inner = (inner || "") + "<span class='sk-mgcount' aria-hidden='true'><img src='" + S.icon("gem") + "' alt=''>" + gn + "</span>";
    }
    else { n = nShown != null ? nShown : count(z); content = groupsCode(n, S.icon("gem"), "sk-mgem", z); }
    var label = zoneLabel(z) + " · " + n + (coop() && count(z) ? " · " + t("man_tile_gems", count(z), zoneLabel(z)) : "");
    // Bande 1 : les tas rétrécissent avec leur nombre pour rester dans le cadre de l'icône.
    var groups = Math.ceil((coop() ? count(z) : n) / 3), gs = BAND1.indexOf(z) >= 0 ? " style='--g:calc(" + (groups <= 1 ? 2.4 : groups <= 4 ? 1.65 : groups <= 9 ? 1.05 : .75) + "cqw * var(--gz, 1))'" : "";
    return "<div class='sk-mz sk-mz-" + z + (n ? "" : " empty") + "' data-zone='" + z + "' role='group' aria-label='" + e(label) + "' title='" + e(label) + "'" + gs + ">"
        + (inner || "") + (title ? "<span class='sk-mtitle'>" + e(title) + "</span>" : "")
        + "<div class='sk-mgems'>" + content + "</div>"
        + (n ? "<span class='sk-mcount' aria-hidden='true'>" + n + "</span>" : "") + "</div>";
};

// ---------- Points de vie des tuiles sur la piste des tours (réglage, par défaut) ----------
// Une tuile glissée sur la piste y pose sa pastille, sur la case de ses points de vie ; la pastille se déplace
// ensuite sur la piste pour changer les PV. Le cœur disparaît alors de la tuile. Une pastille par groupe de PV partagés.
// Réglage hpPlace : "track" (par défaut), "tile" ou "both" (pastille sur la piste et cœur sur la tuile).
// Piste des tours réduite (réglage turnMini) : plus de piste, donc les points de vie passent d'office sur la tuile.
// Téléphone (portrait étroit ou paysage bas) : le livre se découpe comme le plateau automatique et la piste est réduite d'office.
S.PHONE_MQ = "(max-width: 600px), (max-height: 500px) and (orientation: landscape)";
S.phone = function() { return !!(window.matchMedia && window.matchMedia(S.PHONE_MQ).matches); };
S.turnMini = function() { return !!S.prefs().turnMini || S.phone(); };
S.hpOnTrack = function() { return S.prefs().hpPlace != "tile" && !S.turnMini(); };
S.hpOnTile = function() { var v = S.prefs().hpPlace; return v == "tile" || v == "both" || S.turnMini(); };
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
// Le pion de vie de l'unité, tel que l'encyclopédie le définit (tile.tokens : recadrage de l'image de la tuile, comme
// le Studio du Compagnon le dessine) ; à défaut, le portrait de la tuile.
var hpMarkerCode = function(s, k) {
    var tile = S.tileOf(s), label = t("man_hpm", S.tileName(s), s.lp || 0), tk = tile && tile.tokens && tile.tokens[0], inner = "", bg = "";
    if (tk && tk.image_location) {
        inner = "<img src='" + S.asset(tk.image || tile.image) + "' alt='' draggable='false' style='left:" + tk.image_location.x + "%;top:" + tk.image_location.y + "%;width:" + (tk.image_zoom || 100)
            + "%;height:auto;transform:translate(-50%,-50%)" + (tk.image_flip ? " scaleX(-1)" : "") + "'>";
    } else bg = ";background-image:url(\"" + S.asset(tile ? tile.image : "") + "\")";
    return "<span class='sk-mhpm" + (inner ? " tok" : "") + (s.dead ? " dead" : "") + "' data-hpm='" + s.uid + "' role='img' aria-label='" + e(label) + "' title='" + e(label) + "' style='--k:" + k
        + ";--c:" + (SOCLE[s.color] || "#8a8a8a") + bg + "'>" + inner + "</span>";
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

// Piste réduite : le cadre Tour du plateau automatique (sablier et alarme), à gauche de la bande 1. Un appui long sur
// un jeton fait paraître − et + de part et d'autre ; un appui ailleurs les range. Pas de fond rouge au dernier tour.
var turnMiniCode = function() {
    var st = S.state;
    var tok = function(kind) {
        var turn = kind == "turn", val = turn ? st.turn : (st.turns || "–"), open = S._mturnEdit == kind;
        var label = turn ? t("turn") + " " + st.turn : (st.turns ? t("turn_limit") + " " + st.turns : t("turn_limit_none"));
        return "<span class='sk-ptok" + (open ? " editing" : "") + "' data-mturnwrap='" + kind + "'>"
            + "<button class='sk-pstep' data-mturn='" + kind + "' data-n='-1' tabindex='" + (open ? 0 : -1) + "' aria-label='" + e(t(turn ? "aria_turn_prev" : "aria_limit_minus")) + "'>−</button>"
            + "<span class='sk-tokimg sk-tokround' data-turnkind='" + kind + "' role='img' aria-label='" + e(label) + "' title='" + e(label + " · " + t("man_long_press")) + "'>"
            + "<img src='" + S.icon(turn ? "time" : "alarm") + "' alt='' draggable='false'><b>" + val + "</b></span>"
            + "<button class='sk-pstep' data-mturn='" + kind + "' data-n='1' tabindex='" + (open ? 0 : -1) + "' aria-label='" + e(t(turn ? "aria_turn_next" : "aria_limit_plus")) + "'>+</button></span>";
    };
    return "<div class='sk-mturn' role='group' aria-label='" + e(t("turn") + " " + st.turn + (st.turns ? " / " + st.turns : "")) + "'>"
        + "<div class='sk-ptitle'>" + e(t("turn")) + "</div><div class='sk-ppair'>" + tok("turn") + tok("turns") + "</div></div>";
};
S.manualTurnStep = function(kind, d) {
    var st = S.state;
    if (kind == "turn") S.manualPiece("turn", Math.max(0, st.turn + d));
    else { var v = Math.max(0, (st.turns || 0) + d); S.manualPiece("end", v ? v : "none"); }
};
var bindTurnMini = function(root) {
    if (S._mturnBound) return; S._mturnBound = true;
    var timer = null;
    root.addEventListener("pointerdown", function(ev) {
        if (!S.manualOn() || !S.turnMini()) return;
        var tk = ev.target.closest(".sk-mturn [data-turnkind]");
        if (!tk && S._mturnEdit && !ev.target.closest(".sk-mturn .sk-pstep")) { S._mturnEdit = null; syncTurnMini(); }
        if (!tk) return;
        clearTimeout(timer);
        timer = setTimeout(function() { S._mturnEdit = tk.dataset.turnkind; syncTurnMini(); if (navigator.vibrate) navigator.vibrate(15); }, 450);
    }, true);
    ["pointerup", "pointercancel", "pointerleave"].forEach(function(n) { root.addEventListener(n, function() { clearTimeout(timer); }, true); });
    root.addEventListener("click", function(ev) {
        var b = ev.target.closest(".sk-mturn [data-mturn]"); if (!b) return;
        ev.stopPropagation();
        S.manualTurnStep(b.dataset.mturn, +b.dataset.n);
    });
    root.addEventListener("contextmenu", function(ev) { if (ev.target.closest(".sk-mturn")) ev.preventDefault(); });
};
var syncTurnMini = function() {
    S.root.querySelectorAll(".sk-mturn [data-mturnwrap]").forEach(function(w) {
        var on = S._mturnEdit == w.dataset.mturnwrap;
        w.classList.toggle("editing", on);
        w.querySelectorAll(".sk-pstep").forEach(function(b) { b.tabIndex = on ? 0 : -1; });
    });
};

// Récupération : un nombre, ou X (valeur −1) que le joueur règle lui-même.
var recLabel = function() { return S.state.recovery < 0 ? "X" : S.state.recovery; };
var restCode = function() {
    var st = S.state;
    // Coop : pas de nombre au centre, seulement la tuile de repos (double appui : ranger les jetons tirés).
    // Sans texte écrit : le nom et l'aide restent en info-bulle. Avec une image de tuile de récupération (réglages),
    // la flèche dessinée laisse place à l'image et la valeur passe en chiffre dans le coin.
    var img = S.skin().rest, aria = " role='group' aria-label='" + e(t("recovery") + (coop() ? "" : " · " + recLabel())) + "'";
    if (coop()) return "<div class='sk-mrest' data-mrest" + aria + " title='" + e(t("recovery") + " — " + t("man_coop_rest_hint")) + "'>" + (img ? "<div class='sk-mrestcard'><img class='sk-mrestimg' src='" + img + "' alt='' draggable='false'></div>" : S.token("recover", "")) + "</div>";
    // Tuile d'origine : la valeur est la gemme du pion numéroté (1 à 8), sinon un chiffre posé sur la gemme vide ;
    // le − et le + encadrent la gemme, sur la flèche.
    if (img) {
        var gem = S.recoveryGem(st.recovery);
        return "<div class='sk-mrest' data-mrest" + aria + " title='" + e(t("recovery") + " — " + t("man_rest_hint")) + "'><div class='sk-mrestcard'>"
            + "<img class='sk-mrestimg' src='" + img + "' alt='' draggable='false'>"
            + (gem ? "<img class='sk-mrecgem' src='" + gem + "' alt='' draggable='false'>" : "<span class='sk-mrecnum'>" + recLabel() + "</span>")
            + "<button class='sk-pstep sk-mrecm' data-mact='recovery' data-n='-1' aria-label='" + e(t("aria_recovery_minus")) + "'>−</button>"
            + "<button class='sk-pstep sk-mrecp' data-mact='recovery' data-n='1' aria-label='" + e(t("aria_recovery_plus")) + "'>+</button></div></div>";
    }
    return "<div class='sk-mrest' data-mrest" + aria + " title='" + e(t("recovery") + " — " + t("man_rest_hint")) + "'>"
        + S.token("recover", recLabel())
        + "<div class='sk-mstep'><button class='sk-pstep' data-mact='recovery' data-n='-1' aria-label='" + e(t("aria_recovery_minus")) + "'>−</button>"
        + "<button class='sk-pstep' data-mact='recovery' data-n='1' aria-label='" + e(t("aria_recovery_plus")) + "'>+</button></div></div>";
};

// Bande 3 : un pion gemme rouge numéroté au-dessus de chaque case de tuile.
var holeInner = function(i) {
    var sk = S.skin();
    return sk["gem" + (i + 1)] ? "<img class='sk-mrankimg' src='" + sk["gem" + (i + 1)] + "' alt='" + (i + 1) + "' draggable='false'>" : S.rankToken(i + 1, "sk-mrank");
};
var holesCode = function() {
    var h = "";
    for (var i = 0; i < S.RIVER_SIZE; i++) h += "<span class='sk-mhole'>" + holeInner(i) + "</span>";
    return h;
};
// Place d'une case dans la bande des tuiles sur téléphone : 4 colonnes, un rang de pions au-dessus de chaque rang de tuiles.
var cellPos = function(i) { return "--i:" + i + ";--c:" + (i % 4 + 1) + ";--r:" + (Math.floor(i / 4) * 2 + 2); };

// Pastille des cartes portées par une tuile (sorts, équipements, tuiles), comme sur le plateau automatique.
var cardsBadge = function(s) { return S.cardsBadgeCode(s); };

// ---------- Mode studio : réserve de gemmes et tas de tuiles sur le bureau ----------
// Réserve : y prendre des gemmes en ajoute au livre, y en reposer en retire. Tas de tuiles : un appui ouvre le choix
// des tuiles (ajoutées au bout), une tuile glissée dessus quitte le livre.
// Le livre rétrécit en mode studio : la réserve se pose à sa gauche, le tas de tuiles à sa droite.
// Objets réalistes posés sur le bureau (dessins originaux) : un bol de bronze antique plein de gemmes à gauche,
// un tas de tuiles à droite. Le bol est la réserve : y prendre des gemmes en ajoute au livre, y en reposer en retire.
// Vu un peu d'en haut : l'intérieur doré et usé se voit, la paroi extérieure est sombre, patinée.
var BOWL_BACK = "<svg class='sk-mbowl-back' viewBox='0 0 100 80' aria-hidden='true'><defs>"
    + "<radialGradient id='skmbIn' cx='52%' cy='62%' r='62%'><stop offset='0' stop-color='#c9ab7c'/><stop offset='.45' stop-color='#a5845a'/>"
    + "<stop offset='.8' stop-color='#6e5236'/><stop offset='1' stop-color='#3b2a1a'/></radialGradient>"
    + "<linearGradient id='skmbInSh' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#1e140b' stop-opacity='.75'/><stop offset='.45' stop-color='#1e140b' stop-opacity='0'/></linearGradient></defs>"
    + "<ellipse cx='50' cy='24' rx='46' ry='17' fill='url(#skmbIn)'/><ellipse cx='50' cy='24' rx='46' ry='17' fill='url(#skmbInSh)'/>"
    + "<g fill='#6f8a6a' opacity='.35'><ellipse cx='60' cy='33' rx='3' ry='1.2'/><ellipse cx='43' cy='36' rx='1.6' ry='.8'/></g></svg>";
var BOWL_FRONT = "<svg class='sk-mbowl-front' viewBox='0 0 100 80' aria-hidden='true'><defs>"
    + "<linearGradient id='skmbOut' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#1d150e'/><stop offset='.22' stop-color='#4a3a2b'/>"
    + "<stop offset='.42' stop-color='#6a5642'/><stop offset='.6' stop-color='#55432f'/><stop offset='.85' stop-color='#30241a'/><stop offset='1' stop-color='#150f09'/></linearGradient>"
    + "<linearGradient id='skmbOutSh' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.5'/></linearGradient></defs>"
    + "<ellipse cx='50' cy='76.5' rx='30' ry='3' fill='#000' opacity='.3'/>"
    + "<path d='M4 24A46 17 0 0 0 96 24C96 52 84 75 50 76C16 75 4 52 4 24z' fill='url(#skmbOut)'/>"
    + "<path d='M4 24A46 17 0 0 0 96 24C96 52 84 75 50 76C16 75 4 52 4 24z' fill='url(#skmbOutSh)'/>"
    + "<g fill='#7d6a52' opacity='.25'><ellipse cx='30' cy='55' rx='4' ry='1.5'/><ellipse cx='66' cy='60' rx='3' ry='1'/><ellipse cx='48' cy='66' rx='5' ry='1.3'/></g>"
    + "<g fill='#5f7a62' opacity='.3'><ellipse cx='22' cy='46' rx='1.5' ry='1'/><ellipse cx='74' cy='50' rx='1.2' ry='.8'/></g>"
    + "<path d='M4 24A46 17 0 0 0 96 24' fill='none' stroke='#b0926a' stroke-width='1.3'/>"
    + "<path d='M4 24A46 17 0 0 1 96 24' fill='none' stroke='#3a2a1b' stroke-width='1.1'/></svg>";
var reserveCode = function() {
    if (!S.studio) return "";
    return "<div class='sk-mside sk-mside-l'><div class='sk-mz sk-mz-reserve sk-mbowl' data-zone='reserve' role='group' aria-label='" + e(t("man_reserve")) + "' title='" + e(t("man_reserve_hint")) + "'>"
        + BOWL_BACK + "<div class='sk-mgems'>" + groupsCode(12, S.icon("gem"), "sk-mgem", "reserve") + "</div>" + BOWL_FRONT
        + "<span class='sk-mobjname'>" + e(t("man_reserve")) + "</span></div></div>";
};
// Tas de tuiles : quelques tuiles empilées (tranches de carton), celle du dessus montre une tuile du Compagnon.
var pileCode = function() {
    if (!S.studio) return "";
    var top = S.state.river.filter(function(x) { return !S.isEvent(x); })[0] || S.state.river[0], tl = top && S.tileOf(top);
    var img = tl && tl.image ? "<img src='" + S.asset(tl.image) + "' alt='' draggable='false'>" : "";
    return "<div class='sk-mside sk-mside-r'><button class='sk-mpile' data-tilepile title='" + e(t("man_pile_hint")) + "' aria-label='" + e(t("man_pile_hint")) + "'>"
        + "<span class='sk-mstack'><span class='sk-mslab'></span><span class='sk-mslab'></span><span class='sk-mslab'></span><span class='sk-mslab'></span>"
        + "<span class='sk-mslab sk-mtop'>" + img + "</span><b class='sk-mplus'>+</b></span>"
        + "<span class='sk-mobjname'>" + e(t("tab_tiles")) + "</span></button></div>";
};

// Gemmes posées sur une tuile ou ses cartes : un petit tas sur la tuile. Sans carte, le tas est lui-même une zone
// de gemmes ; avec des cartes, un appui ouvre la liste « tuile + cartes », chaque ligne étant une zone.
var tileGemsCode = function(s) {
    var n = tileGems(s), lbl = t("man_tile_gems", n, S.tileName(s));
    if (!n) return "";
    var direct = !(s.cards || []).length, groups = Math.ceil(n / 3);
    // Sur le plateau, toutes les gemmes de la tuile et de ses cartes sont posées sur le corps de la tuile, en tas de trois.
    return "<span class='sk-mtg" + (direct ? " sk-mz" : "") + "'" + (direct ? " data-zone='g:" + s.uid + ":-1'" : " data-tgems='" + s.uid + "'")
        + " style='--g:" + (groups <= 2 ? 22 : groups <= 4 ? 17 : groups <= 6 ? 13 : 10) + "cqw' role='button' aria-label='" + e(lbl) + "' title='" + e(lbl) + "'>"
        + "<span class='sk-mgems'>" + groupsCode(n, S.icon("gem"), "sk-mgem", "t" + s.uid) + "</span></span>";
};
var cardOrder = {ti: 0, eq: 1, sp: 2};
var gemPopCode = function() {
    var s = S._mgpop && S.slotByUid(S._mgpop); if (!s) { S._mgpop = null; return ""; }
    // La tuile et ses cartes, montrées comme sur la table : chacune reçoit ses gemmes, posées dessus.
    var order = [-1].concat((s.cards || []).map(function(c, k) { return k; }).sort(function(a, b) { return cardOrder[s.cards[a].kind] - cardOrder[s.cards[b].kind] || a - b; }));
    return "<div class='sk-mgpop' role='dialog' aria-label='" + e(t("man_gems_on", S.tileName(s))) + "'><div class='sk-mgphead'><b>" + e(t("man_gems_on", S.tileName(s))) + "</b>"
        + "<button class='sk-mgpclose' data-mgpclose aria-label='" + e(t("close")) + "'>×</button></div><div class='sk-mgcards'>"
        + order.map(function(k) {
            var z = "g:" + s.uid + ":" + k, n = count(z), c = k < 0 ? null : s.cards[k];
            var name = k < 0 ? S.tileName(s) : S.itemName(c.kind, c.ref);
            var face = k < 0 ? "<div class='sk-tilebox'>" + S.tileCode(s) + "</div>"
                : c.kind == "ti" ? (S.realCardCode(c.kind, c.ref) || "")
                : "<span class='sk-cardscale'>" + (S.realCardCode(c.kind, c.ref) || "<span class='sk-upcard sk-k-" + c.kind + "'><b>" + e(name) + "</b></span>") + "</span>";
            return "<div class='sk-mz sk-mgcard" + (n ? "" : " empty") + "' data-zone='" + z + "' role='group' aria-label='" + e(name + " · " + n) + "' title='" + e(name) + "'>"
                + "<div class='sk-mgface'>" + face + "</div>" + pipsCode(n, k < 0 ? "sk-gpips-tile" : "") + "</div>";
        }).join("") + "</div></div>";
};
var placeGemPop = function() {
    var pop = S.root.querySelector(".sk-mgpop"), tile = S._mgpop && S.root.querySelector("[data-mtile='" + S._mgpop + "']");
    if (!pop || !tile) return;
    var r = tile.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    var y = r.top - h - 8; if (y < 8) y = Math.min(window.innerHeight - h - 8, r.bottom + 8);
    pop.style.left = x + "px"; pop.style.top = y + "px";
};
S.openGemPop = function(uid) { S._mgpop = uid; S.renderGame(); };
var closeGemPop = function() { if (!S._mgpop) return; S._mgpop = null; var p = S.root.querySelector(".sk-mgpop"); if (p) p.remove(); };

// Mode studio : pastille de couleur du socle sur les tuiles qui en ont plusieurs (un appui passe à la suivante).
var socleCode = function(s) {
    if (!S.studio) return "";
    var socles = S.socles(S.tileOf(s)); if (socles.length < 2) return "";
    var c = socles.indexOf(s.color) >= 0 ? s.color : socles[0], lbl = t("socle_next", S.socleName(c));
    return "<button class='sk-socle' data-msocle='" + s.uid + "' style='--socle:" + SOCLE[c] + "' title='" + e(lbl) + "' aria-label='" + e(lbl) + "'></button>";
};

var tilesCode = function() {
    var st = S.state;
    // Sur téléphone, les pions numérotés passent dans la bande, au-dessus de leur case (cachés ailleurs).
    var ph = "";
    for (var i = 0; i < S.RIVER_SIZE; i++) ph += "<span class='sk-mhole sk-mph' style='--c:" + (i % 4 + 1) + ";--r:" + (Math.floor(i / 4) * 2 + 1) + "' aria-hidden='true'>" + holeInner(i) + "</span>";
    return "<div class='sk-mb4' data-band='tiles'>" + ph + st.river.map(function(s, i) {
        return "<div class='sk-mtile sk-tilebox" + (s.dead ? " dead" : "") + "' style='" + cellPos(i) + "' data-mtile='" + s.uid + "'" + (S.isEvent(s) ? " data-eventuid='" + s.uid + "'" : "")
            + " role='img' aria-label='" + e(S.tileName(s)) + "'>" + S.tileCode(s)
            + (s.dead ? "<span class='sk-deadmark'>" + t("dead") + "</span>" : "")
            + (s.lpMax && S.hpOnTile() ? S.hpBadge(s) : "") + cardsBadge(s) + tileGemsCode(s) + socleCode(s) + "</div>";
    }).join("") + "</div>";
};

S.renderManual = function() {
    var st = S.state, root = S.root;
    var keep = S.screen == "game" && S._lastScreen == "game" ? root.scrollTop : null;
    S.screen = "game"; S.selected = null;
    var mini = S.turnMini();
    var sk = S.skin(), skv = ["green", "red", "rest"];
    var h = "<div class='skelos-game sk-manual" + (coop() ? " solo" : "") + (mini ? " sk-mmini" : "") + skv.map(function(k) { return " sk-has-" + k; }).join("") + "'"
        + (skv.length ? " style=\"" + skv.map(function(k) { return "--sk-" + k + ":url('" + sk[k] + "')"; }).join(";") + "\"" : "") + "><div class='sk-desk'>" + (mini ? "" : trackCode())
        + "<div class='sk-mmid'>" + reserveCode() + "<div class='sk-book'>"
        + "<div class='sk-mb1'>" + (mini ? turnMiniCode() : "") + BAND1.map(function(z) { return zoneCode(z, "<img class='sk-mico' src='" + S.icon(z) + "' alt='' draggable='false'>"); }).join("") + "</div>"
        + "<div class='sk-mb2'>" + zoneCode("energy", "", coop() ? t("tokens_pool") : t("energy")) + restCode() + zoneCode("fatigue", "", t("fatigue")) + "</div>"
        + "<div class='sk-mb3'>" + holesCode() + "</div>"
        + tilesCode() + "</div>" + pileCode() + "</div>"
        + "</div>" + gemPopCode() + "</div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>";
    root.innerHTML = h;
    S._lastScreen = "game";
    // Survol (souris) et appui long (iPad) des compétences : branchés une fois sur la racine, même sans plateau automatique.
    if (!S._pressBound) { S.bindPress(root); S._pressBound = true; }
    // Passage téléphone ↔ tablette (rotation, fenêtre) : le livre change de découpage, on le redessine.
    if (!S._phoneMq && window.matchMedia) {
        S._phoneMq = window.matchMedia(S.PHONE_MQ);
        var re = function() { if (S.screen == "game" && S.manualOn()) S.renderGame(); };
        if (S._phoneMq.addEventListener) S._phoneMq.addEventListener("change", re); else if (S._phoneMq.addListener) S._phoneMq.addListener(re);
    }
    bindTurnMini(root);
    S.placeTabs();
    // Barre des onglets : bouton Studio et disquette comme sur le plateau automatique (S.placeTabs) ; l'interrupteur
    // Aventure / Coop reste visible hors du mode studio (le clic est pris en charge par S.placeTabs → S.switchMode).
    var tools = root.querySelector(":scope > .sk-tabs .sk-tabtools");
    if (tools && !tools.querySelector(".sk-modesw")) tools.insertAdjacentHTML("afterbegin", "<div class='sk-modesw' role='radiogroup' aria-label='" + e(t("mode_switch")) + "'>" + [["classic", "mode_adventure"], ["solo", "mode_coop"]].map(function(m) {
        var on = st.mode == m[0];
        return "<button role='radio' aria-checked='" + on + "' class='" + (on ? "on" : "") + "' data-studio='mode' data-mode='" + m[0] + "'>" + e(t(m[1])) + "</button>";
    }).join("") + "</div>");
    root.querySelector(".sk-manual").classList.toggle("sk-mstudio", !!S.studio);
    S.syncFullscreenButton();
    S.fitDesk();
    if (keep != null) root.scrollTop = keep;
    placeGemPop();
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
    commit(from == "reserve" ? t("man_log_gems_add", n, zoneLabel(to)) : to == "reserve" ? t("man_log_gems_rm", n, zoneLabel(from)) : t("man_log_gems", n, zoneLabel(from), zoneLabel(to)));
};

// Double appui sur la tuile de repos : tout ce qui est dépensé passe en Fatigue, puis autant de gemmes que la
// Récupération reviennent de la Fatigue vers l'Énergie disponible. Tout ce qui est dépensé revient : Mouvement, Défense, Relance, et les gemmes posées sur les tuiles et leurs cartes.
// Gemmes dépensées : celles de Mouvement, Défense, Relance et celles posées sur les tuiles et leurs cartes.
// spentPaths, avant le changement : d'où elles partent (pour l'animation) ; spentToFatigue : elles passent en Fatigue.
var spentPaths = function() {
    var st = S.state, paths = BAND1.filter(function(z) { return count(z) > 0; }).map(function(z) { return {from: rectOf("[data-zone='" + z + "']"), n: count(z)}; });
    st.river.forEach(function(s) { var n = tileGems(s); if (n) paths.push({from: rectOf("[data-mtile='" + s.uid + "'] .sk-mtg") || rectOf("[data-mtile='" + s.uid + "']"), n: n}); });
    return paths;
};
var spentToFatigue = function() {
    var st = S.state;
    S.clearBoosts();
    st.river.forEach(function(s) { var n = tileGems(s); if (n) { st.fatigue += n; delete s.gems; (s.cards || []).forEach(function(c) { delete c.gems; }); } });
};
S.manualRecover = function() {
    var st = S.state; if (coop()) return;
    var onTiles = st.river.reduce(function(a, s) { return a + tileGems(s); }, 0);
    var spent = S.boostSum() + onTiles, back = Math.max(0, Math.min(st.recovery || 0, st.fatigue + spent)), fat0 = st.fatigue, en0 = st.energy;
    if (!spent && !back) { S.toast(t("man_recover_none")); return; }
    // Avant de changer l'état : d'où partent les gemmes (zones, tas posés sur les tuiles).
    var paths = spentPaths();
    S.snapshot();
    spentToFatigue();
    st.fatigue -= back; st.energy += back;
    commit(t("man_log_recover", spent, back));
    // Animation : les gemmes dépensées volent vers la Fatigue, puis la Récupération repart vers l'Énergie disponible.
    // La Fatigue et l'Énergie gardent leur ancien nombre jusqu'à l'arrivée des gemmes.
    var fat = rectOf("[data-zone='fatigue']"), en = rectOf("[data-zone='energy']"), gem = S.icon("gem"), d = 0, t1 = 0, g = ++animGen;
    pulse("[data-mrest]");
    paths.forEach(function(p) { t1 = Math.max(t1, fly(gem, p.from, fat, p.n, d)); d += 90; });
    var t2 = back ? fly(gem, fat, en, back, spent ? d + 520 : 0) : 0;
    if (!t1 && !t2) return;
    hold("fatigue", zoneCode("fatigue", "", t("fatigue"), fat0)); hold("energy", zoneCode("energy", "", t("energy"), en0));
    later(g, t1, function() { hold("fatigue", zoneCode("fatigue", "", t("fatigue"), fat0 + spent)); });
    later(g, Math.max(t1, t2), S.renderGame);
};

// ---------- Animations ----------
// Pièces qui volent d'une zone à l'autre (en arc), au-dessus de tout ; elles disparaissent à l'arrivée.
// Au plus 12 par trajet pour rester lisible. Rien si l'appareil demande moins d'animations.
var rectOf = function(sel) { var el = S.root && S.root.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
var calm = function() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
// Rend l'instant (ms) où la dernière pièce arrive, 0 s'il n'y a pas d'animation.
var fly = function(src, from, to, n, delay, endSrc) {
    if (!from || !to || calm() || !document.body.animate || !n) return 0;
    var k = Math.min(n, 12), size = Math.max(20, Math.min(34, to.width / 8));
    var j = function(r, f) { return (Math.random() - .5) * r.width * f; };
    for (var i = 0; i < k; i++) (function(i) {
        var img = document.createElement("img");
        img.className = "sk-mfly"; img.src = src; img.alt = "";
        img.style.width = img.style.height = size + "px";
        document.body.appendChild(img);
        var x0 = from.left + from.width / 2 + j(from, .4) - size / 2, y0 = from.top + from.height / 2 + j(from, .2) - size / 2;
        var x1 = to.left + to.width / 2 + j(to, .5) - size / 2, y1 = to.top + to.height / 2 + j(to, .25) - size / 2;
        var mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 60 - Math.random() * 40;
        var at = function(x, y, sc, r) { return "translate(" + x + "px," + y + "px) scale(" + sc + ") rotate(" + r + "deg)"; };
        var anim = img.animate([
            {transform: at(x0, y0, 1, 0), opacity: 0},
            {transform: at(x0, y0, 1.15, 0), opacity: 1, offset: .08},
            {transform: at(mx, my, 1.3, Math.random() * 180 - 90), opacity: 1, offset: .5},
            {transform: at(x1, y1, 1, Math.random() * 60 - 30), opacity: 1, offset: .92},
            {transform: at(x1, y1, .9, 0), opacity: 0}
        ], {duration: 620, delay: delay + i * 45, easing: "ease-in-out", fill: "both"});
        if (endSrc) setTimeout(function() { img.src = endSrc; }, delay + i * 45 + 330);
        anim.onfinish = anim.oncancel = function() { img.remove(); };
    })(i);
    return delay + (k - 1) * 45 + 620;
};
// Zone d'arrivée gelée pendant le vol des pièces, puis l'affichage réel quand elles arrivent.
var animGen = 0;
var outerOf = function(z) { var el = S.root && S.root.querySelector(".sk-manual [data-zone='" + z + "']"); return el ? el.outerHTML : null; };
var hold = function(z, html) { var el = S.root && S.root.querySelector(".sk-manual [data-zone='" + z + "']"); if (el && html) el.outerHTML = html; };
var later = function(g, ms, fn) { setTimeout(function() { if (g == animGen && S.state && S.screen == "game" && S.manualOn()) fn(); }, ms); };
var pulse = function(sel) {
    var el = S.root && S.root.querySelector(sel); if (!el || calm() || !el.animate) return;
    el.animate([{transform: "scale(1)"}, {transform: "scale(1.06)", filter: "brightness(1.15)"}, {transform: "scale(1)"}], {duration: 380, easing: "ease-out"});
};

// Coop, double appui sur la tuile Héros en jeu : les jetons tirés (Mouvement, Défense, Relance) passent en Fatigue.
// Quand le dernier jeton a été tiré (zone verte vide), tous les jetons reviennent dans la zone verte, disponibles.
var DRAWN = ["move", "defense", "reroll"];
S.manualCoopClear = function() {
    var st = S.state; if (!coop()) return;
    var reset = !poolCount();
    var toks = reset ? st.river.filter(function(s) { return live(s.uid) && s.token && st.pool.indexOf(s.uid) < 0 && st.used.indexOf(s.uid) >= 0; })
        : st.river.filter(function(s) { return live(s.uid) && DRAWN.indexOf(tokLoc(s.uid)) >= 0; });
    var gems = S.boostSum() + st.river.reduce(function(a, s) { return a + tileGems(s); }, 0);
    if (!toks.length && !gems) { S.toast(t("man_coop_none")); return; }
    // Avant le changement : d'où partent jetons et gemmes, et l'ancien affichage des zones d'arrivée.
    var fromT = toks.map(function(s) { return rectOf("[data-tok='" + s.uid + "']"); }), paths = spentPaths();
    var oldFat = outerOf("fatigue"), pool0 = poolCount();
    S.snapshot();
    spentToFatigue();
    if (reset) {
        toks.forEach(function(s) { st.pool.push(s.uid); });
        st.used = st.used.filter(function(u) { return st.pool.indexOf(u) < 0; });
        st.tokLoc = {};
    } else {
        st.tokLoc = st.tokLoc || {};
        toks.forEach(function(s) { st.tokLoc[s.uid] = "fatigue"; });
    }
    if (gems) S.log(t("man_log_coop_gems", gems));
    commit(toks.length ? t(reset ? "man_log_coop_reset" : "man_log_coop_clear", toks.length) : null);
    // Animation : gemmes vers la Fatigue ; jetons vers la Fatigue (ou, quand tout a été tiré, vers la zone verte, retournés).
    pulse("[data-mrest]");
    var fat = rectOf("[data-zone='fatigue']"), en = rectOf("[data-zone='energy']"), g = ++animGen, end = 0, gem = S.icon("gem");
    paths.forEach(function(p, i) { end = Math.max(end, fly(gem, p.from, fat, p.n, i * 90)); });
    toks.forEach(function(s, i) { end = Math.max(end, reset ? fly(S.marker(s.token), fromT[i], en, 1, i * 70, S.icon("tokenback")) : fly(S.marker(s.token), fromT[i], fat, 1, i * 90)); });
    if (!end) return;
    hold("fatigue", oldFat);
    if (reset) hold("energy", zoneCode("energy", "", t("tokens_pool"), pool0));
    later(g, end, S.renderGame);
};

// Gemmes des tuiles et de leurs cartes : comptées dans le total ; une tuile ou une carte retirée rend les siennes à la Fatigue.
var baseTotal = S.gemTotal;
S.gemTotal = function() {
    var n = baseTotal.apply(S, arguments);
    return S.state ? n + S.state.river.reduce(function(a, s) { return a + tileGems(s); }, 0) : n;
};
// Une seule étape d'annulation : on prend l'instantané avant de rendre les gemmes, puis on fait taire celui de la fonction de base.
var withGemsBack = function(base, args, holders) {
    var n = holders.reduce(function(a, h) { return a + (h.gems || 0); }, 0);
    if (!n || !S.manualOn()) return base.apply(S, args);
    S.snapshot();
    S.state.fatigue += n; holders.forEach(function(h) { delete h.gems; });
    S.log(t("man_log_gems_back", n));
    var snap = S.snapshot; S.snapshot = function() {};
    try { return base.apply(S, args); } finally { S.snapshot = snap; }
};
// PV partagés (même tuile, même socle) : une seule pastille sur la piste pour le groupe. Si la case qui la porte
// quitte le groupe (retirée, ou socle changé), la pastille passe à une autre case du groupe.
var passTrack = function(s) {
    var st = S.state, tr = st && st.hpTrack, i = tr && s ? tr.indexOf(s.uid) : -1;
    if (i < 0) return;
    var other = S.hpGroup(s).filter(function(g) { return g !== s; })[0];
    if (other && tr.indexOf(other.uid) < 0) tr[i] = other.uid;
};
var baseRemove = S.studioRemove;
S.studioRemove = function(uid) {
    var s = S.slotByUid(uid);
    passTrack(s);
    return withGemsBack(baseRemove, arguments, s ? [s].concat(s.cards || []) : []);
};
var baseNextSocle = S.nextSocle;
S.nextSocle = function(uid) { passTrack(S.slotByUid(uid)); return baseNextSocle.apply(S, arguments); };
var baseRemoveCard = S.studioRemoveCard;
S.studioRemoveCard = function(uid, kind, k) {
    var s = S.slotByUid(uid), c = s && S.slotCards(s, kind)[k];
    return withGemsBack(baseRemoveCard, arguments, c ? [c] : []);
};

S.manualMoveToken = function(uid, to) {
    var st = S.state, s = S.slotByUid(uid), from = tokLoc(uid);
    if (!s || !to || to == from || to == "reserve" || to.indexOf("g:") == 0) return;   // un jeton ne va ni dans le bol ni sur une tuile
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
    var msg = t(from == "energy" ? "man_log_draw" : "man_log_token", s.token, S.tileName(s), zoneLabel(to));
    // Dès que le dernier jeton est tiré, les jetons redeviennent disponibles (zone verte), comme dans le jeu ;
    // ceux posés sur Mouvement, Défense et Relance restent en place pour jouer leur activation.
    var all = from == "energy" && !poolCount() ? st.river.filter(function(x) { return live(x.uid) && st.used.indexOf(x.uid) >= 0 && DRAWN.indexOf(tokLoc(x.uid)) < 0; }) : [];
    if (all.length) {
        var fromR = all.map(function(x) { return x.uid == uid ? rectOf("[data-zone='" + to + "']") : rectOf("[data-tok='" + x.uid + "']"); });
        all.forEach(function(x) { st.pool.push(x.uid); delete st.tokLoc[x.uid]; });
        st.used = st.used.filter(function(u) { return st.pool.indexOf(u) < 0; });
        S.log(msg);
        commit(t("man_log_coop_reset", all.length));
        S.toast(t("man_coop_reset_toast", s.token, S.tileName(s)));
        var en = rectOf("[data-zone='energy']"), g = ++animGen, end = 0;
        all.forEach(function(x, i) { end = Math.max(end, fly(S.marker(x.token), fromR[i], en, 1, 150 + i * 70, S.icon("tokenback"))); });
        if (end) { hold("energy", zoneCode("energy", "", t("tokens_pool"), 0)); later(g, end, S.renderGame); }
        return;
    }
    commit(msg);
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
        var up = +cell > st.turn;
        S.snapshot(); st.turn = +cell;
        commit(t("man_log_turn", st.turn));
        // Dernier tour : l'alarme vibre et la cloche sonne, comme sur le plateau automatique (sans fond rouge).
        if (up && st.turns && st.turn == st.turns) S.lastTurnBell && S.lastTurnBell(S.root.querySelector(".sk-mturn [data-turnkind='turns'], .sk-mtrack .sk-mend"));
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
// Livre manuel : le − / + du cœur de la tuile n'a plus de plafond (l'utilisateur est maître des règles) ; tout le groupe suit.
var baseLife = S.life;
S.life = function(uid, d) {
    if (!S.manualOn()) return baseLife.apply(S, arguments);
    var s = S.slotByUid(uid); if (s) S.manualSetHp(uid, (s.lp || 0) + d);
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
// Pion de vie pris en main : agrandi (avec une petite animation) pour bien le reconnaître sous le doigt.
var HPG = 84;
var ghostHp = function(on, html, src) {
    if (!ghost) return;
    var r = src.getBoundingClientRect();
    ghost.classList.toggle("sk-mghost-hp", !!on);
    ghost.style.width = (on ? HPG : r.width) + "px"; ghost.style.height = (on ? HPG : r.height) + "px";
    ghost.innerHTML = html;
};

var under = function(x, y, sel) {
    var el = document.elementFromPoint(x, y);
    return el && el.closest(".sk-manual") ? el.closest(sel) : null;
};
var markTarget = function(el) {
    document.querySelectorAll(".sk-manual .sk-mtarget").forEach(function(n) { if (n !== el) n.classList.remove("sk-mtarget"); });
    if (el) el.classList.add("sk-mtarget");
};
// Pendant le glisser d'une tuile dans sa bande, un cadre pointillé montre la place où elle se posera
// (comme sur le plateau automatique) ; rien quand elle reviendrait à sa place.
var showSpot = function(uid, x, y) {
    var band = S.root.querySelector(".sk-mb4"); if (!band) return;
    var spot = band.querySelector(".sk-mspot"), st = S.state, i = st.river.findIndex(function(s) { return s.uid == uid; });
    var idx = x == null ? -1 : Math.max(0, Math.min(st.river.length - 1, tileIndexAt(x, y)));
    if (idx < 0 || idx == i) { if (spot) spot.remove(); return; }
    if (!spot) { band.insertAdjacentHTML("beforeend", "<span class='sk-mspot' aria-hidden='true'></span>"); spot = band.querySelector(".sk-mspot"); }
    spot.setAttribute("style", cellPos(idx));
};
var tileIndexAt = function(x, y) {
    var band = S.root.querySelector(".sk-mb4"); if (!band) return -1;
    var r = band.getBoundingClientRect();
    // Téléphone : bande en grille de 4 colonnes sur deux rangs.
    if (getComputedStyle(band).display == "grid") {
        var col = Math.max(0, Math.min(3, Math.floor((x - r.left) / (r.width / 4))));
        return (y != null && y > r.top + r.height / 2 ? 4 : 0) + col;
    }
    return Math.floor((x - r.left) / (r.width / S.RIVER_SIZE));
};

// Gemmes lâchées sur une tuile : sur la tuile si elle ne porte pas de carte ; sinon la liste « tuile + cartes »
// s'ouvre et les gemmes restent en main jusqu'au choix de la ligne.
var dropOnTile = function(from, n, tile, x, y) {
    if (!tile) return;
    var s = S.slotByUid(tile.dataset.mtile); if (!s) return;
    if (!(s.cards || []).length) { S.manualMoveGems(from, "g:" + s.uid + ":-1", n); return; }
    hand = {from: from, n: n, x: x, y: y, pinned: true};
    S.openGemPop(s.uid);
    S.toast(t("man_gems_pick"));
};

// ---------- Gestes ----------
var lastTap = {uid: null, at: 0};
var hinted = false;

var bind = function(board) {
    if (!board) return;
    board.addEventListener("click", function(ev) {
        if (ev.target.closest("[data-tilepile]")) { S.studioPick(); return; }
        if (ev.target.closest("[data-mgpclose]")) { closeGemPop(); return; }
        var sc = ev.target.closest("[data-msocle]");
        if (sc) { S.nextSocle(sc.dataset.msocle); return; }
        var tg = ev.target.closest("[data-tgems]");
        if (tg) { S.openGemPop(tg.dataset.tgems); return; }
        // La pastille des cartes sous une tuile ouvre aussi la tuile et ses cartes (pour y poser des gemmes).
        var cb = ev.target.closest("[data-mtile] .sk-cardsbadge");
        if (cb) { S.openGemPop(cb.closest("[data-mtile]").dataset.mtile); return; }
        // Double appui sur la tuile de repos : fin de tour des gemmes (dépensées → Fatigue, Récupération → Énergie).
        if (ev.target.closest("[data-mrest]") && !ev.target.closest("button")) {
            var now = Date.now();
            if (lastTap.uid == "rest" && now - lastTap.at < 400) { lastTap.uid = null; if (coop()) S.manualCoopClear(); else S.manualRecover(); }
            else { lastTap.uid = "rest"; lastTap.at = now; }
            return;
        }
        var b = ev.target.closest("[data-mact]"); if (!b) return;
        var f = b.dataset.mact, v = Math.max(f == "heroes" ? 1 : f == "recovery" ? -1 : 0, (S.state[f] || 0) + +b.dataset.n);
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
        if (S._mgpop && !zone && !ev.target.closest(".sk-mgpop, [data-tgems]")) closeGemPop();
        if (ev.target.closest("[data-tgems], [data-mtile] .sk-cardsbadge")) return;

        // Gemmes en main : l'appui suivant les pose dans la zone touchée (ou sur une tuile), ou les repose.
        if (hand && hand.pinned) {
            ev.preventDefault();
            var from = hand.from, n = hand.n; dropHand();
            if (zone && zone.dataset.zone != from) S.manualMoveGems(from, zone.dataset.zone, n);
            else if (!zone) dropOnTile(from, n, ev.target.closest("[data-mtile]"), x0, y0);
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
                if (!g.moved && far(e2)) { g.moved = true; hpm.classList.add("sk-mdragging"); ghostStart(hpm, e2.clientX, e2.clientY); ghostHp(true, hpm.outerHTML, hpm); }
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
        // (Dans la zone verte, un appui sur le tas de gemmes prend des gemmes, ailleurs il tire un jeton.)
        if (coop() && (tok || (zone && zone.dataset.zone == "energy" && poolCount() && !ev.target.closest(".sk-mcgems")))) {
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
        if (zone && count(zone.dataset.zone) > 0) {
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
                if (g.moved && hand) { hand.x = e2.clientX; hand.y = e2.clientY; showHand(); markTarget(under(e2.clientX, e2.clientY, "[data-zone]") || under(e2.clientX, e2.clientY, "[data-mtile]")); }
            }, function(e2, cancel) {
                if (cancel) { dropHand(); return; }
                if (g.moved && hand) {
                    var to = under(e2.clientX, e2.clientY, "[data-zone]"), n = hand.n;
                    dropHand();
                    if (to) S.manualMoveGems(from, to.dataset.zone, n);
                    else dropOnTile(from, n, under(e2.clientX, e2.clientY, "[data-mtile]"), e2.clientX, e2.clientY);
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
                    // Hors de la bande des tuiles (et hors du tas), la tuile devient son pion de vie, prêt à poser sur la piste.
                    var slot = S.slotByUid(uid);
                    var wantHp = S.hpOnTrack() && slot && !S.isEvent(slot) && !onTrack(slot) && !under(e2.clientX, e2.clientY, ".sk-mb4") && !under(e2.clientX, e2.clientY, "[data-tilepile]");
                    if (!!wantHp != !!g.hp) { g.hp = wantHp; ghostHp(wantHp, wantHp ? hpMarkerCode(slot, 0) : tile.outerHTML, tile); }
                    showSpot(uid, under(e2.clientX, e2.clientY, ".sk-mb4") ? e2.clientX : null, e2.clientY);
                    markTarget(under(e2.clientX, e2.clientY, "[data-tilepile]") || (S.hpOnTrack() && !tile.hasAttribute("data-eventuid") ? under(e2.clientX, e2.clientY, "[data-cell]") : null));
                }
            }, function(e2, cancel) {
                ghostEnd(); tile.classList.remove("sk-dragging"); showSpot(uid, null);
                if (cancel || long) return;
                if (g.moved) {
                    if (under(e2.clientX, e2.clientY, ".sk-mb4")) S.manualMoveTile(uid, tileIndexAt(e2.clientX, e2.clientY));
                    else if (under(e2.clientX, e2.clientY, "[data-tilepile]")) S.studioRemove(uid);
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
// Le zoom du livre manuel : la tuile au centre et, de part et d'autre, ses cartes en plus petit sur deux pistes
// qui défilent (à gauche les sorts, à droite les tuiles portées puis les équipements). Un appui sur une petite carte
// l'agrandit ; la pastille corbeille la retire ; le + à droite des PV en ajoute. Glisser vers le haut ou le bas sur
// la tuile passe à la tuile voisine.
var baseZoom = S.zoomTile;
// Gemmes visibles sur une petite carte : posées à la main (livre manuel) ou, sur le plateau automatique, celles des sorts lancés ce tour.
var gemsOn = function(s, c) { return c.gems || (c.kind == "sp" && !S.manualOn() ? S.castCount(s.uid, c.ref) : 0); };
// Sur le plateau automatique, on ne retire ni n'ajoute de carte qu'en studio (comme l'ancien zoom).
var canEdit = function() { return S.manualOn() || S.studio; };
var smallCard = function(s, c) {
    var kind = c.kind, k = S.slotCards(s, kind).indexOf(c), name = S.itemName(kind, c.ref);
    var real = S.realCardCode(kind, c.ref), face = kind == "ti" ? (real || "") : "<span class='sk-cardscale'>" + (real || "<span class='sk-upcard sk-k-" + kind + "'><b>" + e(name) + "</b></span>") + "</span>";
    return "<div class='sk-mzc sk-mzc-" + kind + "' data-mzc='" + kind + ":" + k + "' role='button' tabindex='0' aria-label='" + e(name) + "' title='" + e(name) + "'>" + face
        + pipsCode(gemsOn(s, c))
        + (canEdit() ? "<button class='sk-zoomrm sk-mzrm' data-zrm='" + kind + ":" + k + "' aria-label='" + e(t("remove_card")) + "' title='" + e(t("remove_card")) + "'>&#xf2ed;</button>" : "") + "</div>";
};
var trackSide = function(s, list, side) {
    if (!list.length) return "<div class='sk-mztrack sk-mztrack-" + side + " empty'></div>";
    var more = list.length > 2;
    return "<div class='sk-mztrack sk-mztrack-" + side + (more ? " more" : "") + "'>"
        + (more ? "<button class='sk-mzrot' data-mzrot='-1' aria-label='" + e(t("man_track_prev")) + "'>&#xf077;</button>" : "")
        + "<div class='sk-mzlist'>" + list.map(function(c) { return smallCard(s, c); }).join("") + "</div>"
        + (more ? "<button class='sk-mzrot' data-mzrot='1' aria-label='" + e(t("man_track_next")) + "'>&#xf078;</button>" : "") + "</div>";
};
// Les deux plateaux utilisent ce zoom ; seule la « main des sorts » (bouton Sort du plateau automatique) garde l'ancien.
S.zoomTile = function(uid, opts) {
    opts = opts || {};
    if (!S.state || opts.hand) { var o0 = S.root && S.root.querySelector("#sk-overlay"); if (o0) o0.classList.remove("sk-mzon"); return baseZoom.apply(S, arguments); }
    var s = S.slotByUid(uid); if (!s) return;
    var manual = S.manualOn();
    S._zoom = {uid: uid, pos: 0, hand: false, manual: true};
    S.hideTip(); S.closeHp && S.closeHp();
    var left = S.slotCards(s, "sp"), right = S.slotCards(s, "ti").concat(S.slotCards(s, "eq"));
    // Points de vie : livre manuel → réglés à la main (data-zmhp) ; plateau automatique → comme avant
    // (studio : PV de départ, data-zlp ; partie : PV restants, data-zhp, seulement si la tuile en a).
    var hp = "";
    if (!S.isEvent(s)) {
        if (manual) hp = S.studioHpCode(s).replace(/data-act='studiolp' data-uid='[^']*' data-n='(-?\d+)'/g, "data-zmhp='$1'");
        else if (S.studio) { if (!s.dead) hp = S.studioHpCode(s).replace(/data-act='studiolp'/g, "data-zlp"); }
        else if (s.lpMax) hp = S.studioHpCode(s).replace(/data-act='studiolp'/g, "data-zhp");
    }
    var ring = S.zoomRing(false), idx = ring.indexOf(uid);
    var ov = S.root.querySelector("#sk-overlay");
    // On garde la position des pistes d'un affichage à l'autre (ajout, retrait, PV) pour la même tuile.
    var keep = {};
    if (ov && S._mzLast == uid) ov.querySelectorAll(".sk-mzlist").forEach(function(l, i) { keep[i] = l.scrollTop; });
    S._mzLast = uid;
    ov.innerHTML = "<div class='sk-zoom sk-mzoom' role='dialog' tabindex='-1' aria-label='" + e(S.tileName(s)) + "'>"
        + "<div class='sk-zoomhead'>" + (ring.length > 1 ? "<span class='sk-zoomring'>" + (idx + 1) + " / " + ring.length + "</span>" : "") + "</div>"
        // Sortie toujours à portée de doigt, même quand le zoom remplit l'écran du téléphone.
        + "<button class='sk-mzclose' data-mzclose aria-label='" + e(t("close")) + "' title='" + e(t("close")) + "'>×</button>"
        + "<div class='sk-mzrow" + (opts.dir ? " sk-zin-" + opts.dir : "") + "'>" + trackSide(s, left, "l")
        + "<div class='sk-mzcenter'><div class='sk-tilebox sk-zoombox" + (s.dead ? " dead" : "") + "'>" + S.tileCode(s) + (s.dead ? "<span class='sk-deadmark'>" + t("dead") + "</span>" : "")
        + pipsCode(s.gems, "sk-gpips-tile") + "</div>"
        + "<div class='sk-mzfoot'>" + (hp ? "<div class='sk-zoomhp'>" + hp + "</div>" : "")
        + (canEdit() ? "<button class='sk-mzadd' data-zadd='eq' aria-label='" + e(t("add_cards")) + "' title='" + e(t("add_cards")) + "'>+</button>" : "") + "</div></div>"
        + trackSide(s, right, "r") + "</div></div>";
    ov.classList.add("on", "sk-zoomon", "sk-mzon");
    ov.querySelectorAll(".sk-mzlist").forEach(function(l, i) { if (keep[i]) l.scrollTop = keep[i]; });
    S.markSteppers && S.markSteppers(ov);
    bindManualZoom(ov);
    ov.querySelector(".sk-zoom").focus({preventScroll: true});
};
var bindManualZoom = function(ov) {
    var sx = 0, sy = 0, down = false, noSwipe = false;
    ov.onkeydown = function(ev) {
        if (ev.key == "Escape") { if (!closeBig(ov)) S.zoomShut(); return; }
        var m = {ArrowUp: "up", ArrowDown: "down"}[ev.key];
        if (m) { ev.preventDefault(); S.zoomGo(m); }
    };
    ov.onpointerdown = function(ev) { down = true; sx = ev.clientX; sy = ev.clientY; noSwipe = !ev.target.closest(".sk-zoombox") || !!ev.target.closest(".sk-mzbig"); };
    ov.onpointerup = function(ev) {
        if (!down) return; down = false;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (noSwipe || Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx)) return;
        S._zswipeAt = Date.now();
        S.zoomGo(dy < 0 ? "down" : "up");
    };
    ov.onclick = function(ev) {
        if (S._zswipeAt && Date.now() - S._zswipeAt < 450) { S._zswipeAt = 0; ev.stopPropagation(); return; }
        var z = S._zoom; if (!z) return;
        var uid = z.uid;
        // Plateau automatique : lancer un sort depuis la carte agrandie (coût fixe, ou coût X choisi avec − / +).
        var xs = ev.target.closest(".sk-mzbig [data-zx]");
        if (xs) { ev.stopPropagation(); var v = ov.querySelector("[data-zxv]"); v.textContent = Math.max(1, Math.min(9, (+v.textContent || 1) + +xs.dataset.zx)); return; }
        var cs = ev.target.closest(".sk-mzbig [data-zcast]");
        if (cs) {
            ev.stopPropagation();
            var n = cs.hasAttribute("data-x") ? (+ov.querySelector("[data-zxv]").textContent || 1) : +cs.dataset.n;
            if (S.castSpell(uid, cs.dataset.zcast, n)) S.zoomTile(uid);
            return;
        }
        if (ev.target.closest("[data-mzclose]")) { ev.stopPropagation(); if (!closeBig(ov)) S.zoomShut(); return; }
        if (ev.target.closest(".sk-mzcast")) { ev.stopPropagation(); return; }
        if (closeBig(ov)) { ev.stopPropagation(); return; }
        var lp = ev.target.closest("[data-zlp], [data-zhp]");
        if (lp) {
            ev.stopPropagation();
            if (lp.hasAttribute("data-zlp")) S.studioLife(uid, +lp.dataset.n); else S.life(uid, +lp.dataset.n);
            if (S.slotByUid(uid)) S.zoomTile(uid); else S.zoomShut();
            return;
        }
        var rm = ev.target.closest("[data-zrm]");
        if (rm) { ev.stopPropagation(); var p = rm.dataset.zrm.split(":"); S.studioRemoveCard(uid, p[0], +p[1]); return; }
        var add = ev.target.closest("[data-zadd]");
        if (add) { ev.stopPropagation(); S.studioAddCards(uid, add.dataset.zadd); return; }
        var rot = ev.target.closest("[data-mzrot]");
        if (rot) {
            ev.stopPropagation();
            var list = rot.parentNode.querySelector(".sk-mzlist"), card = list.querySelector(".sk-mzc");
            list.scrollBy({top: +rot.dataset.mzrot * (card ? card.offsetHeight + 24 : 100), behavior: "smooth"});
            return;
        }
        var sc = ev.target.closest("[data-mzc]");
        if (sc) { ev.stopPropagation(); openBig(ov, sc, uid); return; }
        var sk = ev.target.closest("[data-skill]");
        if (sk) { ev.stopPropagation(); S.showTip(sk); return; }
        if (ev.target.closest(".sk-tip, .sk-zoombox, .sk-mzfoot, .sk-mzc")) return;
        S.zoomShut();
    };
};
// Petite carte agrandie au-dessus du zoom ; un appui n'importe où la repose.
// Sur le plateau automatique, en partie, un sort agrandi porte de quoi le lancer, comme l'ancien zoom.
var openBig = function(ov, sc, uid) {
    var face = sc.cloneNode(true); face.querySelectorAll("button, .sk-gpips").forEach(function(b) { b.remove(); });
    var p = sc.dataset.mzc.split(":"), s = S.slotByUid(uid), c = s && S.slotCards(s, p[0])[+p[1]];
    var foot = c && p[0] == "sp" && autoGame() ? castFoot(s, c.ref) : "";
    ov.querySelector(".sk-mzoom").insertAdjacentHTML("beforeend", "<div class='sk-mzbig" + (foot ? " sk-mzbigcast" : "") + "' role='dialog' aria-label='" + e(sc.getAttribute("aria-label")) + "'><div class='sk-mzbigcard'>" + face.innerHTML + "</div>" + foot + "</div>");
    S.markSteppers && S.markSteppers(ov);
};
var autoGame = function() { return !S.manualOn() && !S.studio; };
// Lancement d'un sort : gemmes déjà posées (et saturation), puis un bouton au coût fixe, ou − / + et le bouton pour un coût X.
var castFoot = function(s, ref) {
    if (s.dead) return "<div class='sk-mzcast'><p class='sk-zoomnote'>" + e(t("spell_tile_dead")) + "</p></div>";
    var d = S.spellData(ref), cost = d ? parseInt(d.cost, 10) : NaN, sat = d ? parseInt(d.saturation, 10) || 0 : 0, cast = S.castCount(s.uid, ref);
    var note = sat > 0 || cast ? "<p class='sk-zoomnote'>" + e(sat > 0 ? t("spell_gems", cast, sat) : t("spell_gems_nosat", cast)) + "</p>" : "";
    if (cost > 0) return "<div class='sk-mzcast'>" + note
        + "<button class='sk-btn sk-primary' data-zcast='" + e(ref) + "' data-n='" + cost + "'>" + e(t("cast_spell")) + " · " + cost + "</button></div>";
    return "<div class='sk-mzcast'>" + note + "<div class='sk-zoomcast'><button class='sk-hpbtn' data-zx='-1' aria-label='−'>−</button><b data-zxv>1</b><button class='sk-hpbtn' data-zx='1' aria-label='+'>+</button>"
        + "<button class='sk-btn sk-primary' data-zcast='" + e(ref) + "' data-x>" + e(t("cast_spell")) + "</button></div></div>";
};
var closeBig = function(ov) { var b = ov.querySelector(".sk-mzbig"); if (b) { b.remove(); return true; } return false; };
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
    if (S._mgpop && !ev.target.closest(".sk-manual")) closeGemPop();
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
