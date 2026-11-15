// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Ce module n'ajoute aucune image ni donnée de Monolith :
// il utilise celles déjà chargées par le Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell).
//
// Interface à la charte du Compagnon : jetons du jeu, commandes au-dessus des tuiles 6 à 8, étapes du tour,
// onglets, boîtes de dialogue plein écran, boutons − et +, descriptions des tuiles Événement, icônes du module.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };

// ---------- Icônes et jetons ----------
// Images du Compagnon, sauf mouvement, relance et défense active : créations originales du module (img/).
S.ICON_DEFAULTS = {
    // Mouvement, relance et défense active : icônes originales du module (créées par l'utilisateur).
    move: "skelos/img/icone_mouvement.webp",
    defense: "skelos/img/icone_defense.webp",
    reroll: "skelos/img/icone_relance.webp",
    spell: "data/skills/img/magic/spell_caster.webp",
    gem: "resources/img/gem_red.webp",
    time: "data/tokens/img/time.webp",
    alarm: "data/tokens/img/alarm.webp",
    tokenback: "data/tokens/img/marker.webp"
};
S.icon = function(k) { return S.asset(S.ICON_DEFAULTS[k]); };
// Les anciennes icônes personnalisées (mouvement, relance, défense active) sont remplacées par celles du module.
try { localStorage.removeItem(Application + "_SkelosIcons"); } catch (x) {}
S.marker = function(n) { return S.asset("data/tokens/img/marker-" + Math.max(1, Math.min(13, n)) + ".webp"); };

S.gems = function(n, cls) {
    var h = "", dim = cls == "off";
    for (var i = 0; i < Math.min(n, 14); i++) h += "<img class='sk-gemimg" + (dim ? " dim" : "") + "' src='" + S.icon("gem") + "' alt=''>";
    if (n > 14) h += "<span class='sk-gemmore'>+" + (n - 14) + "</span>";
    return h;
};
S.token = function(kind, value, extra, cls) {
    if (kind == "gem") return "<span class='sk-tokimg" + (cls == "dim" ? " dim" : "") + "'><img src='" + S.icon("gem") + "' alt=''><b>" + value + "</b></span>";
    if (kind == "hourglass") return "<span class='sk-tokimg sk-tokround'><img src='" + S.icon("time") + "' alt=''><b>" + value + "</b>" + (extra ? "<small>" + e(extra.replace(/\s/g, "")) + "</small>" : "") + "</span>";
    if (kind == "bag") return "<span class='sk-tokimg sk-tokround'><img src='" + S.icon("tokenback") + "' alt=''><b>" + value + "</b></span>";
    if (kind == "heroes") return "<span class='sk-recovtok'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 2.5 19.5 5v6.2c0 4.6-3.2 8.6-7.5 10.3C7.7 19.8 4.5 15.8 4.5 11.2V5z' fill='currentColor'/></svg><b>" + value + "</b></span>";
    // Récupération : une flèche vers la gauche (de la Fatigue vers l'Énergie disponible), le chiffre en gros dans la flèche.
    if (kind == "recover") return "<span class='sk-recovarrow'><svg viewBox='0 0 100 56' aria-hidden='true'><path d='M2 28 34 2v12h64v28H34v12z' fill='currentColor' stroke-linejoin='round'/></svg><b>" + value + "</b></span>";
    return "<span class='sk-recovtok'><b>" + value + "</b></span>";
};
// Cercles d'activation : le pion de rang payé (Aventure) ou le jeton tiré (Coop) prend la place d'un cercle vide.
S.activationSlots = function(used, max) {
    var st = S.state, solo = st && st.mode == "solo", marks = used ? ((st && st.actMarks) || []).slice(-used) : [];
    var h = "<span class='sk-actslots'>";
    for (var i = 0; i < max; i++) {
        var n = i < used ? marks[i - (used - marks.length)] : null;
        if (i >= used) h += "<span class='sk-actempty'></span>";
        else if (!n) h += "<img class='sk-actgem' src='" + S.icon("gem") + "' alt=''>";
        else if (solo) h += "<img class='sk-actgem sk-actmarker' src='" + S.marker(n) + "' alt='" + n + "'>";
        else h += S.rankToken(n, "sk-actgem sk-actrank");
    }
    return h + "</span>";
};

// Pion de coût : pion numéroté du jeu, cerclé de rouge avec une gemme quand la tuile choisie peut être payée.
// Rang d'une case de la Rivière : gemme rouge numérotée dans un anneau (composée en CSS avec la gemme du Compagnon).
// Les pions blancs numérotés restent pour les jetons tirés au sac et le suivi des activations.
S.rankToken = function(n, cls) {
    return "<span class='sk-rankgem" + (cls ? " " + cls : "") + "' role='img' aria-label='" + n + "'><img src='" + S.icon("gem") + "' alt=''><b>" + n + "</b></span>";
};
S.costToken = function(slot, i) {
    var img = S.rankToken(i + 1, "sk-costimg");
    if (!slot) return "<span class='sk-costtok sk-costimgwrap'>" + img + "</span>";
    var sel = slot.uid == S.selected, why = sel ? S.canActivate(slot) : null, armed = sel && !why;
    return "<span class='sk-costtok sk-costimgwrap" + (armed ? " armed" : "") + "' data-act='paycost' data-uid='" + slot.uid + "'"
        + (sel ? " role='button' tabindex='0' aria-label='" + e(armed ? t("activate_named", S.tileName(slot), i + 1) : why) + "'" : "") + ">"
        + img + (armed ? "<img class='sk-costgemimg' src='" + S.icon("gem") + "' alt=''>" : "") + "</span>";
};

// ---------- Panneau du plateau : grille de 8 colonnes calée sur la Rivière ----------
// Classique : Tour (1-2) · Mouvement, Relance, Défense active, Sort (3 à 6) · boutons (7-8)
//             Énergie (1-2) · Récupération (3) · Fatigue (4-5) · Phase en cours (6-7) · Tour de l'Overlord (8)
// Solo / coop : Tour (1-2) · Jetons joués (3 à 6) · boutons (7-8)
//             Jetons disponibles (1 à 3) · Héros en jeu (4-5) · Phase en cours (6-7) · Tour de l'Overlord (8)
var title = function(k) { return "<div class='sk-ptitle'>" + e(t(k)) + "</div>"; };

// Jeton du cadre Tour (sablier ou alarme) : − et + de part et d'autre en mode studio seulement.
S.turnTokenCode = function(kind) {
    var st = S.state, turn = kind == "turn", val = turn ? st.turn : (st.turns || "–"), open = !!S.studio;
    var minus = turn ? "turnminus" : "turnsminus", plus = turn ? "turnplus" : "turnsplus", tab = open ? 0 : -1;
    var label = turn ? t("turn") + " " + st.turn : (st.turns ? t("turn_limit") + " " + st.turns : t("turn_limit_none"));
    return "<span class='sk-ptok" + (open ? " editing" : "") + "' data-turnwrap='" + kind + "'>"
        + "<button class='sk-pstep' data-act='" + minus + "' tabindex='" + tab + "' aria-label='" + e(t(turn ? "aria_turn_prev" : "aria_limit_minus")) + "'>−</button>"
        + "<span class='sk-tokimg sk-tokround' data-turnkind='" + kind + "' role='img' aria-label='" + e(label) + "' title='" + e(label) + "'>"
        + "<img src='" + S.icon(turn ? "time" : "alarm") + "' alt=''><b>" + val + "</b></span>"
        + "<button class='sk-pstep' data-act='" + plus + "' tabindex='" + tab + "' aria-label='" + e(t(turn ? "aria_turn_next" : "aria_limit_plus")) + "'>+</button></span>";
};
S.turnBlockCode = function() {
    var st = S.state, last = st.turns && st.turn >= st.turns;
    var flag = !st.turns ? "" : st.turn > st.turns ? t("game_over_short") : st.turn == st.turns ? t("last_turn") : "";
    return "<div class='sk-p sk-a-tour" + (last ? " last" : "") + "'" + (flag ? " title='" + e(flag) + "'" : "") + ">" + title("turn")
        + "<div class='sk-ppair'>" + S.turnTokenCode("turn") + S.turnTokenCode("turns") + "</div>"
        + (flag ? "<span class='sk-vh'>" + e(flag) + "</span>" : "") + "</div>";
};

// Améliorations ponctuelles : un appui dépense une gemme ; compteur de gemmes sous l'icône.
S.boostBlockCode = function(k, n) {
    var st = S.state, cur = st.current && S.slotByUid(st.current), tile = cur && S.tileOf(cur), tip = t("boost_cost_" + k), cnt = st.boosts[k] || 0;
    if (k == "move" && cur && tile && !S.isEvent(cur) && st.phase == "overlord") tip = t("boost_ctx_short", parseInt(tile.movement, 10) || 0);
    return "<button class='sk-p sk-pboost sk-a-b" + n + "' data-act='boost' data-k='" + k + "' title='" + e(tip) + "' aria-label='" + e(t("boost_" + k) + " · " + cnt + " " + t("gems_word")) + "'>"
        + "<span class='sk-ptitle'>" + e(t("boost_" + k)) + "</span><img class='sk-pboostimg' src='" + S.icon(k) + "' alt=''>"
        + "<span class='sk-pgems" + (cnt ? "" : " zero") + "'><img src='" + S.icon("gem") + "' alt=''><b>" + cnt + "</b></span></button>";
};

// Bloc d'outils : Annuler · [Recommencer | Terminer] · Journal · Aide.
S.toolsBlockCode = function() {
    var b = function(act, icon, label, aria, off) {
        return "<button class='sk-ptool' data-act='" + act + "'" + (off ? " disabled" : "") + " title='" + e(t(aria)) + "' aria-label='" + e(t(aria)) + "'><i aria-hidden='true'>" + icon + "</i><span>" + e(t(label)) + "</span></button>";
    };
    return "<div class='sk-p sk-a-tools'>" + b("undo", "&#xf0e2;", "undo", "undo", !S.undoStack.length)
        + "<div class='sk-ptoolpair'>" + b("restart", "&#xf2f9;", "tool_restart", "restart_game") + b("end", "&#xf11e;", "tool_end", "menu_end", !!S.editing) + "</div>"
        + b("journal", "&#xf02d;", "log", "log") + b("help", "&#xf128;", "help", "help") + "</div>";
};

// Phase en cours : quatre étapes en grille 2×2 ; seule l'étape en cours est en gras.
S.phaseBlockCode = function() {
    var st = S.state, solo = st.mode == "solo", ov = st.phase != "heroes", pre = ov ? (solo ? "solo_short_" : "ov_short_") : "he_short_", cur = -1;
    if (st.phase == "overlord") cur = solo ? (st.highlight ? 3 : 2) : 3;
    return "<div class='sk-p sk-a-phase " + (ov ? "ov" : "he") + "' role='group' aria-label='" + e(t(ov ? "phase_title_overlord" : "phase_title_heroes")) + "'>"
        + "<div class='sk-pphase-t'>" + e(t(ov ? "phase_title_overlord" : "phase_title_heroes")) + "</div><ol>" + [1, 2, 3, 4].map(function(i) {
            return "<li" + (i == cur ? " class='cur' aria-current='step'" : "") + "><span class='sk-pnum' aria-hidden='true'>" + i + "</span><span>" + e(t(pre + i)) + "</span></li>";
        }).join("") + "</ol>" + (S.studio ? S.firstPlayerCode() : "") + "</div>";
};

// Tour de l'Overlord : Commencer / Terminer et emplacements d'activation.
S.overlordBlockCode = function() {
    var st = S.state, ov = st.phase == "overlord", max = st.mode == "solo" ? st.heroes : st.maxActivations;
    return "<div class='sk-p sk-a-ov'>" + title("steps_overlord_title")
        // En mode studio, le tour ne se joue pas : il faut d'abord sortir du mode.
        + "<button class='sk-turnbtn' data-act='" + (ov ? "oend" : "oturn") + "'" + (S.studio ? " disabled" : "") + " title='" + e(t(S.studio ? "studio_exit_first" : ov ? "end_overlord_turn" : "start_overlord_turn")) + "'>" + e(t(ov ? "btn_end" : "btn_start")) + "</button>"
        + (S.studio && st.mode != "solo" ? "<div class='sk-pctr sk-pmaxact'><button class='sk-pstep' data-act='studiomaxact' data-n='-1' aria-label='" + e(t("aria_act_minus")) + "'>−</button>" : "")
        + "<div class='sk-pacts' role='img' aria-label='" + e(t("activations") + " " + st.activations + " / " + max) + "'>" + S.activationSlots(st.activations, max) + "</div>"
        + (S.studio && st.mode != "solo" ? "<button class='sk-pstep' data-act='studiomaxact' data-n='1' aria-label='" + e(t("aria_act_plus")) + "'>+</button></div>" : "") + "</div>";
};

S.panelCode = function() {
    var st = S.state, solo = st.mode == "solo", h = "<div class='sk-panel" + (solo ? " solo" : "") + "'>";
    h += S.turnBlockCode();
    if (!solo) {
        h += S.BOOSTS.map(function(k, i) { return S.boostBlockCode(k, i + 1); }).join("");
        h += S.toolsBlockCode();
        h += "<div class='sk-p sk-a-en'>" + title("energy") + "<div class='sk-pmain'>" + S.token("gem", st.energy) + "</div><div class='sk-gems'>" + S.gems(st.energy, "on") + "</div>"
            + "<button class='sk-pbtn' data-act='xfer' data-dir='tofatigue'" + (st.energy ? "" : " disabled") + ">" + e(t("to_fatigue")) + "</button></div>";
        // Mode studio : − / + de la récupération, puis − / + du total de gemmes en dessous.
        if (S.studio) h += "<div class='sk-p sk-a-rec studio'>" + title("recovery")
            + "<div class='sk-pctr'><button class='sk-pstep' data-act='adj' data-f='recovery' data-n='-1' aria-label='" + e(t("aria_recovery_minus")) + "'>−</button>" + S.token("recover", st.recovery)
            + "<button class='sk-pstep' data-act='adj' data-f='recovery' data-n='1' aria-label='" + e(t("aria_recovery_plus")) + "'>+</button></div>"
            + title("gems_total_title")
            + "<div class='sk-pctr'><button class='sk-pstep' data-act='studiogem' data-n='-1' aria-label='" + e(t("gem_remove")) + "'>−</button>" + S.token("gem", S.gemTotal())
            + "<button class='sk-pstep' data-act='studiogem' data-n='1' aria-label='" + e(t("gem_add")) + "'>+</button></div></div>";
        else h += "<div class='sk-p sk-a-rec'>" + title("recovery") + "<div class='sk-pmain'>" + S.token("recover", st.recovery) + "</div>"
            + "<div class='sk-ptotal'>" + e(t("gem_total", S.gemTotal())) + "</div></div>";
        h += "<div class='sk-p sk-a-fa'>" + title("fatigue") + "<div class='sk-pmain'>" + S.token("gem", st.fatigue, "", "dim") + "</div><div class='sk-gems'>" + S.gems(st.fatigue, "off") + "</div>"
            + "<button class='sk-pbtn' data-act='xfer' data-dir='toenergy'" + (st.fatigue ? "" : " disabled") + ">" + e(t("to_energy")) + "</button></div>";
    } else {
        var slots = st.used.length + st.pool.length;
        h += "<div class='sk-p sk-a-played'>" + title("tokens_used") + "<div class='sk-pmarkers'>"
            + st.used.map(function(u) { var s = S.slotByUid(u); return "<img class='sk-pmarker' src='" + S.marker(s.token) + "' alt='" + s.token + "'>"; }).join("")
            + new Array(Math.max(0, slots - st.used.length) + 1).join("<span class='sk-pmarker empty'></span>") + "</div></div>";
        h += S.toolsBlockCode();
        h += "<div class='sk-p sk-a-pool'>" + title("tokens_pool") + "<div class='sk-prow'>" + S.token("bag", st.pool.length)
            + (st.phase == "overlord" ? "<button class='sk-btn sk-primary sk-pdraw' data-act='draw'>" + e(t("draw_token")) + "</button>" : "<span class='sk-phint'>" + e(t("draw_only_overlord")) + "</span>") + "</div></div>";
        h += "<div class='sk-p sk-a-heroes'>" + title("heroes") + "<div class='sk-prow'>"
            + (S.studio ? "<button class='sk-pstep' data-act='adj' data-f='heroes' data-n='-1' aria-label='" + e(t("aria_heroes_minus")) + "'>−</button>" : "") + S.token("heroes", st.heroes)
            + (S.studio ? "<button class='sk-pstep' data-act='adj' data-f='heroes' data-n='1' aria-label='" + e(t("aria_heroes_plus")) + "'>+</button>" : "") + "</div></div>";
    }
    h += S.phaseBlockCode() + S.overlordBlockCode();
    return h + "</div>";
};

// Limite de tours réglée depuis le plateau : même effet que dans les paramètres.
S.adjustTurns = function(d) {
    var st = S.state, v = Math.max(0, (st.turns || 0) + d);
    if (v == (st.turns || 0)) return;
    S.snapshot();
    st.turns = v; st.scenario.turns = v;
    S.save(); S.renderGame();
};
// Boutons propres au nouveau panneau.
var origBindGame = S.bindGame;
S.bindGame = function() {
    origBindGame.apply(S, arguments);
    S.root.querySelector(".skelos-game").addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-act]"); if (!b) return;
        switch (b.dataset.act) {
            case "turnsplus": S.adjustTurns(1); break;
            case "turnsminus": S.adjustTurns(-1); break;
            case "journal": S.openJournal(); break;
            case "help": S.openGameHelp(); break;
        }
    });
};

// Après le rendu du plateau : fonds des zones, jetons du mode solo, tuiles Événement, carte des événements.
var origRenderGame = S.renderGame;
S.renderGame = function() {
    origRenderGame.apply(S, arguments);
    var st = S.state, r = S.root;
    r.querySelectorAll(".sk-token").forEach(function(tk) {
        var n = parseInt(tk.textContent, 10); if (!n) return;
        tk.innerHTML = S.rankToken(n); tk.classList.add("sk-tokenimg");
    });
    st.river.forEach(function(s) {
        if (!S.isEvent(s)) return;
        var box = r.querySelector(".sk-tilebox[data-uid='" + s.uid + "']"); if (box) box.setAttribute("data-eventuid", s.uid);
    });
    S.placeTabs();
    S.syncFullscreenButton();
};
S.eventTexts = function() {
    var st = S.state, out = [];
    st.river.forEach(function(s, i) {
        if (!S.isEvent(s)) return;
        var txt = s.eventText || (out.length == 0 ? st.scenario.events || "" : "");
        var lines = String(txt).split("\n").map(function(x) { return x.trim(); }).filter(Boolean);
        if (lines.length) out.push({uid: s.uid, pos: i + 1, lines: lines});
    });
    return out;
};

// Info-bulle d'une tuile Événement : survol à la souris, appui long au doigt.
S.showEventTip = function(el) {
    var x = S.eventTexts().filter(function(v) { return v.uid == el.dataset.eventuid; })[0];
    var tip = S.root.querySelector("#sk-tip"); if (!tip) return;
    tip.innerHTML = "<b>" + e(t("event_n", x ? x.pos : "?")) + "</b>" + (x ? "<ul>" + x.lines.map(function(l) { return "<li>" + e(l) + "</li>"; }).join("") + "</ul>" : "<p>" + t("event_tip_none") + "</p>");
    tip.classList.add("on");
    var b = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
    tip.style.width = w + "px";
    var left = b.right + 8; if (left + w > window.innerWidth - 8) left = Math.max(8, b.left - w - 8);
    tip.style.left = left + "px"; tip.style.top = Math.max(8, Math.min(b.top, window.innerHeight - tip.offsetHeight - 8)) + "px";
};
S.bindEventTips = function(root) {
    var timer = null, target = null, sx = 0, sy = 0;
    root.addEventListener("mouseover", function(ev) { if (S._lastPointer && S._lastPointer != "mouse") return; var el = ev.target.closest("[data-eventuid]"); if (el) S.showEventTip(el); });
    root.addEventListener("pointerdown", function(ev) {
        S._lastPointer = ev.pointerType;
        if (ev.pointerType == "mouse") return;
        target = ev.target.closest("[data-eventuid]"); if (!target || ev.target.closest("[data-skill], [data-hpwrap]")) return;
        sx = ev.clientX; sy = ev.clientY; clearTimeout(timer);
        timer = setTimeout(function() { S._suppressClick = true; S.showEventTip(target); }, 450);
    });
    root.addEventListener("pointermove", function(ev) { if (timer && (Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10)) { clearTimeout(timer); timer = null; } });
    ["pointerup", "pointercancel"].forEach(function(n) { root.addEventListener(n, function() { clearTimeout(timer); timer = null; }); });
};

