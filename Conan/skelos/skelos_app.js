// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Ce module n'ajoute aucune image ni donnée de Monolith :
// il utilise celles déjà chargées par le Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell).
// Livre de Skelos : navigation, partie libre, campagnes, sélecteur d'objets, encyclopédie, réglages.
// L'utilisateur reste maître des règles : l'app propose des valeurs, tout reste modifiable.
(function() {
var S = Skelos, t = function() { return S.t.apply(S, arguments); }, e = function(x) { return S.esc(x); };
// Sur tablette, placer le curseur dans la recherche d'un sélecteur ouvre le clavier : iOS remonte alors la page
// et l'en-tête du sélecteur (Valider, Fermer) reste en partie hors de l'écran. Le curseur ne s'y place qu'à la souris.
S.softFocus = function(el) {
    if (!el || (window.matchMedia && matchMedia("(pointer: coarse)").matches)) return;
    try { el.focus({preventScroll: true}); } catch (x) { el.focus(); }
};
// Quand le clavier d'iOS se referme, la page reste parfois décalée vers le haut : on la remet en place.
document.addEventListener("focusout", function() {
    setTimeout(function() { if (!document.activeElement || !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); } }, 120);
});
var KEY_CAMP = Application + "_SkelosCampaigns", KEY_UP = Application + "_SkelosUpgrades", KEY_BG = Application + "_SkelosBackground";
// Fonds du livre manuel choisis par l'utilisateur (gardés seulement sur cet appareil) : green, red, rest, gem1 … gem8.
var KEY_SKIN = Application + "_SkelosSkin";
var HERO_COLORS = ["#e0a43a", "#3fb6a8", "#a58be0", "#e06a5a", "#7fbf6a", "#d98bd0", "#6aa8e0"];
S.HERO_COLORS = HERO_COLORS;
var ARCHETYPES = ["guerrier", "voleur", "sorcier", "mercenaire"];
var uid = function(p) { return (p || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
var load = function(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (x) { return d; } };
var store = function(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (x) { S.toast(t("storage_full")); return false; } };
var today = function() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
// Dates au format de la langue choisie dans le Compagnon (et non celle du navigateur).
S.locale = function() { return (typeof Language != "undefined" && Language) || undefined; };
S.fmtDay = function(iso) {
    if (!iso) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
    if (isNaN(d)) return String(iso);
    try { return d.toLocaleDateString(S.locale(), {day: "2-digit", month: "2-digit", year: "numeric"}); } catch (x) { return d.toLocaleDateString(); }
};
var fmtDate = function(iso) { return iso ? S.fmtDay(iso) : "—"; };
var shell = function(cls, inner) {
    return "<div class='skelos-game sk-screen " + (cls || "") + "'><div class='sk-board'><div class='sk-g8'>" + inner + "</div></div></div>"
        + "<div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>";
};
var head = function(back, title, extra) {
    return "<div class='sk-blk sk-headblk'>" + (back ? "<button class='sk-btn' data-nav='" + back + "'>← " + t(back == "home" ? "home" : back) + "</button>" : "")
        + "<h2>" + title + "</h2>" + (extra || "") + "</div>";
};

// ---------- Données ----------
S.campaigns = function() {
    // Le barème des rangs et le statut « terminée » saisi à la main n'existent plus.
    return load(KEY_CAMP, []).map(function(c) { delete c.tiers; delete c.finished; return c; });
};
S.saveCampaigns = function(l) { return store(KEY_CAMP, l); };
S.campaign = function(cid) { return S.campaigns().filter(function(c) { return c.id == cid; })[0] || null; };
S.campaignName = function(cid) { var c = S.campaign(cid); return c ? c.name : ""; };
S.updateCampaign = function(cid, fn) {
    var l = S.campaigns(), c = l.filter(function(x) { return x.id == cid; })[0];
    if (!c) return null; fn(c); S.saveCampaigns(l); return c;
};
S.upgrades = function() { return load(KEY_UP, []); };
S.saveUpgrades = function(l) { return store(KEY_UP, l); };
S.campLog = function(c, msg) { c.log = c.log || []; c.log.unshift({d: today(), msg: msg}); if (c.log.length > 200) c.log.pop(); };

S.vpTotal = function(c) { return (c.scenarios || []).reduce(function(a, x) { return a + (x.status && x.status != "todo" ? (parseInt(x.vp, 10) || 0) : 0); }, 0); };
// Une campagne est terminée quand le dernier scénario de son fil a été joué et qu'aucune partie de la campagne n'est en cours.
S.campaignFinished = function(c) {
    var scs = (c && c.scenarios) || [], last = scs[scs.length - 1];
    if (!last || !S.scenarioPlays(last).length) return false;
    return !(S.state && S.state.campaign && S.state.campaign.cid == c.id);
};

// Catalogue des objets : équipements et sorts du Compagnon, améliorations locales.
S.catalog = function(kind) {
    if (kind == "up") return S.upgrades().map(function(u) { return {kind: "up", ref: u.id, name: u.name, data: u}; });
    var src = kind == "eq" ? Encyclopedia.equipments : Encyclopedia.spells;
    if (!src || !src.list) return [];
    var seen = {}, out = [], arr = Array.isArray(src.list);
    (arr ? src.list.map(function(x) { return x.id; }) : Object.keys(src.list)).forEach(function(k, n) {
        var x = arr ? src.list[n] : src.list[k]; if (!x || !x.title) return;
        var key = x.title.toLowerCase(), o = x.origins || [];
        if (seen[key]) { o.forEach(function(b) { if (seen[key].origins.indexOf(b) < 0) seen[key].origins.push(b); }); return; }
        seen[key] = {kind: kind, ref: k, name: x.title, data: x, origins: o.slice()};
        out.push(seen[key]);
    });
    return out.sort(function(a, b) { return a.name.localeCompare(b.name, "fr"); });
};
S.heroNames = function() {
    var l = (Encyclopedia.heroes && Encyclopedia.heroes.list) || [], seen = {}, out = [];
    l.forEach(function(x) { var n = (x.name || "").replace(/<[^>]+>/g, "").trim(); if (n && !seen[n]) { seen[n] = true; out.push(n); } });
    return out.sort(function(a, b) { return a.localeCompare(b, "fr"); });
};
// Carte originale dessinée par le Compagnon, quand son code est présent.
S.realCardCode = function(kind, ref) {
    try {
        // Tuile portée par une autre tuile : référence « id|image ».
        if (kind == "ti") {
            var tp = String(ref).split("|"), tl = S.tileOf({tileId: tp[0], img: tp.slice(1).join("|")});
            if (tl) return "<div class='sk-tilebox sk-cardtile'>" + S.tileCode({tileId: tl.id, img: tl.image, color: tl.colors[0]}) + "</div>";
        }
        if (kind == "eq" && typeof CardEquipment != "undefined" && typeof EncyclopediaEquipments != "undefined") {
            var q = (Encyclopedia.equipments.list || []).filter(function(x) { return x.id == ref; })[0];
            if (q) return CardEquipment._cardCode(EncyclopediaEquipments._convertEquipmentToStudio(q));
        }
        if (kind == "sp" && typeof CardSpell != "undefined" && typeof EncyclopediaSpells != "undefined") {
            var p = (Encyclopedia.spells.list || []).filter(function(x) { return x.id == ref; })[0];
            if (p) return CardSpell._cardCode(EncyclopediaSpells._convertSpellToStudio(p));
        }
    } catch (x) {}
    return null;
};
S.itemName = function(kind, ref) {
    if (kind == "ti") { var tl = S.tileOf({tileId: String(ref).split("|")[0], img: String(ref).split("|").slice(1).join("|")}); return tl ? (tl.id == "event" ? t("scenario_events") : tl.name) : ref; }
    var x = S.catalog(kind).filter(function(i) { return i.ref == ref; })[0];
    return x ? x.name : ref;
};

// ---------- Gemmes : conservation et réglage en cours de partie ----------
S.boostSum = function() { var b = S.state.boosts || {}, n = 0; for (var k in b) n += b[k] || 0; return n; };
S.gemTotal = function() { return S.state.energy + S.state.fatigue + S.boostSum(); };
S.transferGem = function(dir) {
    var st = S.state;
    if (dir == "tofatigue" && st.energy > 0) { S.snapshot(); st.energy--; st.fatigue++; }
    else if (dir == "toenergy" && st.fatigue > 0) { S.snapshot(); st.fatigue--; st.energy++; }
    else return;
    S.save(); S.renderGame();
};
S.newSlot = function(tile) {
    var st = S.state, n = 0;
    st.river.concat(st.removedSlots || []).forEach(function(s) { var k = parseInt(String(s.uid).slice(1), 10); if (k >= n) n = k + 1; });
    var maxTok = 0; st.river.forEach(function(s) { if (s.token > maxTok) maxTok = s.token; });
    var slot = {uid: "u" + n, token: maxTok + 1, tileId: tile.id, img: tile.image, color: tile.colors[0], dead: false, lpMax: null, lp: null};
    S.adoptSharedHp(slot);
    return slot;
};
S.addLiveSlot = function(tile) {
    var st = S.state, slot = S.newSlot(tile);
    st.river.push(slot);
    if (st.mode == "solo") st.pool.push(slot.uid);
    S.log(t("log_tile_added", S.tileName(slot)));
};
S.forgetSlot = function(slot) {
    var st = S.state; if (!slot) return;
    st.pool = (st.pool || []).filter(function(u) { return u != slot.uid; });
    st.used = (st.used || []).filter(function(u) { return u != slot.uid; });
    if (S.selected == slot.uid) S.selected = null;
    S.log(t("log_tile_removed", S.tileName(slot)));
};
S.scenarioFromState = function() {
    var st = S.state, d = JSON.parse(JSON.stringify(st.scenario));
    d.river = st.river.map(function(s) { return {tileId: s.tileId, img: s.img, color: s.color, lp: s.lpMax, eventText: s.eventText || "", cards: (s.cards || []).slice()}; });
    d.turns = st.turns; d.recovery = st.recovery; d.maxActivations = st.maxActivations; d.heroes = st.heroes;
    if (st.mode == "classic") { d.energy = st.energy; d.fatigue = st.fatigue + S.boostSum(); }
    return d;
};
S.clearGame = function() { S.state = null; S.undoStack = []; S.selected = null; try { localStorage.removeItem(S.storageGame); } catch (x) {} };

// Actions supplémentaires de l'écran de préparation.
S.setupAction = function(b) {
    var act = b.dataset.act;
    switch (act) {
        case "home": S.ctx = null; S.renderHome(); return true;
        case "backcamp": var cid = S.ctx.cid; S.readForm(); S.savePrep(); S.ctx = null; S.renderCampaign(cid); return true;
        case "prepsave": S.readForm(); S.savePrep(); S.toast(t("prep_saved")); return true;
        case "heroassign": S.openAssign(b.dataset.cid, b.dataset.hero); return true;
        case "itemmenu": S.openItemMenu(b.dataset.cid, b.dataset.item); return true;
    }
    return false;
};
S.savePrep = function() {
    var ctx = S.ctx; if (!ctx) return;
    var d = JSON.parse(JSON.stringify(S.draft));
    S.updateCampaign(ctx.cid, function(c) { var sc = c.scenarios[ctx.idx]; if (sc) { sc.setup = d; sc.title = d.title || sc.title; } });
};
S.onGameStart = function() {
    var st = S.state; if (!st || !st.campaign) return;
    S.updateCampaign(st.campaign.cid, function(c) {
        var sc = c.scenarios[st.campaign.idx]; if (!sc) return;
        // La préparation du scénario n'est jamais réécrite au lancement : elle doit pouvoir resservir telle quelle (elle porte l'état préparé en studio).
        if (!sc.setup) sc.setup = JSON.parse(JSON.stringify(st.scenario));
        sc.title = sc.title || st.scenario.title; sc.status = sc.status == "todo" ? "playing" : sc.status;
        if (!sc.date) sc.date = today();
        S.campLog(c, t("clog_launch", st.campaign.idx + 1, sc.title));
    });
    S.ctx = null;
};

// Parties jouées d'un scénario du fil : un scénario se rejoue ; seule la dernière partie compte pour le total.
S.scenarioPlays = function(sc) {
    if (sc.plays) return sc.plays;
    return sc.status == "win" || sc.status == "loss" ? [{date: sc.date || null, result: sc.status, vp: parseInt(sc.vp, 10) || 0, turn: sc.turnReached || null,
        turns: (sc.setup && sc.setup.turns) || null, title: sc.title || "", notes: sc.notes || "", fallen: []}] : [];
};
S.syncScenario = function(sc) {
    var p = sc.plays = S.scenarioPlays(sc), last = p[p.length - 1];
    if (last) { sc.status = last.result; sc.vp = last.vp; sc.date = last.date; sc.turnReached = last.turn; }
    else { if (sc.status == "win" || sc.status == "loss") sc.status = "todo"; sc.vp = 0; sc.date = null; sc.turnReached = null; }
};
S.fmtVp = function(v) { v = parseInt(v, 10) || 0; return v > 0 ? "+" + v : v < 0 ? "\u2212" + (-v) : "0"; };
S.openPlay = function(cid, i, k) {
    var c = S.campaign(cid), sc = c.scenarios[i], p = S.scenarioPlays(sc)[k]; if (!p) return;
    var fallen = (p.fallen || []).length ? p.fallen.map(function(n) { return e(n); }).join(", ") : e(t("no_fallen"));
    S.dialog("<h2>" + e(t("play_title", fmtDate(p.date))) + "</h2><dl class='sk-playdl'>"
        + "<dt>" + e(t("play_scenario")) + "</dt><dd>" + e(p.title || sc.title || t("untitled")) + "</dd>"
        + "<dt>" + e(t("turn")) + "</dt><dd>" + e(t("turn_of", p.turn || "?", p.turns || "?")) + "</dd>"
        + "<dt>" + e(t("result")) + "</dt><dd><span class='sk-pastille sk-sm " + p.result + "'>" + S.fmtVp(p.vp) + "</span> " + e(t(p.result == "win" ? "victory" : "defeat")) + "</dd>"
        + "<dt>" + e(t("fallen_heroes")) + "</dt><dd>" + fallen + "</dd>"
        + (p.notes ? "<dt>" + e(t("notes")) + "</dt><dd>" + e(p.notes) + "</dd>" : "") + "</dl>"
        + "<div class='sk-playedit'><label class='sk-fl'>" + t("game_date") + "<input class='sk-in' id='sk-pd' type='date' value='" + e(p.date || "") + "'></label>"
        + "<label class='sk-fl'>" + t("victory_points") + "<input class='sk-in' id='sk-pv' type='number' value='" + (parseInt(p.vp, 10) || 0) + "'></label></div>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ok>" + t("validate") + "</button><button class='sk-btn' data-dclose>" + t("cancel") + "</button>"
        + "<button class='sk-btn sk-danger' data-rm>" + t("delete_play") + "</button></div>",
        function(ev, close) {
            if (ev.target.closest("[data-ok]")) {
                var d = S.root.querySelector("#sk-pd").value || p.date, v = parseInt(S.root.querySelector("#sk-pv").value, 10) || 0; close();
                S.updateCampaign(cid, function(x) { var s = x.scenarios[i]; s.plays = S.scenarioPlays(s); s.plays[k].date = d; s.plays[k].vp = v; S.syncScenario(s); });
                S.renderCampaign(cid);
            } else if (ev.target.closest("[data-rm]")) {
                close(); S.ask(t("confirm_delete_play"), t("delete"), function() {
                    S.updateCampaign(cid, function(x) { var s = x.scenarios[i]; s.plays = S.scenarioPlays(s); s.plays.splice(k, 1); S.syncScenario(s); });
                    S.renderCampaign(cid);
                });
            }
        });
};

// ---------- Accueil ----------
S.playedCount = function(c) { return (c.scenarios || []).filter(function(x) { return x.status == "win" || x.status == "loss"; }).length; };

S.mount = function(html) {
    S._lastScreen = S.screen;
    S.root.innerHTML = html;
    if (!S._pressBound) { S.bindPress(S.root); S._pressBound = true; }
    var scr = S.root.querySelector(".sk-screen");
    if (scr) scr.addEventListener("click", S.navClick);
    if (S.inCompanion && S.root) S.root.scrollTop = 0; else window.scrollTo(0, 0);
};
S.navClick = function(ev) {
    var n = ev.target.closest("[data-nav]");
    if (n) {
        var v = n.dataset.nav;
        if (v == "home") S.renderHome();
        else if (v == "game") { if (S.state) S.renderGame(); }
        else if (v == "campaigns") S.renderCampaigns();
        else if (v == "encyclopedia") S.renderEncyclopedia();
        else if (v == "settings") S.renderSettings();
        else if (v == "campaign") S.renderCampaign(n.dataset.cid);
        return;
    }
    // Le bouton Dupliquer d'une carte de campagne ne l'ouvre pas.
    var d = ev.target.closest("[data-cdup]");
    if (d) { S.duplicateCampaign(d.dataset.cdup, true); return; }
    var c = ev.target.closest("[data-camp]");
    if (c) { S.renderCampaign(c.dataset.camp); return; }
    if (S.screenClick) S.screenClick(ev);
};

// ---------- Campagnes ----------
S.renderCampaigns = function() {
    S.screen = "campaigns";
    var camps = S.campaigns(), h = head("home", t("campaigns"));
    var row = function(c) {
        return "<div class='sk-li'><span class='sk-li-t'>" + e(c.name) + "<small>" + t(c.mode == "solo" ? "mode_solo" : "mode_classic") + " · " + t("camp_progress", S.playedCount(c), (c.scenarios || []).length)
            + " · " + S.vpTotal(c) + " PV" + (c.last ? " · " + t("last_played", fmtDate(c.last)) : "") + "</small></span><button class='sk-btn sk-primary' data-camp='" + c.id + "'>" + t("open") + "</button></div>";
    };
    var cur = camps.filter(function(c) { return !S.campaignFinished(c); }), done = camps.filter(function(c) { return S.campaignFinished(c); });
    h += "<div class='sk-blk sk-c5'><h3>" + t("in_progress") + "</h3>" + (cur.length ? cur.map(row).join("") : "<p>" + t("no_campaign") + "</p>")
        + (done.length ? "<h3 class='sk-mt'>" + t("finished") + "</h3>" + done.map(row).join("") : "") + "</div>";
    h += "<div class='sk-blk sk-c3'><h3>" + t("new_campaign") + "</h3>"
        + "<label class='sk-fl'>" + t("name") + "<input class='sk-in' id='sk-cn' placeholder='" + e(t("campaign_name_ph")) + "'></label>"
        + "<span class='sk-fl'>" + t("mode") + "</span><div class='sk-seg'><button class='sk-on' data-mode='solo' aria-pressed='true'>" + t("mode_solo") + "</button><button data-mode='classic' aria-pressed='false'>" + t("mode_classic") + "</button></div>"
        + "<p>" + t("new_campaign_help") + "</p><button class='sk-btn sk-primary' data-newcamp>" + t("create") + "</button></div>";
    S.mount(shell("sk-camps", h));
    var mode = "solo";
    S.screenClick = function(ev) {
        var m = ev.target.closest("[data-mode]");
        if (m) { mode = m.dataset.mode; S.root.querySelectorAll("[data-mode]").forEach(function(x) { x.classList.toggle("sk-on", x == m); x.setAttribute("aria-pressed", x == m); }); return; }
        if (ev.target.closest("[data-newcamp]")) {
            var name = S.root.querySelector("#sk-cn").value.trim() || t("campaign_name_ph");
            var c = {id: uid("c"), name: name, scenarios: [], heroes: [], cache: [], log: [], created: today()};
            S.campLog(c, t("clog_created"));
            var l = S.campaigns(); l.push(c); S.saveCampaigns(l); S.renderCampaign(c.id);
        }
    };
};

S.heroColor = function(c, hid) { var hh = (c.heroes || []).filter(function(x) { return x.id == hid; })[0]; return hh ? hh.color : null; };
// Changement de propriétaire d'un objet : l'objet de départ garde le héros d'origine, le journal note le transfert.
S.setItemOwner = function(c, it, owner) {
    if (it.kind == "up") return owner ? S.setTaker(c, it, owner, true) : false;
    owner = owner || null; if ((it.owner || null) == owner) return false;
    if (it.start && !it.startHero && it.owner) it.startHero = it.owner;
    var nm = function(id) { var h = id ? (c.heroes || []).filter(function(x) { return x.id == id; })[0] : null; return h ? h.name : t("common_cache"); };
    S.campLog(c, t("clog_move", it.name, nm(it.owner), nm(owner)));
    it.owner = owner; return true;
};
// Améliorations : plusieurs héros peuvent prendre la même ; elle reste toujours dans la cache (liste « takers »).
// Équipements et sorts : un seul propriétaire (« owner »), comme avant.
S.takers = function(it) {
    if (it.kind != "up") return it.owner ? [it.owner] : [];
    var l = (it.takers || []).slice(); if (it.owner && l.indexOf(it.owner) < 0) l.push(it.owner);
    return l;
};
S.heldBy = function(it, hid) { return S.takers(it).indexOf(hid) >= 0; };
S.setTaker = function(c, it, hid, on) {
    var l = S.takers(it), has = l.indexOf(hid) >= 0; if (!hid || !!on == has) return false;
    var h = (c.heroes || []).filter(function(x) { return x.id == hid; })[0];
    it.takers = on ? l.concat([hid]) : l.filter(function(x) { return x != hid; }); it.owner = null;
    S.campLog(c, t(on ? "clog_up_taken" : "clog_up_left", it.name, h ? h.name : "?"));
    return true;
};
S.startLabel = function(c, it) {
    var id = it.startHero || it.owner, h = id ? (c.heroes || []).filter(function(x) { return x.id == id; })[0] : null;
    return h ? t("start_item_of", h.name) : t("start_item");
};
S.chipCode = function(c, it, opts) {
    opts = opts || {};
    // Une pastille par héros qui possède l'objet (plusieurs pour une amélioration partagée).
    var heroes = S.takers(it).map(function(id) { return (c.heroes || []).filter(function(x) { return x.id == id; })[0]; }).filter(Boolean);
    return "<button class='sk-chip sk-k-" + it.kind + "' data-card='" + it.kind + ":" + e(it.ref) + "'"
        + (opts.menu ? " data-act='itemmenu' data-cid='" + c.id + "' data-item='" + it.uid + "'" : "")
        + (opts.hero ? " data-from='" + opts.hero + "'" : "") + ">"
        + (opts.initial !== false ? heroes.map(function(hh) { return "<span class='sk-ini' style='--hc:" + hh.color + "' title='" + e(hh.name) + "'>" + e(hh.name.charAt(0)) + "</span>"; }).join("") : "") + e(it.name)
        + (it.start ? " <span class='sk-lock' title='" + e(S.startLabel(c, it)) + "'>🔒</span>" : "") + "</button>";
};

S.renderCampaign = function(cid) {
    var c = S.campaign(cid); if (!c) { S.renderCampaigns(); return; }
    S.screen = "campaign"; S.curCampaign = cid;
    var played = S.playedCount(c), nextIdx = (c.scenarios || []).findIndex(function(x) { return x.status == "todo" || x.status == "playing"; });
    var h = S.campaignHeadCode(c);
    // Fil des scénarios
    // Page d'une campagne : le fil, puis la compagnie sur toute la largeur, puis la cache commune dessous.
    h += "<div class='sk-blk sk-c8 sk-threadblk'><h3>" + t("scenario_thread") + "</h3><div class='sk-thread'>";
    (c.scenarios || []).forEach(function(sc, i) {
        var next = i == nextIdx, plays = S.scenarioPlays(sc), last = plays[plays.length - 1];
        var running = !!(S.state && S.state.campaign && S.state.campaign.cid == c.id && S.state.campaign.idx == i);
        // Plus de « à jouer » ni de « prochain scénario » : les pastilles de l'en-tête disent déjà ce qui a été joué. Seule la partie en cours est signalée.
        var hint = running ? t("in_play") : "";
        var acts = (running ? "<button class='sk-btn sk-primary sk-sm' data-cact='resume'>" + t("resume_short") + "</button>"
                : sc.setup ? "<button class='sk-btn sk-sm' data-cact='prepare' data-i='" + i + "'>" + t("prepare") + "</button><button class='sk-btn sk-primary sk-sm' data-cact='launch' data-i='" + i + "'>" + t("launch") + "</button>" : "")
            + "<button class='sk-btn sk-sm' data-cact='choose' data-i='" + i + "'>" + t("choose") + "</button>"
            + (!plays.length && !running ? "<button class='sk-btn sk-icon sk-sm' data-cact='rmsc' data-i='" + i + "' aria-label='" + e(t("delete")) + "'>✕</button>" : "");
        h += "<div class='sk-sc" + (next ? " sk-next" : "") + "'><button class='sk-grip' data-grip='" + i + "' title='" + e(t("move_scenario")) + "' aria-label='" + e(t("move_scenario")) + "'>&#xf58e;</button><span class='sk-sc-n'>" + (i + 1) + "</span>"
            // Mode au-dessus, titre en grand (sur deux lignes s'il le faut, la place des points de victoire reste à droite), dates en dessous.
            + "<div class='sk-sc-main'>" + (sc.setup ? "<span class='sk-smode'>" + e(t(((sc.setup.saved || sc.setup).mode) == "solo" ? "mode_solo" : "mode_classic")) + "</span>" : "")
            + "<div class='sk-sc-top'><span class='sk-sc-t" + (sc.title ? "" : " sk-sc-none") + "'>" + e(sc.title || t("scenario_to_choose")) + "</span>"
            + (last ? "<span class='sk-pastille " + last.result + "' title='" + e(t("last_counts")) + "'>" + S.fmtVp(last.vp) + "</span>" : "") + "</div>"
            + "<div class='sk-sc-sub'><span class='sk-sc-dates'>" + plays.map(function(p, k) {
                return "<button class='sk-date sk-date-" + p.result + "' data-cact='play' data-i='" + i + "' data-p='" + k + "' aria-label='" + e(t("play_detail", fmtDate(p.date))) + "'>" + fmtDate(p.date) + "</button>";
            }).join("") + (hint ? "<span class='sk-sc-hint'>" + e(hint) + "</span>" : "") + "</span><span class='sk-sc-acts'>" + acts + "</span></div></div></div>";
    });
    h += "</div><button class='sk-btn sk-addrow' data-cact='addsc'>+ " + t("add_scenario") + "</button></div>";
    // Compagnie : quatre fiches de héros
    h += "<div class='sk-blk sk-c8'><h3>" + t("company") + "</h3>" + S.companyCode(c) + "</div>";
    // Cache commune
    var cats = [["eq", "cat_eq"], ["sp", "cat_sp"], ["up", "cat_up"]];
    h += "<div class='sk-blk sk-c2' data-drop='cache'><h3>" + t("common_cache") + "</h3><div class='sk-legend'><span><i class='sk-k-eq'></i>" + t("kind_eq") + "</span><span><i class='sk-k-sp'></i>" + t("kind_sp") + "</span><span><i class='sk-k-up'></i>" + t("kind_up") + "</span></div>";
    cats.forEach(function(k) {
        var items = S.sortItems((c.cache || []).filter(function(it) { return it.kind == k[0]; }));
        h += "<div class='sk-cat'>" + t(k[1]) + "</div><div class='sk-chips'>" + (items.length ? items.map(function(it) { return S.chipCode(c, it, {menu: true}); }).join("") : "<span class='sk-empty-t'>—</span>") + "</div>";
    });
    h += "<button class='sk-btn sk-addrow' data-cact='addcache'>" + t("edit_cache") + "</button></div>";
    S.mount(shell("sk-campaign", h));
    if (S.bindThreadDrag) S.bindThreadDrag(c.id);
    if (S.bindItemDrag) S.bindItemDrag(c.id);
    S.screenClick = function(ev) {
        var b = ev.target.closest("[data-cact], [data-act='heroassign'], [data-act='itemmenu']"); if (!b) return;
        if (b.dataset.act == "heroassign") { S.openAssign(c.id, b.dataset.hero); return; }
        if (b.dataset.act == "itemmenu") { S.openItemMenu(c.id, b.dataset.item); return; }
        var i = +b.dataset.i;
        switch (b.dataset.cact) {
            case "journal": S.openCampaignJournal(c.id); break;
            case "help": S.openCampaignHelp(); break;
            case "settings": S.openCampaignSettings(c.id); break;
            case "cdelete": S.deleteCampaign(c.id); break;
            case "addsc": case "choose": S.openChooseScenario(c.id, b.dataset.cact == "choose" ? i : null); break;
            case "rmsc": S.ask(t("confirm_rm_scenario"), t("delete"), function() { S.updateCampaign(c.id, function(x) { x.scenarios.splice(i, 1); }); S.renderCampaign(c.id); }); break;
            case "prepare": S.openCampaignEditor(c.id, i); break;
            case "launch": S.launchCampaignScenario(c.id, i); break;
            // Reprendre : toujours la partie en jeu, jamais le mode studio ni un éditeur resté ouvert.
            case "resume": if (S.editing) S.closeEditor(); S.studio = false; S.renderGame(); break;
            case "play": S.openPlay(c.id, i, +b.dataset.p); break;
            case "addhero": S.openHeroPicker(c.id); break;
            case "hero": S.openHeroEditor(c.id, b.dataset.hero); break;
            case "addcache": S.openCacheEditor(c.id); break;
        }
    };
};

S.launchCampaignScenario = function(cid, i) {
    var c = S.campaign(cid), sc = c.scenarios[i];
    var go = function() { if (S.editing) S.closeEditor(); S.studio = false; S.clearGame(); S.ctx = {cid: cid, idx: i}; S.draft = JSON.parse(JSON.stringify(sc.setup)); S.startGame(true); };
    if (!sc.setup || !(sc.setup.river || []).length) { S.toast(t("river_help")); return; }
    if (S.state && S.state.river.length) S.ask(t("confirm_new"), t("confirm_new_yes"), go); else go();
};
S.addItems = function(cid, sel, owner) {
    S.updateCampaign(cid, function(c) {
        c.cache = c.cache || [];
        sel.forEach(function(it) { c.cache.push({uid: uid("i"), kind: it.kind, ref: it.ref, name: it.name, owner: owner || null, start: false}); });
        var who = owner ? ((c.heroes || []).filter(function(x) { return x.id == owner; })[0] || {}).name : null;
        S.campLog(c, who ? t("clog_items_hero", sel.length, who) : t("clog_items", sel.length));
    });
};

// Petits dialogues génériques.
S.dialog = function(html, bind) {
    var ov = S.root.querySelector("#sk-overlay");
    ov.innerHTML = "<div class='sk-dialog sk-small' role='dialog' aria-modal='true'>" + html + "</div>";
    ov.classList.add("on");
    var close = function() { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; };
    ov.onclick = function(ev) { if (ev.target === ov || ev.target.closest("[data-dclose]")) { close(); return; } bind(ev, close); };
    var f = ov.querySelector("input, select, textarea, button"); if (f) f.focus();
    return close;
};
S.editField = function(label, type, value, onOk) {
    S.dialog("<h2>" + e(label) + "</h2><input class='sk-in' id='sk-ef' type='" + type + "' value='" + e(value) + "'>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ok>" + t("validate") + "</button><button class='sk-btn' data-dclose>" + t("cancel") + "</button></div>",
        function(ev, close) { if (ev.target.closest("[data-ok]")) { var v = S.root.querySelector("#sk-ef").value; close(); onOk(v); } });
};
S.openCampaignSettings = function(cid) {
    var c = S.campaign(cid); if (!c) return;
    S.dialog("<h2>" + t("campaign_settings") + "</h2>"
        + "<label class='sk-fl'>" + t("name") + "<input class='sk-in' id='sk-cs-n' value='" + e(c.name) + "'></label>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ok>" + t("validate") + "</button><button class='sk-btn' data-dclose>" + t("cancel") + "</button></div>",
        function(ev, close) {
            if (!ev.target.closest("[data-ok]")) return;
            var name = S.root.querySelector("#sk-cs-n").value.trim() || c.name;
            S.updateCampaign(cid, function(x) { x.name = name; });
            close(); S.renderCampaign(cid);
        });
    var inp = S.root.querySelector("#sk-cs-n"); if (inp) { inp.focus(); inp.select(); }
};
// Rejouer une campagne : copie avec la même compagnie (tous vivants), les mêmes scénarios à rejouer et la même cache ;
// les parties jouées, le journal et les morts ne sont pas repris. Depuis l'accueil (« stay »), on reste sur la liste.
S.duplicateCampaign = function(cid, stay) {
    var src = S.campaign(cid); if (!src) return;
    var c = JSON.parse(JSON.stringify(src));
    c.id = uid("c"); c.name = t("campaign_copy_name", src.name || t("untitled")); c.created = new Date().toISOString(); c.last = null; c.log = [];
    (c.scenarios || []).forEach(function(sc) { sc.plays = []; sc.notes = ""; sc.status = "todo"; S.syncScenario(sc); });
    (c.heroes || []).forEach(function(hh) { hh.dead = false; hh.deadAt = null; });
    (c.cache || []).forEach(function(it) { it.uid = uid("i"); });
    S.campLog(c, t("clog_duplicated", src.name || t("untitled")));
    var l = S.campaigns(); l.push(c); S.saveCampaigns(l);
    S.toast(t("campaign_duplicated"));
    if (stay) S.renderCampaigns(); else S.renderCampaign(c.id);
};

// Modifier la cache : le sélecteur s'ouvre avec les objets de la cache déjà sélectionnés.
// Retirer une puce ou « Vider » enlève des objets ; l'équipement de départ reste ; la validation confirme les retraits.
S.openCacheEditor = function(cid, done) {
    var c = S.campaign(cid); if (!c) return;
    var color = {}; (c.heroes || []).forEach(function(hh) { color[hh.id] = hh.color; });
    var init = S.sortItems((c.cache || []).slice()).map(function(it) { return {kind: it.kind, ref: it.ref, name: it.name, uid: it.uid, start: !!it.start, color: it.owner ? color[it.owner] : null}; });
    S.openItemPicker({title: t("edit_cache"), initial: init, onClose: done || null, onAdd: function(sel) {
        var keep = {}, added = sel.filter(function(x) { if (x.uid) keep[x.uid] = true; return !x.uid; });
        var gone = (S.campaign(cid).cache || []).filter(function(it) { return !keep[it.uid] && !it.start; });
        var apply = function() {
            S.updateCampaign(cid, function(x) {
                x.cache = (x.cache || []).filter(function(it) { return keep[it.uid] || it.start; });
                added.forEach(function(it) { x.cache.push({uid: uid("i"), kind: it.kind, ref: it.ref, name: it.name, owner: null, start: false}); });
                if (added.length) S.campLog(x, t("clog_items", added.length));
                if (gone.length) S.campLog(x, t("clog_items_removed", gone.length));
            });
            if (done) done(); else S.renderCampaign(cid);
        };
        if (gone.length) S.ask(t("confirm_cache_remove", gone.length), t("validate"), apply); else apply();
    }});
};

S.openChooseScenario = function(cid, idx) {
    var list = S.scenarios();
    S.dialog("<h2>" + t(idx == null ? "add_scenario" : "choose_scenario") + "</h2>"
        + "<button class='sk-btn sk-primary' data-new>" + t("new_scenario") + "</button>"
        + "<button class='sk-btn' data-placeholder>" + t("placeholder_scenario") + "</button>"
        + (list.length ? "<div class='sk-fl'>" + t("from_saved") + "</div><div class='sk-dlist'>" + list.map(function(s, i) {
            return "<button class='sk-li sk-libtn' data-pick='" + i + "'><span class='sk-li-t'>" + e(s.title || "—") + "<small>" + t(s.mode == "solo" ? "mode_solo" : "mode_classic") + " · " + t("tiles_n", (s.river || []).length) + "</small></span></button>";
        }).join("") + "</div>" : "")
        + "<div class='sk-actions'><button class='sk-btn' data-dclose>" + t("cancel") + "</button></div>",
        function(ev, close) {
            var put = function(setup, title) {
                var at = idx;
                S.updateCampaign(cid, function(c) {
                    var sc = {id: uid("s"), title: title || "", status: "todo", setup: setup, vp: 0, date: null};
                    if (at == null) { c.scenarios.push(sc); at = c.scenarios.length - 1; }
                    else { sc.id = c.scenarios[at].id; c.scenarios[at] = sc; }
                });
                return at;
            };
            var c = S.campaign(cid);
            if (ev.target.closest("[data-new]")) {
                close(); var d = S.blankScenario(); d.mode = c.mode; var at = put(d, "");
                S.ctx = {cid: cid, idx: at}; S.draft = d; S.renderSetup();
            } else if (ev.target.closest("[data-placeholder]")) { close(); put(null, ""); S.renderCampaign(cid); }
            else { var p = ev.target.closest("[data-pick]"); if (p) { close(); var s = JSON.parse(JSON.stringify(list[+p.dataset.pick])); put(s, s.title); S.renderCampaign(cid); } }
        });
};
S.openHeroEditor = function(cid, hid) {
    var c = S.campaign(cid), hh = hid ? c.heroes.filter(function(x) { return x.id == hid; })[0] : null;
    S.dialog("<h2>" + t(hh ? "edit_hero" : "add_hero") + "</h2>"
        + "<label class='sk-fl'>" + t("hero_name") + "<input class='sk-in' id='sk-hn' list='sk-heronames' value='" + e(hh ? hh.name : "") + "' placeholder='Conan'></label>"
        + "<datalist id='sk-heronames'>" + S.heroNames().map(function(n) { return "<option value='" + e(n) + "'>"; }).join("") + "</datalist>"
        + "<label class='sk-fl'>" + t("archetype") + "<small>" + t("archetype_help") + "</small><input class='sk-in' id='sk-ha' list='sk-archs' value='" + e(hh ? hh.archetype || "" : "") + "'>"
        + "<datalist id='sk-archs'>" + ARCHETYPES.map(function(a) { return "<option value='" + t("arch_" + a) + "'>"; }).join("") + "</datalist></label>"
        + "<div class='sk-fl'>" + t("hero_color") + "</div>" + S.swatchesCode(S.freeHeroColors(c, hid), hh ? hh.color : S.pickHeroColor(c, null), "sk-hc")
        + (hh ? "<label class='sk-check'><input type='checkbox' id='sk-hd'" + (hh.dead ? " checked" : "") + "> " + t("hero_dead") + "</label>" : "")
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ok>" + t("validate") + "</button><button class='sk-btn' data-dclose>" + t("cancel") + "</button>"
        + (hh ? "<button class='sk-btn sk-danger' data-rm>" + t("remove_hero") + "</button>" : "") + "</div>",
        function(ev, close) {
            if (S.swatchClick(ev)) return;
            if (ev.target.closest("[data-ok]")) {
                var name = S.root.querySelector("#sk-hn").value.trim(); if (!name) { S.toast(t("name_required")); return; }
                var arch = S.root.querySelector("#sk-ha").value.trim(), col = S.root.querySelector("#sk-hc").dataset.value, dead = hh ? S.root.querySelector("#sk-hd").checked : false;
                S.updateCampaign(cid, function(x) {
                    if (hh) { var y = x.heroes.filter(function(z) { return z.id == hid; })[0]; y.name = name; y.archetype = arch; y.color = col; if (y.dead != dead) { y.dead = dead; y.deadAt = dead ? (S.playedCount(x) || 1) : null; } }
                    else { x.heroes.push({id: uid("h"), name: name, archetype: arch, color: col, dead: false}); S.campLog(x, t("clog_hero", name)); }
                });
                close(); S.rerender();
            } else if (ev.target.closest("[data-rm]")) {
                close(); S.ask(t("confirm_rm_hero"), t("delete"), function() {
                    S.updateCampaign(cid, function(x) { x.heroes = x.heroes.filter(function(z) { return z.id != hid; });
                        // Son équipement de départ part avec lui ; ses autres objets restent dans la cache.
                        x.cache = x.cache.filter(function(it) { return !(it.start && (it.startHero || it.owner) == hid); });
                        x.cache.forEach(function(it) { if (it.owner == hid) it.owner = null; if (it.takers) it.takers = it.takers.filter(function(z) { return z != hid; }); }); });
                    S.rerender();
                });
            }
        });
};
// Attribuer à un héros : objets libres de la cache, ou nouveaux objets.
S.openAssign = function(cid, hid) {
    var c = S.campaign(cid), hh = c.heroes.filter(function(x) { return x.id == hid; })[0];
    var free = (c.cache || []).filter(function(it) { return !S.heldBy(it, hid); });
    S.dialog("<h2>" + e(t("assign_to", hh.name)) + "</h2>"
        + (free.length ? "<div class='sk-fl'>" + t("from_cache") + "</div><div class='sk-chips'>" + free.map(function(it) {
            var ow = S.takers(it).map(function(id) { return (c.heroes || []).filter(function(x) { return x.id == id; })[0]; }).filter(Boolean);
            return "<button class='sk-chip sk-k-" + it.kind + "' data-card='" + it.kind + ":" + e(it.ref) + "' data-give='" + it.uid + "'>"
                + ow.map(function(o) { return "<span class='sk-ini' style='--hc:" + o.color + "' title='" + e(o.name) + "'>" + e(o.name.charAt(0)) + "</span>"; }).join("") + e(it.name) + "</button>";
        }).join("") + "</div><small>" + t("from_cache_help") + "</small>" : "<p>" + t("cache_empty") + "</p>")
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-new>" + t("new_items") + "</button><button class='sk-btn' data-dclose>" + t("close") + "</button></div>",
        function(ev, close) {
            var g = ev.target.closest("[data-give]");
            if (g) {
                S.updateCampaign(cid, function(x) { x.cache.forEach(function(it) { if (it.uid == g.dataset.give) S.setItemOwner(x, it, hid); }); });
                g.remove(); S.toast(t("item_given", hh.name)); S.rerenderSoft = true; return;
            }
            if (ev.target.closest("[data-new]")) { close(); S.openItemPicker({title: t("assign_to", hh.name), onAdd: function(sel) { S.addItems(cid, sel, hid); S.rerender(); }}); }
        });
    // Fermer (bouton ou clic à côté) redessine la campagne : les objets pris dans la cache apparaissent sur la fiche du héros.
    var ov = S.root.querySelector("#sk-overlay"), prev = ov.onclick;
    ov.onclick = function(ev) {
        if (ev.target === ov || ev.target.closest("[data-dclose]")) { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; S.rerender(); return; }
        prev(ev);
    };
};
S.openItemMenu = function(cid, iuid) {
    var c = S.campaign(cid), it = (c.cache || []).filter(function(x) { return x.uid == iuid; })[0]; if (!it) return;
    // Les améliorations ont un seul porteur, comme les autres cartes (étape 25).
    var up = false, tk = S.takers(it);
    S.dialog("<h2>" + e(it.name) + "</h2><div class='sk-fl'>" + t(up ? "taken_by" : "owner") + "</div><div class='sk-chips'>"
        + "<button class='sk-chip" + (!tk.length ? " sk-sel" : "") + "' data-own=''>" + t("nobody") + "</button>"
        + c.heroes.map(function(hh) { return "<button class='sk-chip sk-own" + (tk.indexOf(hh.id) >= 0 ? " sk-sel" : "") + "' style='--hc:" + hh.color + "' data-own='" + hh.id + "'" + (up ? " aria-pressed='" + (tk.indexOf(hh.id) >= 0) + "'" : "") + ">" + e(hh.name) + "</button>"; }).join("") + "</div>"
        + "<label class='sk-check'><input type='checkbox' id='sk-st'" + (it.start ? " checked" : "") + "> " + t("start_item") + "</label>"
        + "<div class='sk-actions'><button class='sk-btn sk-danger' data-rm" + (it.start ? " disabled title='" + e(t("start_item_locked")) + "'" : "") + ">" + t("remove_from_cache") + "</button><button class='sk-btn sk-primary' data-dclose>" + t("close") + "</button></div>",
        function(ev, close) {
            var o = ev.target.closest("[data-own]");
            if (o && up) {
                // Amélioration : chaque héros se coche ou se décoche, « Personne » la reprend à tous ; le menu reste ouvert.
                var who = o.dataset.own, now = [];
                S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) {
                    if (y.uid != iuid) return;
                    if (!who) S.takers(y).forEach(function(h) { S.setTaker(x, y, h, false); }); else S.setTaker(x, y, who, !S.heldBy(y, who));
                    now = S.takers(y);
                }); });
                o.closest(".sk-chips").querySelectorAll("[data-own]").forEach(function(b) {
                    var on = b.dataset.own ? now.indexOf(b.dataset.own) >= 0 : !now.length;
                    b.classList.toggle("sk-sel", on); if (b.dataset.own) b.setAttribute("aria-pressed", on);
                });
                return;
            }
            if (o) { S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) { if (y.uid == iuid) S.setItemOwner(x, y, o.dataset.own); }); }); close(); S.rerender(); return; }
            if (ev.target.closest("[data-dup]")) { S.updateCampaign(cid, function(x) { x.cache.push({uid: uid("i"), kind: it.kind, ref: it.ref, name: it.name, owner: null, start: false}); }); close(); S.rerender(); return; }
            // Un équipement de départ ne se retire pas de la cache : il disparaît seulement avec son héros.
            var rm = ev.target.closest("[data-rm]");
            if (rm && !rm.disabled) { S.updateCampaign(cid, function(x) { x.cache = x.cache.filter(function(y) { return y.uid != iuid || y.start; }); }); close(); S.rerender(); }
        });
    S.root.querySelector("#sk-st").addEventListener("change", function(ev) { var v = ev.target.checked; S.updateCampaign(cid, function(x) { x.cache.forEach(function(y) { if (y.uid == iuid) { y.start = v; y.startHero = v ? (y.startHero || y.owner || null) : null; } }); });
        var rm = S.root.querySelector("#sk-overlay [data-rm]"); if (rm) { rm.disabled = v; rm.title = v ? t("start_item_locked") : ""; } });
    // Fermer le menu d'une amélioration redessine la campagne avec ses nouvelles pastilles.
    if (up) {
        var ov = S.root.querySelector("#sk-overlay"), prev = ov.onclick;
        ov.onclick = function(ev) {
            if (ev.target === ov || ev.target.closest("[data-dclose]")) { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; S.rerender(); return; }
            prev(ev);
        };
    }
};
S.rerender = function() {
    if (S.screen == "campaign") S.renderCampaign(S.curCampaign);
    else if (S.screen == "setup") { S.readForm(); S.renderSetup(); }
    else if (S.screen == "end") S.renderEnd(true);
};

