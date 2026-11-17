// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon ;
// le module reprend celles du Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell) et ajoute les fonds du livre (img/fond/).
//
// Animation de la partie : la cloche du dernier tour (alarme qui oscille et sonne), liée au réglage « Animations ».
// Les gemmes, jetons et tuiles du livre ont leurs propres animations (skelos_manuel.js).
(function() {
var S = Skelos;
var running = [], finishing = false;

var enabled = function() {
    if (S.prefs().noAnim || S.studio || !S.state) return false;
    return !(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
};
var track = function(a, done) {
    running.push(a);
    a.onfinish = a.oncancel = function() { running = running.filter(function(x) { return x !== a; }); if (done) done(); };
    return a;
};
var anim = function(el, frames, opts, done) {
    if (!el || !el.animate) { if (done) done(); return null; }
    return track(el.animate(frames, opts), done);
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