// ---------- Préparation : dialogue plein écran, boutons − et +, tuiles Événement ----------
var origRenderSetup = S.renderSetup;
S.renderSetup = function() {
    origRenderSetup.apply(S, arguments);
    S.enhanceSetup();
};
var ACT_ICONS = {start: "&#xf04b;", savescen: "&#xf0c7;", prepsave: "&#xf0c7;"};
S.enhanceSetup = function() {
    var r = S.root, s = r.querySelector(".skelos-setup"); if (!s) return;
    var rv = S.draft.river;
    // En-tête de dialogue : retour, titre, actions en icônes.
    var head = s.querySelector(".sk-head"), back = head.querySelector("[data-act]"), title = head.querySelector("h1").textContent;
    var acts = s.querySelector(".sk-actions"), icons = "";
    if (acts) {
        acts.querySelectorAll("[data-act]").forEach(function(b) {
            var a = b.dataset.act; if (!ACT_ICONS[a]) return;
            icons += "<button class='sk-dlgact" + (a == "start" ? " primary" : "") + "' data-act='" + a + "' title='" + e(b.textContent) + "' aria-label='" + e(b.textContent) + "'>" + ACT_ICONS[a] + "</button>";
        });
        acts.remove();
    }
    head.outerHTML = "<div class='sk-dlghead'><button class='sk-dlgback' data-act='" + back.dataset.act + "' title='" + e(back.textContent.replace("← ", "")) + "' aria-label='" + e(back.textContent.replace("← ", "")) + "'>&#xf060;</button><h1>" + e(title) + "</h1>" + icons + "</div>";
    s.classList.add("sk-dialogscreen");
    // Une description par tuile Événement, à la place du champ d'événements général.
    var evLabel = s.querySelector("textarea[name=events]");
    if (evLabel) {
        var lab = evLabel.closest("label"), general = S.draft.events || "", first = true;
        var h = "<div class='sk-wide sk-evsection'><h2>" + t("event_tiles") + "</h2><p class='sk-help'>" + t("event_tiles_help") + "</p>";
        var any = false;
        rv.forEach(function(sl, i) {
            if (!S.isEvent(sl)) return;
            any = true;
            var val = sl.eventText != null && sl.eventText !== "" ? sl.eventText : (first ? general : "");
            first = false;
            h += "<div class='sk-evrow'><div class='sk-evthumb sk-tilebox'>" + S.tileCode(sl) + "</div><label class='sk-evfield'>" + e(t("event_n", i + 1))
                + "<textarea data-evi='" + i + "' rows='3' placeholder='" + e(t("events_placeholder")) + "'>" + e(val) + "</textarea></label></div>";
        });
        if (!any) h += "<p class='sk-help'>" + t("event_tiles_none") + "</p>";
        lab.outerHTML = h + "</div>";
    }
    S.addSteppers(s);
    S.syncDialogMode();
};
// Boutons − et + autour de chaque champ numérique.
S.addSteppers = function(scope) {
    scope.querySelectorAll("input[type=number]").forEach(function(inp) {
        if (inp.parentNode.classList.contains("sk-step")) return;
        var w = document.createElement("span"); w.className = "sk-step";
        inp.parentNode.insertBefore(w, inp);
        w.innerHTML = "<button type='button' class='sk-stepbtn' data-step='-1' aria-label='" + e(t("step_minus")) + "'>−</button>";
        w.appendChild(inp);
        w.insertAdjacentHTML("beforeend", "<button type='button' class='sk-stepbtn' data-step='1' aria-label='" + e(t("step_plus")) + "'>+</button>");
    });
};
var origReadForm = S.readForm;
S.readForm = function() {
    origReadForm.apply(S, arguments);
    var rv = S.draft.river;
    S.root.querySelectorAll("textarea[data-evi]").forEach(function(ta) { var sl = rv[+ta.dataset.evi]; if (sl) sl.eventText = ta.value; });
};

// ---------- Onglets ----------
// Toujours visibles (plateau compris, même en plein écran), dessinés comme ceux des autres modules du Compagnon.
var TABS = [["home", "tab_partie"], ["scenarios", "tab_scenarios"], ["campaigns", "tab_campaigns"]];
var TAB_OF = {home: "home", game: "home", free: "home", scenarios: "scenarios", campaigns: "campaigns", campaign: "campaigns"};
S.tabsCode = function(active) {
    return "<nav class='sk-tabs' role='tablist' style='--sk-ntabs:" + TABS.length + "'>" + TABS.map(function(x) {
        return "<button role='tab' class='sk-tabbtn" + (x[0] == active ? " on" : "") + "' aria-selected='" + (x[0] == active) + "' data-nav='" + x[0] + "'>" + t(x[1]) + "</button>";
    }).join("") + "</nav>";
};
// Pose la barre d'onglets en tête du module, hors de l'écran qui défile.
S.placeTabs = function() {
    if (!S.root) return;
    var old = S.root.querySelector(":scope > .sk-tabs"); if (old) old.remove();
    var tab = S.screen == "game" && S.editing ? (S.editing.cid ? "campaigns" : "scenarios") : TAB_OF[S.screen]; if (!tab) return;
    S.root.insertAdjacentHTML("afterbegin", S.tabsCode(tab));
    var scr = S.root.querySelector(".sk-screen, .skelos-game"); if (scr) scr.classList.add("sk-tabbed");
};
var origMount = S.mount;
S.mount = function(html) {
    origMount.call(S, html);
    var scr = S.root.querySelector(".sk-screen");
    if (TAB_OF[S.screen] && scr) {
        var hb = scr.querySelector(".sk-headblk [data-nav='home']");
        if (hb) { var blk = hb.closest(".sk-headblk"); if (blk.querySelectorAll("*").length <= 3) blk.remove(); else hb.remove(); }
    }
    S.placeTabs();
    S.syncFullscreenButton();
};
var origNav = S.navClick;
S.navClick = function(ev) {
    var n = ev.target.closest("[data-nav]");
    if (n && S.editing) {
        var ecid = S.editing.cid;
        S.leaveEditor(function() { if (ecid && n.dataset.nav == "campaigns") S.renderCampaign(ecid); else S.navClick(ev); });
        return;
    }
    if (n && n.dataset.nav == "home") { S.renderHome(); return; }
    if (n && n.dataset.nav == "scenarios") { S.renderScenarios(); return; }
    var f = ev.target.closest("[data-fab]");
    if (f) { if (f.dataset.fab == "scenario") S.newScenario(); else if (f.dataset.fab == "campaign") S.newCampaign(); else S.openUpgradeEditor(null, function() { S.renderUpgrades(); }); return; }
    origNav.call(S, ev);
};
// Onglet Partie : directement le plateau ; sans partie en cours, une partie vide aux valeurs par défaut.
S.renderHome = function() {
    S.ctx = null;
    if (S.state) { S.renderGame(); return; }
    S.draft = S.blankScenario();
    S.startGame("blank");
};

// ---------- Onglet Scénarios ----------
// Chaque scénario a un identifiant (sid), une origine (« user » ou, plus tard, « official ») et ses dates.
var nowIso = function() { return new Date().toISOString(); };
var newSid = function() { return "sc" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
S.scenarioList = function() {
    var l = S.scenarios(), changed = false;
    l.forEach(function(sc) {
        if (!sc.sid) { sc.sid = newSid(); changed = true; }
        if (!sc.source) { sc.source = "user"; changed = true; }
    });
    if (changed) S.saveScenarios(l);
    return l;
};
// Enregistrement depuis la disquette : même scénario (sid) remplacé ; un scénario officiel modifié devient personnel.
S.saveScenarioCopy = function(d) {
    var list = S.scenarioList(), copy = JSON.parse(JSON.stringify(d)), now = nowIso();
    var idx = copy.sid ? list.findIndex(function(x) { return x.sid == copy.sid; }) : -1;
    if (idx < 0) idx = list.findIndex(function(x) { return x.title && x.title == copy.title && x.source != "official"; });
    if (idx >= 0) { copy.sid = list[idx].sid; copy.created = list[idx].created || now; }
    else { copy.sid = newSid(); copy.created = now; }
    copy.source = "user"; copy.updated = now;
    if (copy.saved) copy.saved.scenario.sid = copy.sid;
    if (S.state && S.state.scenario) S.state.scenario.sid = copy.sid;
    if (idx >= 0) list[idx] = copy; else list.push(copy);
    S.saveScenarios(list); S.toast(t("scenario_saved"));
};
var fmtDay = function(iso) { return S.fmtDay(iso); };

// Miniature de la Rivière : les 8 cases, l'illustration de chaque tuile sous son jeton de rang.
S.riverThumbCode = function(sc) {
    var st = sc.saved, river = st ? st.river : (sc.river || []), h = "<div class='sk-sriver' aria-hidden='true'>";
    for (var i = 0; i < S.RIVER_SIZE; i++) {
        var s = river[i], tile = s && S.tileOf(s);
        h += "<span class='sk-scell'>" + (tile ? S.rankToken(i + 1, "sk-srank") : "<span class='sk-srank sk-srank-empty'></span>")
            + "<span class='sk-sslot" + (s && s.dead ? " dead" : "") + "'>" + (tile ? "<img src='" + S.asset(s.img || tile.image) + "' alt='' loading='lazy'>" : "") + "</span></span>";
    }
    return h + "</div>";
};
S.scenarioCardCode = function(sc, i) {
    var st = sc.saved, river = st ? st.river : (sc.river || []), mode = st ? st.mode : sc.mode;
    var ev = river.filter(function(x) { return x.tileId == "event"; }).length, official = sc.source == "official";
    var running = st && (st.turn > 0 || st.activations > 0 || st.phase == "overlord");
    var info = [t(mode == "solo" ? "mode_solo" : "mode_classic"), t("tiles_n", river.length), t("turns_n", (st ? st.turns : sc.turns) || "–")];
    if (ev) info.push(t("event_tiles_n", ev));
    var dates = [];
    if (sc.created) dates.push(t("created_on", fmtDay(sc.created)));
    if (sc.updated && sc.updated != sc.created) dates.push(t("updated_on", fmtDay(sc.updated)));
    var ico = function(act, glyph, label, cls) {
        return "<button class='sk-iconbtn sk-scact" + (cls ? " " + cls : "") + "' data-sc='" + act + "' data-i='" + i + "' title='" + e(label) + "' aria-label='" + e(label + " : " + (sc.title || "—")) + "'>" + glyph + "</button>";
    };
    return "<article class='sk-scard sk-cardlink' data-sc='edit' data-i='" + i + "' tabindex='0' role='button' aria-label='" + e(t("open") + " : " + (sc.title || "—")) + "'>"
        + "<div class='sk-scard-head'><h3>" + e(sc.title || t("untitled")) + "</h3>"
        // Origine : l'icône seule (le libellé reste en info-bulle) ; partie en cours : sablier et « tour / limite ».
        + (running ? "<span class='sk-sbadge running' role='img' title='" + e(t("game_running", st.turn)) + "' aria-label='" + e(t("game_running", st.turn)) + "'><img src='" + S.icon("time") + "' alt=''>" + st.turn + (st.turns ? "/" + st.turns : "") + "</span>" : "")
        + "<span class='sk-sbadge sk-sicon " + (official ? "official" : "user") + "' role='img' title='" + e(t(official ? "source_official" : "source_user")) + "' aria-label='" + e(t(official ? "source_official" : "source_user")) + "'><i aria-hidden='true'>" + (official ? "&#xf02d;" : "&#xf007;") + "</i></span></div>"
        + "<p class='sk-sinfo'>" + e(info.join(" · ")) + "</p>"
        + (dates.length ? "<p class='sk-sdates'>" + e(dates.join(" · ")) + "</p>" : "")
        + S.riverThumbCode(sc)
        + "<div class='sk-scard-acts'><button class='sk-btn sk-primary' data-sc='play' data-i='" + i + "'>" + e(t("play")) + "</button>"
        + "<span class='sk-scard-sp'></span>"
        + ico("dup", "&#xf0c5;", t("duplicate"))
        + "</div></article>";
};
// Pêle-mêle de l'écran vide : illustrations de tuiles du Compagnon en éventail, comme les autres modules.
S.emptyScenariosCode = function(filtered) {
    if (filtered) return "<p class='sk-snone'>" + e(t("no_scenario_match")) + "</p>";
    var ids = ["pict-hunters", "zogar-sag", "thak", "giant-snake", "hyenas"], imgs = "";
    ids.forEach(function(id, k) { var tl = S.tileById(id); if (tl) imgs += "<img class='p" + k + "' src='" + S.asset(tl.image) + "' alt=''>"; });
    return "<div class='sk-sempty'><div class='sk-pelemele' aria-hidden='true'>" + imgs + "</div><p>" + e(t("no_scenario")) + "<br>" + e(t("no_scenario_hint")) + "</p></div>";
};
// Bouton flottant au style du Compagnon (pastille avec libellé, réduite à « + » sur téléphone).
S.floatingCode = function(fab, label) {
    return "<ul class='floatingactions sk-floatbar'><li><a class='sk-fabadd' href='javascript:void(0);' role='button' data-fab='" + fab + "' title='" + e(label) + "'><span>" + e(label) + "</span></a></li></ul>";
};

// Panneau de filtres des onglets Scénarios et Campagnes, sur le modèle de l'encyclopédie du Compagnon :
// colonne à gauche sur tablette, panneau caché sur téléphone, ouvert par le bouton loupe au-dessus du bouton +.
S.filterPanelCode = function(input, groups) {
    return "<aside class='sk-filters-side sk-sfilters' aria-label='" + e(t("search")) + "'><h5>" + t("keyword") + "</h5>" + input
        + groups.map(function(g) { return "<h5>" + e(g[0]) + "</h5>" + g[1]; }).join("")
        + "<button class='sk-btn sk-filtclose' data-filt='close'>" + e(t("close")) + "</button></aside>";
};
S.filterExtrasCode = function() {
    return "<div class='sk-filtveil' data-filt='close'></div>"
        + "<ul class='floatingactions sk-floatbar sk-searchbar'><li><a class='encycloppedia-search-icon' href='javascript:void(0);' role='button' data-filt='open' title='" + e(t("search")) + "' aria-label='" + e(t("search")) + "'></a></li></ul>";
};
S.bindFilterPanel = function() {
    if (S._filtRoot == S.root) return;
    S._filtRoot = S.root;
    S.root.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-filt]"), scr = S.root.querySelector(".sk-screen"); if (!b || !scr) return;
        ev.preventDefault();
        scr.classList.toggle("sk-filtopen", b.dataset.filt == "open");
    });
};
S.renderScenarios = function() {
    S.screen = "scenarios"; S.ctx = null;
    var list = S.scenarioList(), pr = S.prefs();
    var seg = function(attr, cur, opts, label) {
        return "<div class='sk-seg sk-sseg' role='radiogroup' aria-label='" + e(t(label)) + "'>" + opts.map(function(m) {
            return "<button " + attr + "='" + m[0] + "' class='" + (cur == m[0] ? "sk-on" : "") + "' role='radio' aria-checked='" + (cur == m[0]) + "'>" + e(t(m[1])) + "</button>"; }).join("") + "</div>";
    };
    var h = "<div class='sk-scols'>" + S.filterPanelCode("<input type='search' class='sk-in sk-ssearch' id='sk-sq' placeholder='" + e(t("search_scenario")) + "' aria-label='" + e(t("search_scenario")) + "' value='" + e(pr.scenQ || "") + "'>",
            [[t("filter_mode"), seg("data-smode", pr.scenMode || "", [["", "all_modes"], ["classic", "mode_classic"], ["solo", "mode_solo"]], "filter_mode")],
             [t("sort_by"), seg("data-ssort", pr.scenSort || "recent", [["recent", "sort_recent"], ["alpha", "sort_alpha"]], "sort_by")]])
        + "<div id='sk-slist' class='sk-slist'></div></div>" + S.filterExtrasCode() + S.floatingCode("scenario", t("new_scenario"));
    origMount.call(S, "<div class='skelos-game sk-screen sk-scen'><div class='sk-board'>" + h + "</div></div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>");
    S.placeTabs(); S.bindFilterPanel();
    var draw = function() {
        var q = S.norm(pr.scenQ || ""), m = pr.scenMode || "", sort = pr.scenSort || "recent";
        var rows = list.map(function(sc, i) { return {sc: sc, i: i}; }).filter(function(x) {
            var mode = x.sc.saved ? x.sc.saved.mode : x.sc.mode;
            return (!q || S.norm(x.sc.title || "").indexOf(q) >= 0) && (!m || mode == m);
        });
        rows.sort(sort == "alpha"
            ? function(a, b) { return (a.sc.title || "").localeCompare(b.sc.title || "", undefined, {sensitivity: "base"}); }
            : function(a, b) { return (b.sc.updated || b.sc.created || "").localeCompare(a.sc.updated || a.sc.created || "") || b.i - a.i; });
        S.root.querySelector("#sk-slist").innerHTML = rows.length ? rows.map(function(x) { return S.scenarioCardCode(x.sc, x.i); }).join("") : S.emptyScenariosCode(list.length > 0);
    };
    draw(); S.bindCardKeys();
    S.root.querySelector("#sk-sq").addEventListener("input", function(ev) { pr.scenQ = ev.target.value; S.savePrefs(); draw(); });
    var pick = function(attr, key, b) {
        pr[key] = b.getAttribute(attr); S.savePrefs();
        S.root.querySelectorAll("[" + attr + "]").forEach(function(x) { x.classList.toggle("sk-on", x == b); x.setAttribute("aria-checked", x == b); });
        draw();
    };
    S.screenClick = function(ev) {
        var m = ev.target.closest("[data-smode]"); if (m) { pick("data-smode", "scenMode", m); return; }
        var so = ev.target.closest("[data-ssort]"); if (so) { pick("data-ssort", "scenSort", so); return; }
        var b = ev.target.closest("[data-sc]"); if (!b) return;
        var i = +b.dataset.i, sc = list[i]; if (!sc) return;
        switch (b.dataset.sc) {
            case "play": S.playScenario(sc); break;
            case "edit": S.openEditor(sc); break;
            case "dup":
                var c = JSON.parse(JSON.stringify(sc)), now = nowIso();
                c.sid = newSid(); c.source = "user"; c.created = now; c.updated = now;
                c.title = t("copy_of", sc.title || t("untitled"));
                if (c.saved) { c.saved.scenario.sid = c.sid; c.saved.scenario.title = c.title; }
                var l = S.scenarioList(); l.push(c); S.saveScenarios(l);
                S.toast(t("scenario_duplicated")); S.renderScenarios(); break;
            case "del":
                S.ask(t(sc.source == "official" ? "confirm_delete_official" : "confirm_delete_scenario", sc.title || t("untitled")), t("delete"), function() {
                    var l2 = S.scenarioList().filter(function(x) { return x.sid != sc.sid; }); S.saveScenarios(l2); S.renderScenarios();
                });
                break;
        }
    };
};
// Jouer : le scénario devient la partie en cours (confirmation s'il y en a une).
S.playScenario = function(sc) {
    var go = function() {
        S.clearGame(); S.ctx = null;
        S.draft = JSON.parse(JSON.stringify(sc));
        S.startGame(true);
        if (S.state) { S.state.scenario.sid = sc.sid; S.save(); }
    };
    if (S.state && (S.state.river.length || S.state.log.length > 1)) S.ask(t("confirm_new"), t("confirm_new_yes"), go); else go();
};

