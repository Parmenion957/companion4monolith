// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon ;
// le module reprend celles du Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell) et ajoute les fonds du livre (img/fond/).
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

S.token = function(kind, value, extra, cls) {
    if (kind == "gem") return "<span class='sk-tokimg" + (cls == "dim" ? " dim" : "") + "'><img src='" + S.icon("gem") + "' alt=''><b>" + value + "</b></span>";
    if (kind == "hourglass") return "<span class='sk-tokimg sk-tokround'><img src='" + S.icon("time") + "' alt=''><b>" + value + "</b>" + (extra ? "<small>" + e(extra.replace(/\s/g, "")) + "</small>" : "") + "</span>";
    if (kind == "bag") return "<span class='sk-tokimg sk-tokround'><img src='" + S.icon("tokenback") + "' alt=''><b>" + value + "</b></span>";
    if (kind == "heroes") return "<span class='sk-recovtok'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 2.5 19.5 5v6.2c0 4.6-3.2 8.6-7.5 10.3C7.7 19.8 4.5 15.8 4.5 11.2V5z' fill='currentColor'/></svg><b>" + value + "</b></span>";
    // Récupération : une flèche vers la gauche (de la Fatigue vers l'Énergie disponible), le chiffre en gros dans la flèche.
    if (kind == "recover") return "<span class='sk-recovarrow'><svg viewBox='0 0 100 56' aria-hidden='true'><path d='M2 28 34 2v12h64v28H34v12z' fill='currentColor' stroke-linejoin='round'/></svg><b>" + value + "</b></span>";
    return "<span class='sk-recovtok'><b>" + value + "</b></span>";
};

// Pion de coût : pion numéroté du jeu, cerclé de rouge avec une gemme quand la tuile choisie peut être payée.
// Rang d'une case de la Rivière : gemme rouge numérotée dans un anneau (composée en CSS avec la gemme du Compagnon).
// Les pions blancs numérotés restent pour les jetons tirés au sac et le suivi des activations.
S.rankToken = function(n, cls) {
    return "<span class='sk-rankgem" + (cls ? " " + cls : "") + "' role='img' aria-label='" + n + "'><img src='" + S.icon("gem") + "' alt=''><b>" + n + "</b></span>";
};





