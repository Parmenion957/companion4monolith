// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Ce module n'ajoute aucune image ni donnée de Monolith :
// il utilise celles déjà chargées par le Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell).
//
// Animations de la partie jouée (jamais en studio), liées au réglage « Animations », coché par défaut.
// Principe : juste avant de redessiner le plateau, on note la place de chaque tuile, pion et zone de gemmes
// (l'écran montre encore l'état précédent) ; après le rendu, chaque élément part de son ancienne place
// pour rejoindre la nouvelle. L'action est déjà enregistrée : une animation ne retarde jamais le jeu,
// et un appui sur l'écran la termine aussitôt.
(function() {
var S = Skelos;
var running = [], finishing = false;
var GEM_ZONES = {energy: ".sk-a-en .sk-pmain", fatigue: ".sk-a-fa .sk-pmain", move: ".sk-a-b1 .sk-pgems", reroll: ".sk-a-b2 .sk-pgems", defense: ".sk-a-b3 .sk-pgems", spell: ".sk-a-b4 .sk-pgems"};

var enabled = function() {
    if (S.prefs().noAnim || S.studio || !S.state) return false;
    return !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
};
var q = function(sel) { return S.root && S.root.querySelector(sel); };
var center = function(r) { return {x: r.left + r.width / 2, y: r.top + r.height / 2}; };
var track = function(a, done) {
    running.push(a);
    a.onfinish = a.oncancel = function() { running = running.filter(function(x) { return x !== a; }); if (done) done(); };
    return a;
};
var anim = function(el, frames, opts, done) {
    if (!el || !el.animate) { if (done) done(); return null; }
    return track(el.animate(frames, opts), done);
};
// Élément temporaire posé au-dessus du plateau (gemme en vol, tuile qui s'efface, pion qui disparaît).
var floating = function(node, rect) {
    node.style.position = "fixed"; node.style.left = rect.left + "px"; node.style.top = rect.top + "px";
    node.style.width = rect.width + "px"; node.style.height = rect.height + "px";
    node.style.margin = "0"; node.style.zIndex = "1700"; node.style.pointerEvents = "none";
    node.classList.add("sk-animfloat");
    document.body.appendChild(node);
    return node;
};

// État du plateau tel qu'il est affiché, relevé après chaque rendu.
var record = function() {
    var st = S.state; if (!st) { S._animLast = null; return; }
    var lp = {}; st.river.forEach(function(s) { lp[s.uid] = s.lp; });
    S._animLast = {energy: st.energy, fatigue: st.fatigue, boosts: JSON.parse(JSON.stringify(st.boosts || {})), turn: st.turn, phase: st.phase,
        acts: st.activations, mode: st.mode, lp: lp};
};

// Ce que montre l'écran juste avant le rendu.
var capture = function() {
    var r = S.root; if (!r || S.screen != "game" || !S._animLast || !enabled()) return null;
    var g = r.querySelector(".skelos-game"); if (!g || g.classList.contains("sk-studio")) return null;
    var rv = r.querySelector(".sk-river");
    var snap = {last: S._animLast, tiles: {}, zones: {}, cost: [], marks: [], river: rv ? rv.getBoundingClientRect() : null};
    r.querySelectorAll(".sk-river .sk-tilebox[data-uid]").forEach(function(b) {
        snap.tiles[b.dataset.uid] = {rect: b.getBoundingClientRect(), dead: b.classList.contains("dead"), node: b};
    });
    Object.keys(GEM_ZONES).forEach(function(k) { var z = r.querySelector(GEM_ZONES[k]); if (z) snap.zones[k] = z.getBoundingClientRect(); });
    r.querySelectorAll(".sk-river > .sk-slot").forEach(function(sl) { var c = sl.querySelector(".sk-costtok"); snap.cost.push(c ? c.getBoundingClientRect() : null); });
    r.querySelectorAll(".sk-actslots > :not(.sk-actempty)").forEach(function(m) { snap.marks.push({node: m, rect: m.getBoundingClientRect()}); });
    return snap;
};

// ---------- Tuiles ----------
var playTiles = function(snap, undo) {
    var st = S.state, seen = {};
    // Si toute la Rivière s'est décalée (panneau du dessus plus haut ou plus bas), ce n'est pas un mouvement des tuiles.
    var rv = S.root.querySelector(".sk-river"), nr0 = rv && snap.river ? rv.getBoundingClientRect() : null;
    var sx = nr0 ? nr0.left - snap.river.left : 0, sy = nr0 ? nr0.top - snap.river.top : 0;
    S.root.querySelectorAll(".sk-river .sk-tilebox[data-uid]").forEach(function(b) {
        var uid = b.dataset.uid, old = snap.tiles[uid]; seen[uid] = true;
        if (!old || uid == S._animSkip) return;
        var nr = b.getBoundingClientRect(), dx = old.rect.left + sx - nr.left, dy = old.rect.top + sy - nr.top;
        var moved = Math.abs(dx) + Math.abs(dy) > 2, flipped = !undo && old.dead != b.classList.contains("dead");
        var lifted = !undo && moved && st.highlight == uid && st.mode != "solo";
        var at = function(f, extra) { return "translate(" + (dx * f) + "px," + (dy * f) + "px)" + (extra || ""); };
        if (flipped) {
            // Mort ou renfort : la tuile se retourne sur place, puis rejoint sa nouvelle case.
            b.style.zIndex = "5";
            anim(b, [
                {transform: at(1, " perspective(700px) rotateY(0deg)")},
                {transform: at(1, " perspective(700px) rotateY(90deg)"), offset: .3},
                {transform: at(1, " perspective(700px) rotateY(0deg)"), offset: .6},
                {transform: "none"}
            ], {duration: moved ? 900 : 560, easing: "ease-in-out"}, function() { b.style.zIndex = ""; });
        } else if (lifted) {
            // Activation : la tuile se soulève, glisse au bout de la Rivière et se repose.
            b.style.zIndex = "6";
            anim(b, [
                {transform: at(1), boxShadow: "0 0 0 rgba(0,0,0,0)"},
                {transform: at(1, " translateY(-14px) scale(1.07)"), boxShadow: "0 16px 28px rgba(0,0,0,.5)", offset: .2},
                {transform: at(0, " translateY(-14px) scale(1.07)"), boxShadow: "0 16px 28px rgba(0,0,0,.5)", offset: .8},
                {transform: "none", boxShadow: "0 0 0 rgba(0,0,0,0)"}
            ], {duration: 700, easing: "ease-in-out"}, function() { b.style.zIndex = ""; });
        } else if (moved) {
            anim(b, [{transform: at(1)}, {transform: "none"}], {duration: undo ? 260 : 420, easing: "cubic-bezier(.2,.8,.2,1)", delay: undo ? 0 : 60});
        }
        // Points de vie : le cœur bat.
        if (!undo && snap.last.lp[uid] != null) {
            var s = S.slotByUid(uid);
            if (s && s.lp != snap.last.lp[uid]) anim(b.querySelector("[data-hp]"), [{transform: "scale(1)"}, {transform: "scale(1.4)", offset: .4}, {transform: "scale(1)"}], {duration: 380, easing: "ease-out"});
        }
    });
    // Dépollution : la tuile retirée rétrécit et s'efface.
    if (!undo) Object.keys(snap.tiles).forEach(function(uid) {
        if (seen[uid]) return;
        var old = snap.tiles[uid], ghost = floating(old.node.cloneNode(true), old.rect);
        anim(ghost, [{transform: "none", opacity: 1}, {transform: "scale(.4) rotate(-8deg)", opacity: 0}], {duration: 520, easing: "ease-in"}, function() { ghost.remove(); });
    });
};

// ---------- Gemmes ----------
var gemFlight = function(from, to, delay, vanish) {
    var img = document.createElement("img"); img.src = S.icon("gem"); img.alt = "";
    var size = 26, a = center(from), jx = (Math.random() - .5) * 14, jy = (Math.random() - .5) * 10;
    var node = floating(img, {left: a.x - size / 2 + jx, top: a.y - size / 2 + jy, width: size, height: size});
    node.style.opacity = "0";
    var frames;
    if (vanish) frames = [{transform: "none", opacity: 1}, {transform: "translateY(-50px) scale(.5)", opacity: 0}];
    else {
        var b = center(to), dx = b.x - a.x - jx, dy = b.y - a.y - jy, lift = -Math.min(90, 30 + Math.abs(dx) * .15);
        frames = [{transform: "translate(0,0) scale(.8)", opacity: 1}, {transform: "translate(" + dx / 2 + "px," + (dy / 2 + lift) + "px) scale(1.15)", opacity: 1, offset: .5},
            {transform: "translate(" + dx + "px," + dy + "px) scale(.9)", opacity: 1}];
    }
    anim(node, frames, {duration: vanish ? 520 : 480, delay: delay, easing: "ease-in-out", fill: "backwards"}, function() {
        node.remove();
        if (!vanish && !finishing && to.el) anim(to.el, [{transform: "scale(1)"}, {transform: "scale(1.18)", offset: .4}, {transform: "scale(1)"}], {duration: 220});
    });
};
var playGems = function(snap) {
    var st = S.state, last = snap.last; if (st.mode == "solo" || last.mode != st.mode) return;
    var now = {energy: st.energy, fatigue: st.fatigue}, before = {energy: last.energy, fatigue: last.fatigue};
    S.BOOSTS.forEach(function(k) { now[k] = st.boosts[k] || 0; before[k] = last.boosts[k] || 0; });
    var zone = function(k) { var r = snap.zones[k]; if (!r) return null; var el = S.root.querySelector(GEM_ZONES[k]); return {left: r.left, top: r.top, width: r.width, height: r.height, el: el}; };
    var t0 = 0, count = 0, CAP = 8;
    var fly = function(from, to, n, vanish) {
        for (var i = 0; i < n && count < CAP; i++, count++) gemFlight(zone(from), to ? zone(to) : null, t0 + count * 70, vanish);
    };
    // Tour de l'Overlord : les gemmes des améliorations rejoignent d'abord la Fatigue, puis la récupération remonte.
    var cleared = S._animCleared; S._animCleared = null;
    if (cleared) {
        S.BOOSTS.forEach(function(k) { if (before[k] > now[k]) { fly(k, "fatigue", before[k] - now[k]); before.fatigue += before[k] - now[k]; before[k] = now[k]; } });
        if (count) { t0 = 380 + count * 70; count = 0; }
    }
    var keys = ["energy", "fatigue"].concat(S.BOOSTS), out = [], inn = [];
    keys.forEach(function(k) { var d = now[k] - before[k]; if (d < 0) out.push({k: k, n: -d}); else if (d > 0) inn.push({k: k, n: d}); });
    // Les gemmes vont de la zone qui perd vers celle qui gagne (Énergie → Fatigue, Fatigue → Énergie, Énergie → amélioration).
    out.forEach(function(o) {
        inn.forEach(function(i) { var n = Math.min(o.n, i.n); if (n > 0) { fly(o.k, i.k, n); o.n -= n; i.n -= n; } });
        if (o.n > 0) fly(o.k, null, o.n, true);   // retirées du jeu (dépollution)
    });
};

// ---------- Pions, compte-tour, phase ----------
var playTokens = function(snap) {
    var st = S.state, last = snap.last, r = S.root;
    var marks = [].slice.call(r.querySelectorAll(".sk-actslots > :not(.sk-actempty)"));
    if (st.activations > last.acts && marks.length) {
        var m = marks[marks.length - 1], mr = m.getBoundingClientRect();
        var n = (st.actMarks || [])[(st.actMarks || []).length - 1];
        if (st.mode == "solo") {
            // Jeton tiré au sac : il tourne comme une pièce avant de se poser.
            anim(m, [{transform: "perspective(500px) rotateY(0deg) scale(1.6)", opacity: 0}, {transform: "perspective(500px) rotateY(540deg) scale(1.3)", opacity: 1, offset: .6}, {transform: "none", opacity: 1}],
                {duration: 650, easing: "ease-out"});
            var hb = st.highlight && r.querySelector(".sk-river .sk-tilebox[data-uid='" + st.highlight + "']"), hs = st.highlight && S.slotByUid(st.highlight);
            if (hb) anim(hb, hs && hs.dead ? [{transform: "none"}, {transform: "translateX(-6px)"}, {transform: "translateX(6px)"}, {transform: "translateX(-4px)"}, {transform: "none"}]
                : [{transform: "none", filter: "brightness(1)"}, {transform: "scale(1.05)", filter: "brightness(1.25)", offset: .5}, {transform: "none", filter: "brightness(1)"}], {duration: 480, delay: 450});
        } else {
            // Pion de rang : il part de la case payée et se pose dans le cercle d'activation.
            var from = n && snap.cost[n - 1];
            if (from) {
                var a = center(from), b = center(mr), dx = a.x - b.x, dy = a.y - b.y;
                anim(m, [{transform: "translate(" + dx + "px," + dy + "px) scale(1.2)"}, {transform: "translate(" + dx / 2 + "px," + (dy / 2 - 40) + "px) scale(1.3)", offset: .5},
                    {transform: "scale(.85)", offset: .85}, {transform: "none"}], {duration: 620, easing: "ease-in-out"});
            }
        }
    } else if (st.activations < last.acts && snap.marks.length) {
        // Nouveau tour : les pions du cercle s'effacent.
        snap.marks.forEach(function(x, i) {
            var g = floating(x.node.cloneNode(true), x.rect);
            anim(g, [{opacity: 1, transform: "none"}, {opacity: 0, transform: "scale(.6)"}], {duration: 360, delay: i * 60}, function() { g.remove(); });
        });
    }
    if (st.turn != last.turn) {
        var tb = r.querySelector("[data-turnkind='turn'] b");
        anim(tb, [{transform: "translateY(" + (st.turn > last.turn ? "-" : "") + "70%)", opacity: 0}, {transform: "none", opacity: 1}], {duration: 380, easing: "ease-out"});
        anim(r.querySelector("[data-turnkind='turn']"), [{filter: "drop-shadow(0 0 0 #ff7900)"}, {filter: "drop-shadow(0 0 10px #ff7900)", offset: .4}, {filter: "drop-shadow(0 0 0 #ff7900)"}], {duration: 700});
        // Dernier tour : le gong vibre et la cloche sonne, comme au dernier tour d'une course.
        if (st.turns && st.turn == st.turns && st.turn > last.turn) lastTurnBell(r);
        if (st.turns && st.turn > st.turns && st.turn > last.turn)
            anim(r.querySelector(".sk-a-tour"), [{transform: "none"}, {transform: "translateX(-7px)"}, {transform: "translateX(7px)"}, {transform: "translateX(-5px)"}, {transform: "translateX(5px)"}, {transform: "none"}], {duration: 500, delay: 300});
    }
    if (st.phase != last.phase)
        anim(r.querySelector(".sk-a-phase"), [{opacity: .15, transform: "translateY(8px)"}, {opacity: 1, transform: "none"}], {duration: 420, easing: "ease-out"});
};

// Cloche du dernier tour : quelques coups de cloche synthétisés (aucun fichier son), partiels inharmoniques qui s'éteignent.
var audio = null;
var bell = function() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
        audio = audio || new AC();
        if (audio.state == "suspended") audio.resume();
        var t0 = audio.currentTime + .05, out = audio.createGain();
        out.gain.value = .22; out.connect(audio.destination);
        [0, .32, .64].forEach(function(at, k) {
            [[1, 1, 1.6], [2.76, .45, 1.0], [5.4, .25, .6], [8.93, .12, .35]].forEach(function(p) {
                var o = audio.createOscillator(), g = audio.createGain(), t = t0 + at, f = 988 * p[0];
                o.type = "sine"; o.frequency.value = f;
                g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p[1] * (k == 2 ? 1 : .8), t + .006);
                g.gain.exponentialRampToValueAtTime(.0005, t + p[2] * (k == 2 ? 1.6 : .7));
                o.connect(g); g.connect(out); o.start(t); o.stop(t + p[2] * 1.7);
            });
        });
    } catch (x) {}
};
var lastTurnBell = function(r, el) {
    var gong = el || r.querySelector("[data-turnkind='turns']"), img = gong && (gong.tagName == "IMG" ? gong : gong.querySelector("img"));
    var frames = [{transform: "none"}];
    for (var i = 1; i <= 9; i++) frames.push({transform: "rotate(" + ((i % 2 ? 1 : -1) * (10 - i)) + "deg) scale(" + (1 + .012 * (10 - i)) + ")"});
    frames.push({transform: "none"});
    anim(img, frames, {duration: 1300, easing: "ease-out", delay: 250});
    anim(gong, [{filter: "drop-shadow(0 0 0 #ff7900)"}, {filter: "drop-shadow(0 0 12px #ff7900)", offset: .25}, {filter: "drop-shadow(0 0 0 #ff7900)"}], {duration: 1500, delay: 250});
    setTimeout(bell, 250);
};