// ---------- Éditeur de scénario ----------
// Même plateau, dans l'onglet Scénarios, en mode studio verrouillé. La partie en cours est mise de côté
// et n'est jamais touchée : rien n'est écrit dans la sauvegarde de la partie tant que l'éditeur est ouvert.
S.editing = null;
S.openEditor = function(sc) {
    if (!S.editing) S._gameBackup = {state: S.state, undo: S.undoStack, selected: S.selected};
    S.editing = {sid: sc ? sc.sid : null, dirty: false};
    S.ctx = null; S.selected = null;
    S.draft = sc ? JSON.parse(JSON.stringify(sc)) : S.blankScenario();
    S.studio = true;
    S.startGame(S.draft.river.length || S.draft.saved ? true : "blank");
    if (S.state && sc) S.state.scenario.sid = sc.sid;
    S.editing.dirty = false;
    S.renderGame();
};
S.closeEditor = function() {
    var b = S._gameBackup || {};
    S.state = b.state || null; S.undoStack = b.undo || []; S.selected = b.selected || null;
    S.editing = null; S._gameBackup = null; S.studio = false; S._hpOpen = null;
};
// Quitter l'éditeur (changement d'onglet) : confirmation si des modifications ne sont pas enregistrées.
S.leaveEditor = function(next) {
    var go = function() { S.closeEditor(); next(); };
    if (S.editing && S.editing.dirty) S.ask(t("confirm_leave_editor"), t("leave_editor_yes"), go); else go();
};
var origSaveEd = S.save;
S.save = function() {
    var st = S.state;
    if (S.editing) {
        if (st && !st.turn && !st.activations) st.origin = S.stateCopy(st);
        S.editing.dirty = true;
        return;
    }
    return origSaveEd.apply(S, arguments);
};
// Nouveau scénario : éditeur sur un plateau vide.
S.newScenario = function() { S.openEditor(null); };

// Onglet Améliorations : l'encyclopédie locale, avec le panneau de filtres du Compagnon.
S.renderUpgrades = function() {
    S.screen = "upgrades";
    var pr = S.prefs(), f = pr.upFilter || {q: "", arch: [], usage: []}, all = S.upgrades();
    var count = function(key, val) { return all.filter(function(u) { return (key == "arch" ? (u.archetype || "") : (u.usage || "perm")) == val; }).length; };
    var archs = [""].concat(["guerrier", "voleur", "sorcier", "mercenaire"].map(function(a) { return t("arch_" + a); }));
    var side = "<aside class='sk-filters-side'><h5>" + t("keyword") + "</h5><input type='search' class='sk-in' id='sk-uq' value='" + e(f.q || "") + "'>"
        + "<h5>" + t("archetype") + "</h5>" + archs.map(function(a) { return "<label><input type='checkbox' data-farch='" + e(a) + "'" + (f.arch.indexOf(a) >= 0 ? " checked" : "") + "> " + e(a || t("all_archetypes")) + " (" + count("arch", a) + ")</label>"; }).join("")
        + "<h5>" + t("usage") + "</h5>" + ["perm", "scenario", "once"].map(function(u) { return "<label><input type='checkbox' data-fuse='" + u + "'" + (f.usage.indexOf(u) >= 0 ? " checked" : "") + "> " + t("usage_" + u) + " (" + count("usage", u) + ")</label>"; }).join("")
        + "<h5>" + t("data") + "</h5><button class='sk-linkbtn' data-up='imp'>" + t("import_upgrades") + "</button><br><button class='sk-linkbtn' data-up='exp'>" + t("export_upgrades") + "</button></aside>";
    var list = all.filter(function(u) {
        if (f.q && S.norm(u.name + " " + (u.effect || "")).indexOf(S.norm(f.q)) < 0) return false;
        if (f.arch.length && f.arch.indexOf(u.archetype || "") < 0) return false;
        if (f.usage.length && f.usage.indexOf(u.usage || "perm") < 0) return false;
        return true;
    });
    var grid = "<div class='sk-picker sk-ipicker sk-upgrid'>" + (list.length ? list.map(function(u) { return S.itemCardCode({kind: "up", ref: u.id, name: u.name, data: u}); }).join("") : "<p class='sk-help'>" + t(all.length ? "no_tile_found" : "no_upgrade") + "</p>") + "</div>";
    origMount.call(S, "<div class='skelos-game sk-screen sk-ups'><div class='sk-board'><div class='sk-upcols'>" + side + grid + "</div></div></div>"
        + "<button class='sk-fab' data-fab='upgrade' title='" + e(t("create_upgrade")) + "' aria-label='" + e(t("create_upgrade")) + "'>&#xf067;</button>"
        + "<div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>");
    var scr = S.root.querySelector(".sk-screen"); scr.classList.add("sk-tabbed"); scr.insertAdjacentHTML("afterbegin", S.tabsCode("upgrades"));
    var fab = S.root.querySelector(".sk-fab"); fab.addEventListener("click", function() { S.openUpgradeEditor(null, function() { S.renderUpgrades(); }); });
    var save = function() { pr.upFilter = f; S.savePrefs(); };
    S.root.querySelector("#sk-uq").addEventListener("change", function(ev) { f.q = ev.target.value; save(); S.renderUpgrades(); });
    scr.addEventListener("change", function(ev) {
        var x = ev.target;
        if (x.dataset.farch != null) { var k = f.arch.indexOf(x.dataset.farch); if (x.checked && k < 0) f.arch.push(x.dataset.farch); if (!x.checked && k >= 0) f.arch.splice(k, 1); save(); S.renderUpgrades(); }
        if (x.dataset.fuse != null) { var j = f.usage.indexOf(x.dataset.fuse); if (x.checked && j < 0) f.usage.push(x.dataset.fuse); if (!x.checked && j >= 0) f.usage.splice(j, 1); save(); S.renderUpgrades(); }
    });
    S.screenClick = function(ev) {
        var c = ev.target.closest(".sk-icard[data-ref]"); if (c) { S.showCard("up:" + c.dataset.ref); return; }
        var b = ev.target.closest("[data-up]"); if (!b) return;
        if (b.dataset.up == "exp") S.exportData({upgrades: S.upgrades()}, "skelos_ameliorations.json");
        else S.importData(function(o) {
            var add = o.upgrades || (Array.isArray(o) ? o : []), l = S.upgrades();
            add.forEach(function(u) { if (u && u.name && !l.some(function(x) { return x.id == u.id; })) l.push(u); });
            S.saveUpgrades(l); S.toast(t("import_done")); S.renderUpgrades();
        });
    };
};

// ---------- Réglages : icônes personnalisées ----------
var origSettings = S.renderSettings;
S.renderSettings = function() {
    origSettings.apply(S, arguments);
    S.screen = "settings";
    var scr = S.root.querySelector(".sk-screen"); if (!scr) return;
    scr.classList.add("sk-dialogscreen");
    var hb = scr.querySelector(".sk-headblk");
    if (hb) hb.outerHTML = "<div class='sk-dlghead'><button class='sk-dlgback' data-nav='home' title='" + e(t("close")) + "' aria-label='" + e(t("close")) + "'>&#xf060;</button><h1>" + t("settings") + "</h1></div>";
    var g = scr.querySelector(".sk-g8"), ic = S.itemColors();
    if (g) {
        g.insertAdjacentHTML("beforeend", "<div class='sk-blk sk-c3 sk-itemcolors'><h3>" + e(t("item_colors")) + "</h3><p>" + e(t("item_colors_help")) + "</p>"
            + ["eq", "sp", "up"].map(function(k) {
                var others = ["eq", "sp", "up"].filter(function(o) { return o != k; }).map(function(o) { return ic[o]; });
                return "<div class='sk-fl'><span class='sk-chip sk-k-" + k + "'>" + e(t("kind_" + k)) + "</span></div>"
                    + S.swatchesCode(S.PASTELS.filter(function(x) { return others.indexOf(x) < 0; }), ic[k], "sk-ic-" + k, k);
            }).join("") + "</div>");
        g.querySelector(".sk-itemcolors").addEventListener("click", function(ev) {
            var sw = ev.target.closest("[data-col]"); if (!sw) return;
            var k = sw.closest("[data-kind]").dataset.kind, pr = S.prefs();
            pr.itemColors = S.itemColors(); pr.itemColors[k] = sw.dataset.col; S.savePrefs();
            S.applyItemColors();
            var n = S.fixAllHeroColors();
            S.renderSettings();
            if (n) S.toast(t("hero_colors_changed", n));
        });
    }
    S.syncDialogMode();
};
// La fin de scénario prend aussi l'allure d'un dialogue du Compagnon.
var origEndScreen = S.renderEnd;
S.renderEnd = function() {
    origEndScreen.apply(S, arguments);
    var scr = S.root.querySelector(".sk-screen"); if (!scr) return;
    scr.classList.add("sk-dialogscreen");
    var hb = scr.querySelector(".sk-headblk");
    if (hb) hb.outerHTML = "<div class='sk-dlghead'><button class='sk-dlgback' data-end='back' title='" + e(t("resume_game")) + "' aria-label='" + e(t("resume_game")) + "'>&#xf060;</button><h1>" + t("end_title") + "</h1>"
        + "<button class='sk-dlgact primary' data-end='save' title='" + e(t(S.state && S.state.campaign ? "save_back_campaign" : "save_back_home")) + "'>&#xf00c;</button></div>";
    S.addSteppers(scr);
    S.syncDialogMode();
};

// ---------- Thème et plein écran ----------
S.toggleTheme = function() {
    var next = (typeof Theme != "undefined" && Theme == "dark") ? "light" : "dark";
    try { Theme = next; } catch (x) {}
    try { localStorage.setItem(Application + "_Theme", next); } catch (x) {}
    document.querySelectorAll("link[href*='general/skin-']").forEach(function(l) { l.href = l.href.replace(/skin-(light|dark)\.css/, "skin-" + next + ".css"); });
};
S.toggleFullscreen = function(force) {
    var on = force != null ? force : !document.documentElement.classList.contains("skelos-full");
    document.documentElement.classList.toggle("skelos-full", on);
    try {
        if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(function() {});
        if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function() {});
    } catch (x) {}
    S.syncFullscreenButton();
};
// Pendant un dialogue plein écran, l'en-tête et la navigation du Compagnon s'effacent, comme pour ses propres dialogues.
S.syncDialogMode = function() {
    var on = !!(S.root && S.root.querySelector(".sk-dialogscreen"));
    document.documentElement.classList.toggle("skelos-dlgopen", on);
};
S.syncFullscreenButton = function() {
    S.syncDialogMode();
    var on = document.documentElement.classList.contains("skelos-full"), b = document.getElementById("sk-exitfull");
    if (on && !b) {
        document.body.insertAdjacentHTML("beforeend", "<button id='sk-exitfull' class='sk-exitfull' title='" + e(t("exit_fullscreen")) + "' aria-label='" + e(t("exit_fullscreen")) + "'>&#xf066;</button>");
        document.getElementById("sk-exitfull").addEventListener("click", function() { S.toggleFullscreen(false); });
    } else if (!on && b) b.remove();
};
// Sur tablette, iOS quitte le plein écran du navigateur au moindre glissement vers le bas : le mode Skelos
// (barres du Compagnon masquées) reste alors en place, on n'en sort que par son bouton. À la souris, Échap le quitte aussi.
document.addEventListener("fullscreenchange", function() {
    if (window.matchMedia && matchMedia("(pointer: coarse)").matches) return;
    if (!document.fullscreenElement && document.documentElement.classList.contains("skelos-full")) { document.documentElement.classList.remove("skelos-full"); S.syncFullscreenButton(); }
});

// ---------- Mode studio : la partie se règle directement sur le plateau ----------
// Le bouton Studio (barre des onglets) fait apparaître les − et +, le + des emplacements vides,
// le glisser-déposer des tuiles avec corbeille, la pastille de socle, l'interrupteur Aventure / Coop et la disquette.
// Toute modification passe par snapshot() : le bouton Annuler la défait.
S.studio = false;
var SOCLE = {gray: "#8a8a8a", red: "#b3161b", green: "#2e8b3e", blue: "#2a63ad", purple: "#7a3d9a", orange: "#e07a1f", black: "#222"};
var HEART = "<svg viewBox='0 0 24 22' aria-hidden='true'><path d='M12 21.2 10.6 20C5.4 15.3 2 12.2 2 8.4 2 5.3 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.3 22 8.4c0 3.8-3.4 6.9-8.6 11.6z'/></svg>";
var commit = function() { S.save(); S.renderGame(); };
S.socles = function(tile) {
    var out = [];
    (tile && tile.colors || []).forEach(function(c) { if (SOCLE[c] && out.indexOf(c) < 0) out.push(c); });
    return out;
};
S.socleName = function(c) { return (typeof Tile != "undefined" && Tile._i18n && Tile._i18n["color" + c.charAt(0).toUpperCase() + c.slice(1)]) || c; };

S.toggleStudio = function(on) {
    if (S.editing && on !== true) return;  // éditeur de scénario : on ne sort pas du mode studio
    S.studio = on == null ? !S.studio : !!on;
    S.closeHp(); S.selected = null;
    S.renderGame();
};

// Barre des onglets : bouton Studio à droite ; en mode studio, Aventure / Coop et la disquette à sa gauche.
var origPlaceTabs = S.placeTabs;
S.placeTabs = function() {
    origPlaceTabs.apply(S, arguments);
    var nav = S.root && S.root.querySelector(":scope > .sk-tabs");
    if (!nav || S.screen != "game" || !S.state) return;
    var st = S.state, g = "<div class='sk-tabtools'>";
    if (S.studio) {
        g += "<div class='sk-modesw' role='radiogroup' aria-label='" + e(t("mode_switch")) + "'>" + [["classic", "mode_adventure"], ["solo", "mode_coop"]].map(function(m) {
            var on = st.mode == m[0];
            return "<button role='radio' aria-checked='" + on + "' class='" + (on ? "on" : "") + "' data-studio='mode' data-mode='" + m[0] + "'>" + e(t(m[1])) + "</button>";
        }).join("") + "</div>"
            + "<button class='sk-tabico' data-studio='save' title='" + e(t("save_title")) + "' aria-label='" + e(t("save_title")) + "'>&#xf0c7;</button>"
            + (S.editing && S.editing.sid && !S.editing.cid ? "<button class='sk-tabico sk-danger' data-studio='del' title='" + e(t("delete_scenario")) + "' aria-label='" + e(t("delete_scenario")) + "'>&#xf2ed;</button>" : "");
    }
    g += "<button class='sk-tabico" + (S.studio ? " on" : "") + "' data-studio='toggle' aria-pressed='" + S.studio + "'" + (S.editing ? " disabled" : "")
        + " title='" + e(t(S.editing ? "studio_locked" : "studio_hint")) + "' aria-label='" + e(t("studio")) + "'>&#xf591;</button></div>";
    nav.classList.add("withtools");
    nav.classList.toggle("studio", S.studio);
    nav.insertAdjacentHTML("beforeend", g);
    nav.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-studio]"); if (!b) return;
        ev.stopPropagation();
        if (b.dataset.studio == "toggle") S.toggleStudio();
        else if (b.dataset.studio == "save") S.openSaveScenario();
        else if (b.dataset.studio == "mode") S.switchMode(b.dataset.mode);
        else if (b.dataset.studio == "del") S.deleteEditedScenario();
    });
};

// Points de vie en mode studio : les − et + fixent les PV de la tuile (ils deviennent aussi son maximum).
S.studioHpCode = function(s) {
    var tile = S.tileOf(s), reinf = tile && (tile.reinforcement || tile.reinforcement === "0"), lp = s.lp || 0, shared = S.hpGroup(s).length > 1;
    return "<span class='sk-hpwrap open sk-studiohp" + (reinf ? " withreinf" : "") + (shared ? " shared" : "") + "'" + (shared ? " title='" + e(t("hp_shared")) + "'" : "") + ">"
        + "<button class='sk-hpbtn' data-act='studiolp' data-uid='" + s.uid + "' data-n='-1' aria-label='" + e(t("aria_hp_minus")) + "'>−</button>"
        + "<span class='sk-hp" + (lp <= 0 ? " zero" : "") + "' aria-label='" + e(t("life_points") + " " + lp) + "'>" + HEART + "<b>" + lp + "</b></span>"
        + "<button class='sk-hpbtn' data-act='studiolp' data-uid='" + s.uid + "' data-n='1' aria-label='" + e(t("aria_hp_plus")) + "'>+</button></span>";
};

// Signes − et + dessinés en CSS (classes sk-minus / sk-plus) : parfaitement centrés quelle que soit la police.
S.markSteppers = function(scope) {
    scope.querySelectorAll(".sk-pstep, .sk-hpbtn").forEach(function(b) {
        var s = b.textContent.trim();
        if (s == "+") b.classList.add("sk-plus"); else if (s == "−" || s == "-") b.classList.add("sk-minus");
    });
};
// Rang des tuiles (pions numérotés du mode coop) : il reste attaché à la case, pas à la tuile.
S.renumberRiver = function() { S.state.river.forEach(function(s, i) { s.token = i + 1; }); };

// Après le rendu : + des emplacements vides, tuiles déplaçables, PV, pastille de socle.
var studioRenderGame = S.renderGame;
S.renderGame = function() {
    studioRenderGame.apply(S, arguments);
    var r = S.root, st = S.state, game = r.querySelector(".skelos-game");
    if (!game) return;
    game.classList.toggle("sk-studio", !!S.studio);
    S.markSteppers(r);
    if (!S.studio) return;
    r.querySelectorAll(".sk-river > .sk-slot").forEach(function(el, i) {
        var s = st.river[i];
        el.setAttribute("data-si", i);
        if (!s) {
            var em = el.querySelector(".sk-empty");
            if (em) em.innerHTML = "<button class='sk-studioadd' data-act='studioadd' title='" + e(t("add_tile")) + "' aria-label='" + e(t("add_tile")) + "'>+</button>";
            return;
        }
        var box = el.querySelector(".sk-tilebox");
        box.setAttribute("data-act", "studiotile");
        box.setAttribute("aria-label", S.tileName(s) + " — " + t(S.isEvent(s) ? "event_edit_hint" : "drag_hint"));
        var old = box.querySelector(".sk-hpwrap"); if (old) old.remove();
        if (!S.isEvent(s) && !s.dead) box.insertAdjacentHTML("beforeend", S.studioHpCode(s));
        var socles = S.socles(S.tileOf(s));
        if (socles.length > 1) {
            var c = socles.indexOf(s.color) >= 0 ? s.color : socles[0];
            el.insertAdjacentHTML("beforeend", "<button class='sk-socle' data-act='studiosocle' data-uid='" + s.uid + "' style='--socle:" + SOCLE[c] + "'"
                + " title='" + e(t("socle_next", S.socleName(c))) + "' aria-label='" + e(t("socle_next", S.socleName(c))) + "'></button>");
        }
    });
};

// Actions du plateau en mode studio, et Recommencer / Terminer du bloc d'outils.
var studioBindGame = S.bindGame;
S.bindGame = function() {
    studioBindGame.apply(S, arguments);
    S.root.querySelector(".skelos-game").addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-act]"); if (!b) return;
        var uid = b.dataset.uid, n = +b.dataset.n;
        switch (b.dataset.act) {
            case "restart": S.restartGame(); break;
            case "end": S.renderEnd(); break;
            case "studioadd": S.studioPick(); break;
            case "studiotile": var s = S.slotByUid(uid); if (s && S.isEvent(s)) S.editEventText(uid); break;
            case "studiolp": S.studioLife(uid, n); break;
            case "studiosocle": S.nextSocle(uid); break;
            case "studiogem": S.studioGem(n); break;
            case "studiomaxact": S.studioMaxAct(n); break;
            case "studiofirst": S.toggleFirstPlayer(); break;
        }
    });
};

