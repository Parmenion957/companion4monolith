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
// Plusieurs morceaux défilent tout seuls ; le lecteur (« Recevoir », caméra et jsQR) les rassemble dans n'importe quel ordre.
// Recevoir remplace toujours la partie en cours de l'appareil, quel que soit le contenu (partie, héros, un héros),
// après confirmation si une partie est engagée. jsQR (Cosmo Wolfe, licence Apache-2.0, lib/jsQR.js) n'est chargé qu'à l'ouverture.
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

var heroesCopy = function(list) { return JSON.parse(JSON.stringify(list || [])); };
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

// ---------- Recevoir ----------
var inflate = function(bytes, z) {
    if (!z) return Promise.resolve(new TextDecoder().decode(bytes));
    var ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(ds).text();
};
var loadJsQR = function() {
    if (window.jsQR) return Promise.resolve();
    return new Promise(function(ok, ko) {
        var sc = document.createElement("script"); sc.src = "skelos/lib/jsQR.js"; sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc);
    });
};
// Collecte des morceaux : un lot à la fois (un autre lot, c'est un autre partage : on repart de zéro).
var got = null;
var resetGot = function() { got = {lot: -1, n: 0, z: 0, parts: {}}; };
// Un QR lu (octets bruts). Renvoie null (pas un QR du module), {have, n} en cours, ou {done: Promise du contenu}.
S.receiveChunk = function(b) {
    if (!got) resetGot();
    if (!b || b.length < 6 || b[0] != 83 || b[1] != 75 || (b[2] & 0x7f) != VERSION) return null;
    var lot = b[3], i = b[4], n = b[5];
    if (lot != got.lot || n != got.n) { resetGot(); got.lot = lot; got.n = n; got.z = b[2] & 0x80; }
    got.parts[i] = b.slice(6);
    var have = Object.keys(got.parts).length;
    if (have < n) return {have: have, n: n};
    var len = 0, k; for (k = 0; k < n; k++) len += got.parts[k].length;
    var all = new Uint8Array(len), off = 0; for (k = 0; k < n; k++) { all.set(got.parts[k], off); off += got.parts[k].length; }
    var z = got.z; resetGot();
    return {have: n, n: n, done: inflate(all, z).then(function(txt) { return JSON.parse(txt); })};
};

var busy = function() {
    var st = S.state;
    return !!((st && ((st.river || []).length || (st.log || []).length > 1)) || (S.heroBoards().heroes || []).length);
};
// Remplace la partie de cet appareil par ce qui a été reçu.
S.applyShared = function(p) {
    if (!p || p.v != VERSION || !p.heroes) { S.toast(t("receive_bad")); return; }
    var go = function() {
        if (S.editing) S.closeEditor();
        // Les améliorations inconnues de cet appareil sont ajoutées à sa liste (une amélioration déjà connue reste telle quelle).
        var ups = S.upgrades(), known = {}; ups.forEach(function(u) { known[u.id] = 1; });
        (p.ups || []).forEach(function(u) { if (!known[u.id]) ups.push(u); });
        if ((p.ups || []).length) S.saveUpgrades(ups);
        S.studio = false; S.clearGame();
        var river = 0;
        if (p.k == "game" && p.game) {
            var g = p.game; g.campaign = null; g.log = g.log || [];
            S.state = g; S.state.origin = S.stateCopy(g); S.save();
            S.draft = S.scenarioFromState(); river = (g.river || []).length;
        }
        S.loadScenarioHeroes(p.heroes, p.title);
        var hb = S.heroBoards(); hb.gid = p.gid; hb.cur = p.k == "hero" && p.heroes.length == 1 ? p.heroes[0].uid : null;
        S.saveHeroBoards();
        S.showPartView(river ? "overlord" : "heroes");
        S.toast(p.k == "game" ? t("receive_done_game", p.title || t("untitled"), river, p.heroes.length)
            : p.heroes.length == 1 ? t("receive_done_hero", S.heroDisplayName(p.heroes[0])) : t("receive_done_heroes", p.heroes.length));
    };
    if (busy()) S.ask(t("receive_confirm"), t("receive_replace"), go); else go();
};

var scan = null;
var stopScan = function() {
    if (!scan) return;
    cancelAnimationFrame(scan.raf); clearTimeout(scan.to);
    if (scan.stream) scan.stream.getTracks().forEach(function(tr) { tr.stop(); });
    scan = null;
};
S.openReceive = function() {
    stopScan(); resetGot();
    var h = "<div class='sk-receive'><div class='sk-camwrap'><video class='sk-cam' playsinline muted autoplay></video><div class='sk-camaim' aria-hidden='true'></div></div>"
        + "<p class='sk-recvstate' aria-live='polite'>" + e(t("receive_starting")) + "</p>"
        + "<p class='sk-help'>" + e(t("receive_how")) + "</p></div>";
    Nav.dialog(e(t("receive_title")), h, function() { stopScan(); }, []);
    var box = document.querySelector(".sk-receive"), video = box.querySelector("video"), state = box.querySelector(".sk-recvstate");
    var say = function(msg) { state.textContent = msg; };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say(t(window.isSecureContext ? "receive_nocam" : "receive_https")); return; }
    scan = {};
    var me = scan, cv = document.createElement("canvas"), cx = cv.getContext("2d", {willReadFrequently: true}), done = false;
    var alive = function() { return scan === me && document.body.contains(video); };
    var tick = function() {
        if (!alive()) { if (scan === me) stopScan(); return; }
        if (video.readyState >= 2 && video.videoWidth) {
            var k = Math.min(1, 900 / Math.max(video.videoWidth, video.videoHeight)), w = Math.round(video.videoWidth * k), hh = Math.round(video.videoHeight * k);
            cv.width = w; cv.height = hh; cx.drawImage(video, 0, 0, w, hh);
            var r = jsQR(cx.getImageData(0, 0, w, hh).data, w, hh, {inversionAttempts: "dontInvert"});
            var c = r ? S.receiveChunk(r.binaryData) : null;
            if (r && !c) say(t("receive_foreign"));
            else if (c && !c.done) say(t("receive_progress", c.have, c.n));
            else if (c && c.done && !done) {
                done = true; say(t("receive_read"));
                c.done.then(function(p) { stopScan(); Nav.closeDialog(); S.applyShared(p); })
                    .catch(function() { done = false; say(t("receive_bad")); });
                return;
            }
        }
        me.to = setTimeout(function() { me.raf = requestAnimationFrame(tick); }, 120);
    };
    loadJsQR().then(function() {
        return navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false});
    }).then(function(stream) {
        if (!alive()) { stream.getTracks().forEach(function(tr) { tr.stop(); }); return; }
        me.stream = stream; video.srcObject = stream;
        var pl = video.play(); if (pl && pl.catch) pl.catch(function() {});
        say(t("receive_aim")); tick();
    }).catch(function(err) {
        say(t(err && err.name == "NotAllowedError" ? "receive_denied" : window.isSecureContext ? "receive_nocam" : "receive_https"));
    });
};
})();