// Bande d'outils sous la barre des onglets (icônes seules, nom au survol).
S.toolbarCode = function() {
    var b = function(act, icon, aria, off) {
        return "<button class='sk-tbtn' data-studio='tool' data-tool='" + act + "'" + (off ? " disabled" : "") + " title='" + e(t(aria)) + "' aria-label='" + e(t(aria)) + "'>" + icon + "</button>";
    };
    return "<div class='sk-toolbar" + (S._toolsOpen ? " on" : "") + "' id='sk-toolbar' role='toolbar' aria-label='" + e(t("tools_bar")) + "'>"
        + b("undo", "&#xf0e2;", "undo", !S.undoStack.length) + b("restart", "&#xf2f9;", "restart_game") + b("end", "&#xf11e;", "menu_end", !!S.editing)
        + b("journal", "&#xf02d;", "log") + b("help", "&#xf128;", "help") + "</div>";
};
S.syncToolbar = function() {
    var r = S.root; if (!r) return;
    var bar = r.querySelector("#sk-toolbar"), ico = r.querySelector(".sk-toolsico");
    if (bar) bar.classList.toggle("on", !!S._toolsOpen);
    if (ico) { ico.classList.toggle("on", !!S._toolsOpen); ico.setAttribute("aria-expanded", !!S._toolsOpen); }
};
S.runTool = function(act) {
    switch (act) {
        case "undo": S.undo(); break;
        case "restart": S.restartGame(); break;
        case "end": S.renderEnd(); break;
        case "journal": S.openJournal(); break;
        case "help": S.openGameHelp(); break;
    }
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
S.TABS = TABS; S.TAB_OF = TAB_OF;   // d'autres onglets peuvent s'y ajouter (Héros)
S.tabsCode = function(active) {
    return "<nav class='sk-tabs' role='tablist' style='--sk-ntabs:" + TABS.length + "'>" + TABS.map(function(x) {
        return "<button role='tab' class='sk-tabbtn" + (x[0] == active ? " on" : "") + "' aria-selected='" + (x[0] == active) + "' data-nav='" + x[0] + "'>" + t(x[1]) + "</button>";
    }).join("") + "</nav>";
};
// Pose la barre d'onglets en tête du module, hors de l'écran qui défile.
S.placeTabs = function() {
    if (!S.root) return;
    var old = S.root.querySelector(":scope > .sk-tabs"); if (old) old.remove();
    var tab = (S.screen == "game" || S.screen == "heroes") && S.editing ? (S.editing.cid ? "campaigns" : "scenarios") : TAB_OF[S.screen]; if (!tab) return;
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
// Scénario inclus d'office : « Dans les griffes des Pictes », préparé sur le livre (Rivière, gemmes, points de vie).
S.pictsScenario = function() {
    var T = t("picts_title"), EV = t("picts_event");
    return {"title": T, "mode": "classic", "turns": 10, "recovery": 5, "energy": 10, "fatigue": 3, "maxActivations": 2, "heroes": 4, "river": [{"tileId": "pict-hunters", "img": "data/tiles/img/pict-hunters.webp", "color": "blue", "lp": null, "eventText": "", "cards": []}, {"tileId": "zogar-sag", "img": "data/tiles/img/zogar-sag.webp", "color": "gray", "lp": 5, "eventText": "", "cards": []}, {"tileId": "pict-warriors", "img": "data/heroes/img/grom.webp", "color": "purple", "lp": null, "eventText": "", "cards": []}, {"tileId": "hyenas", "img": "data/tiles/img/hyenas.webp", "color": "gray", "lp": null, "eventText": "", "cards": []}, {"tileId": "pict-hunters", "img": "data/tiles/img/pict-hunters.webp", "color": "green", "lp": null, "eventText": "", "cards": []}, {"tileId": "giant-snake", "img": "data/tiles/img/giant-snake.webp", "color": "gray", "lp": 8, "eventText": "", "cards": []}, {"tileId": "pict-hunters", "img": "data/tiles/img/pict-hunters.webp", "color": "red", "lp": null, "eventText": "", "cards": []}, {"tileId": "event", "img": "data/tiles/img/event-1.webp", "color": "none", "lp": null, "eventText": EV, "cards": []}], "events": "", "notes": "", "saved": {"scenario": {"title": T, "mode": "classic", "turns": 10, "recovery": 5, "energy": 10, "fatigue": 0, "maxActivations": 2, "heroes": 4, "river": [], "events": "", "notes": ""}, "mode": "classic", "turn": 0, "turns": 10, "energy": 10, "fatigue": 3, "recovery": 5, "maxActivations": 2, "activations": 0, "heroes": 4, "pool": [], "used": [], "removed": [], "river": [{"uid": "u1", "token": 2, "tileId": "pict-hunters", "img": "data/tiles/img/pict-hunters.webp", "color": "blue", "dead": false, "lpMax": null, "lp": null}, {"uid": "u2", "token": 3, "tileId": "zogar-sag", "img": "data/tiles/img/zogar-sag.webp", "color": "gray", "dead": false, "lpMax": 5, "lp": 5}, {"uid": "u3", "token": 4, "tileId": "pict-warriors", "img": "data/heroes/img/grom.webp", "color": "purple", "dead": false, "lpMax": null, "lp": null}, {"uid": "u4", "token": 5, "tileId": "hyenas", "img": "data/tiles/img/hyenas.webp", "color": "gray", "dead": false, "lpMax": null, "lp": null}, {"uid": "u5", "token": 6, "tileId": "pict-hunters", "img": "data/tiles/img/pict-hunters.webp", "color": "green", "dead": false, "lpMax": null, "lp": null}, {"uid": "u6", "token": 7, "tileId": "giant-snake", "img": "data/tiles/img/giant-snake.webp", "color": "gray", "dead": false, "lpMax": 8, "lp": 8}, {"uid": "u7", "token": 8, "tileId": "pict-hunters", "img": "data/tiles/img/pict-hunters.webp", "color": "red", "dead": false, "lpMax": null, "lp": null}, {"uid": "u0", "token": 1, "tileId": "event", "img": "data/tiles/img/event-1.webp", "color": "none", "dead": false, "lpMax": null, "lp": null, "eventText": EV}], "lastEvent": false, "highlight": null, "log": [], "phase": "heroes", "boosts": {"move": 0, "reroll": 0, "defense": 0, "spell": 0}, "current": null, "campaign": null}};
};
S.scenarioList = function() {
    var l = S.scenarios(), changed = false, pr = S.prefs();
    // Le scénario des Pictes est inclus une fois dans l'onglet Scénarios ; supprimé, il ne revient pas.
    if (!pr.pictsSeeded && S.tileById && S.tileById("pict-hunters")) {
        var x = S.pictsScenario();
        x.sid = newSid(); x.source = "user"; x.created = x.updated = nowIso();
        x.saved.scenario.sid = x.sid;
        l.push(x); changed = true;
        pr.pictsSeeded = true; S.savePrefs();
    }
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
    // Les couleurs des types d'objets n'existent plus : les cartes se montrent elles-mêmes (étape 25).
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
    // Outils de la partie (Annuler, Recommencer, Terminer, Journal, Aide) : hors du plateau, dans une bande qu'une icône
    // discrète fait apparaître ; un nouvel appui sur l'icône la referme. Les deux plateaux (automatique et manuel) la partagent.
    g += "<button class='sk-tabico sk-toolsico" + (S._toolsOpen ? " on" : "") + "' data-studio='tools' aria-expanded='" + !!S._toolsOpen + "' aria-controls='sk-toolbar'"
        + " title='" + e(t("tools_bar")) + "' aria-label='" + e(t("tools_bar")) + "'>&#xf142;</button>";
    g += "<button class='sk-tabico" + (S.studio ? " on" : "") + "' data-studio='toggle' aria-pressed='" + S.studio + "'" + (S.editing ? " disabled" : "")
        + " title='" + e(t(S.editing ? "studio_locked" : "studio_hint")) + "' aria-label='" + e(t("studio")) + "'>&#xf591;</button></div>";
    nav.classList.add("withtools");
    nav.classList.toggle("studio", S.studio);
    nav.insertAdjacentHTML("beforeend", g + S.toolbarCode());
    nav.addEventListener("click", function(ev) {
        var b = ev.target.closest("[data-studio]"); if (!b) return;
        ev.stopPropagation();
        if (b.dataset.studio == "tools") { S._toolsOpen = !S._toolsOpen; S.syncToolbar(); }
        else if (b.dataset.studio == "tool") S.runTool(b.dataset.tool);
        else if (b.dataset.studio == "toggle") S.toggleStudio();
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
            // En Coop, les gemmes sont rares : on part de zéro (le mode studio du livre manuel en ajoute au besoin).
            st.energy = 0; st.fatigue = 0; st.boosts = {move: 0, reroll: 0, defense: 0, spell: 0};
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
        if (!solo) items.push(["purge", t(S.auto("purge") ? "purge" : "purge_free")]);
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
    if (ov) { ov.classList.remove("on", "sk-zoomon", "sk-mzon"); ov.innerHTML = ""; ov.onclick = null; ov.onkeydown = null; ov.onpointerdown = null; ov.onpointerup = null; }
};
// Studio : cartes d'une tuile. Les deux « + » ouvrent le même choix : sorts de l'Overlord, équipements ou tuiles,
// une ou plusieurs d'un coup. Les sorts se rangent à gauche, les tuiles puis les équipements à droite.
S.studioAddCards = function(uid, side, opts) {
    var back = opts && opts.board ? function() { S.renderGame(); } : function(pos) { S.zoomTile(uid, {pos: pos}); };
    var right = function(s) { return S.slotCards(s, "eq").length + S.slotCards(s, "ti").length; };
    S.zoomShut();
    S.openItemPicker({title: t("add_cards"), kind: side == "sp" ? "sp" : "eq", kinds: ["sp", "eq", "tile"], tiles: true,
        filter: function(it) { return it.kind != "sp" || (it.data && it.data.forOverlord); },
        onClose: function() { back(side == "sp" ? -1 : 1); },
        onAdd: function(sel) {
            var s = S.slotByUid(uid); if (!s || !sel.length) { back(0); return; }
            S.snapshot();
            s.cards = (s.cards || []).concat(sel.map(function(x) { return {kind: x.kind, ref: x.ref}; }));
            commit();
            var onlySp = sel.every(function(x) { return x.kind == "sp"; });
            back(onlySp || (side == "sp" && sel.some(function(x) { return x.kind == "sp"; })) ? -S.slotCards(s, "sp").length : right(s));
        }});
};
S.studioRemoveCard = function(uid, kind, k, opts) {
    var s = S.slotByUid(uid); if (!s) return;
    var c = S.slotCards(s, kind)[k]; if (!c) return;
    var side = kind == "sp" ? S.slotCards(s, "sp") : S.slotCards(s, "ti").concat(S.slotCards(s, "eq")), at = side.indexOf(c);
    S.snapshot();
    s.cards.splice(s.cards.indexOf(c), 1);
    commit();
    if (opts && opts.board) return;
    var n = side.length - 1;
    S.zoomTile(uid, {pos: n ? (kind == "sp" ? -Math.min(at + 1, n) : Math.min(at + 1, n)) : 0});
};

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
    Nav.dialog(e(t("log")), h + "</div>", null, S.journalActions ? S.journalActions() : []);
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
    S.hpGroup(s).forEach(function(g) { g.dead = false; });   // le renfort remet la tuile en jeu sans toucher à ses PV
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
    ["board", "gems", solo ? "coop" : "adventure", "tiles", "cards", "auto", "tools", "studio", "phone"].forEach(function(k) {
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
var itemColorList = function() { return []; };
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
    var ord = {eq: 0, sp: 1, up: 2, ti: 3};
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
        if (!x) return null;
        // Compétences repérées comme sur les tuiles : survol ou appui long pour leur description.
        return HeroSheet._cardCode(EncyclopediaHeroes._convertHeroToStudio(x, false)).replace(/src="([^"?]+)(\?[^"]*)?"/g, function(m, p, q) {
            var code = S.skillCodeByImage(p);
            return (code ? 'data-skill="' + code + '" ' : '') + m;
        });
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
// opts (hors campagne) : free (places libres), have (noms déjà présents), onAdd(héros choisis).
S.openHeroPicker = function(cid, opts) {
    opts = opts || {};
    var c = cid ? S.campaign(cid) : null, pr = S.prefs(), sel = [], free = opts.free != null ? opts.free : S.companyFree(c);
    var have = opts.have || {}; if (!opts.have) (c.heroes || []).forEach(function(h) { if (!h.dead) have[S.norm(h.name)] = true; });
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
            if (opts.onAdd) { close(); opts.onAdd(picked); return; }
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
})();

// ---------- Étape 24 : sorts et équipements des tuiles ----------
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
// Pastille au coin des tuiles qui portent des cartes : nombre de sorts, d'équipements et de tuiles portées.
S.cardsBadgeCode = function(s) {
    var sp = S.slotCards(s, "sp").length, eq = S.slotCards(s, "eq").length, ti = S.slotCards(s, "ti").length;
    if (!sp && !eq && !ti) return "";
    var lbl = t("cards_badge3", sp, eq, ti);
    return "<span class='sk-cardsbadge' role='img' aria-label='" + e(lbl) + "' title='" + e(lbl) + "'>"
        + (sp ? "<i class='sk-cb-sp'>&#xf0d0;</i>" + sp : "") + (ti ? "<i class='sk-cb-ti'>&#xf24d;</i>" + ti : "") + (eq ? "<i class='sk-cb-eq'>&#xf3ed;</i>" + eq : "") + "</span>";
};
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

// ---------- Étape 25 : cartes de la campagne (fiches de héros, pistes de cartes, compagnie et cave) ----------
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
var nid = function() { return "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

// Les améliorations sont des cartes comme les autres : un seul porteur. Un ancien partage (« takers ») devient des exemplaires.
S.takers = function(it) { return it.owner ? [it.owner] : []; };
S.setTaker = function(c, it, hid, on) { if (!on) { if (it.owner != hid) return false; it.owner = null; return true; } return S.setItemOwner(c, it, hid); };
var baseOwner = S.setItemOwner;
S.setItemOwner = function(c, it, owner) {
    if (it.kind != "up") return baseOwner.apply(S, arguments);
    owner = owner || null; if ((it.owner || null) == owner) return false;
    var nm = function(id) { var h = id ? (c.heroes || []).filter(function(x) { return x.id == id; })[0] : null; return h ? h.name : t("common_cache"); };
    S.campLog(c, t("clog_move", it.name, nm(it.owner), nm(owner)));
    if (it.start && !it.startHero && it.owner) it.startHero = it.owner;
    it.owner = owner; delete it.takers; return true;
};
var baseCampaigns = S.campaigns;
S.campaigns = function() {
    var l = baseCampaigns.apply(S, arguments), changed = false;
    l.forEach(function(c) {
        var add = [];
        (c.cache || []).forEach(function(it) {
            if (!it.takers) return;
            var who = it.takers.slice(); if (it.owner && who.indexOf(it.owner) < 0) who.unshift(it.owner);
            it.owner = who.shift() || null; delete it.takers; changed = true;
            who.forEach(function(h) { add.push({uid: nid(), kind: it.kind, ref: it.ref, name: it.name, owner: h, start: false}); });
        });
        if (add.length) c.cache = c.cache.concat(add);
    });
    if (changed) S.saveCampaigns(l);
    return l;
};

S.heroById = function(c, hid) { return (c.heroes || []).filter(function(x) { return x.id == hid; })[0] || null; };
S.heroRef = function(hh) {
    if (hh.ref) return hh.ref;
    var n = S.norm(hh.name || ""), x = S.heroCatalog().filter(function(k) { return S.norm(k.name) == n; })[0];
    return x ? x.ref : null;
};
// Cartes d'un héros (hid) ou de la cave (hid = null), dans l'ordre : équipements, sorts, améliorations, tuiles.
S.cardsOf = function(c, hid) { return S.sortItems((c.cache || []).filter(function(it) { return (it.owner || null) == (hid || null); })); };
// Dessin d'une carte d'objet : la carte du Compagnon (équipement, sort) ou la carte d'amélioration du module.
S.itemFace = function(it) {
    var real = it.kind == "up" ? null : S.realCardCode(it.kind, it.ref);
    if (real) return it.kind == "ti" ? "<span class='sk-tiface'>" + real + "</span>" : "<span class='sk-cardscale'>" + real + "</span>";
    var d = (S.catalog(it.kind).filter(function(x) { return x.ref == it.ref; })[0] || {}).data || {};
    return "<span class='sk-upcard sk-k-" + it.kind + "'><b>" + e(it.name) + "</b><span>" + e(it.kind == "up" ? (d.effect || "") : t("kind_" + it.kind)) + "</span></span>";
};
var lockCode = function(c, it) { return it.start ? "<span class='sk-cstart' title='" + e(S.startLabel(c, it)) + "' aria-label='" + e(S.startLabel(c, it)) + "'>&#xf023;</span>" : ""; };
// Une carte de piste : touchée, elle s'ouvre en grand (ou se sélectionne dans la vue de la compagnie).
S.trackCard = function(c, it) {
    return "<button class='sk-tcard' data-tcard='" + it.uid + "' aria-label='" + e(it.name) + "'>" + S.itemFace(it) + lockCode(c, it) + "</button>";
};
// Pastille des cartes d'un héros, comme sur les tuiles : équipements, sorts, améliorations.
S.heroBadge = function(c, hid) {
    var l = S.cardsOf(c, hid), n = function(k) { return l.filter(function(x) { return x.kind == k; }).length; }, eq = n("eq"), sp = n("sp"), up = n("up"), ti = n("ti");
    if (!l.length) return "";
    var lbl = t("hero_cards_badge", eq, sp, up) + (ti ? ", " + t("hero_tiles_badge", ti) : "");
    return "<span class='sk-cardsbadge sk-herobadge' role='img' aria-label='" + e(lbl) + "' title='" + e(lbl) + "'>"
        + (eq ? "<i class='sk-cb-eq'>&#xf3ed;</i>" + eq : "") + (sp ? "<i class='sk-cb-sp'>&#xf0d0;</i>" + sp : "") + (up ? "<i class='sk-cb-up'>&#xf062;</i>" + up : "") + (ti ? "<i class='sk-cb-ti'>&#xf24d;</i>" + ti : "") + "</span>";
};
S.heroFace = function(hh) {
    var ref = S.heroRef(hh), full = ref ? S.heroSheetFull(ref) : null;
    if (full) return "<span class='sk-hsheetscale'>" + full + "</span>";
    var img = S.heroImage(hh);
    return "<span class='sk-hface-alt'>" + (img ? "<img src='" + e(img) + "' alt=''>" : "<span class='sk-hsheet-ini'>" + e((hh.name || "?").charAt(0)) + "</span>") + "<b>" + e(hh.name) + "</b></span>";
};

// Compagnie : la fiche complète de chaque héros, sa pastille de cartes ; un appui pour l'ouvrir, crayon pour la modifier.
S.heroSheetCode = function(c, hh) {
    return "<div class='sk-hcard" + (hh.dead ? " dead" : "") + "' data-hzoom='" + hh.id + "' style='--hc:" + hh.color + "'>"
        + "<div class='sk-hcard-f' role='button' tabindex='0' aria-label='" + e(t("open_hero", hh.name)) + "'>" + S.heroFace(hh) + S.heroBadge(c, hh.id) + "</div>"
        + "<button class='sk-hcard-ed' data-cact='hero' data-hero='" + hh.id + "' title='" + e(t("edit_hero")) + "' aria-label='" + e(t("edit_hero") + " : " + hh.name) + "'>&#xf303;</button>"
        + (hh.dead ? "<span class='sk-st loss sk-hcard-dead'>" + e(t("fell_at", hh.deadAt || "?")) + "</span>" : "") + "</div>";
};
S.companyCode = function(c) {
    var h = "<div class='sk-company sk-company25'>" + (c.heroes || []).map(function(hh) { return S.heroSheetCode(c, hh); }).join("");
    for (var i = S.companyFree(c); i > 0; i--) h += "<button class='sk-hsheet sk-hsheet-empty' data-cact='addhero'><span aria-hidden='true'>+</span><small>" + e(t("add_hero")) + "</small></button>";
    return h + "</div>";
};

// ---------- Zoom d'un héros : la fiche en grand, ses cartes en piste dessous, un + pour en prendre dans la cave ----------
S.heroZoom = function(cid, hid, dir) {
    var c = S.campaign(cid), hh = c && S.heroById(c, hid); if (!hh) return;
    var ring = (c.heroes || []).map(function(x) { return x.id; }), idx = ring.indexOf(hid);
    var cards = S.cardsOf(c, hid);
    var ov = S.root.querySelector("#sk-overlay");
    S._hz = {cid: cid, hid: hid};
    ov.innerHTML = "<div class='sk-hzoom" + (dir ? " sk-zin-" + dir : "") + "' role='dialog' tabindex='-1' aria-label='" + e(hh.name) + "'>"
        + (ring.length > 1 ? "<div class='sk-zoomhead'><span class='sk-zoomring'>" + (idx + 1) + " / " + ring.length + "</span></div>" : "")
        + "<div class='sk-hzoom-f'>" + S.heroFace(hh) + "</div>"
        + "<div class='sk-ctrack' data-dest='" + hid + "'>" + cards.map(function(it) { return S.trackCard(c, it); }).join("")
        + "<button class='sk-tcard sk-tadd' data-hadd='" + hid + "' aria-label='" + e(t("take_from_cave")) + "'><span>+</span>" + e(t("take_from_cave")) + "</button></div></div>";
    ov.classList.add("on", "sk-zoomon");
    var box = ov.querySelector(".sk-hzoom"); box.focus({preventScroll: true});
    var sx = 0, sy = 0, down = false, tr = ov.querySelector(".sk-ctrack");
    ov.onkeydown = function(ev) {
        if (ev.key == "Escape") { S.hzShut(); return; }
        if (ev.key == "ArrowUp" || ev.key == "ArrowDown") { ev.preventDefault(); S.heroZoomGo(ev.key == "ArrowDown" ? 1 : -1); }
    };
    // Glisser vers le haut ou le bas (hors de la piste) : héros suivant ou précédent.
    ov.onpointerdown = function(ev) { down = !ev.target.closest(".sk-ctrack"); sx = ev.clientX; sy = ev.clientY; };
    ov.onpointerup = function(ev) {
        if (!down) return; down = false;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)) return;
        S._zswipeAt = Date.now(); S.heroZoomGo(dy < 0 ? 1 : -1);
    };
    ov.onclick = function(ev) {
        if (S._zswipeAt && Date.now() - S._zswipeAt < 450) { S._zswipeAt = 0; return; }
        var a = ev.target.closest("[data-hadd]"); if (a) { S.pickFromCave(cid, hid); return; }
        var k = ev.target.closest("[data-tcard]"); if (k) { S.cardZoom(cid, k.dataset.tcard, function() { S.heroZoom(cid, hid); }); return; }
        if (ev.target.closest(".sk-ctrack, .sk-hzoom-f, .sk-zoomhead")) return;
        S.hzShut();
    };
    if (tr && S._hzScroll && S._hzScroll.hid == hid) tr.scrollLeft = S._hzScroll.x;
    if (tr) tr.addEventListener("scroll", function() { S._hzScroll = {hid: hid, x: tr.scrollLeft}; });
};
S.heroZoomGo = function(d) {
    var z = S._hz; if (!z) return; var c = S.campaign(z.cid), ring = (c.heroes || []).map(function(x) { return x.id; });
    if (ring.length < 2) return; var i = (ring.indexOf(z.hid) + d + ring.length) % ring.length;
    S.heroZoom(z.cid, ring[i], d > 0 ? "down" : "up");
};
S.hzShut = function() {
    var ov = S.root.querySelector("#sk-overlay"); S._hz = null;
    ov.classList.remove("on", "sk-zoomon"); ov.innerHTML = ""; ov.onclick = ov.onkeydown = ov.onpointerdown = ov.onpointerup = null;
    S.rerender();
};
// Le + d'un héros : les cartes libres de la cache. On en touche une ou plusieurs, puis Donner.
S.pickFromCave = function(cid, hid, picked) {
    var c = S.campaign(cid), hh = S.heroById(c, hid), free = S.cardsOf(c, null);
    var sel = (picked || []).filter(function(u) { return free.some(function(x) { return x.uid == u; }); });
    var ov = S.root.querySelector("#sk-overlay"), keep = ov.querySelector(".sk-cavepick .sk-ctrack"), sx = keep ? keep.scrollTop : 0;
    ov.innerHTML = "<div class='sk-dialog sk-cavepick' role='dialog' aria-modal='true'><h2>" + e(t("assign_to", hh.name)) + "</h2>"
        + (free.length ? "<p class='sk-help'>" + e(t("cave_pick_help")) + "</p><div class='sk-ctrack sk-ctrack-wrap'>" + free.map(function(it) { return S.trackCard(c, it); }).join("") + "</div>"
            : "<p>" + e(t("cache_empty")) + "</p>")
        + "<div class='sk-actions'><button class='sk-btn' data-new>" + e(t("new_items")) + "</button><button class='sk-btn' data-back>" + e(t("close")) + "</button>"
        + (free.length ? "<button class='sk-btn sk-primary' data-give" + (sel.length ? "" : " disabled") + ">" + e(t("give_n", sel.length)) + "</button>" : "") + "</div></div>";
    ov.classList.remove("sk-zoomon"); ov.classList.add("on");
    sel.forEach(function(u) { var n = ov.querySelector("[data-tcard='" + u + "']"); if (n) n.classList.add("sk-tsel"); });
    var tr = ov.querySelector(".sk-cavepick .sk-ctrack"); if (tr) tr.scrollTop = sx;
    ov.onpointerdown = ov.onpointerup = null;
    ov.onclick = function(ev) {
        var k = ev.target.closest("[data-tcard]");
        if (k) { var u = k.dataset.tcard, i = sel.indexOf(u); if (i < 0) sel.push(u); else sel.splice(i, 1); S.pickFromCave(cid, hid, sel); return; }
        if (ev.target.closest("[data-give]")) {
            if (!sel.length) return;
            S.updateCampaign(cid, function(x) { x.cache.forEach(function(it) { if (sel.indexOf(it.uid) >= 0) S.setItemOwner(x, it, hid); }); });
            S.heroZoom(cid, hid); return;
        }
        if (ev.target.closest("[data-new]")) { S.openItemPicker({title: t("assign_to", hh.name), onAdd: function(l) { S.addItems(cid, l, hid); S.heroZoom(cid, hid); }, onClose: function() { S.heroZoom(cid, hid); }}); return; }
        if (ev.target === ov || ev.target.closest("[data-back]")) S.heroZoom(cid, hid);
    };
};

// ---------- Une carte en grand : corbeille (d'un héros → la cache ; de la cache → supprimée) et cadenas d'équipement de départ ----------
// Glisser à gauche ou à droite (ou les flèches du clavier) : les autres cartes du même endroit, celles du héros ou celles de la cache.
S.cardZoom = function(cid, iuid, back, dir) {
    var c = S.campaign(cid), it = (c.cache || []).filter(function(x) { return x.uid == iuid; })[0]; if (!it) { back(); return; }
    var hh = it.owner ? S.heroById(c, it.owner) : null, ov = S.root.querySelector("#sk-overlay");
    var list = S.cardsOf(c, it.owner || null), idx = list.map(function(x) { return x.uid; }).indexOf(iuid);
    var shadeOf = function(x) { return x.kind == "sp" ? "sk-sh-sp" : x.kind == "eq" ? "sk-sh-eq" : "sk-sh-t"; };
    var shade = (idx > 0 ? "<i class='sk-shade sk-sh-l " + shadeOf(list[idx - 1]) + "' aria-hidden='true'></i>" : "")
        + (idx < list.length - 1 ? "<i class='sk-shade sk-sh-r " + shadeOf(list[idx + 1]) + "' aria-hidden='true'></i>" : "");
    var dots = list.length > 1 ? "<div class='sk-zoomdots' aria-hidden='true'>" + list.map(function(x, i) { return "<i class='" + (x.kind == "sp" ? "sk-ds" : x.kind == "eq" ? "sk-de" : "") + (i == idx ? " on" : "") + "'></i>"; }).join("") + "</div>" : "";
    var binLbl = hh ? t("card_to_cave") : it.start ? t("start_item_locked") : t("remove_from_cache");
    ov.innerHTML = "<div class='sk-czoom' role='dialog' tabindex='-1' aria-label='" + e(it.name) + "'>"
        + "<div class='sk-zoomhead'><span>" + e(hh ? hh.name : t("common_cache")) + (list.length > 1 ? " · " + (idx + 1) + " / " + list.length : "") + "</span></div>"
        + "<div class='sk-czoom-p" + (dir ? " sk-zin-" + dir : "") + "'><div class='sk-zoomcard sk-czoom-c'>" + shade + S.itemFace(it)
        + "<button class='sk-zoomrm' data-cbin" + (!hh && it.start ? " disabled" : "") + " title='" + e(binLbl) + "' aria-label='" + e(binLbl) + "'>" + "&#xf2ed;" + "</button>"
        + "<button class='sk-cstartbtn" + (it.start ? " on" : "") + "' data-cstart aria-pressed='" + !!it.start + "' title='" + e(t("start_item")) + "' aria-label='" + e(t("start_item")) + "'>&#xf023;</button></div></div>"
        + dots + "<p class='sk-zoomnote'>" + e(it.start ? S.startLabel(c, it) + " — " + t("start_item_note") : t("start_item_hint")) + "</p></div>";
    ov.classList.add("on", "sk-zoomon");
    ov.querySelector(".sk-czoom").focus({preventScroll: true});
    var go = function(d) { var j = idx + d; if (j < 0 || j >= list.length) return; S.cardZoom(cid, list[j].uid, back, d > 0 ? "right" : "left"); };
    var sx = 0, sy = 0, down = false;
    ov.onpointerdown = function(ev) { down = !ev.target.closest("button"); sx = ev.clientX; sy = ev.clientY; };
    ov.onpointerup = function(ev) {
        if (!down) return; down = false;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        S._zswipeAt = Date.now(); go(dx < 0 ? 1 : -1);
    };
    ov.onkeydown = function(ev) {
        if (ev.key == "Escape") back();
        else if (ev.key == "ArrowLeft" || ev.key == "ArrowRight") { ev.preventDefault(); go(ev.key == "ArrowRight" ? 1 : -1); }
    };
    ov.onclick = function(ev) {
        if (S._zswipeAt && Date.now() - S._zswipeAt < 450) { S._zswipeAt = 0; return; }
        if (ev.target.closest("[data-cstart]")) {
            S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) { if (y.uid == iuid) { y.start = !y.start; y.startHero = y.start ? (y.startHero || y.owner || null) : null; } }); });
            S.cardZoom(cid, iuid, back); return;
        }
        var b = ev.target.closest("[data-cbin]");
        if (b) {
            if (b.disabled) { S.toast(t("start_item_locked")); return; }
            if (hh) S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) { if (y.uid == iuid) S.setItemOwner(x, y, null); }); });
            else S.updateCampaign(cid, function(x) { x.cache = x.cache.filter(function(y) { return y.uid != iuid || y.start; }); S.campLog(x, t("clog_items_removed", 1)); });
            // La carte suivante du même endroit s'affiche, s'il en reste.
            var nx = list[idx + 1] || list[idx - 1];
            if (nx) S.cardZoom(cid, nx.uid, back); else back();
            return;
        }
        if (ev.target.closest(".sk-czoom-c, .sk-zoomhead, .sk-zoomdots")) return;
        back();
    };
};