var origRenderEndLog = S.renderEnd;
S.renderEnd = function(keep) {
    if (!keep && S.state && S.screen == "game") { S.log(t("log_end")); S.save(); }
    return origRenderEndLog.apply(S, arguments);
};
S.restartGame = function() {
    S.ask(t("confirm_restart"), t("restart_game"), function() {
        var st = S.state;
        if (st.origin) {
            S.snapshot();
            var o = JSON.parse(JSON.stringify(st.origin));
            o.origin = st.origin; o.campaign = st.campaign;
            o.scenario.title = st.scenario.title; o.scenario.notes = st.scenario.notes;
            o.log = [];
            S.state = o; S.selected = null; S._hpOpen = null;
        } else {
            // Partie commencée avant cette version : on repart du scénario d'origine connu.
            var camp = st.campaign;
            S.draft = JSON.parse(JSON.stringify(st.scenario));
            S.ctx = camp ? {cid: camp.cid, idx: camp.idx} : null;
            S.clearGame(); S.startGame(S.draft.river.length ? true : "blank");
            if (S.state) S.state.log = [];
        }
        if (S.state) { S.log(t("log_restart")); S.save(); S.renderGame(); }
    });
};
S.studioLife = function(uid, d) {
    var s = S.slotByUid(uid); if (!s) return;
    var v = Math.max(0, Math.min(40, (s.lp || 0) + d));
    if (v == (s.lp || 0)) return;
    S.snapshot();
    S.hpGroup(s).forEach(function(g) { g.lp = v || null; g.lpMax = v || null; });
    commit();
};
S.nextSocle = function(uid) {
    var s = S.slotByUid(uid), socles = S.socles(S.tileOf(s)); if (socles.length < 2) return;
    S.snapshot();
    s.color = socles[(socles.indexOf(s.color) + 1) % socles.length];
    S.adoptSharedHp(s);
    commit();
};
S.studioGem = function(d) {
    var st = S.state;
    if (d < 0 && !st.fatigue && !st.energy) { S.toast(t("gem_none_left")); return; }
    S.snapshot();
    if (d > 0) st.fatigue++; else if (st.fatigue > 0) st.fatigue--; else st.energy--;
    S.log(t(d > 0 ? "log_gem_added" : "log_gem_removed", S.gemTotal()));
    commit();
};
S.studioMaxAct = function(d) {
    var st = S.state, v = Math.max(1, Math.min(8, (st.maxActivations || 1) + d));
    if (v == st.maxActivations) return;
    S.snapshot();
    st.maxActivations = v; st.scenario.maxActivations = v;
    commit();
};

// Premier joueur : réglé dans le bloc Phase ; avant le premier tour, la phase suit.
S.firstPlayerCode = function() {
    var ov = S.state.scenario.firstPlayer == "overlord";
    return "<button class='sk-pfirst' data-act='studiofirst' aria-label='" + e(t("first_player") + " : " + t(ov ? "first_overlord" : "first_heroes")) + "'>"
        + "<span>" + e(t("first_player")) + "</span><b>" + e(t(ov ? "first_overlord" : "first_heroes")) + "</b></button>";
};
S.toggleFirstPlayer = function() {
    var st = S.state, fp = st.scenario.firstPlayer == "overlord" ? "heroes" : "overlord";
    S.snapshot();
    st.scenario.firstPlayer = fp;
    // Le bloc Phase suit toujours ; un tour de l'Overlord entamé repart de zéro (Annuler permet de revenir).
    st.phase = fp == "overlord" ? "start" : "heroes";
    st.activations = 0; st.current = null; st.highlight = null; st.lastEvent = false;
    commit();
};

// Aventure (gemmes) ⟷ Coop (jetons tirés au sac) : l'Overlord repart de zéro, tuiles, PV et tour conservés.
S.switchMode = function(mode) {
    var st = S.state; if (!st || st.mode == mode) return;
    var go = function() {
        S.snapshot();
        st.mode = mode; st.scenario.mode = mode;
        st.activations = 0; st.highlight = null; st.current = null; st.lastEvent = false;
        if (mode == "classic") {
            st.energy = st.scenario.energy != null ? st.scenario.energy : 10;
            st.fatigue = st.scenario.fatigue || 0;
            st.recovery = st.recovery != null ? st.recovery : 5;
            st.maxActivations = st.maxActivations || 2;
            st.boosts = {move: 0, reroll: 0, defense: 0, spell: 0};
        } else {
            st.pool = st.river.map(function(s) { return s.uid; }); st.used = []; st.removed = [];
            st.heroes = st.heroes || 4;
        }
        if (st.phase == "overlord") st.phase = "start";
        S.log(t("log_mode", t(mode == "classic" ? "mode_adventure" : "mode_coop")));
        commit();
    };
    var started = st.turn > 0 || st.activations > 0 || st.log.length > 1;
    if (started) S.ask(t("confirm_mode"), t("confirm_mode_yes"), go); else go();
};

// + d'un emplacement vide : le sélecteur de tuiles, qui ajoute au bout de la Rivière.
S.studioPick = function() {
    S._pickToGame = true;
    S.openPicker();
    document.documentElement.classList.add("skelos-dlgopen");
};

// Texte d'une tuile Événement : appui sur la tuile en mode studio.
S.editEventText = function(uid) {
    var st = S.state, s = S.slotByUid(uid), pos = st.river.indexOf(s) + 1;
    var firstEv = st.river.filter(function(x) { return S.isEvent(x); })[0] == s;
    var usesGeneral = !s.eventText && firstEv && st.scenario.events;
    var val = s.eventText || (usesGeneral ? st.scenario.events : "");
    S.dialog("<h2>" + e(t("event_n", pos)) + "</h2><textarea class='sk-in' id='sk-evtext' rows='5' placeholder='" + e(t("events_placeholder")) + "'>" + e(val) + "</textarea>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ok>" + t("validate") + "</button><button class='sk-btn' data-dclose>" + t("cancel") + "</button></div>",
        function(ev, close) {
            if (!ev.target.closest("[data-ok]")) return;
            var v = S.root.querySelector("#sk-evtext").value.trim(); close();
            if (v == val.trim()) return;
            S.snapshot();
            s.eventText = v;
            if (usesGeneral) st.scenario.events = "";
            commit();
        });
};

// Disquette : enregistre la partie comme scénario (titre et notes), dans un dialogue du Compagnon.
S.openSaveScenario = function() {
    var sc = S.state.scenario;
    Nav.dialog(e(t("save_title")),
        "<div class='sk-savedlg'><label for='sk-savetitle'>" + e(t("scenario_name")) + "</label>"
        + "<input id='sk-savetitle' type='text' value='" + e(sc.title || "") + "' placeholder='" + e(t("scenario_name_placeholder")) + "'>"
        + "<p class='sk-savemsg' id='sk-savemsg' role='alert'></p>"
        + "<label for='sk-savenotes'>" + e(t("notes")) + "</label><textarea id='sk-savenotes' rows='6'>" + e(sc.notes || "") + "</textarea>"
        + "<button type='button' class='sk-savebtn' onclick='Skelos.saveScenarioFromDialog()'>" + e(t("save_scenario")) + "</button></div>",
        null, [{fn: "Skelos.saveScenarioFromDialog()", icon: "skelos-save-icon", label: e(t("save_scenario"))}]);
    var inp = document.getElementById("sk-savetitle"); if (inp) { inp.focus(); inp.select(); }
};
S.saveScenarioFromDialog = function() {
    var title = (document.getElementById("sk-savetitle").value || "").trim();
    if (!title) { document.getElementById("sk-savemsg").textContent = t("title_required"); document.getElementById("sk-savetitle").focus(); return; }
    var st = S.state, before = st.scenario.title || "";
    st.scenario.title = title;
    st.scenario.notes = document.getElementById("sk-savenotes").value;
    if (before != title) S.log(before ? t("log_title", before, title) : t("log_title_new", title));
    S.log(t("log_saved", title));
    S.save();
    var d = S.scenarioFromState();
    d.saved = S.stateCopy(st, true);
    S.saveScenarioCopy(d);
    if (S.editing) { S.editing.dirty = false; S.editing.sid = st.scenario.sid; }  // éditeur : tout est enregistré
    Nav.closeDialog();
};

// Glisser-déposer des tuiles en mode studio : les autres se décalent ; la corbeille retire la tuile.
S.bindStudioDrag = function(root) {
    var drag = null;
    var clean = function() {
        if (!drag) return;
        if (drag.ghost) drag.ghost.remove();
        if (drag.trash) drag.trash.remove();
        drag.box.classList.remove("sk-dragging");
        root.querySelectorAll(".sk-droptarget").forEach(function(x) { x.classList.remove("sk-droptarget"); });
        drag = null;
    };
    var targetAt = function(x, y) {
        var el = document.elementFromPoint(x, y);
        if (!el) return null;
        if (el.closest(".sk-trash")) return {trash: true};
        var slot = el.closest(".sk-studio .sk-river > .sk-slot");
        return slot ? {slot: slot, i: +slot.getAttribute("data-si")} : null;
    };
    root.addEventListener("pointerdown", function(ev) {
        if (!S.studio || S.screen != "game" || drag) return;
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        var box = ev.target.closest(".sk-studio .sk-river .sk-tilebox[data-uid]");
        if (!box || ev.target.closest("button")) return;
        drag = {box: box, uid: box.dataset.uid, x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false};
    });
    root.addEventListener("pointermove", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) {
            if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 8) return;
            drag.on = true;
            var rc = drag.box.getBoundingClientRect();
            drag.dx = drag.x - rc.left; drag.dy = drag.y - rc.top;
            drag.ghost = drag.box.cloneNode(true);
            drag.ghost.className = "sk-tilebox sk-ghost"; drag.ghost.removeAttribute("data-act"); drag.ghost.removeAttribute("tabindex");
            drag.ghost.style.width = rc.width + "px";
            document.body.appendChild(drag.ghost);
            drag.box.classList.add("sk-dragging");
            root.insertAdjacentHTML("beforeend", "<div class='sk-trash' aria-hidden='true'><i>&#xf2ed;</i><span>" + e(t("drop_remove")) + "</span></div>");
            drag.trash = root.querySelector(".sk-trash");
            try { drag.box.setPointerCapture(ev.pointerId); } catch (x) {}
            S.hideTip(); S.closeHp();
        }
        ev.preventDefault();
        drag.ghost.style.left = (ev.clientX - drag.dx) + "px"; drag.ghost.style.top = (ev.clientY - drag.dy) + "px";
        var tg = targetAt(ev.clientX, ev.clientY);
        root.querySelectorAll(".sk-droptarget").forEach(function(x) { x.classList.remove("sk-droptarget"); });
        drag.trash.classList.toggle("hot", !!(tg && tg.trash));
        if (tg && tg.slot) tg.slot.classList.add("sk-droptarget");
        // Défilement près des bords (téléphone).
        if (ev.clientY < 70) root.scrollTop -= 12; else if (ev.clientY > window.innerHeight - 70) root.scrollTop += 12;
    });
    root.addEventListener("pointerup", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) { drag = null; return; }
        var tg = targetAt(ev.clientX, ev.clientY), uid = drag.uid;
        clean();
        S._suppressClick = true; setTimeout(function() { S._suppressClick = false; }, 60);
        if (!tg) return;
        if (tg.trash) S.studioRemove(uid); else S.studioMove(uid, tg.i);
    });
    root.addEventListener("pointercancel", clean);
    // Le glisser natif des images (souris) annulerait le nôtre.
    root.addEventListener("dragstart", function(ev) { if (S.studio && ev.target.closest(".sk-river")) ev.preventDefault(); });
};
// Mode Aventure, en partie : glisser une tuile au bout de la Rivière l'active, exactement comme la gemme rouge
// (mêmes contrôles, mêmes gemmes payées, même journal). La tuile se soulève pendant le glisser et se repose
// à sa nouvelle place, ou revient à l'ancienne si l'activation est refusée. Indépendant du réglage Animations.
S.bindActivateDrag = function(root) {
    var drag = null;
    var allowed = function() { return S.screen == "game" && !S.studio && S.state && S.state.mode != "solo"; };
    var slots = function() { return [].slice.call(root.querySelectorAll(".sk-river > .sk-slot")); };
    var clean = function(keep) {
        if (!drag) return;
        if (!keep) drag.box.classList.remove("sk-dragging");
        root.querySelectorAll(".sk-dropend").forEach(function(x) { x.classList.remove("sk-dropend"); });
        drag = null;
    };
    // Bout de la Rivière : la case de la dernière tuile, une case vide après elle, ou à droite de la dernière tuile.
    var atEnd = function(x, y) {
        var all = slots(), n = S.state.river.length, last = all[n - 1]; if (!last) return null;
        var el = document.elementFromPoint(x, y), slot = el && el.closest(".sk-river > .sk-slot");
        if (slot && all.indexOf(slot) >= n - 1) return last;
        var rc = last.getBoundingClientRect();
        return x > rc.right && y > rc.top - rc.height * .25 && y < rc.bottom + rc.height * .25 ? last : null;
    };
    // La tuile soulevée se pose sur le rectangle d'arrivée, puis disparaît.
    var settle = function(ghost, rc, done) {
        ghost.classList.add("sk-settling");
        ghost.style.left = rc.left + "px"; ghost.style.top = rc.top + "px"; ghost.style.width = rc.width + "px";
        var end = function() { if (!ghost.parentNode) return; ghost.remove(); if (done) done(); };
        ghost.addEventListener("transitionend", end); setTimeout(end, 320);
    };
    root.addEventListener("pointerdown", function(ev) {
        if (!allowed() || drag) return;
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        var box = ev.target.closest(".sk-river .sk-tilebox[data-uid]");
        if (!box || ev.target.closest("button, .sk-hpwrap, [data-hp], [data-skill]")) return;
        drag = {box: box, uid: box.dataset.uid, x: ev.clientX, y: ev.clientY, id: ev.pointerId, on: false};
    });
    root.addEventListener("pointermove", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) {
            if (Math.abs(ev.clientX - drag.x) + Math.abs(ev.clientY - drag.y) < 10) return;
            drag.on = true;
            var rc = drag.box.getBoundingClientRect();
            drag.from = rc; drag.dx = drag.x - rc.left; drag.dy = drag.y - rc.top;
            drag.ghost = drag.box.cloneNode(true);
            drag.ghost.className = "sk-tilebox sk-ghost sk-lifted"; drag.ghost.removeAttribute("data-act"); drag.ghost.removeAttribute("tabindex");
            drag.ghost.style.width = rc.width + "px";
            document.body.appendChild(drag.ghost);
            drag.box.classList.add("sk-dragging");
            try { drag.box.setPointerCapture(ev.pointerId); } catch (x) {}
            S.hideTip(); S.closeHp();
        }
        ev.preventDefault();
        drag.ghost.style.left = (ev.clientX - drag.dx) + "px"; drag.ghost.style.top = (ev.clientY - drag.dy) + "px";
        root.querySelectorAll(".sk-dropend").forEach(function(x) { x.classList.remove("sk-dropend"); });
        var end = atEnd(ev.clientX, ev.clientY); if (end) end.classList.add("sk-dropend");
        if (ev.clientY < 70) root.scrollTop -= 12; else if (ev.clientY > window.innerHeight - 70) root.scrollTop += 12;
    });
    root.addEventListener("pointerup", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) { drag = null; return; }
        var uid = drag.uid, ghost = drag.ghost, from = drag.from, src = drag.box, end = atEnd(ev.clientX, ev.clientY);
        clean(true);
        S._suppressClick = true; setTimeout(function() { S._suppressClick = false; }, 60);
        var why = end ? S.canActivate(S.slotByUid(uid)) : null;
        if (!end || why) {
            if (why) S.toast(why);
            settle(ghost, from, function() { src.classList.remove("sk-dragging"); });
            return;
        }
        // La vraie tuile est masquée le temps que la tuile soulevée la rejoigne au bout de la Rivière.
        S._animSkip = uid; S.activate(uid); S._animSkip = null;
        var box = root.querySelector(".sk-river .sk-tilebox[data-uid='" + uid + "']");
        if (!box) { ghost.remove(); return; }
        box.classList.add("sk-dragging");
        settle(ghost, box.getBoundingClientRect(), function() { box.classList.remove("sk-dragging"); });
    });
    root.addEventListener("pointercancel", function() { if (drag && drag.ghost) drag.ghost.remove(); clean(); });
    root.addEventListener("dragstart", function(ev) { if (allowed() && ev.target.closest(".sk-river")) ev.preventDefault(); });
};
S.studioMove = function(uid, to) {
    var st = S.state, i = st.river.findIndex(function(s) { return s.uid == uid; });
    to = Math.min(to, st.river.length - 1);
    if (i < 0 || to == i) return;
    S.snapshot();
    st.river.splice(to, 0, st.river.splice(i, 1)[0]);
    S.renumberRiver();
    commit();
};
S.studioRemove = function(uid) {
    var st = S.state, i = st.river.findIndex(function(s) { return s.uid == uid; });
    if (i < 0) return;
    S.snapshot();
    var gone = st.river.splice(i, 1)[0];
    S.forgetSlot(gone);
    st.removed = (st.removed || []).filter(function(u) { return u != uid; });
    if (st.current == uid) st.current = null;
    if (st.highlight == uid) st.highlight = null;
    S.renumberRiver();
    commit();
};

// ---------- Menu contextuel des tuiles (appui long, ou clic droit à la souris) ----------
// Remplace le panneau du bas : un appui simple sélectionne la tuile (activation par le pion), un appui long ouvre ses actions.
S.openTileMenu = function(uid) {
    var st = S.state, s = S.slotByUid(uid); if (!s || S.isEvent(s)) return;
    var solo = st.mode == "solo", items = [["zoom", t("zoom_tile")]];
    if (!s.dead) items.push(["dead", t("mark_dead")]);
    else {
        var rc = S.reinforceCost(s);
        items.push(["reinf", rc ? t(rc == 1 ? "reinforce_cost_1" : "reinforce_cost", t("reinforce"), rc) : t("reinforce")]);
        if (!solo) items.push(["purge", t("purge")]);
        if (solo && st.removed.indexOf(uid) < 0) items.push(["rmtoken", t("remove_token")]);
    }
    S.hideTip(); S.closeHp();
    var ov = S.root.querySelector("#sk-overlay");
    ov.innerHTML = "<div class='sk-dialog sk-menu sk-tilemenu' role='menu' aria-label='" + e(S.tileName(s)) + "'><h2>" + e(S.tileName(s)) + "</h2>"
        + items.map(function(x) { return "<button class='sk-btn" + (x[0] == "purge" || x[0] == "rmtoken" ? " sk-danger" : "") + "' data-m='" + x[0] + "' role='menuitem'>" + e(x[1]) + "</button>"; }).join("") + "</div>";
    ov.classList.add("on");
    var shut = function() { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; ov.onkeydown = null; };
    ov.onkeydown = function(ev) { if (ev.key == "Escape") shut(); };
    ov.onclick = function(ev) {
        var b = ev.target.closest("[data-m]"); if (!b && ev.target !== ov) return;
        shut();
        if (!b) return;
        switch (b.dataset.m) {
            case "dead": S.markDead(uid); break;
            case "reinf": S.reinforce(uid); break;
            case "purge": S.purge(uid); break;
            case "rmtoken": S.removeToken(uid); break;
            case "zoom": S.zoomTile(uid); break;
        }
    };
    if (navigator.vibrate) navigator.vibrate(20);
    ov.querySelector("[data-m]").focus();
};
// Cartes portées par une tuile (scénario) : sorts à gauche de la tuile, équipements à droite.
S.slotCards = function(s, kind) { return ((s && s.cards) || []).filter(function(c) { return c.kind == kind; }); };
S.spellData = function(ref) { return ((Encyclopedia.spells && Encyclopedia.spells.list) || []).filter(function(x) { return x.id == ref; })[0] || null; };
// Tuiles de la Rivière qui ont des sorts utilisables (tuile vivante, hors Événement).
S.spellSlots = function() {
    return S.state ? S.state.river.filter(function(s) { return s && !s.dead && !S.isEvent(s) && S.slotCards(s, "sp").length; }) : [];
};
// Lancer un sort : en Aventure, son coût passe de l'énergie disponible à la zone Sort, comme une amélioration.
// En Coop, il n'y a pas de gemmes d'énergie : on ne garde que la trace des gemmes posées sur le sort.
// Dans les deux cas, les gemmes posées sur le sort ce tour sont comptées (saturation : nombre de gemmes au plus sur le sort).
S.castSpell = function(uid, ref, n) {
    var st = S.state, s = S.slotByUid(uid), coop = st.mode == "solo"; if (!s || !(n > 0)) return false;
    if (!coop && st.energy < n) { S.toast(t("not_enough", n, st.energy)); return false; }
    S.snapshot();
    if (!coop) { st.energy -= n; st.boosts.spell = (st.boosts.spell || 0) + n; }
    st.cast = st.cast || {}; st.cast[uid + "|" + ref] = (st.cast[uid + "|" + ref] || 0) + n;
    S._justCast = uid + "|" + ref; S._lastCastN = n;
    S.log(t("log_spell", S.tileName(s), S.itemName("sp", ref), n));
    S.save(); S.renderGame();
    return true;
};