// Section « Héros et équipement » de la préparation d'un scénario de campagne.
S.heroesSectionCode = function(cid) {
    var c = S.campaign(cid); if (!c) return "";
    var h = "<h2>" + t("heroes_equipment") + "</h2><p class='sk-help'>" + t("heroes_equipment_help") + "</p><div class='sk-heroes-prep'>";
    (c.heroes || []).forEach(function(hh) {
        var items = (c.cache || []).filter(function(it) { return S.heldBy(it, hh.id); });
        h += "<div class='sk-hero" + (hh.dead ? " dead" : "") + "' style='--hc:" + hh.color + "'><div class='sk-hero-h'><span class='sk-hero-n'>" + e(hh.name) + "</span>" + (hh.archetype ? "<span class='sk-arch'>" + e(hh.archetype) + "</span>" : "") + "</div><div class='sk-chips'>"
            + items.map(function(it) { return S.chipCode(c, it, {menu: true, initial: false, hero: hh.id}); }).join("")
            + "<button class='sk-chip sk-chipadd' data-act='heroassign' data-cid='" + c.id + "' data-hero='" + hh.id + "'>+ " + t("assign") + "</button></div></div>";
    });
    if (!(c.heroes || []).length) h += "<p class='sk-help'>" + t("no_hero") + "</p>";
    return h + "</div>";
};

