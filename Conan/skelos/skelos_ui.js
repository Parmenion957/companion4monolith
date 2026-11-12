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
    if (kind == "recover") return "<span class='sk-recovtok'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M19 12a7 7 0 1 1-2.05-4.95' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round'/><path d='M18.5 3.5v4.5H14' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/></svg><b>" + value + "</b></span>";
    return "<span class='sk-recovtok'><b>" + value + "</b></span>";
};
S.activationSlots = function(used, max) {
    var h = "<span class='sk-actslots'>";
    for (var i = 0; i < max; i++) h += i < used ? "<img class='sk-actgem' src='" + S.icon("gem") + "' alt=''>" : "<span class='sk-actempty'></span>";
    return h + "</span>";
};

// Pion de coût : pion numéroté du jeu, cerclé de rouge avec une gemme quand la tuile choisie peut être payée.
S.costToken = function(slot, i) {
    var img = "<img class='sk-costimg' src='" + S.marker(i + 1) + "' alt='" + (i + 1) + "'>";
    if (!slot) return "<span class='sk-costtok sk-costimgwrap'>" + img + "</span>";
    var sel = slot.uid == S.selected, why = sel ? S.canActivate(slot) : null, armed = sel && !why;
    return "<span class='sk-costtok sk-costimgwrap" + (armed ? " armed" : "") + "' data-act='paycost' data-uid='" + slot.uid + "'"
        + (sel ? " role='button' tabindex='0' aria-label='" + e(armed ? t("activate_named", S.tileName(slot), i + 1) : why) + "'" : "") + ">"
        + img + (armed ? "<img class='sk-costgemimg' src='" + S.icon("gem") + "' alt=''>" : "") + "</span>";
};

// Améliorations ponctuelles avec leurs icônes.
S.boostsCode = function() {
    var st = S.state, cur = st.current && S.slotByUid(st.current), tile = cur && S.tileOf(cur);
    var ico = {move: "move", reroll: "reroll", defense: "defense", spell: "spell"};
    var h = "<div class='sk-boosts' role='group' aria-label='" + e(t("boosts")) + "' title='" + e(t("boosts_help")) + "'><div class='sk-boost-row'>";
    S.BOOSTS.forEach(function(k) {
        var n = st.boosts[k] || 0, tip = t("boost_cost_" + k);
        if (k == "move" && cur && tile && !S.isEvent(cur) && st.phase == "overlord") tip = t("boost_ctx_short", parseInt(tile.movement, 10) || 0);
        h += "<div class='sk-boost'><button class='sk-btn' data-act='boost' data-k='" + k + "' title='" + e(tip) + "'><img class='sk-boosticon' src='" + S.icon(ico[k]) + "' alt=''><span>" + t("boost_" + k) + "</span></button>"
            + "<div class='sk-boost-gems' aria-label='" + n + " " + e(t("gems_word")) + "'>" + (n ? "<img class='sk-actgem' src='" + S.icon("gem") + "' alt=''><b>" + n + "</b>" : "") + "</div></div>";
    });
    return h + "</div></div>";
};

// Étapes du tour : automatiques pour l'Overlord (l'app les réalise), simple rappel pour les Héros.
S.stepsCode = function() {
    var st = S.state, ov = st.phase != "heroes", steps = ov ? [1, 2, 3, 4].map(function(n) { return t("ov_step_" + n); }) : [1, 2, 3, 4].map(function(n) { return t("he_step_" + n); });
    var cur = st.phase == "overlord" ? 2 : -1;
    return "<div class='sk-zone sk-c8 " + (ov ? "ov" : "he") + "'><h4>" + t(ov ? "steps_overlord_title" : "steps_heroes_title") + "</h4><ol>"
        + steps.map(function(s, i) { return "<li class='" + (st.phase == "overlord" && i < cur ? "done" : "") + (i == cur ? " cur" : "") + "'>" + e(s) + "</li>"; }).join("") + "</ol></div>";
};