// ---------- Zoom d'une tuile ----------
// La tuile au centre ; glisser vers la droite fait venir ses sorts, vers la gauche ses équipements ;
// glisser vers le haut ou le bas passe à la tuile suivante ou précédente de la Rivière.
// La « main des sorts » (bouton Sort) est le même zoom, limité aux tuiles vivantes qui ont des sorts.
// En studio, un + au bout de chaque côté ajoute un sort (à gauche) ou un équipement (à droite).
S.zoomTile = function(uid, opts) {
    opts = opts || {};
    var s = S.slotByUid(uid); if (!s) return;
    var hand = !!opts.hand, studio = S.studio, game = !studio;
    var sp = S.slotCards(s, "sp"), eq = S.slotCards(s, "eq");
    var minPos = -sp.length - (studio ? 1 : 0), maxPos = eq.length + (studio ? 1 : 0);
    var pos = Math.max(minPos, Math.min(maxPos, opts.pos == null ? (hand ? -1 : 0) : opts.pos));
    S._zoom = {uid: uid, pos: pos, hand: hand};
    S.hideTip(); S.closeHp && S.closeHp();
    var title = S.tileName(s), body = "", after = "";
    if (pos == 0) {
        // Points de vie à taille du doigt : en studio, les PV de départ ; en partie, les PV restants (0 = unités mortes, comme sur le plateau).
        var hpCode = "";
        if (!S.isEvent(s)) {
            if (studio) { if (!s.dead) hpCode = S.studioHpCode(s).replace(/data-act='studiolp'/g, "data-zlp"); }
            else if (s.lpMax) hpCode = S.studioHpCode(s).replace(/data-act='studiolp'/g, "data-zhp");
        }
        body = "<div class='sk-tilebox sk-zoombox" + (s.dead ? " dead" : "") + "'>" + S.tileCode(s) + (s.dead ? "<span class='sk-deadmark'>" + t("dead") + "</span>" : "") + "</div>";
        after = hpCode ? "<div class='sk-zoomhp'>" + hpCode + "</div>" : "";
    } else if (pos == minPos && studio) {
        body = "<button class='sk-zoomadd' data-zadd='sp'><span>+</span>" + e(t("add_spell")) + "</button>";
    } else if (pos == maxPos && studio) {
        body = "<button class='sk-zoomadd' data-zadd='eq'><span>+</span>" + e(t("add_eq")) + "</button>";
    } else {
        var kind = pos < 0 ? "sp" : "eq", list = kind == "sp" ? sp : eq, k = Math.abs(pos) - 1, c = list[k];
        var real = S.realCardCode(kind, c.ref) || "<div class='sk-bigcard sk-k-" + kind + "'><span class='sk-icard-n'>" + e(S.itemName(kind, c.ref)) + "</span></div>";
        var foot = "", cast = 0, cls = "", pips = "";
        if (kind == "sp" && game) {
            var d = S.spellData(c.ref), cost = d ? parseInt(d.cost, 10) : NaN;
            cast = S.castCount(uid, c.ref);
            if (cast) cls += " sk-cast";
            var anim = S._justCast == uid + "|" + c.ref, fresh = anim ? S._lastCastN : 0;
            if (anim) { cls += " sk-castanim"; S._justCast = null; }
            // Pastilles de saturation : la saturation est le nombre de gemmes au plus sur le sort ce tour (2 / 4 : 2 gemmes par lancement, 4 au plus).
            // Une pastille vide par gemme possible ; chaque lancement remplit en rouge autant de pastilles que son coût.
            // Au-delà de la saturation, des pastilles en plus, cerclées (non bloquant). Sans saturation : une gemme rouge et le nombre posé.
            var sat = d ? parseInt(d.saturation, 10) || 0 : 0;
            if (sat > 0 || cast) {
                var slots = sat > 0 ? Math.max(sat, cast) : 1;
                pips = "<span class='sk-satpips' role='img' aria-label='" + e(sat > 0 ? t("spell_gems", cast, sat) : t("spell_gems_nosat", cast)) + "'>";
                for (var q = 0; q < slots; q++) pips += "<i class='" + (q < cast ? "on" : "") + (sat > 0 && q >= sat ? " over" : "") + (fresh && (sat > 0 ? q >= cast - fresh && q < cast : true) ? " new" : "") + "'>&#xf3a5;</i>";
                pips += (!sat ? "<b>" + cast + "</b>" : "") + "</span>";
            }
            if (s.dead) foot = "<p class='sk-zoomnote'>" + e(t("spell_tile_dead")) + "</p>";
            else if (cost > 0) foot = "<p class='sk-zoomnote'>" + e(sat > 0 && cast >= sat ? t("spell_sat_full", sat) : t(cast ? "spell_cast_done" : "spell_cast_hint", cost)) + "</p>";
            else foot = "<div class='sk-zoomcast'><button class='sk-hpbtn' data-zx='-1' aria-label='−'>−</button><b data-zxv>1</b><button class='sk-hpbtn' data-zx='1' aria-label='+'>+</button>"
                + "<button class='sk-btn sk-primary' data-zcastx='" + e(c.ref) + "'>" + e(t("cast_spell")) + "</button></div>";
        }
        // Studio : une pastille corbeille au coin bas droit de la carte la retire de la tuile.
        var rm = studio ? "<button class='sk-zoomrm' data-zrm='" + kind + ":" + k + "' aria-label='" + e(t("remove_card")) + "' title='" + e(t("remove_card")) + "'>&#xf2ed;</button>" : "";
        var paid = cls.indexOf("sk-castanim") >= 0 && S.state.mode != "solo" ? "<span class='sk-castpaid' aria-hidden='true'>−" + S._lastCastN + "</span>" : "";
        body = "<div class='sk-zoomcard" + (kind == "sp" && game && !s.dead ? " sk-castable" : "") + (s.dead && kind == "sp" ? " dead" : "") + cls + "' data-zcard='" + kind + ":" + e(c.ref) + "'><span class='sk-cardscale'>" + real + "</span>" + rm + paid + pips + "</div>"; after = foot;
    }
    // Repères : un point par page, la tuile au milieu, les sorts à gauche, les équipements à droite.
    var dots = "";
    for (var p = minPos; p <= maxPos; p++) dots += "<i class='" + (p == 0 ? "sk-dt" : p < 0 ? "sk-ds" : "sk-de") + (p == pos ? " on" : "") + "'></i>";
    var ring = S.zoomRing(hand), idx = ring.indexOf(uid);
    var dir = opts.dir ? " sk-zin-" + opts.dir : "";
    var ov = S.root.querySelector("#sk-overlay");
    ov.innerHTML = "<div class='sk-zoom' role='dialog' tabindex='-1' aria-label='" + e(title) + "'>"
        // En-tête : seulement la position de la tuile dans la Rivière (les points du bas situent la carte).
        + "<div class='sk-zoomhead'>" + (ring.length > 1 ? "<span class='sk-zoomring'>" + (idx + 1) + " / " + ring.length + "</span>" : "") + "</div>"
        + "<div class='sk-zoompage" + dir + "'><div class='sk-zoomstage'>" + body + "</div>" + after + "</div>"
        + (maxPos > minPos ? "<div class='sk-zoomdots' aria-hidden='true'>" + dots + "</div>" : "")
        + "</div>";
    ov.classList.add("on", "sk-zoomon");
    S.bindZoom(ov);
    ov.querySelector(".sk-zoom").focus({preventScroll: true});
};
// Nombre de gemmes posées ce tour sur un sort d'une tuile (remis à zéro quand les gemmes rejoignent la fatigue).
S.castCount = function(uid, ref) { var c = S.state && S.state.cast; return (c && c[uid + "|" + ref]) || 0; };
// Tuiles parcourues de haut en bas : toutes les tuiles de la Rivière, ou seulement celles qui ont des sorts (main des sorts).
S.zoomRing = function(hand) {
    if (!S.state) return [];
    return (hand ? S.spellSlots() : S.state.river.filter(function(s) { return s; })).map(function(s) { return s.uid; });
};
S.zoomGo = function(dir) {
    var z = S._zoom; if (!z) return;
    if (dir == "left" || dir == "right") { S.zoomTile(z.uid, {pos: z.pos + (dir == "right" ? 1 : -1), hand: z.hand, dir: dir}); return; }
    var ring = S.zoomRing(z.hand), i = ring.indexOf(z.uid); if (ring.length < 2) return;
    var j = (i + (dir == "down" ? 1 : -1) + ring.length) % ring.length;
    S.zoomTile(ring[j], {pos: z.hand ? -1 : 0, hand: z.hand, dir: dir});
};
S.zoomShut = function() {
    var ov = S.root && S.root.querySelector("#sk-overlay"); S._zoom = null; S.hideTip();
    if (ov) { ov.classList.remove("on", "sk-zoomon"); ov.innerHTML = ""; ov.onclick = null; ov.onkeydown = null; ov.onpointerdown = null; ov.onpointerup = null; }
};
S.bindZoom = function(ov) {
    // Le zoom se redessine à chaque glissement : le repère « vient de glisser » vit hors du redessin.
    var sx = 0, sy = 0, down = false;
    ov.onkeydown = function(ev) {
        if (ev.key == "Escape") { S.zoomShut(); return; }
        var m = {ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down"}[ev.key];
        if (m) { ev.preventDefault(); S.zoomGo(m); }
    };
    ov.onpointerdown = function(ev) { down = true; sx = ev.clientX; sy = ev.clientY; };
    ov.onpointerup = function(ev) {
        if (!down) return; down = false;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
        S._zswipeAt = Date.now();
        // Le doigt glisse vers la droite : la page de gauche arrive (sorts) ; vers la gauche : celle de droite (équipements).
        if (Math.abs(dx) > Math.abs(dy)) S.zoomGo(dx > 0 ? "left" : "right");
        else S.zoomGo(dy < 0 ? "down" : "up");
    };
    ov.onclick = function(ev) {
        if (S._zswipeAt && Date.now() - S._zswipeAt < 450) { S._zswipeAt = 0; ev.stopPropagation(); return; }
        var z = S._zoom; if (!z) return;
        var uid = z.uid, go = ev.target.closest("[data-zgo]");
        if (go) { ev.stopPropagation(); if (!go.disabled) S.zoomGo(go.dataset.zgo); return; }
        var lp = ev.target.closest("[data-zlp], [data-zhp]");
        if (lp) {
            ev.stopPropagation();
            if (lp.hasAttribute("data-zlp")) S.studioLife(uid, +lp.dataset.n); else S.life(uid, +lp.dataset.n);
            S.zoomTile(uid, {pos: 0, hand: z.hand}); return;
        }
        if (ev.target.closest(".sk-studiohp")) return;
        // Sort à coût fixe : un appui sur le coût le lance (le chiffre de saturation recouvre en partie le coût, il compte aussi).
        var cost = ev.target.closest(".sk-zoomcard.sk-castable .cost, .sk-zoomcard.sk-castable .saturation, .sk-zoomcard.sk-castable .cost-and-saturation");
        if (cost) {
            ev.stopPropagation();
            var card = cost.closest("[data-zcard]"), ref = card.dataset.zcard.split(":").slice(1).join(":"), d = S.spellData(ref), n = d ? parseInt(d.cost, 10) : 0;
            if (n > 0 && S.castSpell(uid, ref, n)) S.zoomTile(uid, {pos: z.pos, hand: z.hand});
            return;
        }
        // Coût variable (X) : choisir le nombre de gemmes, puis Lancer.
        var xs = ev.target.closest("[data-zx]");
        if (xs) { ev.stopPropagation(); var v = ov.querySelector("[data-zxv]"), nv = Math.max(1, Math.min(9, (+v.textContent || 1) + (+xs.dataset.zx))); v.textContent = nv; return; }
        var cx = ev.target.closest("[data-zcastx]");
        if (cx) { ev.stopPropagation(); if (S.castSpell(uid, cx.dataset.zcastx, +ov.querySelector("[data-zxv]").textContent || 1)) S.zoomTile(uid, {pos: z.pos, hand: z.hand}); return; }
        var add = ev.target.closest("[data-zadd]");
        if (add) { ev.stopPropagation(); S.studioAddCards(uid, add.dataset.zadd); return; }
        var rm = ev.target.closest("[data-zrm]");
        if (rm) { ev.stopPropagation(); var p = rm.dataset.zrm.split(":"); S.studioRemoveCard(uid, p[0], +p[1]); return; }
        if (ev.target.closest("[data-zcard]")) return;
        var sk = ev.target.closest("[data-skill]");
        if (sk) { ev.stopPropagation(); S.showTip(sk); return; }
        if (ev.target.closest(".sk-tip, .sk-zoomcast, .sk-zoomhead, .sk-zoomdots")) return;
        S.zoomShut();
    };
};
// Studio : cartes d'une tuile. Le côté décide du type : à gauche les sorts de l'Overlord, à droite les équipements.
S.studioAddCards = function(uid, kind) {
    var back = function(pos) { S.zoomTile(uid, {pos: pos}); };
    S.zoomShut();
    S.openItemPicker({title: t(kind == "sp" ? "add_spell" : "add_eq"), kind: kind, kinds: [kind],
        filter: kind == "sp" ? function(it) { return it.data && it.data.forOverlord; } : null,
        onClose: function() { back(kind == "sp" ? -1 : 1); },
        onAdd: function(sel) {
            var s = S.slotByUid(uid); if (!s || !sel.length) { back(0); return; }
            S.snapshot();
            s.cards = (s.cards || []).concat(sel.map(function(x) { return {kind: x.kind, ref: x.ref}; }));
            commit();
            back(kind == "sp" ? -S.slotCards(s, "sp").length : S.slotCards(s, "eq").length);
        }});
};
S.studioRemoveCard = function(uid, kind, k) {
    var s = S.slotByUid(uid); if (!s) return;
    var c = S.slotCards(s, kind)[k]; if (!c) return;
    S.snapshot();
    s.cards.splice(s.cards.indexOf(c), 1);
    commit();
    var n = S.slotCards(s, kind).length;
    S.zoomTile(uid, {pos: n ? (kind == "sp" ? -Math.min(k + 1, n) : Math.min(k + 1, n)) : 0});
};
// Double appui sur une tuile de la Rivière : le premier appui l'a sélectionnée, le second la désélectionne, puis le zoom s'ouvre.
S.bindTileZoom = function(root) {
    var last = {uid: null, at: 0};
    root.addEventListener("click", function(ev) {
        if (S.screen != "game") return;
        // Studio : un appui sur le cœur ouvre la tuile en grand, pour régler les points de vie.
        var heart = S.studio && ev.target.closest(".sk-river .sk-studiohp .sk-hp");
        if (heart) { var hb = heart.closest(".sk-tilebox[data-uid]"); if (hb) { S.zoomTile(hb.dataset.uid); return; } }
        if (ev.target.closest(".sk-hpwrap, [data-hp], button")) return;
        var box = ev.target.closest(".sk-river .sk-tilebox[data-uid]"); if (!box || box.hasAttribute("data-eventuid")) { last.uid = null; return; }
        var uid = box.dataset.uid, now = Date.now();
        if (last.uid == uid && now - last.at < 400) { last.uid = null; S.zoomTile(uid); return; }
        last.uid = uid; last.at = now;
    });
};
S.bindTileMenu = function(root) {
    var timer = null, sx = 0, sy = 0;
    var tileAt = function(target) {
        if (S.studio || S.screen != "game") return null;
        if (target.closest("[data-skill], .sk-hpwrap, [data-hp], button")) return null;
        var box = target.closest(".sk-river .sk-tilebox[data-uid]"); if (!box) return null;
        var s = S.slotByUid(box.dataset.uid);
        return s && !S.isEvent(s) ? s.uid : null;
    };
    var stop = function() { clearTimeout(timer); timer = null; };
    root.addEventListener("pointerdown", function(ev) {
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        var uid = tileAt(ev.target); if (!uid) return;
        sx = ev.clientX; sy = ev.clientY; stop();
        timer = setTimeout(function() { timer = null; S._suppressClick = true; S.openTileMenu(uid); }, 450);
    });
    root.addEventListener("pointermove", function(ev) { if (timer && (Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10)) stop(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function(n) { root.addEventListener(n, stop); });
    root.addEventListener("contextmenu", function(ev) {
        var uid = tileAt(ev.target); if (!uid) return;
        ev.preventDefault(); stop(); S.openTileMenu(uid);
    });
};

// Activation d'une tuile Événement : l'alerte qui était sur la poignée du panneau devient un message.
["activate", "drawToken"].forEach(function(k) {
    var orig = S[k];
    S[k] = function() {
        var before = S.state && S.state.log.length;
        orig.apply(S, arguments);
        if (S.state && S.state.lastEvent && S.state.log.length != before) S.toast(t("event_activated"));
    };
});

// ---------- Journal : notes du scénario, textes des Événements, puis toutes les actions ----------
S.openJournal = function() {
    var st = S.state, sc = st.scenario, h = "<div class='sk-journal'>";
    if (sc.title) h += "<h1>" + e(sc.title) + "</h1>";
    if (sc.notes) h += "<h2>" + e(t("scenario_notes")) + "</h2><p>" + e(sc.notes).replace(/\n/g, "<br>") + "</p>";
    var texts = S.eventTexts();
    if (texts.length) h += "<h2>" + e(t("scenario_events")) + "</h2>" + texts.map(function(x) {
        return "<h3>" + e(t("event_n", x.pos)) + "</h3><ul>" + x.lines.map(function(l) { return "<li>" + e(l) + "</li>"; }).join("") + "</ul>";
    }).join("");
    h += "<h2>" + e(t("journal_actions")) + "</h2>";
    if (!st.log.length) h += "<p>" + e(t("journal_empty")) + "</p>";
    else h += "<ol class='sk-jlist'>" + st.log.map(function(l) {
        var when = l.ts ? new Date(l.ts).toLocaleString(S.locale(), {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}) : "";
        return "<li>" + (when ? "<span class='sk-jtime'>" + e(when) + "</span>" : "") + "<b>" + e(t("journal_turn", l.turn)) + "</b> " + e(l.msg) + "</li>";
    }).join("") + "</ol>";
    Nav.dialog(e(t("log")), h + "</div>", null, []);
};

// ---------- Sauvegarde complète, reprise et état de départ ----------
// Copie de l'état de la partie, sans l'état de départ (et sans le Journal si keepLog est faux).
S.stateCopy = function(st, keepLog) {
    var c = JSON.parse(JSON.stringify(st)); delete c.origin;
    if (!keepLog) c.log = [];
    return c;
};
// Charger un scénario sauvegardé en cours de partie reprend la partie là où elle était, Journal compris.
var origStartGame = S.startGame;
S.startGame = function(force) {
    var d = S.draft;
    if (d && d.saved) {
        var cur = S.loadSaved();
        if (!force && cur && cur.river && cur.river.length) { S.ask(t("confirm_new"), t("confirm_new_yes"), function() { S.startGame(true); }); return; }
        var st = JSON.parse(JSON.stringify(d.saved));
        st.scenario.title = d.title || st.scenario.title;
        if (d.notes != null) st.scenario.notes = d.notes;
        st.campaign = S.ctx ? {cid: S.ctx.cid, idx: S.ctx.idx} : null;
        st.origin = S.stateCopy(st);
        S.undoStack = []; S._hpOpen = null; S.selected = null;
        S.state = st;
        if (!S.editing) S.log(t("log_resume", st.turn));
        S.save();
        if (S.onGameStart) S.onGameStart();
        S.renderGame();
        return;
    }
    origStartGame.apply(S, arguments);
    if (S.state && !S.state.origin) { S.state.origin = S.stateCopy(S.state); S.save(); }
};
// Préparation en mode studio (tour 0, aucune activation) : l'état de départ suit les modifications.
var origSave = S.save;
S.save = function() {
    var st = S.state;
    if (st && S.studio && !st.turn && !st.activations && S.screen == "game") st.origin = S.stateCopy(st);
    return origSave.apply(S, arguments);
};

// ---------- Renfort : la tuile coûte sa valeur de renfort en gemmes (Énergie → Fatigue), en mode Aventure ----------
S.reinforceCost = function(s) {
    if (!S.state || S.state.mode != "classic") return 0;
    var tile = S.tileOf(s), n = tile ? parseInt(tile.reinforcement, 10) : 0;
    return isNaN(n) ? 0 : n;
};
var origReinforce = S.reinforce;
S.reinforce = function(uid) {
    var st = S.state, s = S.slotByUid(uid); if (!s) return;
    var cost = S.reinforceCost(s);
    if (!cost) return origReinforce.apply(S, arguments);
    if (st.energy < cost) { S.toast(t("not_enough", cost, st.energy)); return; }
    S.snapshot();
    st.energy -= cost; st.fatigue += cost;
    S.hpGroup(s).forEach(function(g) { g.dead = false; if (g.lpMax) g.lp = g.lpMax; });
    S.log(t(cost == 1 ? "log_reinforce_cost_1" : "log_reinforce_cost", S.tileName(s), cost));
    S.save(); S.renderGame();
};

// ---------- Initialisation ----------
var origInit = S.init;
S.init = function(root) {
    origInit.apply(S, arguments);
    S.bindEventTips(root);
    S.bindCardTips(root);
    S.applyItemColors(); S.fixAllHeroColors();
    S.bindStudioDrag(root);
    S.bindActivateDrag(root);
    S.bindTileMenu(root);
    S.bindTileZoom(root);
    // Onglets : hors de l'écran, ils ont leur propre écoute.
    root.addEventListener("click", function(ev) {
        var b = ev.target.closest(".sk-tabs [data-nav]"); if (!b) return;
        ev.stopPropagation(); S.navClick(ev);
    });
    // Boutons − et + : modifient le champ et préviennent le formulaire.
    root.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-step]"); if (!b) return;
        ev.preventDefault(); ev.stopPropagation();
        var inp = b.parentNode.querySelector("input"); if (!inp) return;
        var v = (parseInt(inp.value, 10) || 0) + (+b.dataset.step), min = inp.min !== "" ? +inp.min : -9999, max = inp.max !== "" ? +inp.max : 9999;
        inp.value = Math.max(min, Math.min(max, v));
        inp.dispatchEvent(new Event("change", {bubbles: true}));
    }, true);
};