// ---------- Sélecteur d'objets (équipements, sorts, améliorations) ----------
S.itemCardCode = function(it, badge) {
    var d = it.data || {}, b = badge ? "<span class='sk-pickbadge'>" + badge + "</span>" : "";
    if (it.kind == "up") {
        return "<button class='sk-icard sk-k-up" + (badge ? " picked" : "") + "' data-ref='" + e(it.ref) + "' data-kind='up' data-card='up:" + e(it.ref) + "'>" + b + "<span class='sk-icard-n'>" + e(it.name) + "</span><span class='sk-icard-x'>" + e(d.effect || "") + "</span>"
            + "<span class='sk-icard-tags'>" + (d.archetype ? "<span>" + e(d.archetype) + "</span>" : "<span>" + t("all_archetypes") + "</span>") + "<span>" + e(t("usage_" + (d.usage || "perm"))) + "</span></span></button>";
    }
    var real = S.realCardCode(it.kind, it.ref);
    if (real) return "<button class='sk-icard sk-real sk-k-" + it.kind + (badge ? " picked" : "") + "' data-ref='" + e(it.ref) + "' data-kind='" + it.kind + "' data-card='" + it.kind + ":" + e(it.ref) + "' aria-label='" + e(it.name) + "'>" + b + "<span class='sk-cardscale'>" + real + "</span></button>";
    var txt = it.kind == "sp" ? (d.text || "") : "";
    return "<button class='sk-icard sk-k-" + it.kind + (badge ? " picked" : "") + "' data-ref='" + e(it.ref) + "' data-kind='" + it.kind + "' data-card='" + it.kind + ":" + e(it.ref) + "'>" + b
        + "<span class='sk-icard-n'>" + e(it.name) + "</span>" + (txt ? "<span class='sk-icard-x'>" + e(txt.length > 160 ? txt.slice(0, 157) + "…" : txt) + "</span>" : "<span class='sk-icard-x sk-muted'>" + t(it.kind == "eq" ? "kind_eq" : "kind_sp") + "</span>")
        + "<span class='sk-icard-tags'><span>" + t(it.kind == "eq" ? "kind_eq" : "kind_sp") + "</span></span></button>";
};
S.openItemPicker = function(opts) {
    var pr = S.prefs(), kind = opts.kind || pr.itemKind || "eq", sel = (opts.initial || []).slice(), browse = !!opts.browse, editing = !!opts.initial;
    var ov = S.root.querySelector("#sk-overlay");
    var tabs = (opts.tiles ? [["tile", "tab_tiles"]] : []).concat([["eq", "tab_eq"], ["sp", "tab_sp"], ["up", "tab_up"]]);
    if (opts.tiles && !opts.kind && !pr.itemKind) kind = "tile";
    // Choix limité à certains types (cartes d'une tuile en studio : sorts ou équipements).
    if (opts.kinds) { tabs = tabs.filter(function(x) { return opts.kinds.indexOf(x[0]) >= 0; }); if (opts.kinds.indexOf(kind) < 0) kind = opts.kinds[0]; }
    ov.innerHTML = "<div class='sk-dialog sk-pickdlg' role='dialog' aria-modal='true'><div class='sk-dialog-head'><h2>" + e(opts.title) + "</h2><div class='sk-actions sk-pickactions'>"
        + (browse ? "" : "<button class='sk-btn sk-primary' data-addsel" + (editing ? "" : " disabled") + ">" + t("add_selection", 0) + "</button>") + "<button class='sk-btn' data-pclose>" + t("close") + "</button></div></div>"
        + "<div class='sk-tabs' role='tablist'>" + tabs.map(function(x) { return "<button class='sk-tab' role='tab' data-tab='" + x[0] + "'>" + t(x[1]) + "</button>"; }).join("") + "</div>"
        + "<div class='sk-filters'><input type='search' id='sk-iq' placeholder='" + e(t("search")) + "'>" + S.scopeCode() + "</div>"
        + (browse ? "" : "<div class='sk-pickstatus' id='sk-ist'></div>") + "<div class='sk-picker sk-ipicker' id='sk-ig'></div></div>";
    ov.classList.add("on");
    var q = ov.querySelector("#sk-iq");
    q.value = (pr.itemQ || {})[kind] || "";
    S.bindScope(ov, function() { draw(); });
    var items = function() {
        if (kind == "tile") return [];
        var nq = S.norm(q.value);
        return S.catalog(kind).filter(function(it) { return (!opts.filter || opts.filter(it)) && (kind == "up" || S.inScope(it.origins)) && (!nq || S.norm(it.name).indexOf(nq) >= 0 || S.norm((it.data && (it.data.effect || it.data.text)) || "").indexOf(nq) >= 0); });
    };
    var status = function() {
        if (browse) return;
        var free = sel.some(function(x) { return !x.start; });
        ov.querySelector("#sk-ist").innerHTML = "<div class='sk-selhead'><b>" + t("items_selected", sel.length) + "</b>"
            + (editing ? "<button type='button' class='sk-btn sk-danger sk-clear' data-clear" + (free ? "" : " disabled") + ">" + t("clear_cache") + "</button>" : "") + "</div><div class='sk-selchips'>" + sel.map(function(x, i) {
            var dot = x.color ? "<span class='sk-chip-own' style='background:" + e(x.color) + "' aria-hidden='true'></span>" : "";
            // L'équipement de départ ne se retire pas : puce grisée, sans croix.
            if (x.start) return "<span class='sk-chip sk-k-" + x.kind + " sk-locked' title='" + e(t("start_item_locked")) + "'><span class='sk-chip-n'>" + (i + 1) + "</span>" + dot + e(x.name) + " <span class='fas fa-lock' aria-hidden='true'></span></span>";
            return "<button class='sk-chip sk-k-" + x.kind + "' data-unsel='" + i + "'><span class='sk-chip-n'>" + (i + 1) + "</span>" + dot + e(x.name) + " <span aria-hidden='true'>✕</span></button>";
        }).join("") + "</div>";
        var a = ov.querySelector("[data-addsel]"); a.disabled = !editing && !sel.length; a.textContent = editing ? t("validate") : t("add_selection", sel.length);
        ov.querySelectorAll(".sk-icard[data-ref]").forEach(function(c) {
            var k = []; sel.forEach(function(x, i) { if (x.kind == c.dataset.kind && x.ref == c.dataset.ref) k.push(i + 1); });
            var bd = c.querySelector(".sk-pickbadge");
            if (k.length) { if (!bd) { bd = document.createElement("span"); bd.className = "sk-pickbadge"; c.appendChild(bd); } bd.textContent = k.join(" · "); c.classList.add("picked"); }
            else { if (bd) bd.remove(); c.classList.remove("picked"); }
        });
        // Tuiles choisies (cartes d'une tuile : une tuile peut en porter d'autres) : même repère numéroté.
        ov.querySelectorAll("[data-tilepick]").forEach(function(c) {
            var k = []; sel.forEach(function(x, i) { if (x.kind == "ti" && x.ref == c.dataset.tilepick) k.push(i + 1); });
            var bd = c.querySelector(".sk-pickbadge");
            if (k.length) { if (!bd) { bd = document.createElement("span"); bd.className = "sk-pickbadge"; c.appendChild(bd); } bd.textContent = k.join(" · "); c.classList.add("picked"); }
            else { if (bd) bd.remove(); c.classList.remove("picked"); }
        });
    };
    var draw = function() {
        ov.querySelectorAll("[data-tab]").forEach(function(b) { var on = b.dataset.tab == kind; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
        q.placeholder = t("search_" + kind);
        ov.querySelector(".sk-scope").style.display = kind == "up" ? "none" : "";
        var g = ov.querySelector("#sk-ig"), out = "";
        if (kind == "tile") {
            var nq = S.norm(q.value), seen = {};
            Encyclopedia.tiles.list.forEach(function(x) {
                var nm = x.id == "event" ? t("scenario_events") : x.name; if (nq && S.norm(nm).indexOf(nq) < 0) return;
                if (!S.inScope(x.origins)) return;
                var key = x.id + "|" + x.image; if (seen[key]) return; seen[key] = true;
                out += "<div class='sk-pick sk-tilebox'" + (browse ? " role='img'" : " role='button' tabindex='0' data-tilepick='" + e(key) + "'") + " aria-label='" + e(nm) + "'>" + S.tileCode({tileId: x.id, color: x.colors[0], img: x.image}) + "</div>";
            });
        } else {
            if (kind == "up") out += "<button class='sk-icard sk-newup' data-newup>+<span>" + t("create_upgrade") + "</span></button>";
            out += items().map(function(it) { return S.itemCardCode(it); }).join("");
            if (kind != "up" && !S.catalog(kind).length) out += "<p class='sk-help'>" + t("catalog_missing") + "</p>";
        }
        g.innerHTML = out || "<p class='sk-help'>" + t("no_tile_found") + "</p>";
        status();
    };
    q.addEventListener("input", function() { pr.itemQ = pr.itemQ || {}; pr.itemQ[kind] = q.value; S.savePrefs(); draw(); });
    var close = function() { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; };
    ov.onclick = function(ev) {
        if (ev.target === ov || ev.target.closest("[data-pclose]")) { close(); if (opts.onClose) opts.onClose(); return; }
        var tb = ev.target.closest("[data-tab]");
        if (tb) { kind = tb.dataset.tab; pr.itemKind = kind; S.savePrefs(); q.value = (pr.itemQ || {})[kind] || ""; draw(); return; }
        if (ev.target.closest("[data-newup]")) { S.openUpgradeEditor(null, function() { kind = "up"; draw(); }); return; }
        var un = ev.target.closest("[data-unsel]"); if (un) { sel.splice(+un.dataset.unsel, 1); status(); return; }
        if (ev.target.closest("[data-clear]")) { sel = sel.filter(function(x) { return x.start; }); status(); return; }
        if (ev.target.closest("[data-addsel]")) { var s2 = sel.slice(); close(); opts.onAdd(s2); return; }
        var tp = !browse && ev.target.closest("[data-tilepick]");
        if (tp) {
            var tl = S.tileOf({tileId: tp.dataset.tilepick.split("|")[0], img: tp.dataset.tilepick.split("|").slice(1).join("|")});
            sel.push({kind: "ti", ref: tp.dataset.tilepick, name: tl ? (tl.id == "event" ? t("scenario_events") : tl.name) : tp.dataset.tilepick});
            tp.classList.remove("added"); void tp.offsetWidth; tp.classList.add("added");
            status(); return;
        }
        var c = ev.target.closest(".sk-icard[data-ref]"); if (!c) return;
        if (browse) { S.showCard(c.dataset.kind + ":" + c.dataset.ref); return; }
        var it = S.catalog(c.dataset.kind).filter(function(x) { return x.ref == c.dataset.ref; })[0]; if (!it) return;
        sel.push({kind: it.kind, ref: it.ref, name: it.name});
        c.classList.remove("added"); void c.offsetWidth; c.classList.add("added");
        status();
    };
    draw(); S.softFocus(q);
};
S.openUpgradeEditor = function(id, done) {
    var list = S.upgrades(), u = id ? list.filter(function(x) { return x.id == id; })[0] : null;
    var ov = S.root.querySelector("#sk-overlay"), keep = ov.innerHTML, keepClick = ov.onclick;
    var seg = function(name, vals, cur) {
        return "<div class='sk-seg' data-seg='" + name + "'>" + vals.map(function(v) { return "<button type='button' data-v='" + v[0] + "'" + (v[0] == cur ? " class='sk-on' aria-pressed='true'" : " aria-pressed='false'") + ">" + e(v[1]) + "</button>"; }).join("") + "</div>";
    };
    ov.innerHTML = "<div class='sk-dialog sk-small' role='dialog' aria-modal='true'><h2>" + t(u ? "edit_upgrade" : "new_upgrade") + "</h2>"
        + "<label class='sk-fl'>" + t("name") + "<input class='sk-in' id='sk-un' value='" + e(u ? u.name : "") + "'></label>"
        + "<label class='sk-fl'>" + t("upgrade_effect") + "<textarea class='sk-in' id='sk-ue' rows='3'>" + e(u ? u.effect : "") + "</textarea></label>"
        + "<span class='sk-fl'>" + t("archetype") + "</span>" + seg("arch", [["", t("all_archetypes")]].concat(ARCHETYPES.map(function(a) { return [t("arch_" + a), t("arch_" + a)]; })), u ? u.archetype || "" : "")
        + "<span class='sk-fl'>" + t("usage") + "</span>" + seg("usage", [["perm", t("usage_perm")], ["scenario", t("usage_scenario")], ["once", t("usage_once")]], u ? u.usage || "perm" : "perm")
        + "<label class='sk-fl'>" + t("origin") + "<input class='sk-in' id='sk-uo' value='" + e(u ? u.origin || "" : "") + "' placeholder='" + e(t("origin_ph")) + "'></label>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-usave>" + t("create_or_save") + "</button><button class='sk-btn' data-ucancel>" + t("cancel") + "</button>"
        + (u ? "<button class='sk-btn sk-danger' data-udel>" + t("delete") + "</button>" : "") + "</div></div>";
    var back = function() { ov.innerHTML = keep; ov.onclick = keepClick; if (done) done(); };
    ov.onclick = function(ev) {
        var sb = ev.target.closest("[data-seg] [data-v]");
        if (sb) { sb.parentNode.querySelectorAll("[data-v]").forEach(function(x) { x.classList.toggle("sk-on", x == sb); x.setAttribute("aria-pressed", x == sb); }); return; }
        if (ev.target.closest("[data-ucancel]")) { back(); return; }
        if (ev.target.closest("[data-udel]")) { S.saveUpgrades(S.upgrades().filter(function(x) { return x.id != id; })); back(); return; }
        if (ev.target.closest("[data-usave]")) {
            var name = ov.querySelector("#sk-un").value.trim(); if (!name) { S.toast(t("name_required")); return; }
            var val = function(n) { var b = ov.querySelector("[data-seg='" + n + "'] .sk-on"); return b ? b.dataset.v : ""; };
            var rec = {id: u ? u.id : uid("u"), name: name, effect: ov.querySelector("#sk-ue").value.trim(), archetype: val("arch"), usage: val("usage") || "perm", origin: ov.querySelector("#sk-uo").value.trim()};
            var l = S.upgrades(); var k = l.findIndex(function(x) { return x.id == rec.id; }); if (k >= 0) l[k] = rec; else l.push(rec);
            S.saveUpgrades(l); S.toast(t("upgrade_saved")); back();
        }
    };
    ov.querySelector("#sk-un").focus();
};

// Carte en grand (appui long) : tuile, équipement, sort ou amélioration.
S.showCard = function(code) {
    var p = String(code).split(":"), kind = p[0], ref = p.slice(1).join(":");
    var it = S.catalog(kind).filter(function(x) { return x.ref == ref; })[0] || {kind: kind, ref: ref, name: ref, data: {}};
    var who = "";
    if (S.screen == "campaign" || S.screen == "setup" || S.screen == "end") {
        var c = S.campaign(S.curCampaign || (S.ctx && S.ctx.cid) || (S.state && S.state.campaign && S.state.campaign.cid));
        if (c) {
            var owners = [], seenH = {};
            (c.cache || []).filter(function(x) { return x.kind == kind && x.ref == ref; }).forEach(function(x) { S.takers(x).forEach(function(id) { var hh = c.heroes.filter(function(z) { return z.id == id; })[0]; if (hh && !seenH[id]) { seenH[id] = 1; owners.push(hh); } }); });
            if (owners.length) who = "<div class='sk-who'>" + t("assigned_to") + " " + owners.map(function(hh) { return "<span style='color:" + hh.color + "'>● " + e(hh.name) + "</span>"; }).join(", ") + "</div>";
        }
    }
    var real = kind == "up" ? null : S.realCardCode(kind, ref);
    var body = kind == "up" ? S.itemCardCode(it) : real ? "<div class='sk-bigreal'><span class='sk-cardscale'>" + real + "</span></div>" : "<div class='sk-bigcard sk-k-" + kind + "'><span class='sk-icard-n'>" + e(it.name) + "</span>"
        + (kind == "sp" && it.data.text ? "<span class='sk-icard-x'>" + e(it.data.text) + "</span>" : "")
        + "<span class='sk-muted'>" + t("card_pending") + "</span></div>";
    var ov = S.root.querySelector("#sk-overlay"), keep = ov.classList.contains("on") ? ov.innerHTML : null, keepClick = ov.onclick;
    ov.innerHTML = "<div class='sk-dialog sk-cardview' role='dialog' aria-modal='true'><h2>" + e(it.name) + "</h2>" + body + who
        + "<div class='sk-actions'>" + (kind == "up" ? "<button class='sk-btn' data-uedit>" + t("edit") + "</button>" : "") + "<button class='sk-btn sk-primary' data-cv>" + t("close") + "</button></div></div>";
    ov.classList.add("on");
    var back = function() { if (keep != null) { ov.innerHTML = keep; ov.onclick = keepClick; } else { ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null; } };
    ov.onclick = function(ev) {
        if (ev.target === ov || ev.target.closest("[data-cv]")) { back(); return; }
        if (ev.target.closest("[data-uedit]")) { S.openUpgradeEditor(ref, function() { back(); if (S.screen == "encyclopedia") S.renderEncyclopedia(); }); }
    };
};

// ---------- Encyclopédie ----------
S.renderEncyclopedia = function() {
    S.screen = "encyclopedia";
    S.mount(shell("sk-ency", head("home", t("encyclopedia")) + "<div class='sk-blk sk-c8'><p>" + t("encyclopedia_hint") + "</p><div class='sk-row'>"
        + "<button class='sk-btn sk-primary' data-ency>" + t("open_encyclopedia") + "</button><button class='sk-btn' data-upexp>" + t("export_upgrades") + "</button><button class='sk-btn' data-upimp>" + t("import_upgrades") + "</button></div>"
        + "<p class='sk-help'>" + t("upgrades_count", S.upgrades().length) + "</p></div>"));
    var open = function() { S.openItemPicker({title: t("encyclopedia"), browse: true, tiles: true}); };
    S.screenClick = function(ev) {
        if (ev.target.closest("[data-ency]")) open();
        else if (ev.target.closest("[data-upexp]")) S.exportData({upgrades: S.upgrades()}, "skelos_ameliorations.json");
        else if (ev.target.closest("[data-upimp]")) S.importData(function(o) {
            var add = o.upgrades || (Array.isArray(o) ? o : []); var l = S.upgrades();
            add.forEach(function(u) { if (u && u.name && !l.some(function(x) { return x.id == u.id; })) l.push(u); });
            S.saveUpgrades(l); S.toast(t("import_done")); S.renderEncyclopedia();
        });
    };
    open();
};

// ---------- Réglages ----------
S.bg = function() { return load(KEY_BG, null); };
S.skin = function() { if (S._skin === undefined) S._skin = load(KEY_SKIN, null); return S._skin || {}; };
S.SKIN_KEYS = ["green", "red", "rest", "gem1", "gem2", "gem3", "gem4", "gem5", "gem6", "gem7", "gem8"];
// Image chargée pour un fond : réduite et compressée (fonds vert et rouge tournés en paysage s'ils sont en portrait),
// pions gemmes détourés en rond.
S.loadSkin = function(key, file) {
    var r = new FileReader();
    r.onload = function() {
        var img = new Image();
        img.onload = function() {
            var gem = key.indexOf("gem") == 0, turn = (key == "green" || key == "red") && img.height > img.width;
            var max = gem ? 200 : key == "rest" ? 700 : 1100, w = img.width, hgt = img.height, cv = document.createElement("canvas"), cx = cv.getContext("2d"), url;
            if (gem) {
                var side = Math.min(w, hgt), k0 = Math.min(1, max / side);
                cv.width = cv.height = Math.round(side * k0);
                cx.beginPath(); cx.arc(cv.width / 2, cv.height / 2, cv.width / 2, 0, Math.PI * 2); cx.clip();
                cx.drawImage(img, (w - side) / 2, (hgt - side) / 2, side, side, 0, 0, cv.width, cv.height);
                url = cv.toDataURL("image/png");
            } else {
                var k = Math.min(1, max / Math.max(w, hgt)), dw = Math.round(w * k), dh = Math.round(hgt * k);
                cv.width = turn ? dh : dw; cv.height = turn ? dw : dh;
                if (turn) { cx.translate(cv.width, 0); cx.rotate(Math.PI / 2); }
                cx.drawImage(img, 0, 0, dw, dh);
                url = cv.toDataURL("image/jpeg", 0.82);
            }
            var sk = S.skin(); sk[key] = url;
            if (store(KEY_SKIN, sk)) { S._skin = sk; S.renderSettings(); } else { S._skin = undefined; S.toast(t("image_error")); }
        };
        img.onerror = function() { S.toast(t("image_error")); };
        img.src = r.result;
    };
    r.readAsDataURL(file);
};
S.removeSkin = function(key) {
    var sk = S.skin();
    if (key) delete sk[key]; else sk = {};
    try { if (Object.keys(sk).length) store(KEY_SKIN, sk); else localStorage.removeItem(KEY_SKIN); } catch (x) {}
    S._skin = sk; S.renderSettings();
};
S.boardBgStyle = function() {
    var b = S.bg(); if (!b || !b.img) return "";
    return " data-bg style=\"--sk-bgimg:url('" + b.img + "');" + S.bgVars(b) + "\"";
};
S.bgVars = function(b) {
    return "--sk-bgzoom:" + Math.max(100, b.zoom || 100) / 100 + ";--sk-bgpos:" + (b.x == null ? 50 : b.x) + "% " + (b.y == null ? 50 : b.y) + "%";
};
S.applyDisplayPrefs = function() {
    var pr = S.prefs();
    document.documentElement.classList.toggle("sk-noanim", !!pr.noAnim);
};
S.renderSettings = function() {
    S.screen = "settings";
    var pr = S.prefs(), b = S.bg() || {};
    var h = head("home", t("settings"));
    h += "<div class='sk-blk sk-c3'><h3>" + t("background") + "</h3><p>" + t("background_help") + "</p>"
        + "<div class='sk-bgprev'" + S.boardBgStyle() + ">" + (b.img ? "" : "<span>" + t("no_background") + "</span>") + "</div>"
        + "<label class='sk-btn sk-filebtn'>" + t("choose_photo") + "<input type='file' accept='image/*' id='sk-bgfile' hidden></label>"
        + (b.img ? "<label class='sk-fl'>" + t("zoom") + " <output id='sk-zo'>" + Math.max(100, b.zoom || 100) + " %</output><input type='range' min='100' max='300' value='" + Math.max(100, b.zoom || 100) + "' data-bg='zoom'></label>"
            + "<label class='sk-fl'>" + t("offset_x") + "<input type='range' min='0' max='100' value='" + (b.x == null ? 50 : b.x) + "' data-bg='x'></label>"
            + "<label class='sk-fl'>" + t("offset_y") + "<input type='range' min='0' max='100' value='" + (b.y == null ? 50 : b.y) + "' data-bg='y'></label>"
            + "<button class='sk-btn' data-bgrm>" + t("remove_background") + "</button>" : "") + "</div>";
    // Fonds du livre manuel : une image par élément, à charger depuis l'appareil ; sans image, le dessin du module.
    var sk = S.skin(), skinItem = function(k) {
        return "<div class='sk-skinitem sk-skin-" + (k.indexOf("gem") == 0 ? "gem" : k) + "'><label class='sk-skinprev' title='" + e(t("skin_" + (k.indexOf("gem") == 0 ? "gem" : k), k.slice(3))) + "'>"
            + (sk[k] ? "<img src='" + sk[k] + "' alt=''>" : "<span>" + e(k.indexOf("gem") == 0 ? k.slice(3) : t("skin_default")) + "</span>")
            + "<input type='file' accept='image/*' data-skin='" + k + "' hidden></label>"
            + "<span class='sk-skinname'>" + e(t("skin_" + (k.indexOf("gem") == 0 ? "gem" : k), k.slice(3))) + "</span>"
            + (sk[k] ? "<button class='sk-btn sk-skinrm' data-skinrm='" + k + "' aria-label='" + e(t("skin_remove")) + "' title='" + e(t("skin_remove")) + "'>&#xf2ed;</button>" : "") + "</div>";
    };
    h += "<div class='sk-blk sk-c3 sk-skins'><h3>" + t("skin_title") + "</h3><p>" + t("skin_help") + "</p>"
        + "<div class='sk-skinrow'>" + ["green", "red", "rest"].map(skinItem).join("") + "</div>"
        + "<h4>" + t("skin_gems") + "</h4><div class='sk-skingems'>" + [1, 2, 3, 4, 5, 6, 7, 8].map(function(i) { return skinItem("gem" + i); }).join("") + "</div>"
        + (Object.keys(sk).length ? "<button class='sk-btn' data-skinrm=''>" + t("skin_remove_all") + "</button>" : "") + "</div>";
    h += "<div class='sk-blk sk-c2'><h3>" + t("data") + "</h3><p>" + t("data_help") + "</p><button class='sk-btn' data-exp>" + t("export_all") + "</button><button class='sk-btn' data-imp>" + t("import") + "</button>"
        + "<h3 class='sk-mt'>" + t("display") + "</h3>"
        + "<label class='sk-sw'><span>" + t("animations") + "</span><input type='checkbox' data-pref='anim'" + (!pr.noAnim ? " checked" : "") + "></label>"
        + "<label class='sk-sw'><span>" + t("man_setting") + "</span><input type='checkbox' data-pref='manual'" + (pr.board == "manual" ? " checked" : "") + "></label>"
        + "<p>" + t("man_setting_help") + "</p>"
        // Points de vie : sur la piste, sur la tuile, ou les deux ; au moins une case reste cochée.
        + "<label class='sk-sw'><span>" + t("man_turn_mini") + "</span><input type='checkbox' data-pref='turnmini'" + (pr.turnMini ? " checked" : "") + "></label>"
        + "<p>" + t("man_turn_mini_help") + "</p>"
        + "<fieldset class='sk-hpplace'" + (pr.turnMini ? " disabled" : "") + "><legend>" + t("man_hp_place") + "</legend>"
        + "<label class='sk-sw'><span>" + t("man_hp_track") + "</span><input type='checkbox' data-pref='hpplace' value='track'" + (pr.hpPlace != "tile" && !pr.turnMini ? " checked" : "") + "></label>"
        + "<label class='sk-sw'><span>" + t("man_hp_tile") + "</span><input type='checkbox' data-pref='hpplace' value='tile'" + (pr.hpPlace == "tile" || pr.hpPlace == "both" || pr.turnMini ? " checked" : "") + "></label></fieldset></div>";
    S.mount(shell("sk-settings", h));
    var scr = S.root.querySelector(".sk-screen");
    scr.addEventListener("change", function(ev) {
        var x = ev.target;
        if (x.dataset.pref == "anim") { pr.noAnim = !x.checked; S.savePrefs(); S.applyDisplayPrefs(); }
        else if (x.dataset.pref == "manual") { pr.board = x.checked ? "manual" : "auto"; S.savePrefs(); }
        else if (x.dataset.pref == "turnmini") { pr.turnMini = x.checked; S.savePrefs(); S.renderSettings(); }
        else if (x.dataset.pref == "hpplace") {
            var tr = scr.querySelector("[data-pref='hpplace'][value='track']").checked, ti = scr.querySelector("[data-pref='hpplace'][value='tile']").checked;
            if (!tr && !ti) { x.checked = true; return; }
            pr.hpPlace = tr && ti ? "both" : tr ? "track" : "tile"; S.savePrefs();
        }
        else if (x.id == "sk-bgfile" && x.files && x.files[0]) S.loadBackground(x.files[0]);
        else if (x.dataset.skin && x.files && x.files[0]) S.loadSkin(x.dataset.skin, x.files[0]);
        else if (x.dataset.bg) { var bb = S.bg() || {}; bb[x.dataset.bg] = +x.value; store(KEY_BG, bb); S.renderSettings(); }
    });
    scr.addEventListener("input", function(ev) {
        var x = ev.target; if (!x.dataset.bg) return;
        var bb = S.bg() || {}; bb[x.dataset.bg] = +x.value;
        var pv = scr.querySelector(".sk-bgprev"); S.bgVars(bb).split(";").forEach(function(d) { var kv = d.split(":"); pv.style.setProperty(kv[0], kv[1]); });
        if (x.dataset.bg == "zoom") scr.querySelector("#sk-zo").textContent = x.value + " %";
    });
    S.screenClick = function(ev) {
        var srm = ev.target.closest("[data-skinrm]");
        if (srm) { S.removeSkin(srm.dataset.skinrm); return; }
        if (ev.target.closest("[data-bgrm]")) { try { localStorage.removeItem(KEY_BG); } catch (x) {} S.renderSettings(); }
        else if (ev.target.closest("[data-exp]")) S.exportData(S.allData(), "skelos_sauvegarde.json");
        else if (ev.target.closest("[data-imp]")) S.importData(function(o) {
            S.ask(t("confirm_import"), t("import"), function() { S.restoreData(o); S.toast(t("import_done")); S.renderSettings(); });
        });
    };
};
// La photo est réduite avant d'être gardée sur l'appareil, pour tenir dans l'espace disponible.
S.loadBackground = function(file) {
    var r = new FileReader();
    r.onload = function() {
        var img = new Image();
        img.onload = function() {
            var max = 1800, w = img.width, hgt = img.height, k = Math.min(1, max / Math.max(w, hgt));
            var cv = document.createElement("canvas"); cv.width = Math.round(w * k); cv.height = Math.round(hgt * k);
            cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
            var b = S.bg() || {}; b.img = cv.toDataURL("image/jpeg", 0.8); if (b.zoom == null) b.zoom = 100;
            if (store(KEY_BG, b)) S.renderSettings();
        };
        img.onerror = function() { S.toast(t("image_error")); };
        img.src = r.result;
    };
    r.readAsDataURL(file);
};
S.allData = function() {
    var o = {format: "skelos", version: 1, exported: today()};
    o.game = load(S.storageGame, null); o.scenarios = S.scenarios(); o.campaigns = S.campaigns(); o.upgrades = S.upgrades(); o.prefs = S.prefs();
    return o;
};
S.restoreData = function(o) {
    if (o.scenarios) S.saveScenarios(o.scenarios);
    if (o.campaigns) S.saveCampaigns(o.campaigns);
    if (o.upgrades) S.saveUpgrades(o.upgrades);
    if (o.prefs) { S._prefs = o.prefs; S.savePrefs(); }
    if (o.game) { store(S.storageGame, o.game); S.state = S.migrate(o.game); }
};
// Export : téléchargement quand l'appareil le permet, sinon texte à copier.
S.exportData = function(obj, name) {
    var txt = JSON.stringify(obj);
    try {
        var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], {type: "application/json"})); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
    } catch (x) {}
    S.dialog("<h2>" + t("export") + "</h2><p>" + t("export_help") + "</p><textarea class='sk-in sk-code' rows='6' readonly id='sk-exp'>" + e(txt) + "</textarea>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-copy>" + t("copy") + "</button><button class='sk-btn' data-dclose>" + t("close") + "</button></div>",
        function(ev) {
            if (ev.target.closest("[data-copy]")) {
                var ta = S.root.querySelector("#sk-exp"); ta.select();
                var ok = false; try { ok = document.execCommand("copy"); } catch (x) {}
                if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function() { S.toast(t("copied")); }, function() { if (!ok) S.toast(t("copy_manual")); });
                else S.toast(ok ? t("copied") : t("copy_manual"));
            }
        });
};
S.importData = function(onData) {
    S.dialog("<h2>" + t("import") + "</h2><p>" + t("import_help") + "</p><label class='sk-btn sk-filebtn'>" + t("choose_file") + "<input type='file' accept='.json,application/json' id='sk-impf' hidden></label>"
        + "<textarea class='sk-in sk-code' rows='5' id='sk-impt' placeholder='" + e(t("paste_here")) + "'></textarea>"
        + "<div class='sk-actions'><button class='sk-btn sk-primary' data-imp-ok>" + t("import") + "</button><button class='sk-btn' data-dclose>" + t("cancel") + "</button></div>",
        function(ev, close) {
            if (ev.target.closest("[data-imp-ok]")) {
                var v = S.root.querySelector("#sk-impt").value.trim(); if (!v) { S.toast(t("paste_here")); return; }
                try { var o = JSON.parse(v); close(); onData(o); } catch (x) { S.toast(t("import_bad")); }
            }
        });
    S.root.querySelector("#sk-impf").addEventListener("change", function(ev) {
        var f = ev.target.files && ev.target.files[0]; if (!f) return;
        var r = new FileReader(); r.onload = function() { S.root.querySelector("#sk-impt").value = r.result; }; r.readAsText(f);
    });
};

