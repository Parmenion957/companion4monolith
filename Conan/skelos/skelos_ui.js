// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Ce module n'ajoute aucune image ni donnée de Monolith :
// il utilise celles déjà chargées par le Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell).
//
// Interface à la charte du Compagnon : jetons du jeu, commandes au-dessus des tuiles 6 à 8, étapes du tour,
// onglets, boîtes de dialogue plein écran, boutons − et +, descriptions des tuiles Événement, icônes personnalisées.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
var KEY_ICONS = Application + "_SkelosIcons";

// ---------- Icônes et jetons ----------
// Images du Compagnon par défaut ; l'utilisateur peut charger les siennes, gardées sur son appareil.
S.ICON_DEFAULTS = {
    move: "studio/tile/img/movement.webp",
    defense: "studio/hero_sheet/img/d_defense.webp",
    reroll: "resources/img/dice_red_reroll.webp",
    spell: "data/skills/img/magic/spell_caster.webp",
    gem: "resources/img/gem_red.webp",
    time: "data/tokens/img/time.webp",
    alarm: "data/tokens/img/alarm.webp",
    tokenback: "data/tokens/img/marker.webp"
};
S.CUSTOMIZABLE = ["move", "defense", "reroll"];
S.customIcons = function() { try { return JSON.parse(localStorage.getItem(KEY_ICONS)) || {}; } catch (x) { return {}; } };
S.saveCustomIcons = function(o) { try { localStorage.setItem(KEY_ICONS, JSON.stringify(o)); return true; } catch (x) { S.toast(t("storage_full")); return false; } };
S.icon = function(k) { var c = S.customIcons(); return c[k] || S.asset(S.ICON_DEFAULTS[k]); };
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
    if (kind == "recover") return "<span class='sk-recovtok'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M19 12a7 7 0 1 1-2.05-4.95' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/><path d='M18.5 3.5v4.5H14' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg><b>" + value + "</b></span>";
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
        + "<div class='sk-ptoolpair'>" + b("restart", "&#xf2f9;", "tool_restart", "restart_game") + b("end", "&#xf11e;", "tool_end", "menu_end") + "</div>"
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
        + "<button class='sk-turnbtn' data-act='" + (ov ? "oend" : "oturn") + "' title='" + e(t(ov ? "end_overlord_turn" : "start_overlord_turn")) + "'>" + e(t(ov ? "btn_end" : "btn_start")) + "</button>"
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
            case "help": S.toast(t("coming_soon")); break;
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

// L'Overlord a fait la récupération et le compte-tour : on garde l'état pour l'affichage des étapes.
var origEnd = S.endOverlordTurn;
S.endOverlordTurn = function() { origEnd.apply(S, arguments); };

// ---------- Préparation et paramètres : dialogue plein écran, boutons − et +, tuiles Événement ----------
var origRenderSetup = S.renderSetup;
S.renderSetup = function() {
    origRenderSetup.apply(S, arguments);
    S.enhanceSetup();
};
var ACT_ICONS = {start: "&#xf04b;", savescen: "&#xf0c7;", savelive: "&#xf0c7;", prepsave: "&#xf0c7;", restart: "&#xf2f9;"};
S.enhanceSetup = function() {
    var r = S.root, s = r.querySelector(".skelos-setup"); if (!s) return;
    var live = !!(S.live && S.state), rv = live ? S.state.river : S.draft.river;
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
        var lab = evLabel.closest("label"), general = (live ? S.state.scenario.events : S.draft.events) || "", first = true;
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
    var live = !!(S.live && S.state), rv = live ? S.state.river : S.draft.river;
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
    var tab = TAB_OF[S.screen]; if (!tab) return;
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
    if (n && n.dataset.nav == "home") { S.renderHome(); return; }
    if (n && n.dataset.nav == "scenarios") { S.renderScenarios(); return; }
    var f = ev.target.closest("[data-fab]");
    if (f) { if (f.dataset.fab == "scenario") { S.ctx = null; S.live = false; S.draft = S.blankScenario(); S.renderSetup(); } else S.openUpgradeEditor(null, function() { S.renderUpgrades(); }); return; }
    origNav.call(S, ev);
};
// Onglet Partie : directement le plateau ; sans partie en cours, une partie vide aux valeurs par défaut.
S.renderHome = function() {
    S.live = false; S.ctx = null;
    if (S.state) { S.renderGame(); return; }
    S.draft = S.blankScenario();
    S.startGame("blank");
};