// Supprimer des cartes de la campagne (corbeille de la vue Compagnie et cache). L'équipement de départ est gardé.
S.removeCards = function(cid, uids) {
    var n = 0, kept = 0;
    S.updateCampaign(cid, function(x) {
        x.cache = x.cache.filter(function(y) { if (uids.indexOf(y.uid) < 0) return true; if (y.start) { kept++; return true; } n++; return false; });
        if (n) S.campLog(x, t("clog_items_removed", n));
    });
    if (n) S.toast(t("cards_removed", n));
    if (kept) S.toast(t("start_item_locked"));
};

// Dans la vue Compagnie et cache, un héros se reconnaît à son portrait et à son nom : toute la place va aux cartes.
S.heroMini = function(hh) {
    var img = S.heroImage(hh);
    return "<span class='sk-hmini'>" + (img ? "<img src='" + e(img) + "' alt=''>" : "<span class='sk-hsheet-ini'>" + e((hh.name || "?").charAt(0)) + "</span>") + "<b>" + e(hh.name) + "</b></span>";
};
// ---------- Compagnie et cache : les héros avec leur piste de cartes, la cache en grande piste en bas ----------
// Toucher des cartes les choisit (plusieurs à la fois) ; toucher ensuite un héros ou la cache les y envoie, la corbeille les supprime.
// Appui long puis glisser : la carte (ou toutes les cartes choisies, si elle en fait partie) part vers un héros, la cache ou la corbeille.
// Double appui sur une carte : elle s'ouvre en grand.
S.openCompanyView = function(cid) {
    var c = S.campaign(cid); if (!c) return;
    var ov = S.root.querySelector("#sk-overlay"), all = (c.cache || []).map(function(x) { return x.uid; });
    var sel = S._cvSel && S._cvSel.cid == cid ? S._cvSel.uids.filter(function(u) { return all.indexOf(u) >= 0; }) : [];
    S._cvSel = {cid: cid, uids: sel};
    var row = function(hh) {
        var cards = S.cardsOf(c, hh.id);
        return "<div class='sk-cvhero" + (hh.dead ? " dead" : "") + "' data-dest='" + hh.id + "' style='--hc:" + hh.color + "'>"
            + "<div class='sk-cvsheet sk-cvmini' data-cvhero='" + hh.id + "'>" + S.heroMini(hh) + "</div>"
            + "<div class='sk-ctrack'>" + (cards.length ? cards.map(function(it) { return S.trackCard(c, it); }).join("") : "<span class='sk-ctrack-empty'>" + e(t("no_card")) + "</span>") + "</div></div>";
    };
    var cave = S.cardsOf(c, null);
    ov.innerHTML = "<div class='sk-dialog sk-pickdlg sk-cview' role='dialog' aria-modal='true'><div class='sk-dialog-head'><h2>" + e(t("company_view")) + "</h2>"
        // En-tête : la corbeille (cible du glisser, ou bouton quand des cartes sont choisies) et Désélectionner, à côté de Fermer.
        + "<div class='sk-actions sk-pickactions'><div class='sk-cvbar" + (sel.length ? " on" : "") + "'><button class='sk-trash sk-cvtrash' data-dest='!bin' aria-label='" + e(t("cv_drop_remove")) + "' title='" + e(t("cv_drop_remove")) + "'><i>&#xf2ed;</i><span>" + e(t("cv_drop_remove")) + "</span></button>"
        + "<button class='sk-btn sk-cvunsel' data-cvunsel>" + e(t("cv_unselect")) + "</button></div>"
        + "<button class='sk-btn sk-primary' data-cvclose>" + e(t("close")) + "</button></div></div>"
        + "<p class='sk-cvhint" + (sel.length ? " on" : "") + "' role='status'>" + e(sel.length ? t("cv_hint_sel", sel.length) : t("cv_hint")) + "</p>"
        + "<div class='sk-cvheroes'>" + (c.heroes || []).filter(function(hh) { return !hh.dead; }).map(row).join("") + "</div>"
        + "<div class='sk-cvcave' data-dest=''><h3>" + e(t("common_cache")) + "</h3><div class='sk-ctrack sk-ctrack-big'>" + cave.map(function(it) { return S.trackCard(c, it); }).join("")
        + "<button class='sk-tcard sk-tadd' data-cvadd aria-label='" + e(t("add_to_cave")) + "'><span>+</span>" + e(t("add_to_cave")) + "</button></div></div></div>";
    ov.classList.remove("sk-zoomon"); ov.classList.add("on");
    sel.forEach(function(u) { var n = ov.querySelector("[data-tcard='" + u + "']"); if (n) n.classList.add("sk-tsel"); });
    var keep = S._cvScroll || {};
    ov.querySelectorAll(".sk-ctrack").forEach(function(tr, i) { if (keep[i]) tr.scrollLeft = keep[i]; tr.addEventListener("scroll", function() { (S._cvScroll = S._cvScroll || {})[i] = tr.scrollLeft; }); });
    var dlg = ov.querySelector(".sk-cview"); if (keep.top) dlg.scrollTop = keep.top; dlg.addEventListener("scroll", function() { (S._cvScroll = S._cvScroll || {}).top = dlg.scrollTop; });
    var redraw = function() { S.openCompanyView(cid); };
    // Choisir ou laisser une carte : seuls la carte, la consigne et la barre du bas changent (pas de nouvel affichage, le double appui reste rapide).
    var sync = function() {
        S._cvSel = {cid: cid, uids: sel};
        ov.querySelectorAll(".sk-cview [data-tcard]").forEach(function(n) { n.classList.toggle("sk-tsel", sel.indexOf(n.dataset.tcard) >= 0); });
        var h = ov.querySelector(".sk-cvhint"); h.classList.toggle("on", !!sel.length); h.textContent = sel.length ? t("cv_hint_sel", sel.length) : t("cv_hint");
        ov.querySelector(".sk-cvbar").classList.toggle("on", !!sel.length);
    };
    var move = function(uids, dest) {
        S._cvSel = null;
        if (dest == "!bin") { S.removeCards(cid, uids); redraw(); return; }
        var moved = [];
        S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) { if (uids.indexOf(y.uid) >= 0 && S.setItemOwner(x, y, dest || null)) moved.push(y.uid); }); });
        redraw();
        moved.forEach(function(u) { var n = S.root.querySelector("#sk-overlay [data-tcard='" + u + "']"); if (n) n.classList.add("sk-tmoved"); });
    };
    ov.onpointerdown = ov.onpointerup = null; ov.onkeydown = function(ev) { if (ev.key == "Escape") S.closeCompanyView(); };
    ov.onclick = function(ev) {
        if (S._cvDragAt && Date.now() - S._cvDragAt < 400) return;
        if (ev.target === ov || ev.target.closest("[data-cvclose]")) { S.closeCompanyView(); return; }
        if (ev.target.closest("[data-cvunsel]")) { sel = []; sync(); return; }
        if (ev.target.closest("[data-cvadd]")) {
            S.openCacheEditor(cid, redraw); return;
        }
        var k = ev.target.closest("[data-tcard]");
        if (k) {
            var u = k.dataset.tcard, now = Date.now(), tp = S._cvTap;
            // Double appui : la sélection revient à ce qu'elle était avant le premier appui, et la carte s'ouvre en grand.
            if (tp && tp.uid == u && now - tp.at < 400) { S._cvTap = null; sel = tp.prev; sync(); S.cardZoom(cid, u, redraw); return; }
            S._cvTap = {uid: u, at: now, prev: sel.slice()};
            var i = sel.indexOf(u); if (i < 0) sel.push(u); else sel.splice(i, 1);
            sync(); return;
        }
        var d = ev.target.closest("[data-dest]");
        if (d && sel.length) { move(sel.slice(), d.dataset.dest); return; }
    };
    S.bindCardDrag(ov, move);
};
S.closeCompanyView = function() {
    var ov = S.root.querySelector("#sk-overlay"); S._cvSel = null; S._cvScroll = null; S._cvTap = null;
    ov.classList.remove("on", "sk-cvdrag"); ov.innerHTML = ""; ov.onclick = ov.onkeydown = null; S.rerender();
};
// Glisser une carte jusqu'à un héros, la cache ou la corbeille. Une carte choisie emmène toutes les cartes choisies.
// Le glisser part tout de suite dès que le doigt monte ou descend (ou bouge, si la piste ne défile pas) ; un glissé
// horizontal fait défiler la piste. L'appui long reste possible, pour glisser une carte dans n'importe quelle direction.
// Les écouteurs ne sont posés qu'une fois sur le calque, qui est réutilisé à chaque nouvel affichage de la vue.
S.bindCardDrag = function(ov, move) {
    S._cvMove = move;
    if (ov._cvDragBound) return; ov._cvDragBound = true;
    var timer = null, drag = null, sx = 0, sy = 0, card = null, lift = null;
    var target = function(x, y) { var el = document.elementFromPoint(x, y); return el ? el.closest("#sk-overlay [data-dest]") : null; };
    var end = function() {
        clearTimeout(timer); timer = null;
        if (!drag) return;
        drag.ghost.remove(); ov.classList.remove("sk-cvdrag");
        ov.querySelectorAll(".sk-tdrag").forEach(function(n) { n.classList.remove("sk-tdrag"); });
        ov.querySelectorAll(".sk-dover").forEach(function(n) { n.classList.remove("sk-dover"); });
        var d = drag.over, uids = drag.uids; drag = null; S._cvDragAt = Date.now();
        if (d && S._cvMove) S._cvMove(uids, d.dataset.dest);
    };
    ov.addEventListener("pointerdown", function(ev) {
        var k = ev.target.closest("[data-tcard]"); if (!k || !ov.querySelector(".sk-cview")) return;
        if (ev.pointerType == "mouse" && ev.button != 0) return;
        sx = ev.clientX; sy = ev.clientY; clearTimeout(timer); card = k;
        lift = function() {
            clearTimeout(timer); timer = null; var r = k.getBoundingClientRect(), g = k.cloneNode(true), sel = (S._cvSel && S._cvSel.uids) || [];
            var uids = sel.indexOf(k.dataset.tcard) >= 0 ? sel.slice() : [k.dataset.tcard];
            g.className = "sk-tcard sk-tghost"; g.style.width = r.width + "px"; g.style.left = (sx - r.width / 2) + "px"; g.style.top = (sy - r.height / 2) + "px";
            if (uids.length > 1) g.insertAdjacentHTML("beforeend", "<b class='sk-tghostn'>" + uids.length + "</b>");
            document.body.appendChild(g); ov.classList.add("sk-cvdrag");
            uids.forEach(function(u) { var n = ov.querySelector("[data-tcard='" + u + "']"); if (n) n.classList.add("sk-tdrag"); });
            drag = {uids: uids, ghost: g, w: r.width, h: r.height, over: null};
            S._cvTap = null;
            if (navigator.vibrate) navigator.vibrate(20);
        };
        timer = setTimeout(lift, 400);
    });
    ov.addEventListener("pointermove", function(ev) {
        var dx = Math.abs(ev.clientX - sx), dy = Math.abs(ev.clientY - sy);
        if (timer && (dx > 8 || dy > 8)) {
            var tr = card && card.closest(".sk-ctrack"), scrolls = tr && tr.scrollWidth > tr.clientWidth + 2 && !tr.classList.contains("sk-ctrack-wrap");
            if (!scrolls || dy > dx) lift(); else { clearTimeout(timer); timer = null; }
        }
        if (!drag) return;
        ev.preventDefault();
        drag.ghost.style.left = (ev.clientX - drag.w / 2) + "px"; drag.ghost.style.top = (ev.clientY - drag.h / 2) + "px";
        // Près du haut ou du bas de l'écran, la vue défile pour atteindre un héros caché (sauf sur la corbeille).
        var d = target(ev.clientX, ev.clientY), bin = d && d.dataset.dest == "!bin";
        var dlg = ov.querySelector(".sk-cview"); if (dlg && !bin) { if (ev.clientY < 90) dlg.scrollTop -= 14; else if (ev.clientY > innerHeight - 90) dlg.scrollTop += 14; }
        if (d != drag.over) { if (drag.over) drag.over.classList.remove("sk-dover", "hot"); drag.over = d; if (d) d.classList.add(bin ? "hot" : "sk-dover"); }
    }, {passive: false});
    ov.addEventListener("pointerup", end); ov.addEventListener("pointercancel", end);
    ov.addEventListener("touchmove", function(ev) { if (drag) ev.preventDefault(); }, {passive: false});
    ov.addEventListener("contextmenu", function(ev) { if (ev.target.closest("[data-tcard]")) ev.preventDefault(); });
};