// ---------- Fin de scénario ----------
S.renderEnd = function(keep) {
    var st = S.state; if (!st) { S.renderHome(); return; }
    S.screen = "end";
    var camp = st.campaign ? S.campaign(st.campaign.cid) : null;
    if (!keep || !S.endDraft) S.endDraft = {result: "win", date: today(), loot: [], fallen: [], notes: "", vp: null};
    var d = S.endDraft;
    if (camp) S.curCampaign = camp.id;
    var alive = camp ? camp.heroes.filter(function(hh) { return !hh.dead && d.fallen.indexOf(hh.id) < 0; }).length : 0;
    var autoVp = d.result == "loss" ? -1 : Math.min(3, alive);
    if (d.vp == null) d.vp = autoVp;
    var h = head(null, t("end_title"), "<button class='sk-btn' data-end='back'>" + t("resume_game") + "</button>");
    h += "<div class='sk-blk sk-c8 sk-endform'><p class='sk-help'>" + e((st.scenario.title || t("tab")) + (camp ? " — " + t("in_campaign", camp.name) + ", " + t("scenario_n", st.campaign.idx + 1) : "") + " · " + t("turn") + " " + st.turn) + "</p>";
    h += "<span class='sk-fl'>" + t("result") + "</span><div class='sk-seg sk-res'><button data-res='win'" + (d.result == "win" ? " class='sk-on'" : "") + ">" + t("heroes_win") + "</button><button data-res='loss'" + (d.result == "loss" ? " class='sk-on'" : "") + ">" + t("overlord_wins") + "</button></div>";
    if (camp) {
        h += "<label class='sk-fl'>" + t("game_date") + "<input type='date' class='sk-in sk-w' id='sk-ed' value='" + d.date + "'></label>";
        h += "<span class='sk-fl'>" + t("fallen_heroes") + "</span><div class='sk-chips'>" + camp.heroes.filter(function(hh) { return !hh.dead; }).map(function(hh) {
            return "<button class='sk-chip sk-own" + (d.fallen.indexOf(hh.id) >= 0 ? " sk-sel sk-x" : "") + "' style='--hc:" + hh.color + "' data-fall='" + hh.id + "' aria-pressed='" + (d.fallen.indexOf(hh.id) >= 0) + "'>" + e(hh.name) + "</button>";
        }).join("") + "</div>";
        h += "<span class='sk-fl'>" + t("victory_points") + "</span><div class='sk-row'><button class='sk-mini' data-vp='-1' aria-label='−1'>−</button><b class='sk-vpbig'>" + (d.vp > 0 ? "+" : "") + d.vp + "</b><button class='sk-mini' data-vp='1' aria-label='+1'>+</button>"
            + "<span class='sk-help'>" + t("vp_help", autoVp > 0 ? "+" + autoVp : autoVp) + "</span>" + (d.vp != autoVp ? "<button class='sk-btn sk-sm' data-vpauto>" + t("vp_reset") + "</button>" : "") + "</div>";
        h += "<span class='sk-fl'>" + t("loot") + "</span><div class='sk-lootlist'>" + d.loot.map(function(it, i) {
            return "<div class='sk-lootrow'>" + "<span class='sk-chip sk-k-" + it.kind + "' data-card='" + it.kind + ":" + e(it.ref) + "'>" + e(it.name) + "</span>"
                + "<select class='sk-in' data-lootown='" + i + "'><option value=''>" + t("common_cache") + "</option>" + camp.heroes.map(function(hh) { return "<option value='" + hh.id + "'" + (it.owner == hh.id ? " selected" : "") + ">" + e(hh.name) + "</option>"; }).join("") + "</select>"
                + "<button class='sk-mini' data-lootrm='" + i + "' aria-label='" + e(t("delete")) + "'>✕</button></div>";
        }).join("") + "</div><button class='sk-btn' data-end='loot'>+ " + t("add_loot") + "</button>";
    }
    h += "<label class='sk-fl'>" + t("notes") + "<textarea class='sk-in' id='sk-en' rows='3'>" + e(d.notes) + "</textarea></label>";
    h += "<div class='sk-actions'><button class='sk-btn sk-primary' data-end='save'>" + t(camp ? "save_back_campaign" : "save_back_home") + "</button><button class='sk-btn' data-end='back'>" + t("resume_game") + "</button></div></div>";
    S.mount(shell("sk-end", h));
    var scr = S.root.querySelector(".sk-screen");
    scr.addEventListener("change", function(ev) {
        var x = ev.target;
        if (x.id == "sk-ed") d.date = x.value;
        else if (x.id == "sk-en") d.notes = x.value;
        else if (x.dataset.lootown != null) d.loot[+x.dataset.lootown].owner = x.value || null;
    });
    S.screenClick = function(ev) {
        var nt = scr.querySelector("#sk-en"); if (nt) d.notes = nt.value;
        var r = ev.target.closest("[data-res]"); if (r) { d.result = r.dataset.res; d.vp = null; S.renderEnd(true); return; }
        var f = ev.target.closest("[data-fall]"); if (f) { var k = d.fallen.indexOf(f.dataset.fall); if (k >= 0) d.fallen.splice(k, 1); else d.fallen.push(f.dataset.fall); d.vp = null; S.renderEnd(true); return; }
        var v = ev.target.closest("[data-vp]"); if (v) { d.vp += +v.dataset.vp; S.renderEnd(true); return; }
        if (ev.target.closest("[data-vpauto]")) { d.vp = null; S.renderEnd(true); return; }
        var lr = ev.target.closest("[data-lootrm]"); if (lr) { d.loot.splice(+lr.dataset.lootrm, 1); S.renderEnd(true); return; }
        var b = ev.target.closest("[data-end]"); if (!b) return;
        if (b.dataset.end == "back") { S.renderGame(); return; }
        if (b.dataset.end == "loot") { S.openItemPicker({title: t("add_loot"), onAdd: function(sel) { sel.forEach(function(x) { d.loot.push({kind: x.kind, ref: x.ref, name: x.name, owner: null}); }); S.renderEnd(true); }}); return; }
        if (b.dataset.end == "save") S.saveEnd();
    };
};
S.saveEnd = function() {
    var st = S.state, d = S.endDraft, link = st.campaign;
    if (link) {
        S.updateCampaign(link.cid, function(c) {
            var sc = c.scenarios[link.idx];
            if (sc) {
                var names = d.fallen.map(function(hid) { return ((c.heroes || []).filter(function(x) { return x.id == hid; })[0] || {}).name; }).filter(Boolean);
                sc.plays = S.scenarioPlays(sc);
                sc.plays.push({date: d.date, result: d.result, vp: d.vp, turn: st.turn, turns: st.scenario.turns || (sc.setup && sc.setup.turns) || null,
                    title: sc.title || st.scenario.title || "", notes: d.notes, fallen: names});
                S.syncScenario(sc); sc.notes = d.notes;
                sc.setup = sc.setup || JSON.parse(JSON.stringify(st.scenario));
            }
            d.loot.forEach(function(it) { var up = it.kind == "up"; c.cache.push({uid: uid("i"), kind: it.kind, ref: it.ref, name: it.name, owner: up ? null : it.owner || null, takers: up && it.owner ? [it.owner] : undefined, start: false}); });
            d.fallen.forEach(function(hid) { c.heroes.forEach(function(hh) { if (hh.id == hid) { hh.dead = true; hh.deadAt = link.idx + 1; } }); });
            c.last = d.date;
            var title = (sc && sc.title) || st.scenario.title || "";
            S.campLog(c, t(d.result == "win" ? "clog_win" : "clog_loss", link.idx + 1, title, st.turn) + " (" + (d.vp > 0 ? "+" : "") + d.vp + " PV)");
            if (d.loot.length) S.campLog(c, t("clog_loot", link.idx + 1, d.loot.length));
            d.fallen.forEach(function(hid) { var hh = c.heroes.filter(function(x) { return x.id == hid; })[0]; if (hh) S.campLog(c, t("clog_fallen", link.idx + 1, hh.name)); });
            if (d.notes) S.campLog(c, t("clog_note", link.idx + 1, d.notes));
        });
    }
    S.endDraft = null; S.clearGame();
    if (link) S.renderCampaign(link.cid); else S.renderHome();
};
})();