// Onglet Scénarios.
S.renderScenarios = function() {
    S.screen = "scenarios"; S.ctx = null; S.live = false;
    var list = S.scenarios(), pr = S.prefs();
    var h = "<div class='sk-blk sk-c8'><div class='sk-row'><input type='search' class='sk-in' id='sk-sq' placeholder='" + e(t("search_scenario")) + "' value='" + e(pr.scenQ || "") + "' style='flex:1'>"
        + "<div class='sk-seg' role='radiogroup'>" + [["", "all_modes"], ["classic", "mode_classic"], ["solo", "mode_solo"]].map(function(m) {
            return "<button data-smode='" + m[0] + "' class='" + ((pr.scenMode || "") == m[0] ? "sk-on" : "") + "' aria-pressed='" + ((pr.scenMode || "") == m[0]) + "'>" + t(m[1]) + "</button>"; }).join("") + "</div></div><div id='sk-slist'></div></div>";
    h += "<button class='sk-fab' data-fab='scenario' title='" + e(t("new_scenario")) + "' aria-label='" + e(t("new_scenario")) + "'>&#xf067;</button>";
    origMount.call(S, "<div class='skelos-game sk-screen sk-scen'><div class='sk-board'><div class='sk-g8'>" + h + "</div></div></div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>");
    S.placeTabs();
    var draw = function() {
        var q = S.norm(pr.scenQ || ""), m = pr.scenMode || "";
        S.root.querySelector("#sk-slist").innerHTML = list.map(function(sc, i) {
            if (q && S.norm(sc.title).indexOf(q) < 0) return ""; if (m && sc.mode != m) return "";
            var ev = (sc.river || []).filter(function(x) { return x.tileId == "event"; }).length;
            return "<div class='sk-li'><span class='sk-li-t'>" + e(sc.title || "—") + "<small>" + t(sc.mode == "solo" ? "mode_solo" : "mode_classic") + " · " + t("tiles_n", (sc.river || []).length) + " · " + t("turns_n", sc.turns) + (ev ? " · " + t("event_tiles_n", ev) : "") + "</small></span>"
                + "<button class='sk-btn sk-primary' data-sc='play' data-i='" + i + "'>" + t("play") + "</button><button class='sk-btn' data-sc='edit' data-i='" + i + "'>" + t("edit") + "</button>"
                + "<button class='sk-iconbtn sk-sm' data-sc='del' data-i='" + i + "' title='" + e(t("delete")) + "' aria-label='" + e(t("delete")) + "'>&#xf2ed;</button></div>";
        }).join("") || "<p class='sk-help'>" + t("no_saved") + "</p>";
    };
    draw();
    S.root.querySelector("#sk-sq").addEventListener("input", function(ev) { pr.scenQ = ev.target.value; S.savePrefs(); draw(); });
    S.screenClick = function(ev) {
        var m = ev.target.closest("[data-smode]");
        if (m) { pr.scenMode = m.dataset.smode; S.savePrefs(); S.root.querySelectorAll("[data-smode]").forEach(function(x) { x.classList.toggle("sk-on", x == m); x.setAttribute("aria-pressed", x == m); }); draw(); return; }
        var b = ev.target.closest("[data-sc]"); if (!b) return;
        var i = +b.dataset.i;
        if (b.dataset.sc == "edit") { S.draft = JSON.parse(JSON.stringify(list[i])); S.renderSetup(); }
        else if (b.dataset.sc == "play") {
            var go = function() { S.clearGame(); S.ctx = null; S.live = false; S.draft = JSON.parse(JSON.stringify(list[i])); S.startGame(true); };
            if (S.state && S.state.river.length) S.ask(t("confirm_new"), t("confirm_new_yes"), go); else go();
        }
        else if (b.dataset.sc == "del") S.ask(t("confirm_delete"), t("delete"), function() { var l = S.scenarios(); l.splice(i, 1); S.saveScenarios(l); S.renderScenarios(); });
    };
};

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
    var c = S.customIcons();
    var h = "<div class='sk-blk sk-c8 sk-iconset'><h3>" + t("custom_icons") + "</h3><p>" + t("custom_icons_help") + "</p><div class='sk-iconrows'>"
        + S.CUSTOMIZABLE.map(function(k) {
            return "<div class='sk-iconrow'><img src='" + S.icon(k) + "' alt=''><span>" + t("icon_" + k) + (c[k] ? " <small>" + t("icon_custom") + "</small>" : "") + "</span>"
                + "<label class='sk-btn sk-filebtn'>" + t("choose_image") + "<input type='file' accept='image/*' data-iconfile='" + k + "' hidden></label>"
                + (c[k] ? "<button class='sk-btn' data-iconreset='" + k + "'>" + t("reset_icon") + "</button>" : "") + "</div>";
        }).join("") + "</div></div>";
    scr.querySelector(".sk-g8").insertAdjacentHTML("beforeend", h);
    scr.addEventListener("change", function(ev) {
        var x = ev.target; if (!x.dataset.iconfile || !x.files || !x.files[0]) return;
        var k = x.dataset.iconfile, rd = new FileReader();
        rd.onload = function() {
            var img = new Image();
            img.onload = function() {
                var max = 128, sc = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
                cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
                cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
                var o = S.customIcons(); o[k] = cv.toDataURL("image/png");
                if (S.saveCustomIcons(o)) S.renderSettings();
            };
            img.onerror = function() { S.toast(t("image_error")); };
            img.src = rd.result;
        };
        rd.readAsDataURL(x.files[0]);
    });
    scr.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-iconreset]"); if (!b) return;
        var o = S.customIcons(); delete o[b.dataset.iconreset]; S.saveCustomIcons(o); S.renderSettings();
    });
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
document.addEventListener("fullscreenchange", function() { if (!document.fullscreenElement && document.documentElement.classList.contains("skelos-full")) { document.documentElement.classList.remove("skelos-full"); S.syncFullscreenButton(); } });

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
            + "<button class='sk-tabico' data-studio='save' title='" + e(t("save_title")) + "' aria-label='" + e(t("save_title")) + "'>&#xf0c7;</button>";
    }
    g += "<button class='sk-tabico" + (S.studio ? " on" : "") + "' data-studio='toggle' aria-pressed='" + S.studio + "' title='" + e(t("studio_hint")) + "' aria-label='" + e(t("studio")) + "'>&#xf591;</button></div>";
    nav.classList.add("withtools");
    nav.classList.toggle("studio", S.studio);
    nav.insertAdjacentHTML("beforeend", g);
    nav.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-studio]"); if (!b) return;
        ev.stopPropagation();
        if (b.dataset.studio == "toggle") S.toggleStudio();
        else if (b.dataset.studio == "save") S.openSaveScenario();
        else if (b.dataset.studio == "mode") S.switchMode(b.dataset.mode);
    });
};