// Livre manuel : même cloche sur l'alarme donnée (piste des tours ou cadre Tour réduit), si les animations sont actives.
S.lastTurnBell = function(el) { if (enabled() && el) lastTurnBell(S.root, el); };

// ---------- Branchements ----------
var baseRender = S.renderGame;
S.renderGame = function() {
    var snap = capture(), undo = S._animUndo;
    S._animUndo = false;
    baseRender.apply(S, arguments);
    record();
    if (!snap || S.screen != "game" || S.studio) return;
    try {
        playTiles(snap, undo);
        if (!undo) { playGems(snap); playTokens(snap); }
    } catch (x) { console.warn("Skelos animation", x); }
};
// Annuler : les tuiles reprennent leur place en glissant, sans rejouer les gemmes.
var baseUndo = S.undo;
S.undo = function() { S._animUndo = true; return baseUndo.apply(S, arguments); };
// Les gemmes des améliorations rejoignent la Fatigue avant la récupération du nouveau tour.
var baseClear = S.clearBoosts;
S.clearBoosts = function() { var n = baseClear.apply(S, arguments); if (n) S._animCleared = n; return n; };
// Un appui termine les animations en cours ; quitter le plateau aussi.
S.finishAnimations = function() {
    // Les fins d'animation arrivent un peu après : les rebonds des compteurs qu'elles déclencheraient sont ignorés.
    finishing = true; clearTimeout(S._animFinT);
    running.slice().forEach(function(a) { try { a.finish(); } catch (x) {} });
    S._animFinT = setTimeout(function() { finishing = false; }, 150);
    document.querySelectorAll(".sk-animfloat").forEach(function(n) { n.remove(); });
};
document.addEventListener("pointerdown", function() { if (running.length) S.finishAnimations(); }, true);
})();