// ---------- Onglet Campagnes ----------
// Même logique que l'onglet Scénarios : cartes, filtres, écran vide en pêle-mêle, bouton flottant.
var campMode = function(sc) { var s = sc && sc.setup; return s ? (s.saved ? s.saved.mode : s.mode) : null; };
S.campaignCardCode = function(c) {
    var scs = c.scenarios || [], played = S.playedCount(c), vp = S.vpTotal(c);
    var info = [t("camp_progress", played, scs.length), t("vp_n", vp)];
    var dates = [];
    if (c.created) dates.push(t("created_on", fmtDay(c.created)));
    if (c.last) dates.push(t("last_played", fmtDay(c.last)));
    var dots = S.campaignDotsCode(c, true);
    var heroes = (c.heroes || []).map(function(h) {
        return "<span class='sk-chero" + (h.dead ? " dead" : "") + "' style='--hc:" + e(h.color || "#888") + "'>" + e(h.name) + "</span>";
    }).join("");
    return "<article class='sk-scard sk-ccard sk-cardlink' data-camp='" + c.id + "' tabindex='0' role='button' aria-label='" + e(t("open") + " : " + c.name) + "'>"
        + "<div class='sk-scard-head'><h3>" + e(c.name || t("untitled")) + "</h3>"
        + (S.campaignFinished(c) ? "<span class='sk-sbadge sk-cdone'>" + e(t("camp_done")) + "</span>" : "") + "</div>"
        + "<p class='sk-sinfo'>" + e(info.join(" · ")) + "</p>"
        + (dates.length ? "<p class='sk-sdates'>" + e(dates.join(" · ")) + "</p>" : "")
        + "<div class='sk-cheroes'>" + (heroes || "<span class='sk-sdates'>" + e(t("camp_no_hero")) + "</span>") + "</div>"
        + (dots || "<div class='sk-cthread'><span class='sk-sdates'>" + e(t("camp_no_scenario")) + "</span></div>")
        // Dupliquer pour rejouer, comme sur les cartes de scénario.
        + "<div class='sk-scard-acts'><span class='sk-scard-sp'></span><button class='sk-iconbtn sk-scact' data-cdup='" + c.id + "' title='" + e(t("duplicate_campaign")) + "' aria-label='" + e(t("duplicate_campaign") + " : " + (c.name || "—")) + "'>&#xf0c5;</button></div>"
        + "</article>";
};
// Écran vide : pêle-mêle de cartes de scénario (les vôtres s'il y en a, sinon l'exemple).
S.emptyCampaignsCode = function(filtered) {
    if (filtered) return "<p class='sk-snone'>" + e(t("no_campaign_match")) + "</p>";
    var src = S.scenarioList().slice(-4);
    while (src.length < 4) {
        var x = S.exampleScenario(), k = src.length;
        x.river = x.river.slice(k).concat(x.river.slice(0, k));
        src.push(x);
    }
    var cards = src.map(function(sc, k) {
        return "<div class='sk-cmini p" + k + "'><b>" + e(sc.title || t("untitled")) + "</b>" + S.riverThumbCode(sc) + "</div>";
    }).join("");
    return "<div class='sk-sempty'><div class='sk-cpelemele' aria-hidden='true'>" + cards + "</div><p>" + e(t("no_campaign")) + "<br>" + e(t("no_campaign_hint")) + "</p></div>";
};
S.renderCampaigns = function() {
    S.screen = "campaigns"; S.ctx = null;
    var list = S.campaigns(), pr = S.prefs();
    var seg = function(attr, cur, opts, label) {
        return "<div class='sk-seg sk-sseg' role='radiogroup' aria-label='" + e(t(label)) + "'>" + opts.map(function(m) {
            return "<button " + attr + "='" + m[0] + "' class='" + (cur == m[0] ? "sk-on" : "") + "' role='radio' aria-checked='" + (cur == m[0]) + "'>" + e(t(m[1])) + "</button>"; }).join("") + "</div>";
    };
    var h = "<div class='sk-scols'>" + S.filterPanelCode("<input type='search' class='sk-in sk-ssearch' id='sk-cq' placeholder='" + e(t("search_campaign")) + "' aria-label='" + e(t("search_campaign")) + "' value='" + e(pr.campQ || "") + "'>",
            [[t("filter_state"), seg("data-cstate", pr.campState || "", [["", "all_campaigns"], ["cur", "in_progress"], ["done", "finished"]], "filter_state")],
             [t("sort_by"), seg("data-csort", pr.campSort || "recent", [["recent", "sort_recent"], ["alpha", "sort_alpha"]], "sort_by")]])
        + "<div id='sk-clist' class='sk-slist'></div></div>" + S.filterExtrasCode() + S.floatingCode("campaign", t("new_campaign"));
    origMount.call(S, "<div class='skelos-game sk-screen sk-scen sk-camps'><div class='sk-board'>" + h + "</div></div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>");
    S.placeTabs(); S.bindFilterPanel();
    var draw = function() {
        var q = S.norm(pr.campQ || ""), stt = pr.campState || "", sort = pr.campSort || "recent";
        var rows = list.filter(function(c) {
            return (!q || S.norm(c.name || "").indexOf(q) >= 0) && (!stt || (stt == "done") == S.campaignFinished(c));
        });
        rows.sort(sort == "alpha"
            ? function(a, b) { return (a.name || "").localeCompare(b.name || "", undefined, {sensitivity: "base"}); }
            : function(a, b) { return (b.last || b.created || "").localeCompare(a.last || a.created || ""); });
        S.root.querySelector("#sk-clist").innerHTML = rows.length ? rows.map(S.campaignCardCode).join("") : S.emptyCampaignsCode(list.length > 0);
    };
    draw();
    S.root.querySelector("#sk-cq").addEventListener("input", function(ev) { pr.campQ = ev.target.value; S.savePrefs(); draw(); });
    var pick = function(attr, key, b) {
        pr[key] = b.getAttribute(attr); S.savePrefs();
        S.root.querySelectorAll("[" + attr + "]").forEach(function(x) { x.classList.toggle("sk-on", x == b); x.setAttribute("aria-checked", x == b); });
        draw();
    };
    S.screenClick = function(ev) {
        var b;
        if ((b = ev.target.closest("[data-cstate]"))) { pick("data-cstate", "campState", b); return; }
        if ((b = ev.target.closest("[data-csort]"))) { pick("data-csort", "campSort", b); return; }
        if ((b = ev.target.closest("[data-camp]"))) { S.renderCampaign(b.dataset.camp); return; }
    };
    S.bindCardKeys();
};
// Cartes cliquables : Entrée ou Espace ouvrent la carte au clavier.
S.bindCardKeys = function() {
    var scr = S.root.querySelector(".sk-screen"); if (!scr) return;
    scr.addEventListener("keydown", function(ev) {
        if ((ev.key == "Enter" || ev.key == " ") && ev.target.classList && ev.target.classList.contains("sk-cardlink")) { ev.preventDefault(); ev.target.click(); }
    });
};
S.deleteCampaign = function(cid) {
    var c = S.campaign(cid); if (!c) return;
    S.ask(t("confirm_delete_campaign_n", c.name || ""), t("delete"), function() {
        S.saveCampaigns(S.campaigns().filter(function(x) { return x.id != cid; }));
        if (S.state && S.state.campaign && S.state.campaign.cid == cid) { S.state.campaign = null; S.save(); }
        S.renderCampaigns();
    });
};
S.deleteEditedScenario = function() {
    var sid = S.editing && S.editing.sid, sc = S.scenarioList().filter(function(x) { return x.sid == sid; })[0]; if (!sc) return;
    S.ask(t(sc.source == "official" ? "confirm_delete_official" : "confirm_delete_scenario", sc.title || t("untitled")), t("delete"), function() {
        S.saveScenarios(S.scenarioList().filter(function(x) { return x.sid != sid; }));
        S.closeEditor(); S.renderScenarios();
    });
};
// Pastilles du fil (cartes et en-tête de la campagne).
S.campaignDotsCode = function(c, wrap) {
    var scs = c.scenarios || [], playing = S.state && S.state.campaign && S.state.campaign.cid == c.id ? S.state.campaign.idx : -1;
    if (!scs.length) return "";
    return "<div class='sk-cthread' role='img' aria-label='" + e(t("scenario_thread")) + "'>" + scs.map(function(sc, i) {
        var st = i == playing ? "playing" : sc.status == "win" || sc.status == "loss" ? sc.status : sc.setup ? "todo" : "empty";
        var lab = (i + 1) + ". " + (sc.title || t("scenario_to_choose")) + " — " + t("thread_" + st);
        return "<span class='sk-cdot " + st + "' title='" + e(lab) + "'>" + (i + 1) + "</span>";
    }).join("") + "</div>";
};
// En-tête de la campagne : titre suivi du fil, informations comme sur la carte, points de victoire en évidence, Journal et corbeille.
S.campaignHeadCode = function(c) {
    var scs = c.scenarios || [], info = [t("camp_progress", S.playedCount(c), scs.length)];
    if (c.created) info.push(t("created_on", fmtDay(c.created)));
    if (c.last) info.push(t("last_played", fmtDay(c.last)));
    var vp = S.vpTotal(c);
    return "<div class='sk-blk sk-headblk sk-chead'><button class='sk-btn sk-cback' data-nav='campaigns'>← " + e(t("campaigns")) + "</button>"
        + "<div class='sk-chead-t'><div class='sk-chead-row'><h2><button class='sk-ctitle' data-cact='settings' title='" + e(t("campaign_settings")) + "'>" + e(c.name || t("untitled"))
        + "<i aria-hidden='true'>&#xf303;</i></button></h2>"
        + (S.campaignFinished(c) ? "<span class='sk-sbadge sk-cdone'>" + e(t("camp_done")) + "</span>" : "") + S.campaignDotsCode(c) + "</div>"
        + "<p class='sk-sinfo'>" + e(info.join(" · ")) + "</p></div>"
        + "<div class='sk-cvp" + (vp < 0 ? " neg" : "") + "' role='img' aria-label='" + e(t("vp_n", vp)) + "'><b>" + vp + "</b><span>" + e(t("victory_points")) + "</span></div>"
        + "<div class='sk-chead-acts'><button class='sk-btn sk-icon sk-cjournal' data-cact='help' title='" + e(t("help")) + "' aria-label='" + e(t("help")) + "'>&#xf059;</button>"
        + "<button class='sk-btn sk-icon sk-cjournal' data-cact='journal' title='" + e(t("log")) + "' aria-label='" + e(t("log")) + "'>&#xf02d;</button>"
        + "<button class='sk-btn sk-icon sk-cjournal sk-danger' data-cact='cdelete' title='" + e(t("delete_campaign")) + "' aria-label='" + e(t("delete_campaign")) + "'>&#xf2ed;</button></div></div>";
};
// Aide de l'écran de campagne : une section par zone de l'écran.
S.openCampaignHelp = function() {
    var h = "<div class='sk-journal sk-help-doc'><h1>" + e(t("chelp_title")) + "</h1><p>" + e(t("chelp_intro")) + "</p>";
    ["head", "thread", "company", "cache", "end"].forEach(function(k) {
        h += "<h2>" + e(t("chelp_" + k)) + "</h2><ul>" + t("chelp_" + k + "_items").split("|").map(function(x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>";
    });
    Nav.dialog(e(t("help")), h + "</div>", null, []);
};
// Aide de la partie : sections communes, plus celles du mode joué (Aventure ou Coop).
S.openGameHelp = function() {
    var solo = S.state && S.state.mode == "solo";
    var h = "<div class='sk-journal sk-help-doc'><h1>" + e(t("ghelp_title")) + "</h1><p>" + e(t("ghelp_intro")) + "</p>";
    ["board", solo ? "coop" : "adventure", "tiles"].concat(solo ? [] : ["gems"]).concat(["tools", "studio"]).forEach(function(k) {
        h += "<h2>" + e(t("ghelp_" + k)) + "</h2><ul>" + t("ghelp_" + k + "_items").split("|").map(function(x) { return "<li>" + e(x) + "</li>"; }).join("") + "</ul>";
    });
    Nav.dialog(e(t("help")), h + "</div>", null, []);
};
// Nouvelle campagne : nom et mode, puis l'écran de la campagne.
S.newCampaign = function() {
    S.dialog("<h2>" + e(t("new_campaign")) + "</h2>"
        + "<label class='sk-fl'>" + e(t("name")) + "<input class='sk-in' id='sk-cn' placeholder='" + e(t("campaign_name_ph")) + "'></label>"
        + "<p>" + e(t("new_campaign_help")) + "</p>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ok>" + e(t("create")) + "</button><button class='sk-btn' data-dclose>" + e(t("cancel")) + "</button></div>",
        function(ev, close) {
            if (!ev.target.closest("[data-ok]")) return;
            var name = S.root.querySelector("#sk-cn").value.trim() || t("campaign_name_ph");
            var c = {id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name, scenarios: [], heroes: [], cache: [], log: [], created: nowIso()};
            S.campLog(c, t("clog_created"));
            var l = S.campaigns(); l.push(c); S.saveCampaigns(l);
            close(); S.renderCampaign(c.id);
        });
};

// Ajouter (ou choisir) un scénario : copie d'un de mes scénarios du même mode, nouveau dans l'éditeur, ou emplacement vide.
S.openChooseScenario = function(cid, idx) {
    var c = S.campaign(cid); if (!c) return;
    var list = S.scenarioList();
    var cards = list.map(function(sc, i) {
        return "<button class='sk-cpick' data-pick='" + i + "'><b>" + e(sc.title || t("untitled")) + "</b><span class='sk-smode'>" + e(t((sc.saved ? sc.saved.mode : sc.mode) == "solo" ? "mode_solo" : "mode_classic")) + "</span>" + S.riverThumbCode(sc) + "</button>";
    }).join("");
    S.dialog("<h2>" + e(t(idx == null ? "add_scenario" : "choose_scenario")) + "</h2>"
        + "<div class='sk-actions sk-cpick-top'><button class='sk-btn sk-primary' data-new>" + e(t("new_scenario")) + "</button>"
        + (idx == null ? "<button class='sk-btn' data-placeholder>" + e(t("placeholder_scenario")) + "</button>" : "") + "</div>"
        + "<div class='sk-fl'>" + e(t("from_my_scenarios", list.length)) + "</div>"
        + (cards ? "<div class='sk-cpicks'>" + cards + "</div>" : "<p>" + e(t("no_scenario")) + "</p>")
        + "<div class='sk-actions'><button class='sk-btn' data-dclose>" + e(t("cancel")) + "</button></div>",
        function(ev, close) {
            if (ev.target.closest("[data-new]")) { close(); S.openCampaignEditor(cid, idx); return; }
            if (ev.target.closest("[data-placeholder]")) {
                close();
                S.updateCampaign(cid, function(x) { x.scenarios.push({id: "s" + Date.now().toString(36), title: "", status: "todo", setup: null, vp: 0, date: null}); });
                S.renderCampaign(cid); return;
            }
            var p = ev.target.closest("[data-pick]"); if (!p) return;
            close();
            // Copie : modifier plus tard le scénario d'origine ne change pas la campagne.
            var src = list[+p.dataset.pick], setup = JSON.parse(JSON.stringify(src));
            setup.fromSid = src.sid; delete setup.sid;
            S.putCampaignScenario(cid, idx, setup, src.title || "");
            S.renderCampaign(cid);
        });
    var dlg = S.root.querySelector("#sk-overlay .sk-dialog"); if (dlg) dlg.classList.add("sk-cpickdlg");
};
S.putCampaignScenario = function(cid, idx, setup, title) {
    var at = idx;
    S.updateCampaign(cid, function(c) {
        var old = at != null ? c.scenarios[at] : null;
        var sc = {id: old ? old.id : "s" + Date.now().toString(36), title: title, status: old ? old.status : "todo", setup: setup, vp: old ? old.vp : 0, date: old ? old.date : null};
        if (old) { sc.turnReached = old.turnReached; if (old.plays) sc.plays = old.plays; c.scenarios[at] = sc; } else { c.scenarios.push(sc); at = c.scenarios.length - 1; }
        S.campLog(c, t("clog_scenario", title || t("untitled")));
    });
    return at;
};

// Éditeur dans l'onglet Campagnes : même plateau que l'onglet Scénarios, mode fixé par la campagne.
S.openCampaignEditor = function(cid, idx) {
    var c = S.campaign(cid); if (!c) return;
    var sc = idx != null ? c.scenarios[idx] : null, setup = sc && sc.setup ? JSON.parse(JSON.stringify(sc.setup)) : null;
    if (setup) setup.title = sc.title || setup.title;
    if (!setup) setup = S.blankScenario();
    S.openEditor(setup);
    S.editing.cid = cid; S.editing.idx = idx;
    S.renderGame();
};
var origOpenSave = S.openSaveScenario;
S.openSaveScenario = function() {
    if (!S.editing || !S.editing.cid) return origOpenSave.apply(S, arguments);
    var sc = S.state.scenario;
    Nav.dialog(e(t("save_in_campaign")),
        "<div class='sk-savedlg'><label for='sk-savetitle'>" + e(t("scenario_name")) + "</label>"
        + "<input id='sk-savetitle' type='text' value='" + e(sc.title || "") + "' placeholder='" + e(t("scenario_name_placeholder")) + "'>"
        + "<p class='sk-savemsg' id='sk-savemsg' role='alert'></p>"
        + "<label for='sk-savenotes'>" + e(t("notes")) + "</label><textarea id='sk-savenotes' rows='5'>" + e(sc.notes || "") + "</textarea>"
        + "<label class='sk-check sk-savealso'><input type='checkbox' id='sk-savealso'> " + e(t("also_my_scenarios")) + "</label>"
        + "<button type='button' class='sk-savebtn' onclick='Skelos.saveCampaignScenarioFromDialog()'>" + e(t("save_in_campaign")) + "</button></div>",
        null, [{fn: "Skelos.saveCampaignScenarioFromDialog()", icon: "skelos-save-icon", label: e(t("save_in_campaign"))}]);
    var inp = document.getElementById("sk-savetitle"); if (inp) { inp.focus(); inp.select(); }
};
S.saveCampaignScenarioFromDialog = function() {
    var title = (document.getElementById("sk-savetitle").value || "").trim();
    if (!title) { document.getElementById("sk-savemsg").textContent = t("title_required"); document.getElementById("sk-savetitle").focus(); return; }
    var st = S.state, ed = S.editing, also = document.getElementById("sk-savealso").checked;
    st.scenario.title = title; st.scenario.notes = document.getElementById("sk-savenotes").value;
    st.log = [];
    var d = S.scenarioFromState(); d.saved = S.stateCopy(st, true); d.title = title; d.notes = st.scenario.notes;
    var old = ed.idx != null ? (S.campaign(ed.cid).scenarios[ed.idx] || {}).setup : null;
    if (old && old.fromSid) d.fromSid = old.fromSid;
    delete d.sid; if (d.saved.scenario) delete d.saved.scenario.sid;
    S.putCampaignScenario(ed.cid, ed.idx, d, title);
    if (also) {
        var copy = JSON.parse(JSON.stringify(d)), now = nowIso();
        delete copy.fromSid; copy.sid = newSid(); copy.source = "user"; copy.created = now; copy.updated = now;
        if (copy.saved.scenario) copy.saved.scenario.sid = copy.sid;
        var l = S.scenarioList(); l.push(copy); S.saveScenarios(l);
    }
    Nav.closeDialog();
    var cid = ed.cid;
    S.closeEditor(); S.toast(t(also ? "saved_campaign_and_mine" : "saved_in_campaign"));
    S.renderCampaign(cid);
};

// Fil des scénarios d'une campagne : réordonné par glisser-déposer de la poignée.
S.moveCampaignScenario = function(cid, from, to) {
    if (from == to) return;
    var order = null;
    S.updateCampaign(cid, function(c) {
        order = c.scenarios.map(function(x, i) { return i; });
        c.scenarios.splice(to, 0, c.scenarios.splice(from, 1)[0]);
        order.splice(to, 0, order.splice(from, 1)[0]);
    });
    var st = S.state;
    if (st && st.campaign && st.campaign.cid == cid && order) { st.campaign.idx = order.indexOf(st.campaign.idx); S.save(); }
    S.renderCampaign(cid);
};
S.bindThreadDrag = function(cid) {
    var box = S.root.querySelector(".sk-thread"); if (!box) return;
    var drag = null;
    var rows = function() { return Array.prototype.slice.call(box.querySelectorAll(".sk-sc")); };
    var clean = function() { if (!drag) return; drag.row.classList.remove("sk-dragging"); rows().forEach(function(r) { r.classList.remove("sk-dropbefore", "sk-dropafter"); }); drag = null; };
    var targetAt = function(y) {
        var rs = rows(), to = rs.length - 1;
        for (var i = 0; i < rs.length; i++) { var rc = rs[i].getBoundingClientRect(); if (y < rc.top + rc.height / 2) { to = i; break; } }
        return to;
    };
    box.addEventListener("pointerdown", function(ev) {
        var g = ev.target.closest("[data-grip]"); if (!g || drag) return;
        ev.preventDefault();
        drag = {row: g.closest(".sk-sc"), from: +g.dataset.grip, id: ev.pointerId, y: ev.clientY, on: false};
        try { g.setPointerCapture(ev.pointerId); } catch (x) {}
    });
    box.addEventListener("pointermove", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) { if (Math.abs(ev.clientY - drag.y) < 6) return; drag.on = true; drag.row.classList.add("sk-dragging"); }
        ev.preventDefault();
        var to = targetAt(ev.clientY), rs = rows();
        rs.forEach(function(r, i) { r.classList.toggle("sk-dropbefore", i == to && to < drag.from); r.classList.toggle("sk-dropafter", i == to && to > drag.from); });
        drag.to = to;
    });
    box.addEventListener("pointerup", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        var from = drag.from, to = drag.on ? drag.to : null; clean();
        if (to != null) S.moveCampaignScenario(cid, from, to);
    });
    box.addEventListener("pointercancel", clean);
};