// Commandes au-dessus des tuiles 6, 7 et 8.
S.controlsCode = function() {
    var st = S.state, solo = st.mode == "solo", max = solo ? st.heroes : st.maxActivations;
    var h = "<div class='sk-zone sk-c6'><div class='sk-zone-label'>" + t("turn") + "</div><div class='sk-turnrow'>"
        + "<button class='sk-mini' data-act='turnminus' aria-label='" + e(t("aria_turn_prev")) + "'>−</button>"
        + "<span title='" + e(t("turn")) + "' aria-label='" + e(t("turn") + " " + st.turn + (st.turns ? " / " + st.turns : "")) + "'>" + S.token("hourglass", st.turn, st.turns ? "/" + st.turns : "") + "</span>"
        + "<button class='sk-mini' data-act='turnplus' aria-label='" + e(t("aria_turn_next")) + "'>+</button></div>"
        + "<div class='sk-zone-label'>" + t("activations") + "</div><div class='sk-acts' aria-label='" + e(t("activations") + " " + st.activations + " / " + max) + "'>" + S.activationSlots(st.activations, max) + "</div></div>";
    var ov = st.phase == "overlord";
    h += "<div class='sk-zone sk-c7'><span class='sk-phasepill " + (st.phase == "heroes" ? "he" : "ov") + "'>" + t(st.phase == "heroes" ? "phase_short_heroes" : st.phase == "start" ? "phase_start" : "phase_short_overlord") + "</span>"
        + "<button class='sk-turnbtn' data-act='" + (ov ? "oend" : "oturn") + "' title='" + e(t(ov ? "end_overlord_turn" : "start_overlord_turn")) + "'>" + t(ov ? "btn_end" : "btn_start") + "</button>"
        + "<div class='sk-tools'><button class='sk-iconbtn' data-act='undo' title='" + e(t("undo")) + "' aria-label='" + e(t("undo")) + "'" + (S.undoStack.length ? "" : " disabled") + ">&#xf0e2;</button>"
        + "<button class='sk-iconbtn' data-act='setup' title='" + e(t("menu_params")) + "' aria-label='" + e(t("menu_params")) + "'>&#xf013;</button></div>";
    if (st.turns && st.turn == st.turns) h += "<span class='sk-flag'>" + t("last_turn") + "</span>";
    if (st.turns && st.turn > st.turns) h += "<span class='sk-flag sk-danger'>" + t("game_over_short") + "</span>";
    h += "</div>";
    return h + S.stepsCode();
};