// ---------- Écran de campagne : appui sur une fiche, cave en piste de cartes, bouton Compagnie et cave ----------
S.caveBlockCode = function(c) {
    var cave = S.cardsOf(c, null);
    return "<div class='sk-blk sk-c8 sk-caveblk'><h3>" + e(t("common_cache")) + "</h3>"
        + "<div class='sk-ctrack sk-ctrack-big' data-cavetrack>" + cave.map(function(it) { return S.trackCard(c, it); }).join("")
        + "<button class='sk-tcard sk-tadd' data-cact='addcave' aria-label='" + e(t("add_to_cave")) + "'><span>+</span>" + e(t("add_to_cave")) + "</button></div>"
        + "<button class='sk-btn sk-primary sk-addrow' data-cact='companyview'>&#xf00a; " + e(t("company_view")) + "</button></div>";
};
var baseRenderCampaign = S.renderCampaign;
S.renderCampaign = function(cid) {
    var r = baseRenderCampaign.apply(S, arguments);
    var c = S.campaign(cid); if (!c || S.screen != "campaign") return r;
    var old = S.root.querySelector(".sk-campaign [data-drop='cache']");
    if (old) old.outerHTML = S.caveBlockCode(c);
    var base = S.screenClick;
    S.screenClick = function(ev) {
        var b = ev.target.closest("[data-cact='companyview'], [data-cact='addcave'], .sk-caveblk [data-tcard]");
        if (b) {
            if (b.dataset.cact == "companyview") S.openCompanyView(c.id);
            else if (b.dataset.cact == "addcave") S.openCacheEditor(c.id);
            else S.cardZoom(c.id, b.dataset.tcard, function() { var ov = S.root.querySelector("#sk-overlay"); ov.classList.remove("on", "sk-zoomon"); ov.innerHTML = ""; ov.onclick = ov.onkeydown = null; S.rerender(); });
            return;
        }
        return base && base.apply(this, arguments);
    };
    return r;
};
// Un appui (ou un clic) sur une fiche de héros : son zoom, comme pour les cartes de la cache. Écran de campagne et
// préparation d'un scénario. Après un appui long (description d'une compétence), on n'ouvre pas.
S.bindHeroZoom = function(root) {
    var down = 0;
    root.addEventListener("pointerdown", function(ev) { if (ev.target.closest && ev.target.closest(".sk-hcard-f")) down = Date.now(); });
    root.addEventListener("click", function(ev) {
        var f = ev.target.closest(".sk-hcard-f"); if (!f || ev.target.closest("[data-cact]")) return;
        if (down && Date.now() - down > 450 && ev.target.closest("[data-skill]")) return;
        var hid = f.closest("[data-hzoom]").dataset.hzoom, cid = S.curCampaign || (S.ctx && S.ctx.cid);
        if (cid) { S.hideTip && S.hideTip(); S.heroZoom(cid, hid); }
    });
    root.addEventListener("keydown", function(ev) {
        if (ev.key != "Enter") return; var f = ev.target.closest && ev.target.closest(".sk-hcard-f"); if (!f) return;
        var cid = S.curCampaign || (S.ctx && S.ctx.cid); if (cid) S.heroZoom(cid, f.closest("[data-hzoom]").dataset.hzoom);
    });
};
var baseInit25 = S.init;
S.init = function(root) { var r = baseInit25.apply(S, arguments); S.bindHeroZoom(root); return r; };