// Points de vie en mode studio : les − et + fixent les PV de la tuile (ils deviennent aussi son maximum).
S.studioHpCode = function(s) {
    var tile = S.tileOf(s), reinf = tile && (tile.reinforcement || tile.reinforcement === "0"), lp = s.lp || 0;
    return "<span class='sk-hpwrap open sk-studiohp" + (reinf ? " withreinf" : "") + "'>"
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
            S.draft = JSON.parse(JSON.stringify(st.scenario)); S.live = false;
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
    s.lp = v || null; s.lpMax = v || null;
    commit();
};
S.nextSocle = function(uid) {
    var s = S.slotByUid(uid), socles = S.socles(S.tileOf(s)); if (socles.length < 2) return;
    S.snapshot();
    s.color = socles[(socles.indexOf(s.color) + 1) % socles.length];
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
    if (st.turn == 0 && !st.activations && st.phase != "overlord") st.phase = fp == "overlord" ? "start" : "heroes";
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
    S.live = true; S._pickToGame = true;
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
    var solo = st.mode == "solo", items = [];
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
        }
    };
    if (navigator.vibrate) navigator.vibrate(20);
    ov.querySelector("[data-m]").focus();
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
        var when = l.ts ? new Date(l.ts).toLocaleString(undefined, {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"}) : "";
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
        S.undoStack = []; S._hpOpen = null; S.selected = null; S.live = false;
        S.state = st;
        S.log(t("log_resume", st.turn));
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
    s.dead = false; if (s.lpMax) s.lp = s.lpMax;
    S.log(t(cost == 1 ? "log_reinforce_cost_1" : "log_reinforce_cost", S.tileName(s), cost));
    S.save(); S.renderGame();
};

// ---------- Initialisation ----------
var origInit = S.init;
S.init = function(root) {
    origInit.apply(S, arguments);
    S.bindEventTips(root);
    S.bindStudioDrag(root);
    S.bindTileMenu(root);
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
})();