// ---------- Glisser-déposer des objets : cache → héros, héros → héros, héros → cache ----------
S.bindItemDrag = function(cid) {
    var box = S.root.querySelector(".sk-campaign"); if (!box) return;
    var drag = null;
    var targetAt = function(x, y) { var el = document.elementFromPoint(x, y); return el ? el.closest("[data-drophero], [data-drop='cache']") : null; };
    var clean = function() {
        if (!drag) return;
        if (drag.ghost) drag.ghost.remove();
        drag.chip.classList.remove("sk-dragging");
        box.querySelectorAll(".sk-dropon").forEach(function(x) { x.classList.remove("sk-dropon"); });
        document.documentElement.classList.remove("sk-itemdrag");
        drag = null;
    };
    box.addEventListener("pointerdown", function(ev) {
        if (drag || (ev.pointerType == "mouse" && ev.button != 0)) return;
        var chip = ev.target.closest(".sk-chip[data-item]"); if (!chip) return;
        drag = {chip: chip, item: chip.dataset.item, from: chip.dataset.from || null, id: ev.pointerId, x: ev.clientX, y: ev.clientY, on: false};
    });
    box.addEventListener("pointermove", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) {
            if (Math.abs(ev.clientX - drag.x) < 6 && Math.abs(ev.clientY - drag.y) < 6) return;
            drag.on = true; S.hideCardTip();
            try { drag.chip.setPointerCapture(ev.pointerId); } catch (x) {}
            var r = drag.chip.getBoundingClientRect();
            drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
            drag.ghost = drag.chip.cloneNode(true); drag.ghost.classList.add("sk-dragghost"); drag.ghost.style.width = r.width + "px";
            box.appendChild(drag.ghost);
            drag.chip.classList.add("sk-dragging");
            document.documentElement.classList.add("sk-itemdrag");
        }
        ev.preventDefault();
        drag.ghost.style.left = (ev.clientX - drag.dx) + "px"; drag.ghost.style.top = (ev.clientY - drag.dy) + "px";
        var tg = targetAt(ev.clientX, ev.clientY);
        box.querySelectorAll(".sk-dropon").forEach(function(x) { if (x != tg) x.classList.remove("sk-dropon"); });
        if (tg) tg.classList.add("sk-dropon");
    });
    box.addEventListener("pointerup", function(ev) {
        if (!drag || ev.pointerId != drag.id) return;
        if (!drag.on) { drag = null; return; }
        var tg = targetAt(ev.clientX, ev.clientY), item = drag.item, from = drag.from; clean();
        // Le clic qui suit le dépôt n'ouvre pas le menu de l'objet.
        var stop = function(e2) { e2.stopPropagation(); e2.preventDefault(); };
        window.addEventListener("click", stop, true); setTimeout(function() { window.removeEventListener("click", stop, true); }, 0);
        if (!tg) return;
        var owner = tg.dataset.drophero || null, moved = false;
        S.updateCampaign(cid, function(x) { (x.cache || []).forEach(function(it) {
            if (it.uid != item) return;
            if (it.kind != "up") { moved = S.setItemOwner(x, it, owner); return; }
            // Amélioration : le héros d'arrivée la prend, celui de départ la rend ; reposée dans la cache, elle est rendue.
            if (owner == from) return;
            if (owner && S.setTaker(x, it, owner, true)) moved = true;
            if (from && S.setTaker(x, it, from, false)) moved = true;
        }); });
        if (moved) S.renderCampaign(cid);
    });
    box.addEventListener("pointercancel", clean);
};

