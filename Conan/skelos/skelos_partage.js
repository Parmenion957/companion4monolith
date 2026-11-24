// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon.
// QR codes fabriqués avec qrcode-generator (Kazuhiko Arase, licence MIT, lib/qrcode.js).
//
// Partage par QR code, sans serveur. Le menu « Partager » est contextuel :
//   - depuis le livre (vue Overlord) : toute la partie, livre et héros ;
//   - depuis la compagnie (vue Héros) : tous les héros ;
//   - depuis le zoom sur un héros : ce héros seul.
// Le contenu (JSON) est compressé puis découpé en morceaux ; chaque morceau est un QR en octets bruts :
//   « SK », version, lot (au hasard), rang, nombre, puis les octets du morceau.
// Plusieurs morceaux défilent tout seuls ; le lecteur (étape suivante) les rassemble dans n'importe quel ordre.
// Les références de l'encyclopédie suffisent (l'autre appareil a le Compagnon) ; les améliorations inventées en campagne
// voyagent avec leur nom et leur texte. Le journal et l'historique d'annulation ne partent pas.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
var VERSION = 1, CHUNK = 700, TICK = 380;

// Identifiant de la partie : il relie le retour d'un héros à la partie de l'Overlord.
S.shareGid = function() {
    var hb = S.heroBoards();
    if (!hb.gid) { hb.gid = "g" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); S.saveHeroBoards(); }
    return hb.gid;
};

var heroesCopy = function(list) {
    return JSON.parse(JSON.stringify(list || [])).map(function(h) { delete h.redHome; return h; });
};
// Les améliorations portées (par un héros ou sur une tuile) partent avec leur fiche : l'autre appareil ne les connaît pas.
var upsOf = function(heroes, river) {
    var ids = {};
    heroes.forEach(function(h) { (h.cards || []).forEach(function(c) { if (c.kind == "up") ids[c.ref] = 1; }); });
    (river || []).forEach(function(s) { (s.cards || []).forEach(function(c) { if (c.kind == "up") ids[c.ref] = 1; }); });
    return S.upgrades().filter(function(u) { return ids[u.id]; });
};

// Ce qui part, selon le contexte.
S.sharePayload = function(ctx) {
    var hb = S.heroBoards(), all = hb.heroes || [], o = {v: VERSION, k: ctx, gid: S.shareGid(), title: hb.title || ""};
    if (ctx == "game") {
        var g = S.stateCopy(S.state, false);
        if (g.scenario) { delete g.scenario.saved; delete g.scenario.heroBoards; }
        o.title = (g.scenario && g.scenario.title) || o.title;
        o.game = g; o.heroes = heroesCopy(all);
    } else if (ctx == "hero") {
        o.heroes = heroesCopy(all.filter(function(h) { return h.uid == hb.cur; }));
    } else o.heroes = heroesCopy(all);
    if (!o.title && S.state && S.state.scenario) o.title = S.state.scenario.title || "";
    o.ups = upsOf(o.heroes, o.game && o.game.river);
    return o;
};

// JSON → octets compressés (deflate brut ; sans CompressionStream, les octets restent tels quels, marqués non compressés).
var deflate = function(str) {
    var raw = new TextEncoder().encode(str);
    if (typeof CompressionStream == "undefined") return Promise.resolve({z: 0, bytes: raw});
    var cs = new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Response(cs).arrayBuffer().then(function(b) { return {z: 1, bytes: new Uint8Array(b)}; });
};
// Morceaux prêts pour le QR (chaîne d'octets bruts, mode « Byte » de qrcode-generator).
S.shareChunks = function(payload) {
    return deflate(JSON.stringify(payload)).then(function(r) {
        var n = Math.max(1, Math.ceil(r.bytes.length / CHUNK)), lot = Math.floor(Math.random() * 256), out = [];
        for (var i = 0; i < n; i++) {
            var part = r.bytes.subarray(i * CHUNK, (i + 1) * CHUNK), s = "SK" + String.fromCharCode(VERSION | (r.z ? 0x80 : 0), lot, i, n);
            for (var k = 0; k < part.length; k++) s += String.fromCharCode(part[k]);
            out.push(s);
        }
        return {chunks: out, size: r.bytes.length};
    });
};
// Un QR en SVG (modules noirs sur fond blanc : le contraste dont les lecteurs ont besoin, quel que soit le thème).
var qrSvg = function(data) {
    var q = qrcode(0, "L"); q.addData(data, "Byte"); q.make();
    var n = q.getModuleCount(), m = 4, d = "";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + (c + m) + " " + (r + m) + "h1v1h-1z";
    return "<svg class='sk-qrsvg' viewBox='0 0 " + (n + 2 * m) + " " + (n + 2 * m) + "' shape-rendering='crispEdges' aria-hidden='true'>"
        + "<rect width='100%' height='100%' fill='#fff'/><path d='" + d + "' fill='#000'/></svg>";
};

var shareTitle = function(ctx) {
    if (ctx == "game") return t("share_game");
    if (ctx == "hero") {
        var hb = S.heroBoards(), h = (hb.heroes || []).filter(function(x) { return x.uid == hb.cur; })[0];
        return t("share_hero", h ? S.heroDisplayName(h) : "");
    }
    return t("share_heroes");
};
var timer = null;
S.openShare = function(ctx) {
    if (typeof qrcode == "undefined") { S.toast(t("share_unavailable")); return; }
    var p = S.sharePayload(ctx);
    if (ctx != "game" && !p.heroes.length) { S.toast(t("share_nothing")); return; }
    S.shareChunks(p).then(function(r) {
        var n = r.chunks.length, what = ctx == "game" ? t("share_what_game", (p.game.river || []).length, p.heroes.length) : (p.heroes.length == 1 ? t("share_what_hero") : t("share_what_heroes", p.heroes.length));
        var h = "<div class='sk-share' data-n='" + n + "'>"
            + "<p class='sk-help'>" + e(what) + (p.title ? " — " + e(p.title) : "") + "</p>"
            + "<div class='sk-qrbox' role='img' aria-label='" + e(t("share_qr_label", n)) + "'>"
            + r.chunks.map(function(c, i) { return "<div class='sk-qr" + (i ? "" : " on") + "'>" + qrSvg(c) + "</div>"; }).join("") + "</div>"
            + (n > 1 ? "<div class='sk-qrdots' aria-live='off'>" + r.chunks.map(function(c, i) { return "<i" + (i ? "" : " class='on'") + "></i>"; }).join("")
                + "<span class='sk-qrcount'>1 / " + n + "</span></div><p class='sk-help'>" + e(t("share_series", n)) + "</p>" : "")
            + "<p class='sk-help'>" + e(t("share_how")) + "</p></div>";
        Nav.dialog(e(shareTitle(ctx)), h, null, []);
        clearInterval(timer);
        if (n > 1) {
            var k = 0;
            timer = setInterval(function() {
                var box = document.querySelector(".sk-share[data-n='" + n + "']");
                if (!box) { clearInterval(timer); timer = null; return; }
                k = (k + 1) % n;
                box.querySelectorAll(".sk-qr").forEach(function(x, i) { x.classList.toggle("on", i == k); });
                box.querySelectorAll(".sk-qrdots i").forEach(function(x, i) { x.classList.toggle("on", i == k); });
                var c = box.querySelector(".sk-qrcount"); if (c) c.textContent = (k + 1) + " / " + n;
            }, TICK);
        }
    }).catch(function() { S.toast(t("share_unavailable")); });
};
})();