// Préparation d'un scénario de campagne : les mêmes fiches que la compagnie.
S.heroesSectionCode = function(cid) {
    var c = S.campaign(cid); if (!c) return "";
    return "<h2>" + t("heroes_equipment") + "</h2><p class='sk-help'>" + t("heroes_equipment_help") + "</p>"
        + ((c.heroes || []).length ? S.companyCode(c).replace(/<button class='sk-hsheet sk-hsheet-empty'[^]*?<\/button>/g, "") : "<p class='sk-help'>" + t("no_hero") + "</p>");
};
})();

// ---------- Défilement par glissé, partout : pas de barre de défilement ----------
(function() {
var S = Skelos;
// Au doigt, les pistes de cartes défilent déjà en glissant. À la souris, on attrape la piste et on la fait glisser ;
// la molette verticale la fait aussi défiler. Un glissé ne compte pas comme un appui sur la carte où il a commencé.
S.bindDragScroll = function(root) {
    if (!root || root._skDragScroll) return; root._skDragScroll = true;
    var st = null;
    root.addEventListener("pointerdown", function(ev) {
        if (ev.pointerType != "mouse" || ev.button != 0) return;
        var tr = ev.target.closest(".sk-ctrack"); if (!tr || tr.scrollWidth <= tr.clientWidth + 2) return;
        st = {tr: tr, x: ev.clientX, l: tr.scrollLeft, moved: false};
    });
    window.addEventListener("pointermove", function(ev) {
        if (!st) return;
        // Une carte attrapée par appui long (vue Compagnie et cache) : c'est elle qui bouge, pas la piste.
        if (root.querySelector("#sk-overlay.sk-cvdrag")) { st.tr.classList.remove("sk-grabbing"); st = null; return; }
        var dx = ev.clientX - st.x;
        if (!st.moved && Math.abs(dx) < 6) return;
        st.moved = true; st.tr.classList.add("sk-grabbing"); st.tr.scrollLeft = st.l - dx;
    });
    window.addEventListener("pointerup", function() {
        if (!st) return;
        if (st.moved) S._dragScrollAt = Date.now();
        st.tr.classList.remove("sk-grabbing"); st = null;
    });
    root.addEventListener("click", function(ev) {
        if (S._dragScrollAt && Date.now() - S._dragScrollAt < 300) { S._dragScrollAt = 0; ev.stopPropagation(); ev.preventDefault(); }
    }, true);
    root.addEventListener("wheel", function(ev) {
        var tr = ev.target.closest(".sk-ctrack"); if (!tr || tr.scrollWidth <= tr.clientWidth + 2 || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;
        var max = tr.scrollWidth - tr.clientWidth;
        if ((ev.deltaY < 0 && tr.scrollLeft <= 0) || (ev.deltaY > 0 && tr.scrollLeft >= max - 1)) return;  // au bout : la page reprend la molette
        ev.preventDefault(); tr.scrollLeft += ev.deltaY;
    }, {passive: false});
};
var baseInitDS = S.init;
S.init = function(root) { var r = baseInitDS.apply(S, arguments); S.bindDragScroll(root || S.root); return r; };
})();

// ---------- Page d'une campagne : glisser une carte de la cache sur la fiche d'un héros (ou dans la corbeille) ----------
// Glisser une carte de la cache : sur une fiche, le héros la prend ; sur la corbeille qui apparaît en bas, elle est supprimée
// (sauf l'équipement de départ). Le glisser part dès que le doigt monte ou descend ; un glissé horizontal fait défiler
// la cache ; l'appui long reste possible. Un simple appui l'ouvre toujours en grand.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
S.bindPageCardDrag = function(cid) {
    var blk = S.root.querySelector(".sk-caveblk"); if (!blk) return;
    var timer = null, drag = null, sx = 0, sy = 0, card = null, lift = null;
    var scroller = function() { var n = blk.parentElement; while (n && n !== document.body) { var cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight) return n; n = n.parentElement; } return document.scrollingElement; };
    var target = function(x, y) {
        var el = document.elementFromPoint(x, y); if (!el) return null;
        if (el.closest(".sk-pgtrash")) return {bin: true, el: el.closest(".sk-pgtrash")};
        var h = el.closest(".sk-hcard[data-hzoom]"); return h && !h.classList.contains("dead") ? {hid: h.dataset.hzoom, el: h} : null;
    };
    var finish = function() {
        clearTimeout(timer); timer = null;
        if (!drag) return;
        var d = drag; drag = null; S._pgDragAt = Date.now();
        d.ghost.remove(); d.bin.remove(); d.src.classList.remove("sk-tdrag");
        S.root.querySelectorAll(".sk-dover").forEach(function(n) { n.classList.remove("sk-dover"); });
        var tg = d.over; if (!tg) return;
        if (tg.bin) S.removeCards(cid, [d.uid]);
        else S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) { if (y.uid == d.uid) S.setItemOwner(x, y, tg.hid); }); });
        S.rerender();
    };
    blk.addEventListener("pointerdown", function(ev) {
        var k = ev.target.closest(".sk-ctrack [data-tcard]"); if (!k || (ev.pointerType == "mouse" && ev.button != 0)) return;
        sx = ev.clientX; sy = ev.clientY; clearTimeout(timer); card = k;
        lift = function() {
            clearTimeout(timer); timer = null; var r = k.getBoundingClientRect(), g = k.cloneNode(true);
            g.className = "sk-tcard sk-tghost"; g.style.width = r.width + "px"; g.style.left = (sx - r.width / 2) + "px"; g.style.top = (sy - r.height / 2) + "px";
            document.body.appendChild(g); k.classList.add("sk-tdrag");
            var bin = document.createElement("div"); bin.className = "sk-trash sk-pgtrash"; bin.setAttribute("aria-hidden", "true");
            bin.innerHTML = "<i>&#xf2ed;</i><span>" + e(t("cv_drop_remove")) + "</span>"; document.body.appendChild(bin);
            drag = {uid: k.dataset.tcard, src: k, ghost: g, bin: bin, w: r.width, h: r.height, over: null, sc: scroller()};
            if (navigator.vibrate) navigator.vibrate(20);
        };
        timer = setTimeout(lift, 400);
    });
    S._pgMove = function(ev) {
        var dx = Math.abs(ev.clientX - sx), dy = Math.abs(ev.clientY - sy);
        if (timer && (dx > 8 || dy > 8)) {
            var tr = card && card.closest(".sk-ctrack"), scrolls = tr && tr.scrollWidth > tr.clientWidth + 2 && !tr.classList.contains("sk-ctrack-wrap");
            if (!scrolls || dy > dx) lift(); else { clearTimeout(timer); timer = null; }
        }
        if (!drag) return;
        ev.preventDefault();
        drag.ghost.style.left = (ev.clientX - drag.w / 2) + "px"; drag.ghost.style.top = (ev.clientY - drag.h / 2) + "px";
        var tg = target(ev.clientX, ev.clientY);
        // Près du haut de l'écran, la page remonte vers les héros ; près du bas, elle descend.
        if (drag.sc && !(tg && tg.bin)) { if (ev.clientY < 110) drag.sc.scrollTop -= 14; else if (ev.clientY > innerHeight - 110) drag.sc.scrollTop += 14; }
        if ((tg && tg.el) != (drag.over && drag.over.el)) {
            if (drag.over) drag.over.el.classList.remove("sk-dover", "hot");
            drag.over = tg; if (tg) tg.el.classList.add(tg.bin ? "hot" : "sk-dover");
        }
    };
    S._pgEnd = finish;
    // Les écouteurs de la fenêtre ne sont posés qu'une fois ; ils suivent la page affichée.
    if (!S._pgWin) {
        S._pgWin = true;
        window.addEventListener("pointermove", function(ev) { if (S._pgMove) S._pgMove(ev); }, {passive: false});
        window.addEventListener("pointerup", function() { if (S._pgEnd) S._pgEnd(); });
        window.addEventListener("pointercancel", function() { if (S._pgEnd) S._pgEnd(); });
    }
    blk.addEventListener("touchmove", function(ev) { if (drag) ev.preventDefault(); }, {passive: false});
    blk.addEventListener("contextmenu", function(ev) { if (ev.target.closest("[data-tcard]")) ev.preventDefault(); });
    blk.addEventListener("click", function(ev) { if (S._pgDragAt && Date.now() - S._pgDragAt < 400) { ev.stopPropagation(); ev.preventDefault(); } }, true);
};
var baseRC = S.renderCampaign;
S.renderCampaign = function(cid) {
    var r = baseRC.apply(S, arguments);
    if (S.screen == "campaign") S.bindPageCardDrag(cid);
    return r;
};
})();