// ---------- Couleurs pastel : héros et types d'objets ne partagent jamais une couleur ----------
S.PASTELS = ["#f4a6a6", "#f5c6aa", "#f9e79f", "#d4e9a8", "#a8e6cf", "#b8e0d2", "#a0d8ef", "#b5c7f2", "#cdb4f0", "#f2b5d4", "#e8d5b5", "#d9d4cf"];
S.ITEM_COLOR_DEFAULTS = {eq: "#e8d5b5", sp: "#cdb4f0", up: "#a8e6cf"};
S.itemColors = function() {
    var ic = S.prefs().itemColors || {}, o = {};
    ["eq", "sp", "up"].forEach(function(k) { o[k] = S.PASTELS.indexOf(ic[k]) >= 0 ? ic[k] : S.ITEM_COLOR_DEFAULTS[k]; });
    return o;
};
S.applyItemColors = function() {
    var ic = S.itemColors(), st = document.documentElement.style;
    ["eq", "sp", "up"].forEach(function(k) { st.setProperty("--sk-c-" + k, ic[k]); });
};
var itemColorList = function() { var ic = S.itemColors(); return [ic.eq, ic.sp, ic.up]; };
// Couleurs libres pour un héros : ni celle d'un type d'objet, ni celle d'un autre héros de la campagne.
S.freeHeroColors = function(c, exceptHid) {
    var used = itemColorList().concat((c.heroes || []).filter(function(h) { return h.id != exceptHid; }).map(function(h) { return h.color; }));
    return S.PASTELS.filter(function(x) { return used.indexOf(x) < 0; });
};
S.pickHeroColor = function(c, exceptHid) {
    var f = S.freeHeroColors(c, exceptHid), items = itemColorList();
    if (!f.length) f = S.PASTELS.filter(function(x) { return items.indexOf(x) < 0; });
    return f[Math.floor(Math.random() * f.length)];
};
// Un héros dont la couleur n'est plus valable (pas pastel, prise par un type d'objet ou par un autre héros) en reçoit une libre au hasard.
S.fixHeroColors = function(c) {
    var taken = itemColorList(), bad = [], n = 0;
    (c.heroes || []).forEach(function(h) { if (S.PASTELS.indexOf(h.color) >= 0 && taken.indexOf(h.color) < 0) taken.push(h.color); else bad.push(h); });
    bad.forEach(function(h) {
        var f = S.PASTELS.filter(function(x) { return taken.indexOf(x) < 0; });
        if (!f.length) f = S.PASTELS.filter(function(x) { return itemColorList().indexOf(x) < 0; });
        h.color = f[Math.floor(Math.random() * f.length)]; taken.push(h.color); n++;
    });
    return n;
};
S.fixAllHeroColors = function() {
    var l = S.campaigns(), n = 0;
    l.forEach(function(c) { n += S.fixHeroColors(c); });
    if (n) S.saveCampaigns(l);
    return n;
};
// Nuancier : un bouton par couleur ; la valeur retenue est dans data-value du conteneur.
S.swatchesCode = function(colors, current, id, kind) {
    if (current && colors.indexOf(current) < 0) colors = [current].concat(colors);
    return "<div class='sk-swatches' role='radiogroup' id='" + id + "' data-value='" + e(current || "") + "'" + (kind ? " data-kind='" + kind + "'" : "") + ">"
        + colors.map(function(x) { var on = x == current; return "<button type='button' class='sk-swatch" + (on ? " on" : "") + "' role='radio' aria-checked='" + on + "' data-col='" + x + "' style='--sw:" + x + "' aria-label='" + x + "'></button>"; }).join("") + "</div>";
};
S.swatchClick = function(ev) {
    var sw = ev.target.closest("[data-col]"); if (!sw) return false;
    var box = sw.closest(".sk-swatches"); box.dataset.value = sw.dataset.col;
    box.querySelectorAll(".sk-swatch").forEach(function(b) { var on = b == sw; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    return true;
};

// ---------- Écran de campagne : objets triés, bouton Journal à droite des onglets ----------
S.sortItems = function(list) {
    var ord = {eq: 0, sp: 1, up: 2};
    return list.slice().sort(function(a, b) { return (ord[a.kind] - ord[b.kind]) || String(a.name).localeCompare(String(b.name), "fr", {sensitivity: "base"}); });
};
S.openCampaignJournal = function(cid) {
    var c = S.campaign(cid); if (!c) return;
    var fmt = S.fmtDay;
    var h = "<div class='sk-journal'><h1>" + e(c.name) + "</h1>";
    if (!(c.log || []).length) h += "<p>" + e(t("journal_empty")) + "</p>";
    else h += "<ol class='sk-jlist'>" + c.log.map(function(l) { return "<li>" + (l.d ? "<span class='sk-jtime'>" + e(fmt(l.d)) + "</span>" : "") + e(l.msg) + "</li>"; }).join("") + "</ol>";
    Nav.dialog(e(t("log")), h + "</div>", null, []);
};

// ---------- Export et import des scénarios et des campagnes, à la manière du Studio du Compagnon ----------
// Mêmes dialogues : cartes cochables (croix rouge / coche verte), « La totale ! » à gauche, l'action à droite.
S.xferCardsCode = function(kind, list, exists) {
    if (!list.length) return "<div class='nocards'>" + e(t(kind == "sc" ? "xfer_none_sc" : "xfer_none_camp")) + "</div>";
    return "<div class='sk-xlist'>" + list.map(function(x, i) {
        var id = "sk-x-" + kind + "-" + i, ex = exists && exists(x);
        var card = kind == "sc" ? S.scenarioCardCode(x, i) : S.campaignCardCode(x);
        return "<input type='checkbox' id='" + id + "' name='skelos-" + kind + "' data-index='" + i + "'" + (exists && !ex ? " checked='checked'" : "") + "/>"
            + "<label for='" + id + "' class='sk-xitem'>" + card + (ex ? "<span class='sk-xexists'>" + e(t("xfer_exists")) + "</span>" : "") + "</label>";
    }).join("") + "</div>";
};
S.xferWarn = function(msg) { if (window.About && About.warnToast) About.warnToast(msg); else S.toast(msg); };
S._xferAll = function() { $(".sk-xfer input[type='checkbox']").prop("checked", true); };
S._xferChecked = function(kind) {
    return $(".sk-xfer input[name='skelos-" + kind + "']:checked").map(function(a, b) { return parseInt($(b).data("index"), 10); }).get();
};
S.xferKind = function() { return S.screen == "campaigns" ? "camp" : "sc"; };
S.openExport = function() {
    var kind = S._xferKind = S.xferKind();
    Nav.dialog(t("xfer_export"),
        "<div class='printcards sk-xfer'>"
            + "<p class='hint'>" + e(t("xfer_export_hint_" + kind)) + "</p>"
            + (kind == "sc" ? S.xferCardsCode("sc", S.scenarioList()) : S.xferCardsCode("camp", S.campaigns()))
        + "</div>",
        null,
        [{label: t("xfer_all"), icon: "skelos-allin", fn: "Skelos._xferAll();"}],
        [{icon: "skelos-export-icon", label: t("xfer_export"), fn: "Skelos._export()"}]);
};
S._export = function() {
    var scs = S._xferChecked("sc"), camps = S._xferChecked("camp");
    if (!scs.length && !camps.length) { S.xferWarn(t("xfer_export_empty")); return; }
    var all = S.scenarioList(), cl = S.campaigns();
    var data = {format: "skelos", version: 1, exported: new Date().toISOString().slice(0, 10)};
    if (S._xferKind == "camp") data.campaigns = camps.map(function(i) { return cl[i]; });
    else data.scenarios = scs.map(function(i) { return all[i]; });
    Nav.closeDialog();
    // Téléchargement direct, comme le Studio.
    var file = new Blob([JSON.stringify(data, null, 4)], {type: "application/json"}), a = document.createElement("a"), url = URL.createObjectURL(file);
    a.href = url; a.download = Application + "-Skelos-" + new Date().getTime() + ".json";
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
};
S.openImport = function() {
    S._xferData = null; S._xferKind = S.xferKind();
    Nav.dialog(t("xfer_import"),
        "<div class='importcards printcards sk-xfer'>"
            + "<h1>" + e(t("xfer_import_hint")) + "</h1>"
            + "<p class='hint'><label><button type='button' onclick='this.nextSibling.click()'>" + e(t("xfer_choose")) + "</button><input type='file' accept='.json,application/json' onchange='Skelos._importFile(this)'/></label></p>"
            + "<h1>" + e(t("xfer_import_hint2")) + "</h1>"
            + "<div id='sk-xresult'><p class='hint'>" + e(t("xfer_import_todo")) + "</p></div>"
            + "<h1>" + e(t("xfer_import_hint3")) + "</h1>"
        + "</div>",
        null,
        [{label: t("xfer_all"), icon: "skelos-allin", fn: "Skelos._xferAll();"}],
        [{icon: "skelos-import-icon", label: t("xfer_import"), fn: "Skelos._import()"}]);
};
S._importFile = function(input) {
    var out = document.getElementById("sk-xresult");
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(ev) {
            var o; S._xferData = null;
            try { o = JSON.parse(ev.target.result); } catch (x) { out.innerHTML = "<p class='hint'>" + e(t("xfer_import_error")) + "</p>"; return; }
            var kind = S._xferKind;
            var scs = kind == "sc" && o && Array.isArray(o.scenarios) ? o.scenarios : [], camps = kind == "camp" && o && Array.isArray(o.campaigns) ? o.campaigns : [];
            if (!scs.length && !camps.length) { out.innerHTML = "<p class='hint'>" + e(t("xfer_import_empty_" + kind)) + "</p>"; return; }
            S._xferData = {scenarios: scs, campaigns: camps};
            var hasSc = {}, hasC = {};
            S.scenarioList().forEach(function(x) { hasSc[x.sid] = 1; });
            S.campaigns().forEach(function(x) { hasC[x.id] = 1; });
            out.innerHTML = kind == "sc" ? S.xferCardsCode("sc", scs, function(x) { return x.sid && hasSc[x.sid]; })
                : S.xferCardsCode("camp", camps, function(x) { return x.id && hasC[x.id]; });
        };
        reader.readAsText(input.files[0]);
    }
    input.value = "";
};
// Exporter et Importer ne s'affichent qu'à l'accueil des onglets Scénarios et Campagnes.
S.syncXferActions = function() {
    var on = (S.screen == "scenarios" || S.screen == "campaigns") && !S.editing;
    ["skelos-export", "skelos-import"].forEach(function(id) { if (window.Nav && Nav.hideAction) Nav[on ? "showAction" : "hideAction"]("skelos", id); });
};
var placeTabsXfer = S.placeTabs;
S.placeTabs = function() { placeTabsXfer.apply(S, arguments); S.syncXferActions(); };
S._import = function() {
    var d = S._xferData, scs = S._xferChecked("sc"), camps = S._xferChecked("camp");
    if (!d || (!scs.length && !camps.length)) { S.xferWarn(t("xfer_import_nothing")); return; }
    // Même identifiant : l'élément importé remplace l'existant ; sinon il s'ajoute.
    var merge = function(list, items, key, mk) {
        items.forEach(function(it) {
            it = JSON.parse(JSON.stringify(it)); delete it.prechecked;
            if (!it[key]) it[key] = mk();
            var k = list.findIndex(function(x) { return x[key] == it[key]; });
            if (k >= 0) list[k] = it; else list.push(it);
        });
        return list;
    };
    if (scs.length) S.saveScenarios(merge(S.scenarioList(), scs.map(function(i) { return d.scenarios[i]; }), "sid", newSid));
    if (camps.length) S.saveCampaigns(merge(S.campaigns(), camps.map(function(i) { return d.campaigns[i]; }), "id", function() { return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }));
    Nav.closeDialog();
    S.toast(t("xfer_import_done", scs.length + camps.length));
    if (!S.root) return;
    if (S.screen == "scenarios") S.renderScenarios();
    else if (S.screen == "campaigns") S.renderCampaigns();
    else if (S.screen == "campaign" && S.curCampaign) S.renderCampaign(S.curCampaign);
    else if (S.screen == "home") S.renderHome();
};

// ---------- Compagnie : héros choisis dans l'encyclopédie du Compagnon, présentés en quatre fiches ----------
// On ne garde du héros que son nom et son image ; la fiche accueillera son équipement.
var COMPANY_SIZE = 4;
var plain = function(s) { return String(s || "").replace(/<[^>]+>/g, "").trim(); };
S.heroCatalog = function() {
    return ((Encyclopedia.heroes && Encyclopedia.heroes.list) || []).map(function(x) {
        return {ref: x.id, name: plain(x.name), sub: plain(x.subname), image: x.image || "", origins: x.origins || []};
    }).filter(function(x) { return x.name; }).sort(function(a, b) { return (a.name + " " + a.sub).localeCompare(b.name + " " + b.sub, "fr"); });
};
// Image d'un héros : celle retenue au choix, sinon celle d'un héros de l'encyclopédie du même nom (anciens héros saisis à la main).
S.heroImage = function(hh) {
    if (hh.image) return hh.image;
    var n = S.norm(hh.name || ""), x = S.heroCatalog().filter(function(k) { return S.norm(k.name) == n; })[0];
    return x ? x.image : "";
};
// Fiche complète du héros, dessinée par le Compagnon (comme dans son encyclopédie).
S.heroSheetFull = function(ref) {
    try {
        if (typeof HeroSheet == "undefined" || typeof EncyclopediaHeroes == "undefined") return null;
        var x = (Encyclopedia.heroes.list || []).filter(function(h) { return h.id == ref; })[0];
        return x ? HeroSheet._cardCode(EncyclopediaHeroes._convertHeroToStudio(x, false)) : null;
    } catch (err) { return null; }
};
S.companyFree = function(c) { return Math.max(0, COMPANY_SIZE - (c.heroes || []).filter(function(h) { return !h.dead; }).length); };
S.heroSheetCode = function(c, hh) {
    var items = S.sortItems((c.cache || []).filter(function(it) { return S.heldBy(it, hh.id); })), img = S.heroImage(hh);
    return "<div class='sk-hsheet" + (hh.dead ? " dead" : "") + "' data-drophero='" + hh.id + "' style='--hc:" + hh.color + "'>"
        + "<button class='sk-hsheet-p' data-cact='hero' data-hero='" + hh.id + "' aria-label='" + e(t("edit_hero") + " : " + hh.name) + "'>"
        + (img ? "<img src='" + e(img) + "' alt='' loading='lazy'>" : "<span class='sk-hsheet-ini' aria-hidden='true'>" + e((hh.name || "?").charAt(0)) + "</span>") + "</button>"
        + "<div class='sk-hsheet-n'><b>" + e(hh.name) + "</b>" + (hh.sub ? "<small>" + e(hh.sub) + "</small>" : "") + "</div>"
        + (hh.dead ? "<span class='sk-st loss'>" + e(t("fell_at", hh.deadAt || "?")) + "</span>" : "")
        + "<div class='sk-hsheet-eq'><div class='sk-hsheet-t'>" + e(t("hero_equipment")) + "</div><div class='sk-chips'>"
        + items.map(function(it) { return S.chipCode(c, it, {menu: true, initial: false, hero: hh.id}); }).join("")
        + "<button class='sk-chip sk-chipadd' data-act='heroassign' data-cid='" + c.id + "' data-hero='" + hh.id + "'>+ " + e(t("assign")) + "</button></div></div></div>";
};
S.companyCode = function(c) {
    var h = "<div class='sk-company'>" + (c.heroes || []).map(function(hh) { return S.heroSheetCode(c, hh); }).join("");
    for (var i = S.companyFree(c); i > 0; i--) h += "<button class='sk-hsheet sk-hsheet-empty' data-cact='addhero'><span aria-hidden='true'>+</span><small>" + e(t("add_hero")) + "</small></button>";
    return h + "</div>";
};
// Sélection multiple des héros, sur le modèle du choix des tuiles : on touche, l'ordre s'affiche, on ajoute la sélection.
S.openHeroPicker = function(cid) {
    var c = S.campaign(cid), pr = S.prefs(), sel = [], free = S.companyFree(c);
    var have = {}; (c.heroes || []).forEach(function(h) { if (!h.dead) have[S.norm(h.name)] = true; });
    var ov = S.root.querySelector("#sk-overlay");
    ov.innerHTML = "<div class='sk-dialog sk-pickdlg sk-hpickdlg' role='dialog' aria-modal='true'><div class='sk-dialog-head'><h2>" + e(t("hero_picker_title")) + "</h2>"
        + "<div class='sk-actions sk-pickactions'><button class='sk-btn sk-primary' data-addsel disabled>" + e(t("add_selection", 0)) + "</button>"
        + "<button class='sk-btn' data-pclose>" + e(t("close")) + "</button></div></div>"
        + "<div class='sk-filters'><input type='search' id='sk-hq' placeholder='" + e(t("search_hero")) + "' value='" + e(pr.heroQ || "") + "'>" + S.scopeCode() + "</div>"
        + "<div class='sk-pickstatus' id='sk-hst' role='status'></div><div class='sk-picker sk-hpicker' id='sk-hg'></div></div>";
    ov.classList.add("on");
    var cat = S.heroCatalog(), byRef = {}; cat.forEach(function(x) { byRef[x.ref] = x; });
    var status = function() {
        ov.querySelector("#sk-hst").innerHTML = "<div>" + e(t("hero_selection_count", sel.length, free)) + "</div><div class='sk-selchips'>" + sel.map(function(r, i) {
            return "<button class='sk-chip' data-unsel='" + i + "' aria-label='" + e(t("unselect", byRef[r].name)) + "'><span class='sk-chip-n'>" + (i + 1) + "</span>" + e(byRef[r].name) + " <span aria-hidden='true'>✕</span></button>";
        }).join("") + "</div>";
        var a = ov.querySelector("[data-addsel]"); a.disabled = !sel.length; a.textContent = t("add_selection", sel.length);
        ov.querySelectorAll(".sk-hpick[data-ref]").forEach(function(p) {
            var k = sel.indexOf(p.dataset.ref), bd = p.querySelector(".sk-pickbadge");
            if (k >= 0) { if (!bd) { bd = document.createElement("span"); bd.className = "sk-pickbadge"; p.appendChild(bd); } bd.textContent = k + 1; p.classList.add("picked"); }
            else { if (bd) bd.remove(); p.classList.remove("picked"); }
            p.setAttribute("aria-pressed", k >= 0);
        });
    };
    var draw = function() {
        pr.heroQ = ov.querySelector("#sk-hq").value; S.savePrefs();
        var q = S.norm(pr.heroQ);
        var out = cat.filter(function(x) {
            if (!S.inScope(x.origins)) return false;
            return !q || S.norm(x.name + " " + x.sub).indexOf(q) >= 0;
        }).map(function(x) {
            var inco = have[S.norm(x.name)];
            var full = S.heroSheetFull(x.ref), lbl = x.name + (x.sub ? " " + x.sub : "") + (inco ? " — " + t("in_company") : "");
            if (full) return "<button class='sk-hpick sk-hpick-full" + (inco ? " sk-inco" : "") + "' data-ref='" + e(x.ref) + "' aria-label='" + e(lbl) + "'" + (inco ? " disabled" : "") + ">"
                + "<span class='sk-hsheetscale'>" + full + "</span>" + (inco ? "<span class='sk-inco-t'>" + e(t("in_company")) + "</span>" : "") + "</button>";
            return "<button class='sk-hpick" + (inco ? " sk-inco" : "") + "' data-ref='" + e(x.ref) + "'" + (inco ? " disabled title='" + e(t("in_company")) + "'" : "") + ">"
                + "<span class='sk-hpick-i'>" + (x.image ? "<img src='" + e(x.image) + "' alt='' loading='lazy'>" : "") + "</span>"
                + "<span class='sk-hpick-n'><b>" + e(x.name) + "</b>" + (x.sub ? "<small>" + e(x.sub) + "</small>" : "") + (inco ? "<small class='sk-inco-t'>" + e(t("in_company")) + "</small>" : "") + "</span></button>";
        }).join("");
        ov.querySelector("#sk-hg").innerHTML = out || "<p class='sk-help'>" + e(t("no_hero_found")) + "</p>";
        status();
    };
    var close = function() { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; };
    ov.querySelector("#sk-hq").addEventListener("input", draw);
    S.bindScope(ov, draw);
    ov.onclick = function(ev) {
        if (ev.target === ov || ev.target.closest("[data-pclose]")) { close(); return; }
        var un = ev.target.closest("[data-unsel]"); if (un) { sel.splice(+un.dataset.unsel, 1); status(); return; }
        if (ev.target.closest("[data-addsel]")) {
            var picked = sel.map(function(r) { return byRef[r]; });
            S.updateCampaign(cid, function(x) {
                x.heroes = x.heroes || [];
                picked.forEach(function(k) {
                    x.heroes.push({id: "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ref: k.ref, name: k.name, sub: k.sub, image: k.image,
                        color: S.pickHeroColor(x, null), dead: false});
                    S.campLog(x, t("clog_hero", k.name));
                });
            });
            close(); S.renderCampaign(cid); return;
        }
        var p = ev.target.closest(".sk-hpick[data-ref]"); if (!p || p.disabled) return;
        var k = sel.indexOf(p.dataset.ref), nm = S.norm(byRef[p.dataset.ref].name);
        var twin = sel.filter(function(r) { return S.norm(byRef[r].name) == nm; })[0];
        if (k >= 0) sel.splice(k, 1);
        else if (twin) { sel[sel.indexOf(twin)] = p.dataset.ref; }
        else if (sel.length >= free) { S.toast(t("company_full", COMPANY_SIZE)); return; }
        else { sel.push(p.dataset.ref); p.classList.remove("added"); void p.offsetWidth; p.classList.add("added"); }
        status();
    };
    draw(); S.softFocus(ov.querySelector("#sk-hq"));
};

// ---------- Carte d'un objet au survol de la souris (équipement, sort, amélioration) ----------
S.cardTipCode = function(code) {
    var p = String(code).split(":"), kind = p[0], ref = p.slice(1).join(":");
    var real = kind == "up" ? null : S.realCardCode(kind, ref);
    if (real) return "<span class='sk-cardscale'>" + real + "</span>";
    var it = S.catalog(kind).filter(function(x) { return x.ref == ref; })[0];
    return it ? S.itemCardCode(it) : "";
};
S.showCardTip = function(el) {
    var html = S.cardTipCode(el.dataset.card); if (!html) { S.hideCardTip(); return; }
    var tip = S.root.querySelector("#sk-cardtip");
    if (!tip) { tip = document.createElement("div"); tip.id = "sk-cardtip"; tip.className = "sk-cardtip"; tip.setAttribute("aria-hidden", "true"); S.root.appendChild(tip); }
    if (tip.dataset.card != el.dataset.card) { tip.innerHTML = html; tip.dataset.card = el.dataset.card; }
    tip.classList.add("on");
    var place = function() {
        if (tip.dataset.card != el.dataset.card || !el.isConnected) return;
        // Hauteur attendue d'une carte même avant le chargement de son image (rapport 0,67).
        var b = el.getBoundingClientRect(), w = tip.offsetWidth, hg = Math.max(tip.offsetHeight, Math.round(w / 0.67));
        var bottom = window.innerHeight - 8, nb = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 2);
        // La barre de navigation du Compagnon, en bas, ne doit pas couvrir la carte.
        while (nb && nb != document.body && !S.root.contains(nb) && ["fixed", "absolute", "sticky"].indexOf(getComputedStyle(nb).position) < 0) nb = nb.parentElement;
        if (nb && nb != document.body && !S.root.contains(nb)) bottom = Math.min(bottom, nb.getBoundingClientRect().top - 8);
        var left = b.right + 10; if (left + w > window.innerWidth - 8) left = Math.max(8, b.left - w - 10);
        var top = Math.max(8, Math.min(b.top + b.height / 2 - hg / 2, bottom - hg));
        tip.style.left = left + "px"; tip.style.top = top + "px";
    };
    place();
    tip.querySelectorAll("img").forEach(function(im) { if (!im.complete) im.addEventListener("load", place, {once: true}); });
};
S.hideCardTip = function() { var tip = S.root && S.root.querySelector("#sk-cardtip"); if (tip) tip.classList.remove("on"); };
S.bindCardTips = function(root) {
    root.addEventListener("mouseover", function(ev) {
        if (S._lastPointer && S._lastPointer != "mouse") return;
        var el = ev.target.closest(".sk-chip[data-card]");
        if (el) S.showCardTip(el); else S.hideCardTip();
    });
    root.addEventListener("mouseleave", S.hideCardTip);
    root.addEventListener("pointerdown", S.hideCardTip, true);
    window.addEventListener("scroll", S.hideCardTip, true);
};

// ---------- Bloc Phase : étapes écrites aussi grand que possible, même taille pour les quatre ----------
// La plus grande taille qui tient dans chaque case est cherchée, puis la plus petite de ces tailles est appliquée
// partout. Recalculé à chaque rendu, au changement de taille de l'écran et quand la police du jeu a chargé.
S.fitPhase = function() {
    var r = S.root; if (!r) return;
    var lis = Array.prototype.slice.call(r.querySelectorAll(".sk-a-phase li")); if (!lis.length) return;
    var best = lis.map(function(li) {
        var sp = li.lastElementChild;
        var fits = function(px) { sp.style.fontSize = px + "px"; return li.scrollHeight <= li.clientHeight + 1 && sp.scrollWidth <= sp.clientWidth + 1; };
        var lo = 7, hi = 44;
        while (hi - lo > 0.5) { var mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
        return Math.floor(lo * 2) / 2;
    });
    var px = Math.min.apply(Math, best);
    lis.forEach(function(li) { li.lastElementChild.style.fontSize = px + "px"; });
};
var fitRenderGame = S.renderGame;
S.renderGame = function() { fitRenderGame.apply(S, arguments); S.fitPhase(); };
// Le plateau se redessine en entier à chaque action : le temps du redessin, la page raccourcit et le défilement
// du module recule (sélectionner une tuile de la dernière rangée faisait remonter l'écran d'une demi-tuile).
// On garde la position de défilement d'un redessin à l'autre, tant qu'on reste sur le plateau.
// (Avant les animations, qui mesurent les tuiles après le redessin.)
var scrollRenderGame = S.renderGame;
S.renderGame = function() {
    var root = S.root, keep = root && S.screen == "game" && S._lastScreen == "game" ? root.scrollTop : null;
    scrollRenderGame.apply(S, arguments);
    if (keep == null || !S.root || S.screen != "game") return;
    S.root.scrollTop = keep;
    requestAnimationFrame(function() { if (S.screen == "game" && Math.abs(S.root.scrollTop - keep) > 1) S.root.scrollTop = keep; });
};
var fitTimer = null;
window.addEventListener("resize", function() { clearTimeout(fitTimer); fitTimer = setTimeout(S.fitPhase, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function() { S.fitPhase(); });
})();

// ---------- Étape 24 : sorts et équipements des tuiles ----------
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
// Bouton Sort : s'il reste des sorts sur des tuiles vivantes, il ouvre la main des sorts ; sinon il ajoute une gemme, comme avant.
// Appui long : une gemme sans ouvrir la main (sort hors des cartes).
var baseBoost = S.boost;
S.boost = function(kind) {
    if (kind == "spell" && !S._forceGem && !S.studio) {
        var hand = S.spellSlots();
        if (hand.length) { S.zoomTile(hand[0].uid, {hand: true, pos: -1}); return; }
    }
    S._forceGem = false;
    return baseBoost.apply(S, arguments);
};
S.bindSpellPress = function(root) {
    var timer = null, sx = 0, sy = 0;
    root.addEventListener("pointerdown", function(ev) {
        var b = ev.target.closest("[data-act='boost'][data-k='spell']"); if (!b || S.studio) return;
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        sx = ev.clientX; sy = ev.clientY; clearTimeout(timer);
        timer = setTimeout(function() { timer = null; S._suppressClick = true; S._forceGem = true; S.boost("spell"); if (navigator.vibrate) navigator.vibrate(20); }, 450);
    });
    root.addEventListener("pointermove", function(ev) { if (timer && (Math.abs(ev.clientX - sx) > 10 || Math.abs(ev.clientY - sy) > 10)) { clearTimeout(timer); timer = null; } });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function(n) { root.addEventListener(n, function() { clearTimeout(timer); timer = null; }); });
    root.addEventListener("contextmenu", function(ev) { if (ev.target.closest("[data-act='boost'][data-k='spell']")) ev.preventDefault(); });
};
var baseInit = S.init;
S.init = function(root) { var r = baseInit.apply(S, arguments); S.bindSpellPress(root); return r; };
// Pastille au coin des tuiles qui portent des cartes : nombre de sorts et d'équipements.
S.decorateCards = function() {
    if (!S.root || !S.state) return;
    S.root.querySelectorAll(".sk-river .sk-tilebox[data-uid]").forEach(function(box) {
        var s = S.slotByUid(box.dataset.uid), sp = S.slotCards(s, "sp").length, eq = S.slotCards(s, "eq").length;
        var old = box.querySelector(".sk-cardsbadge"); if (old) old.remove();
        if (!sp && !eq) return;
        box.insertAdjacentHTML("beforeend", "<span class='sk-cardsbadge' role='img' aria-label='" + e(t("cards_badge", sp, eq)) + "' title='" + e(t("cards_badge", sp, eq)) + "'>"
            + (sp ? "<i class='sk-cb-sp'>&#xf0d0;</i>" + sp : "") + (eq ? "<i class='sk-cb-eq'>&#xf3ed;</i>" + eq : "") + "</span>");
    });
};
var cardsRender = S.renderGame;
S.renderGame = function() { var r = cardsRender.apply(S, arguments); if (S.screen == "game") S.decorateCards(); return r; };
// Fin du tour de l'Overlord : les gemmes des sorts rejoignent la fatigue, les sorts lancés redeviennent disponibles.
var baseClearCast = S.clearBoosts;
S.clearBoosts = function() { var r = baseClearCast.apply(S, arguments); if (S.state) S.state.cast = {}; return r; };
// Tuile morte : rappel des équipements qu'elle laisse au sol (Journal et message).
var baseKill = S.killSlot;
S.killSlot = function(slot) {
    var r = baseKill.apply(S, arguments);
    var eq = S.slotCards(slot, "eq");
    if (eq.length) {
        var msg = t("log_drop", S.tileName(slot), eq.map(function(c) { return S.itemName("eq", c.ref); }).join(", "));
        S.log(msg); setTimeout(function() { S.toast(msg); }, 50);
    }
    return r;
};
})();