// Après le rendu du plateau : fonds des zones, jetons du mode solo, tuiles Événement, carte des événements.
var origRenderGame = S.renderGame;
S.renderGame = function() {
    origRenderGame.apply(S, arguments);
    var st = S.state, r = S.root, solo = st.mode == "solo";
    var zs = r.querySelectorAll(".sk-zones > .sk-zone");
    if (!solo && zs.length >= 3) { zs[0].classList.add("sk-zen"); zs[1].classList.add("sk-zrec"); zs[2].classList.add("sk-zfa"); }
    r.querySelectorAll(".sk-token").forEach(function(tk) {
        var n = parseInt(tk.textContent, 10); if (!n) return;
        tk.innerHTML = "<img src='" + S.marker(n) + "' alt='" + n + "'>"; tk.classList.add("sk-tokenimg");
    });
    st.river.forEach(function(s) {
        if (!S.isEvent(s)) return;
        var box = r.querySelector(".sk-tilebox[data-uid='" + s.uid + "']"); if (box) box.setAttribute("data-eventuid", s.uid);
    });
    var texts = S.eventTexts();
    if (texts.length) {
        var side = r.querySelector(".sk-side"), old = side && side.querySelector(".sk-card");
        var card = "<div class='sk-card" + (st.lastEvent ? " sk-alert" : "") + "'><h3>" + t("scenario_events") + "</h3>" + (st.lastEvent ? "<p class='sk-em'>" + t("event_activated") + "</p>" : "")
            + texts.map(function(x) { return "<p class='sk-evtitle'>" + e(t("event_n", x.pos)) + "</p><ul>" + x.lines.map(function(l) { return "<li>" + e(l) + "</li>"; }).join("") + "</ul>"; }).join("") + "</div>";
        if (old && old.querySelector("h3") && old.querySelector("h3").textContent == t("scenario_events")) old.outerHTML = card;
        else if (side) side.insertAdjacentHTML("afterbegin", card);
    }
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
var TABS = [["home", "tab_partie"], ["campaigns", "tab_campaigns"], ["scenarios", "tab_scenarios"], ["upgrades", "tab_upgrades"]];
var TAB_OF = {home: "home", free: "home", campaigns: "campaigns", campaign: "campaigns", scenarios: "scenarios", upgrades: "upgrades"};
S.tabsCode = function(active) {
    return "<nav class='sk-tabs' role='tablist'>" + TABS.map(function(x) {
        return "<button role='tab' class='sk-tabbtn" + (x[0] == active ? " on" : "") + "' aria-selected='" + (x[0] == active) + "' data-nav='" + x[0] + "'>" + t(x[1]) + "</button>";
    }).join("") + "</nav>";
};
var origMount = S.mount;
S.mount = function(html) {
    origMount.call(S, html);
    var tab = TAB_OF[S.screen], scr = S.root.querySelector(".sk-screen");
    if (tab && scr) {
        scr.classList.add("sk-tabbed");
        var hb = scr.querySelector(".sk-headblk [data-nav='home']");
        if (hb) { var blk = hb.closest(".sk-headblk"); if (blk.querySelectorAll("*").length <= 3) blk.remove(); else hb.remove(); }
        scr.insertAdjacentHTML("afterbegin", S.tabsCode(tab));
    }
    S.syncFullscreenButton();
};
var origNav = S.navClick;
S.navClick = function(ev) {
    var n = ev.target.closest("[data-nav]");
    if (n && n.dataset.nav == "home") { S._forceTabs = false; S.renderHome(); return; }
    if (n && n.dataset.nav == "scenarios") { S.renderScenarios(); return; }
    if (n && n.dataset.nav == "upgrades") { S.renderUpgrades(); return; }
    var f = ev.target.closest("[data-fab]");
    if (f) { if (f.dataset.fab == "scenario") { S.ctx = null; S.live = false; S.draft = S.blankScenario(); S.renderSetup(); } else S.openUpgradeEditor(null, function() { S.renderUpgrades(); }); return; }
    origNav.call(S, ev);
};
// Onglet Partie : le plateau s'il y a une partie, sinon le lancement d'une partie.
S.renderHome = function() {
    S.live = false; S.ctx = null;
    if (S.state && !S._forceTabs) { S.renderGame(); return; }
    S.renderFree();
    if (S.state) {
        var st = S.state, g = S.root.querySelector(".sk-g8");
        g.insertAdjacentHTML("afterbegin", "<div class='sk-blk sk-resume sk-c8'><h3>" + t("resume_game") + "</h3><p>" + e((st.scenario.title || t("tab")) + " · " + t("turn") + " " + st.turn) + "</p>"
            + "<button class='sk-btn sk-primary sk-go' data-nav='game'>" + t("resume_short") + "</button></div>");
    }
};
var origMenu = S.openGameMenu;
S.openGameMenu = function() {
    origMenu.apply(S, arguments);
    var ov = S.root.querySelector("#sk-overlay"), prev = ov.onclick;
    ov.onclick = function(ev) {
        var b = ev.target.closest("[data-m]");
        if (b && b.dataset.m == "home") { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; S._forceTabs = true; S.renderHome(); return; }
        prev(ev);
    };
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
    var scr = S.root.querySelector(".sk-screen"); scr.classList.add("sk-tabbed"); scr.insertAdjacentHTML("afterbegin", S.tabsCode("scenarios"));
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
            if (S.state) S.ask(t("confirm_new"), t("confirm_new_yes"), go); else go();
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

// ---------- Initialisation ----------
var origInit = S.init;
S.init = function(root) {
    origInit.apply(S, arguments);
    S.bindEventTips(root);
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
