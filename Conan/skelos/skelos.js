// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Ce module n'ajoute aucune image ni donnée de Monolith :
// il utilise celles déjà chargées par le Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell).
// Livre de Skelos numérique : module pour le Compagnon de Conan.
// Réutilise Encyclopedia.tiles, Encyclopedia.skills et Tile._cardCode du Compagnon.
var Skelos = {
    _i18n: {},
    storageGame: Application + "_SkelosGame",
    storageScenarios: Application + "_SkelosScenarios",
    RIVER_SIZE: 8,

    // Résolution des chemins d'images. Le Compagnon les sert tels quels ;
    // la version autonome remplace cette fonction pour pointer vers des images embarquées.
    asset: function(path) { return path; },

    state: null,
    draft: null,
    undoStack: [],
    selected: null,
    root: null,

    t: function(key) {
        var s = Skelos._i18n[key] || key;
        for (var i = 1; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(arguments[i]);
        return s;
    },

    esc: function(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; });
    },

    // ---------- Données ----------

    tileById: function(id) {
        var l = Encyclopedia.tiles.list;
        for (var i = 0; i < l.length; i++) if (l[i].id == id) return l[i];
        return null;
    },

    skillById: function(code) {
        var l = Encyclopedia.skills.list;
        for (var i = 0; i < l.length; i++) if (l[i].type + "/" + l[i].id == code) return l[i];
        return null;
    },

    // Une même référence peut exister avec plusieurs illustrations (ex. les tuiles Événement).
    tileOf: function(slot) {
        var l = Encyclopedia.tiles.list;
        if (slot.img) for (var i = 0; i < l.length; i++) if (l[i].id == slot.tileId && l[i].image == slot.img) return l[i];
        return Skelos.tileById(slot.tileId);
    },

    tileName: function(slot) {
        var t = Skelos.tileOf(slot);
        if (!t) return "?";
        if (t.id == "event") return Skelos.t("scenario_events");
        return t.name;
    },

    skillCodeByImage: function(path) {
        if (path.indexOf("data/skills/") < 0) return null;
        var l = Encyclopedia.skills.list;
        for (var i = 0; i < l.length; i++) if (l[i].image == path) return l[i].type + "/" + l[i].id;
        return null;
    },

    isEvent: function(slot) { return slot.tileId == "event"; },

    tileCode: function(slot) {
        var tile = Skelos.tileOf(slot);
        if (!tile) return "";
        var color = slot.color || (tile.colors && tile.colors[0]) || "gray";
        var o = {
            name: tile.id == "event" ? undefined : tile.name,
            nameSize: tile.size,
            color: color,
            movement: tile.movement || "",
            defense: tile.defense || "",
            attacktype: tile.attacktype || "",
            dices: tile.dices,
            dices2: tile.dices2,
            skills: tile.skills,
            reinforcement: tile.reinforcement || "",
            image: tile.image,
            imageflip: tile.image_flip || false,
            imagelocation: {x: tile.image_location.x, y: tile.image_location.y},
            imagezoom: tile.image_zoom,
            imagerotation: tile.image_rotation || 0,
            tokens: []
        };
        return Tile._cardCode(o, null, false).replace(/src="([^"?]+)(\?[^"]*)?"/g, function(m, p) {
            var code = Skelos.skillCodeByImage(p);
            return (code ? 'data-skill="' + code + '" ' : '') + 'src="' + Skelos.asset(p) + '"';
        });
    },

    // ---------- Sauvegarde ----------

    save: function() {
        try { localStorage.setItem(Skelos.storageGame, JSON.stringify(Skelos.state)); } catch (e) {}
    },

    loadSaved: function() {
        try { return JSON.parse(localStorage.getItem(Skelos.storageGame)); } catch (e) { return null; }
    },

    scenarios: function() {
        try { return JSON.parse(localStorage.getItem(Skelos.storageScenarios)) || []; } catch (e) { return []; }
    },

    saveScenarios: function(list) {
        try { localStorage.setItem(Skelos.storageScenarios, JSON.stringify(list)); } catch (e) {}
    },

    // Mémorise l'état avant chaque action pour pouvoir l'annuler.
    snapshot: function() {
        Skelos.undoStack.push(JSON.stringify(Skelos.state));
        if (Skelos.undoStack.length > 100) Skelos.undoStack.shift();
    },

    undo: function() {
        if (!Skelos.undoStack.length) return;
        Skelos.state = JSON.parse(Skelos.undoStack.pop());
        Skelos.save();
        Skelos.renderGame();
    },

    log: function(msg) {
        Skelos.state.log.unshift({turn: Skelos.state.turn, msg: msg, ts: Date.now()});
        if (Skelos.state.log.length > 500) Skelos.state.log.pop();
    },

    // Réglages d'affichage mémorisés sur l'appareil.
    prefs: function() {
        if (!Skelos._prefs) {
            try { Skelos._prefs = JSON.parse(localStorage.getItem(Application + "_SkelosPrefs")) || {}; } catch (e) { Skelos._prefs = {}; }
        }
        return Skelos._prefs;
    },

    savePrefs: function() {
        try { localStorage.setItem(Application + "_SkelosPrefs", JSON.stringify(Skelos._prefs)); } catch (e) {}
    },

    migrate: function(st) {
        if (!st.boosts) st.boosts = {move: 0, reroll: 0, defense: 0, spell: 0};
        if (!st.phase) st.phase = "heroes";
        return st;
    },

    // ---------- Préparation ----------

    blankScenario: function() {
        return {title: "", mode: "classic", turns: 10, recovery: 5, energy: 10, fatigue: 0,
                maxActivations: 2, heroes: 4, river: [], events: "", notes: ""};
    },

    exampleScenario: function() {
        var s = Skelos.blankScenario();
        s.title = Skelos.t("example");
        s.notes = Skelos.t("example_note");
        s.turns = 8; s.recovery = 5; s.energy = 10; s.fatigue = 4;
        var ids = ["pict-hunters", "event", "zogar-sag", "hyenas", "thak", "giant-snake"];
        ids.forEach(function(id) {
            var t = Skelos.tileById(id);
            if (t) s.river.push({tileId: id, color: t.colors[0], lp: (id == "zogar-sag" ? 6 : id == "thak" ? 8 : id == "giant-snake" ? 8 : null)});
        });
        s.events = "Renfort : 4 points\nLes tambours résonnent : chaque Chasseur picte gagne 1 point de mouvement";
        return s;
    },

    init: function(root) {
        Skelos.root = root;
        var saved = Skelos.loadSaved();
        Skelos.draft = saved && saved.scenario ? JSON.parse(JSON.stringify(saved.scenario)) : Skelos.exampleScenario();
        if (saved && saved.river) Skelos.state = Skelos.migrate(saved);
        if (Skelos.applyDisplayPrefs) Skelos.applyDisplayPrefs();
        if (Skelos.renderHome) Skelos.renderHome(); else if (Skelos.state) Skelos.renderGame(); else Skelos.renderSetup();
    },

    renderSetup: function() {
        Skelos.screen = "setup";
        var live = !!(Skelos.live && Skelos.state), ctx = Skelos.ctx;
        if (live) Skelos.draft = Skelos.liveDraft();
        var d = Skelos.draft, t = Skelos.t, e = Skelos.esc;
        var rv = live ? Skelos.state.river : d.river;
        var h = "<div class='skelos-setup" + (live ? " live" : "") + "'>";
        h += "<div class='sk-head'>" + (live ? "<button class='sk-btn' data-act='backgame'>← " + t("back_board") + "</button>"
            : "<button class='sk-btn' data-act='" + (ctx ? "backcamp" : "home") + "'>← " + t(ctx ? "campaign" : "home") + "</button>")
            + "<h1>" + t(live ? "live_title" : ctx ? "prepare_title" : "setup_title") + "</h1></div>";
        if (live) h += "<div class='sk-livebanner'>" + t("live_banner", Skelos.state.turn) + "</div>";
        if (ctx && !live) h += "<div class='sk-livebanner sk-ctxbanner'>" + e(t("prepare_banner", Skelos.campaignName(ctx.cid), ctx.idx + 1)) + "</div>";

        h += "<div class='sk-form'>";
        h += "<label class='sk-wide'>" + t("scenario_name") + "<input name='title' value='" + e(d.title) + "' placeholder='" + e(t("scenario_name_placeholder")) + "'></label>";
        h += "<fieldset class='sk-wide sk-mode'" + (live ? " disabled" : "") + "><legend>" + t("mode") + "</legend>"
            + "<label><input type='radio' name='mode' value='classic'" + (d.mode == "classic" ? " checked" : "") + "> " + t("mode_classic") + "</label>"
            + "<label><input type='radio' name='mode' value='solo'" + (d.mode == "solo" ? " checked" : "") + "> " + t("mode_solo") + "</label></fieldset>";
        h += "<label>" + t("turns") + "<input type='number' min='1' max='30' name='turns' value='" + d.turns + "'></label>";
        if (d.mode == "classic" && live) {
            h += Skelos.gemsEditorCode();
            h += "<label>" + t("recovery") + "<input type='number' min='0' max='20' name='recovery' value='" + d.recovery + "'></label>";
            h += "<label>" + t("max_activations") + "<input type='number' min='1' max='8' name='maxActivations' value='" + d.maxActivations + "'></label>";
        } else if (d.mode == "classic") {
            h += "<label>" + t("start_energy") + "<input type='number' min='0' max='40' name='energy' value='" + d.energy + "'></label>";
            h += "<label>" + t("start_fatigue") + "<input type='number' min='0' max='40' name='fatigue' value='" + d.fatigue + "'></label>";
            h += "<label>" + t("recovery") + "<input type='number' min='0' max='20' name='recovery' value='" + d.recovery + "'></label>";
            h += "<label>" + t("max_activations") + "<input type='number' min='1' max='8' name='maxActivations' value='" + d.maxActivations + "'></label>";
        } else {
            h += "<label>" + t("heroes") + "<input type='number' min='1' max='4' name='heroes' value='" + d.heroes + "'></label>";
        }
        h += "<label>" + t("first_player") + "<select name='firstPlayer'><option value='heroes'" + (d.firstPlayer != "overlord" ? " selected" : "") + ">" + t("first_heroes") + "</option><option value='overlord'" + (d.firstPlayer == "overlord" ? " selected" : "") + ">" + t("first_overlord") + "</option></select></label>";
        h += "</div>";

        h += "<h2>" + t("river") + "</h2><p class='sk-help'>" + t("river_help") + "</p><div class='sk-river sk-river-setup'>";
        for (var i = 0; i < Skelos.RIVER_SIZE; i++) {
            var s = rv[i];
            h += "<div class='sk-slot'><div class='sk-cost'><span class='sk-costtok'><span>" + (i + 1) + "</span></span></div>";
            if (s) {
                var tile = Skelos.tileOf(s);
                h += "<div class='sk-tilebox'>" + Skelos.tileCode(s) + "</div>";
                h += "<div class='sk-slot-tools'>"
                    + "<button class='sk-mini' data-act='left' data-i='" + i + "' aria-label='" + t("aria_left") + "'" + (i == 0 ? " disabled" : "") + ">‹</button>"
                    + "<button class='sk-mini' data-act='remove' data-i='" + i + "' aria-label='" + t("delete") + "'>✕</button>"
                    + "<button class='sk-mini' data-act='right' data-i='" + i + "' aria-label='" + t("aria_right") + "'" + (i == rv.length - 1 ? " disabled" : "") + ">›</button></div>";
                if (tile && tile.colors && tile.colors.length > 1) {
                    h += "<select class='sk-color' data-i='" + i + "' aria-label='" + t("color") + "'>" + tile.colors.map(function(c) {
                        return "<option value='" + c + "'" + (c == s.color ? " selected" : "") + ">" + (Tile._i18n && Tile._i18n['color' + c.charAt(0).toUpperCase() + c.slice(1)] || c) + "</option>";
                    }).join("") + "</select>";
                }
                if (!Skelos.isEvent(s)) h += "<label class='sk-lp'>" + t("life_points") + "<input type='number' min='0' max='40' data-i='" + i + "' value='" + ((live ? s.lpMax : s.lp) || "") + "' placeholder='1'></label>";
            } else if (i == rv.length) {
                h += "<button class='sk-add' data-act='pick'>+<span>" + t(live ? "add_tile_end" : "add_tile") + "</span></button>";
            } else {
                h += "<div class='sk-empty'>" + t("empty_slot") + "</div>";
            }
            h += "</div>";
        }
        h += "</div>";

        h += "<div class='sk-form'><label class='sk-wide'>" + t("events") + "<small>" + t("events_help") + "</small><textarea name='events' rows='3' placeholder='" + e(t("events_placeholder")) + "'>" + e(d.events) + "</textarea></label>";
        h += "<label class='sk-wide'>" + t("notes") + "<textarea name='notes' rows='3'>" + e(d.notes) + "</textarea></label></div>";

        if (ctx || (live && Skelos.state.campaign)) h += Skelos.heroesSectionCode(ctx ? ctx.cid : Skelos.state.campaign.cid);

        if (live) h += "<div class='sk-actions'><button class='sk-btn sk-primary' data-act='backgame'>" + t("back_board") + "</button>"
            + "<button class='sk-btn' data-act='savelive'>" + t("save_scenario") + "</button>"
            + "<button class='sk-btn' data-act='restart'>" + t("restart_game") + "</button></div>";
        else if (ctx) h += "<div class='sk-actions'><button class='sk-btn sk-primary' data-act='start'>" + t("launch") + "</button>"
            + "<button class='sk-btn' data-act='prepsave'>" + t("save_prep") + "</button>"
            + "<button class='sk-btn' data-act='savescen'>" + t("save_scenario") + "</button></div>";
        else h += "<div class='sk-actions'><button class='sk-btn sk-primary' data-act='start'>" + t("start_game") + "</button>"
            + "<button class='sk-btn' data-act='savescen'>" + t("save_scenario") + "</button></div>";

        var list = live || ctx ? null : Skelos.scenarios();
        if (list) h += "<h2>" + t("saved_scenarios") + "</h2>";
        if (!list) {}
        else if (!list.length) h += "<p class='sk-help'>" + t("no_saved") + "</p>";
        else h += "<ul class='sk-scenlist'>" + list.map(function(s, i) {
            return "<li><span>" + e(s.title || "—") + " <small>" + (s.mode == "solo" ? t("mode_solo") : t("mode_classic")) + "</small></span>"
                + "<button class='sk-btn' data-act='loadscen' data-i='" + i + "'>" + t("load") + "</button>"
                + "<button class='sk-btn' data-act='delscen' data-i='" + i + "'>" + t("delete") + "</button></li>";
        }).join("") + "</ul>";
        h += "</div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>";
        Skelos.root.innerHTML = h;
        if (!Skelos._pressBound) { Skelos.bindPress(Skelos.root); Skelos._pressBound = true; }
        Skelos.bindSetup();
    },

    readForm: function() {
        var r = Skelos.root, d = Skelos.draft;
        var v = function(n) { var el = r.querySelector("[name=" + n + "]"); return el ? el.value : null; };
        d.title = v("title") || "";
        var m = r.querySelector("[name=mode]:checked"); if (m) d.mode = m.value;
        ["turns", "energy", "fatigue", "recovery", "maxActivations", "heroes"].forEach(function(n) {
            var x = v(n); if (x !== null && x !== "") d[n] = Math.max(0, parseInt(x, 10) || 0);
        });
        if (v("firstPlayer")) d.firstPlayer = v("firstPlayer");
        d.events = v("events") || "";
        d.notes = v("notes") || "";
        var live = !!(Skelos.live && Skelos.state), rv = live ? Skelos.state.river : d.river;
        r.querySelectorAll(".sk-lp input").forEach(function(el) {
            var s = rv[+el.dataset.i]; if (!s) return;
            var v = el.value ? parseInt(el.value, 10) : null;
            if (!live) { s.lp = v; return; }
            var old = s.lpMax;
            s.lpMax = v;
            if (v == null) s.lp = null;
            else if (old == null || s.lp == null) s.lp = v;
            else s.lp = Math.max(0, Math.min(v, s.lp + (v - old)));
        });
        r.querySelectorAll(".sk-color").forEach(function(el) {
            var s = rv[+el.dataset.i]; if (s) s.color = el.value;
        });
    },

    bindSetup: function() {
        var r = Skelos.root;
        r.querySelectorAll("[name=mode]").forEach(function(el) {
            el.addEventListener("change", function() { Skelos.readForm(); Skelos.renderSetup(); });
        });
        r.querySelector(".skelos-setup").addEventListener("click", function(ev) {
            var b = ev.target.closest("[data-act]"); if (!b) return;
            var i = +b.dataset.i, d = Skelos.draft, live = !!(Skelos.live && Skelos.state);
            if (Skelos.setupAction && Skelos.setupAction(b, ev)) return;
            Skelos.readForm();
            var rv = live ? Skelos.state.river : d.river;
            if (live && ["remove", "left", "right"].indexOf(b.dataset.act) >= 0) Skelos.snapshot();
            switch (b.dataset.act) {
                case "pick": Skelos.openPicker(); return;
                case "remove": var gone = rv.splice(i, 1)[0]; if (live) Skelos.forgetSlot(gone); break;
                case "left": rv.splice(i - 1, 0, rv.splice(i, 1)[0]); break;
                case "right": rv.splice(i + 1, 0, rv.splice(i, 1)[0]); break;
                case "start": Skelos.startGame(); return;
                case "resume": Skelos.state = Skelos.migrate(Skelos.loadSaved()); Skelos.renderGame(); return;
                case "savescen":
                    var list = Skelos.scenarios();
                    var copy = JSON.parse(JSON.stringify(d));
                    var idx = list.findIndex(function(s) { return s.title && s.title == copy.title; });
                    if (idx >= 0) list[idx] = copy; else list.push(copy);
                    Skelos.saveScenarios(list);
                    Skelos.toast(Skelos.t("scenario_saved"));
                    break;
                case "loadscen": Skelos.draft = JSON.parse(JSON.stringify(Skelos.scenarios()[i])); break;
                case "delscen":
                    Skelos.ask(Skelos.t("confirm_delete"), Skelos.t("delete"), function() {
                        var l = Skelos.scenarios(); l.splice(i, 1); Skelos.saveScenarios(l); Skelos.renderSetup();
                    });
                    return;
            }
            if (live) Skelos.applyLive(true);
            Skelos.renderSetup();
        });
        if (Skelos.live && Skelos.state) {
            r.querySelector(".skelos-setup").addEventListener("change", function(ev) {
                if (!ev.target.matches("input, select, textarea")) return;
                Skelos.readForm(); Skelos.applyLive();
            });
            var sl = r.querySelector("#sk-gemslider");
            if (sl) sl.addEventListener("input", function() { Skelos.gemSliderPreview(+sl.value); });
        }
    },

    allBoxes: function() {
        var boxes = {};
        Encyclopedia.tiles.list.forEach(function(x) { (x.origins || []).forEach(function(o) { boxes[o] = true; }); });
        var order = ["corebox", "stretchgoal", "king"];
        return Object.keys(boxes).sort(function(a, b) {
            return ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99) || Skelos.boxName(a).localeCompare(Skelos.boxName(b), "fr");
        });
    },

    ownedBoxes: function() {
        if (typeof Extensions != "undefined" && Skelos.inCompanion) return Object.keys(Extensions).filter(function(k) { return Extensions[k]; });
        return Skelos.prefs().ownedBoxes || [];
    },

    // Sélecteur de tuiles : reste ouvert et garde ses filtres pour ajouter plusieurs tuiles d'affilée.
    openPicker: function() {
        var t = Skelos.t, e = Skelos.esc, pr = Skelos.prefs();
        if (pr.pickerQ == null) pr.pickerQ = "";
        if (pr.pickerBox == null) pr.pickerBox = "corebox";
        var ov = Skelos.root.querySelector("#sk-overlay");
        ov.innerHTML = "<div class='sk-dialog sk-pickdlg' role='dialog' aria-modal='true'><div class='sk-dialog-head'><h2>" + t("picker_title") + "</h2>"
            + "<div class='sk-actions sk-pickactions'><button class='sk-btn sk-primary' data-act='addsel' disabled>" + t("add_selection", 0) + "</button>"
            + "<button class='sk-btn' data-act='close'>" + t("close") + "</button></div></div>"
            + "<div class='sk-filters'><input type='search' id='sk-q' placeholder='" + e(t("search")) + "' value='" + e(pr.pickerQ) + "'>"
            + "<select id='sk-box'></select><button class='sk-btn' data-act='owned' aria-expanded='false'>" + t("my_boxes") + "</button></div>"
            + "<div class='sk-owned' id='sk-owned' hidden></div>"
            + "<div class='sk-pickstatus' id='sk-pickstatus' role='status'></div>"
            + "<div class='sk-picker' id='sk-picker'></div></div>";
        ov.classList.add("on");

        var fillBoxes = function() {
            var owned = Skelos.ownedBoxes(), list = owned.length ? Skelos.allBoxes().filter(function(k) { return owned.indexOf(k) >= 0; }) : Skelos.allBoxes();
            if (pr.pickerBox && list.indexOf(pr.pickerBox) < 0) pr.pickerBox = "";
            document.getElementById("sk-box").innerHTML = "<option value=''>" + t(owned.length ? "all_my_boxes" : "all_boxes") + "</option>"
                + list.map(function(k) { return "<option value='" + k + "'" + (k == pr.pickerBox ? " selected" : "") + ">" + e(Skelos.boxName(k)) + "</option>"; }).join("");
        };
        var fillOwned = function() {
            var owned = Skelos.ownedBoxes();
            document.getElementById("sk-owned").innerHTML = "<p class='sk-help'>" + t("my_boxes_help") + "</p><div class='sk-owned-grid'>"
                + Skelos.allBoxes().map(function(k) {
                    return "<label><input type='checkbox' value='" + k + "'" + (owned.indexOf(k) >= 0 ? " checked" : "") + "> " + e(Skelos.boxName(k)) + "</label>";
                }).join("") + "</div><div class='sk-actions'><button class='sk-btn' data-act='ownedall'>" + t("check_all") + "</button><button class='sk-btn' data-act='ownednone'>" + t("check_none") + "</button></div>";
        };
        var sel = [];
        var status = function() {
            var n = (Skelos.live && Skelos.state ? Skelos.state.river : Skelos.draft.river).length, free = Skelos.RIVER_SIZE - n;
            var h = "<div><b>" + t("river") + " " + n + " / " + Skelos.RIVER_SIZE + "</b> — " + t("selection_count", sel.length, free) + "</div>";
            h += "<div class='sk-selchips'>" + sel.map(function(x, i) {
                return "<button class='sk-chip' data-unsel='" + i + "' aria-label='" + e(t("unselect", x.name)) + "'><span class='sk-chip-n'>" + (n + i + 1) + "</span>" + e(x.name) + " <span aria-hidden='true'>✕</span></button>";
            }).join("") + "</div>";
            document.getElementById("sk-pickstatus").innerHTML = h;
            var add = document.querySelector("[data-act=addsel]");
            add.disabled = !sel.length;
            add.textContent = t("add_selection", sel.length);
            document.querySelectorAll(".sk-pick").forEach(function(p) {
                var k = [], key = p.dataset.id + "|" + p.dataset.img;
                sel.forEach(function(x, i) { if (x.key == key) k.push(n + i + 1); });
                var badge = p.querySelector(".sk-pickbadge");
                if (k.length) {
                    if (!badge) { badge = document.createElement("span"); badge.className = "sk-pickbadge"; p.appendChild(badge); }
                    badge.textContent = k.join(" · ");
                    p.classList.add("picked");
                } else { if (badge) badge.remove(); p.classList.remove("picked"); }
            });
        };
        var draw = function() {
            pr.pickerQ = document.getElementById("sk-q").value;
            pr.pickerBox = document.getElementById("sk-box").value;
            Skelos.savePrefs();
            var q = Skelos.norm(pr.pickerQ), bx = pr.pickerBox, owned = Skelos.ownedBoxes();
            var seen = {}, out = "";
            Encyclopedia.tiles.list.forEach(function(x) {
                var orig = x.origins || [];
                if (bx && orig.indexOf(bx) < 0) return;
                if (!bx && owned.length && !orig.some(function(o) { return owned.indexOf(o) >= 0; })) return;
                var nm = x.id == "event" ? Skelos.t("scenario_events") : x.name;
                if (q && Skelos.norm(nm).indexOf(q) < 0) return;
                var key = x.id + "|" + x.image; if (seen[key]) return; seen[key] = true;
                out += "<button class='sk-pick' data-id='" + x.id + "' data-img='" + e(x.image) + "' aria-label='" + e(nm) + "'>" + Skelos.tileCode({tileId: x.id, color: x.colors[0], img: x.image}) + "</button>";
            });
            document.getElementById("sk-picker").innerHTML = out || "<p class='sk-help'>" + t("no_tile_found") + "</p>";
            status();
        };
        // Ouvert depuis le mode studio du plateau : on revient au plateau.
        var close = function() {
            ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null;
            if (Skelos._pickToGame) { Skelos._pickToGame = false; Skelos.live = false; Skelos.renderGame(); } else Skelos.renderSetup();
        };

        fillBoxes(); draw();
        document.getElementById("sk-q").addEventListener("input", draw);
        document.getElementById("sk-box").addEventListener("change", draw);
        document.getElementById("sk-owned").addEventListener("change", function() {
            pr.ownedBoxes = Array.prototype.map.call(document.querySelectorAll("#sk-owned input:checked"), function(i) { return i.value; });
            Skelos.savePrefs(); fillBoxes(); draw();
        });
        ov.onclick = function(ev) {
            if (ev.target === ov || ev.target.closest("[data-act=close]")) { close(); return; }
            var ob = ev.target.closest("[data-act=owned]");
            if (ob) {
                var panel = document.getElementById("sk-owned"), open = panel.hasAttribute("hidden");
                if (open) { fillOwned(); panel.removeAttribute("hidden"); } else panel.setAttribute("hidden", "");
                ob.setAttribute("aria-expanded", open);
                return;
            }
            var all = ev.target.closest("[data-act=ownedall], [data-act=ownednone]");
            if (all) {
                pr.ownedBoxes = all.dataset.act == "ownedall" ? Skelos.allBoxes() : [];
                Skelos.savePrefs(); fillOwned(); fillBoxes(); draw(); return;
            }
            var un = ev.target.closest("[data-unsel]");
            if (un) { sel.splice(+un.dataset.unsel, 1); status(); return; }
            if (ev.target.closest("[data-act=addsel]")) {
                var live = !!(Skelos.live && Skelos.state);
                if (live) Skelos.snapshot();
                sel.forEach(function(x) {
                    var tile = Skelos.tileOf({tileId: x.id, img: x.img});
                    if (live) Skelos.addLiveSlot(tile);
                    else Skelos.draft.river.push({tileId: tile.id, img: tile.image, color: tile.colors[0], lp: null});
                });
                if (live && !Skelos._pickToGame) Skelos.applyLive(true); else if (live) Skelos.save();
                close(); return;
            }
            var p = ev.target.closest(".sk-pick"); if (!p) return;
            if ((Skelos.live && Skelos.state ? Skelos.state.river : Skelos.draft.river).length + sel.length >= Skelos.RIVER_SIZE) { Skelos.toast(t("river_full")); return; }
            var tl = Skelos.tileOf({tileId: p.dataset.id, img: p.dataset.img});
            sel.push({id: p.dataset.id, img: p.dataset.img, key: p.dataset.id + "|" + p.dataset.img, name: tl.id == "event" ? t("scenario_events") : tl.name});
            p.classList.remove("added"); void p.offsetWidth; p.classList.add("added");
            status();
        };
        document.getElementById("sk-q").focus();
    },

    boxName: function(id) {
        var ex = Encyclopedia.expansions && Encyclopedia.expansions.list;
        if (ex) {
            if (Array.isArray(ex)) { for (var i = 0; i < ex.length; i++) if (ex[i].id == id) return ex[i].short || ex[i].title || id; }
            else if (ex[id]) return ex[id].short || ex[id].title || id;
        }
        return id;
    },

    norm: function(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); },

    // ---------- Partie ----------

    // Confirmation dans la page : les fenêtres natives (confirm) peuvent être bloquées.
    ask: function(message, yesLabel, onYes) {
        var ov = Skelos.root.querySelector("#sk-overlay");
        ov.innerHTML = "<div class='sk-dialog sk-confirm' role='alertdialog' aria-modal='true'><p>" + Skelos.esc(message) + "</p>"
            + "<div class='sk-actions'><button class='sk-btn sk-primary' data-ans='yes'>" + Skelos.esc(yesLabel) + "</button>"
            + "<button class='sk-btn' data-ans='no'>" + Skelos.t("cancel") + "</button></div></div>";
        ov.classList.add("on");
        ov.onclick = function(ev) {
            var b = ev.target.closest("[data-ans]");
            if (!b && ev.target !== ov) return;
            ov.classList.remove("on"); ov.innerHTML = ""; ov.onclick = null;
            if (b && b.dataset.ans == "yes") onYes();
        };
        ov.querySelector("[data-ans=yes]").focus();
    },

    startGame: function(force) {
        Skelos._hpOpen = null;
        var d = Skelos.draft;
        // « blank » : partie vide par défaut ouverte par l'onglet Partie (Rivière sans tuile).
        if (!d.river.length && force !== "blank") { Skelos.toast(Skelos.t("river_help")); return; }
        var saved = Skelos.loadSaved();
        if (!force && saved && saved.river && saved.river.length) {
            Skelos.ask(Skelos.t("confirm_new"), Skelos.t("confirm_new_yes"), function() { Skelos.startGame(true); });
            return;
        }
        Skelos.undoStack = [];
        var river = d.river.map(function(s, i) {
            return {uid: "u" + i, token: i + 1, tileId: s.tileId, img: s.img, color: s.color, dead: false, eventText: s.eventText || "",
                    lpMax: s.lp || null, lp: s.lp || null};
        });
        Skelos.state = {
            scenario: JSON.parse(JSON.stringify(d)),
            mode: d.mode, turn: 0, turns: d.turns,
            energy: d.energy, fatigue: d.fatigue, recovery: d.recovery,
            maxActivations: d.maxActivations, activations: 0,
            heroes: d.heroes,
            pool: river.map(function(s) { return s.uid; }), used: [], removed: [],
            river: river, lastEvent: false, highlight: null, log: [],
            phase: d.firstPlayer == "overlord" ? "start" : "heroes",
            boosts: {move: 0, reroll: 0, defense: 0, spell: 0}, current: null,
            campaign: Skelos.ctx ? {cid: Skelos.ctx.cid, idx: Skelos.ctx.idx} : null
        };
        Skelos.log(Skelos.t("log_start"));
        Skelos.save();
        Skelos.selected = null;
        Skelos.live = false;
        if (Skelos.onGameStart) Skelos.onGameStart();
        Skelos.renderGame();
    },

    slotByUid: function(uid) {
        var r = Skelos.state.river;
        for (var i = 0; i < r.length; i++) if (r[i].uid == uid) return r[i];
        return null;
    },

    // Mode classique : payer, puis replacer la tuile au bout de la Rivière.
    activate: function(uid) {
        var st = Skelos.state, i = st.river.findIndex(function(s) { return s.uid == uid; });
        var slot = st.river[i], cost = i + 1;
        if (st.phase != "overlord") { Skelos.toast(Skelos.t("activate_only_overlord")); return; }
        if (st.activations >= st.maxActivations) { Skelos.toast(Skelos.t("too_many_activations", st.maxActivations)); return; }
        if (st.energy < cost) { Skelos.toast(Skelos.t("not_enough", cost, st.energy)); return; }
        Skelos.snapshot();
        st.energy -= cost; st.fatigue += cost; st.activations++;
        st.river.splice(i, 1); st.river.push(slot);
        st.lastEvent = Skelos.isEvent(slot);
        st.highlight = slot.uid; st.current = slot.uid;
        Skelos.selected = null;
        Skelos.log(Skelos.t("log_activate", Skelos.tileName(slot), cost));
        Skelos.save(); Skelos.renderGame();
    },

    // Mode solo : piocher un jeton au hasard ; la tuile ne bouge pas.
    drawToken: function() {
        var st = Skelos.state;
        if (st.phase != "overlord") { Skelos.toast(Skelos.t("draw_only_overlord")); return; }
        if (st.activations >= st.heroes) { Skelos.toast(Skelos.t("no_more_activations", st.heroes)); return; }
        Skelos.snapshot();
        if (!st.pool.length) {
            st.pool = st.used.slice(); st.used = [];
            Skelos.log(Skelos.t("log_refresh"));
        }
        if (!st.pool.length) { Skelos.save(); Skelos.renderGame(); return; }
        var k = Math.floor(Math.random() * st.pool.length);
        var uid = st.pool.splice(k, 1)[0];
        st.used.push(uid); st.activations++;
        var slot = Skelos.slotByUid(uid);
        st.highlight = uid;
        st.lastEvent = Skelos.isEvent(slot) && !slot.dead;
        Skelos.log(Skelos.t("log_activate_solo", slot.token, Skelos.tileName(slot)) + (slot.dead ? " — " + Skelos.t("activation_lost") : ""));
        Skelos.selected = uid;
        Skelos.save(); Skelos.renderGame();
    },

    spend: function(n) {
        var st = Skelos.state;
        n = Math.min(n, st.energy); if (n <= 0) return;
        Skelos.snapshot();
        st.energy -= n; st.fatigue += n;
        Skelos.log(Skelos.t("log_spend", n));
        Skelos.save(); Skelos.renderGame();
    },

    adjust: function(field, delta) {
        var st = Skelos.state;
        Skelos.snapshot();
        st[field] = Math.max(0, (st[field] || 0) + delta);
        Skelos.save(); Skelos.renderGame();
    },

    // Tour de l'Overlord : récupération, puis progression du pion Compte-tour.
    overlordTurn: function() {
        var st = Skelos.state;
        Skelos.snapshot();
        st.turn++;
        st.activations = 0; st.lastEvent = false; st.highlight = null;
        if (st.mode == "classic") {
            Skelos.clearBoosts();
            var n = Math.min(st.recovery, st.fatigue);
            st.fatigue -= n; st.energy += n;
            st.phase = "overlord"; st.current = null;
            Skelos.log(Skelos.t("log_recovery", st.turn, n));
        } else {
            st.phase = "overlord"; st.current = null;
            Skelos.log(Skelos.t("log_solo_turn", st.turn));
        }
        if (st.turns && st.turn > st.turns) Skelos.toast(Skelos.t("game_over"));
        Skelos.save(); Skelos.renderGame();
    },

    markDead: function(uid) {
        var st = Skelos.state, i = st.river.findIndex(function(s) { return s.uid == uid; });
        var slot = st.river[i];
        Skelos.snapshot();
        slot.dead = true;
        if (st.mode == "classic") { st.river.splice(i, 1); st.river.push(slot); }
        Skelos.log(Skelos.t("log_dead", Skelos.tileName(slot)));
        Skelos.save(); Skelos.renderGame();
    },

    reinforce: function(uid) {
        var slot = Skelos.slotByUid(uid);
        Skelos.snapshot();
        slot.dead = false;
        if (slot.lpMax) slot.lp = slot.lpMax;
        Skelos.log(Skelos.t("log_reinforce", Skelos.tileName(slot)));
        Skelos.save(); Skelos.renderGame();
    },

    removeToken: function(uid) {
        var st = Skelos.state;
        Skelos.snapshot();
        st.pool = st.pool.filter(function(u) { return u != uid; });
        st.used = st.used.filter(function(u) { return u != uid; });
        if (st.removed.indexOf(uid) < 0) st.removed.push(uid);
        Skelos.toast(Skelos.t("token_removed"));
        Skelos.save(); Skelos.renderGame();
    },

    life: function(uid, delta) {
        var slot = Skelos.slotByUid(uid);
        Skelos.snapshot();
        slot.lp = Math.max(0, Math.min(slot.lpMax || 99, (slot.lp || 0) + delta));
        Skelos.save(); Skelos.renderGame();
        if (slot.lp == 0 && delta < 0) Skelos.toast(Skelos.t("hp_zero", Skelos.tileName(slot)));
    },

    hpBadge: function(s) {
        var open = Skelos._hpOpen == s.uid, tile = Skelos.tileOf(s);
        var reinf = tile && (tile.reinforcement || tile.reinforcement === "0");
        return "<span class='sk-hpwrap" + (open ? " open" : "") + (reinf ? " withreinf" : "") + "' data-hpwrap='" + s.uid + "'>"
            + "<button class='sk-hpbtn' data-hpdelta='-1' data-uid='" + s.uid + "' aria-label='" + Skelos.t("aria_hp_minus") + "' tabindex='" + (open ? 0 : -1) + "'>−</button>"
            + "<span class='sk-hp" + (s.lp <= 0 ? " zero" : "") + "' data-hp='" + s.uid + "' role='button' tabindex='0' aria-label='" + Skelos.esc(Skelos.t("hp_label", s.lp, s.lpMax)) + "' title='" + Skelos.esc(Skelos.t("hp_hint")) + "'>"
            + "<svg viewBox='0 0 24 22' aria-hidden='true'><path d='M12 21.2 10.6 20C5.4 15.3 2 12.2 2 8.4 2 5.3 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.3 22 8.4c0 3.8-3.4 6.9-8.6 11.6z'/></svg>"
            + "<b>" + s.lp + "</b></span>"
            + "<button class='sk-hpbtn' data-hpdelta='1' data-uid='" + s.uid + "' aria-label='" + Skelos.t("aria_hp_plus") + "' tabindex='" + (open ? 0 : -1) + "'>+</button></span>";
    },

    openHp: function(uid) {
        Skelos.closeHp();
        Skelos._hpOpen = uid;
        var w = Skelos.root.querySelector("[data-hpwrap='" + uid + "']");
        if (w) { w.classList.add("open"); w.querySelectorAll(".sk-hpbtn").forEach(function(b) { b.tabIndex = 0; }); }
        if (navigator.vibrate) navigator.vibrate(20);
    },

    closeHp: function() {
        Skelos._hpOpen = null;
        Skelos.root.querySelectorAll(".sk-hpwrap.open").forEach(function(w) {
            w.classList.remove("open"); w.querySelectorAll(".sk-hpbtn").forEach(function(b) { b.tabIndex = -1; });
        });
    },

    BOOSTS: ["move", "reroll", "defense", "spell"],

    // Amélioration ponctuelle : une gemme passe de l'énergie disponible à la zone d'amélioration.
    boost: function(kind) {
        var st = Skelos.state;
        if (st.energy < 1) { Skelos.toast(Skelos.t("not_enough", 1, st.energy)); return; }
        if (kind == "move" && st.phase != "overlord") { Skelos.toast(Skelos.t("move_only_overlord")); return; }
        Skelos.snapshot();
        st.energy--; st.boosts[kind] = (st.boosts[kind] || 0) + 1;
        Skelos.log(Skelos.t("log_boost", Skelos.t("boost_" + kind)));
        Skelos.save(); Skelos.renderGame();
    },

    // Les gemmes des améliorations et des sorts rejoignent la fatigue.
    clearBoosts: function() {
        var st = Skelos.state, n = 0;
        Skelos.BOOSTS.forEach(function(k) { n += st.boosts[k] || 0; st.boosts[k] = 0; });
        st.fatigue += n;
        return n;
    },

    endOverlordTurn: function() {
        var st = Skelos.state;
        Skelos.snapshot();
        var n = Skelos.clearBoosts();
        st.phase = "heroes"; st.current = null; st.lastEvent = false; st.activations = 0; st.highlight = null;
        Skelos.log(Skelos.t("log_end_overlord", n));
        Skelos.save(); Skelos.renderGame();
    },

    // Dépolluer la Rivière : 2 gemmes retirées du jeu (fatigue, puis améliorations, puis énergie).
    purge: function(uid) {
        var st = Skelos.state, need = 2, total = st.fatigue + st.energy;
        Skelos.BOOSTS.forEach(function(k) { total += st.boosts[k] || 0; });
        if (total < need) { Skelos.toast(Skelos.t("not_enough", need, total)); return; }
        Skelos.snapshot();
        var take = function(n) { return n; };
        var f = Math.min(st.fatigue, need); st.fatigue -= f; need -= f;
        Skelos.BOOSTS.forEach(function(k) { var x = Math.min(st.boosts[k] || 0, need); st.boosts[k] -= x; need -= x; });
        var en = Math.min(st.energy, need); st.energy -= en; need -= en;
        var slot = Skelos.slotByUid(uid);
        st.river = st.river.filter(function(x) { return x.uid != uid; });
        if (Skelos.selected == uid) Skelos.selected = null;
        Skelos.log(Skelos.t("log_purge", Skelos.tileName(slot)));
        Skelos.save(); Skelos.renderGame();
    },

    renderGame: function() {
        Skelos.screen = "game";
        var st = Skelos.state, t = Skelos.t, e = Skelos.esc, solo = st.mode == "solo";
        var h = "<div class='skelos-game" + (solo ? " solo" : "") + "'>";

        // Panneau au-dessus de la Rivière : défini par la couche d'interface (skelos_ui.js).
        h += "<div class='sk-board'" + (Skelos.boardBgStyle ? Skelos.boardBgStyle() : "") + ">" + Skelos.panelCode();

        h += "<div class='sk-river'>";
        for (var i = 0; i < Skelos.RIVER_SIZE; i++) {
            var s = st.river[i];
            h += "<div class='sk-slot" + (s && s.uid == Skelos.selected ? " sel" : "") + (s && s.uid == st.highlight ? " hl" : "") + "'>";
            h += "<div class='sk-cost'>" + (solo ? (s ? "<span class='sk-token" + (st.removed.indexOf(s.uid) >= 0 ? " gone" : "") + "'>" + s.token + "</span>" : "") : Skelos.costToken(s, i)) + "</div>";
            if (s) {
                h += "<div class='sk-tilebox" + (s.dead ? " dead" : "") + "' role='button' tabindex='0' data-act='select' data-uid='" + s.uid + "' aria-label='" + e(Skelos.tileName(s)) + "'>" + Skelos.tileCode(s)
                    + (s.dead ? "<span class='sk-deadmark'>" + t("dead") + "</span>" : "")
                    + (s.lpMax && !s.dead ? Skelos.hpBadge(s) : "") + "</div>";
            } else h += "<div class='sk-empty'></div>";
            h += "</div>";
        }
        h += "</div>";
        h += "</div>";

        // Plus de panneau du bas : détails et actions des tuiles par appui long (menu contextuel), notes et actions dans le Journal.
        h += "</div><div class='sk-overlay' id='sk-overlay'></div><div class='sk-toast' id='sk-toast' role='status'></div><div class='sk-tip' id='sk-tip' role='tooltip'></div>";

        Skelos.root.innerHTML = h;
        Skelos.bindGame();
        if (Skelos.inCompanion && Skelos._lastScreen != "game") Skelos.root.scrollTop = 0;
        Skelos._lastScreen = "game";
    },

    // Pion de coût d'une case : il passe au rouge quand la tuile sélectionnée peut être activée ; un appui paie et active.
    canActivate: function(slot) {
        var st = Skelos.state, cost = st.river.indexOf(slot) + 1;
        if (st.phase != "overlord") return Skelos.t("activate_only_overlord");
        if (st.activations >= st.maxActivations) return Skelos.t("too_many_activations", st.maxActivations);
        if (st.energy < cost) return Skelos.t("not_enough", cost, st.energy);
        return null;
    },

    costToken: function(slot, i) {
        var t = Skelos.t, e = Skelos.esc;
        if (!slot) return "<span class='sk-costtok'><span>" + (i + 1) + "</span></span>";
        var sel = slot.uid == Skelos.selected, why = sel ? Skelos.canActivate(slot) : null, armed = sel && !why;
        return "<span class='sk-costtok" + (armed ? " armed" : "") + "' data-act='paycost' data-uid='" + slot.uid + "'"
            + (sel ? " role='button' tabindex='0' aria-label='" + e(armed ? t("activate_named", Skelos.tileName(slot), i + 1) : why) + "'" : "") + ">"
            + "<span>" + (i + 1) + "</span>" + (armed ? "<i class='sk-costgem' aria-hidden='true'></i>" : "") + "</span>";
    },

    fixDice: function(s) {
        return String(s || "").replace(/\{dice_(\w+)\}/g, function(m, c) { return {red: Skelos.t("die_red"), orange: Skelos.t("die_orange"), yellow: Skelos.t("die_yellow")}[c] || m; });
    },

    // Appui long (iPad) ou survol (souris) : description des compétences ; appui long sur le cœur : −1 point de vie.
    bindPress: function(container) {
        var timer = null, startX = 0, startY = 0, target = null;
        var cancel = function() { clearTimeout(timer); timer = null; };
        container.addEventListener("pointerdown", function(ev) {
            Skelos._suppressClick = false;
            if (ev.pointerType == "mouse" && ev.button != 0) return;
            var hp = ev.target.closest("[data-hp]"), sk = ev.target.closest("[data-skill]"), cd = ev.target.closest("[data-card]");
            target = hp || cd || (ev.pointerType != "mouse" ? sk : null);
            if (!target) return;
            startX = ev.clientX; startY = ev.clientY;
            cancel();
            timer = setTimeout(function() {
                timer = null;
                Skelos._suppressClick = true;
                if (target.dataset.hp) Skelos.openHp(target.dataset.hp);
                else if (target.dataset.card) Skelos.showCard(target.dataset.card);
                else Skelos.showTip(target);
            }, 450);
        });
        container.addEventListener("pointermove", function(ev) {
            if (timer && (Math.abs(ev.clientX - startX) > 10 || Math.abs(ev.clientY - startY) > 10)) cancel();
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach(function(n) { container.addEventListener(n, cancel); });
        container.addEventListener("contextmenu", function(ev) { if (ev.target.closest(".tile, [data-hp], [data-card]")) ev.preventDefault(); });
        container.addEventListener("mouseover", function(ev) {
            var sk = ev.target.closest("[data-skill]");
            if (sk) Skelos.showTip(sk); else if (!ev.target.closest(".sk-tip")) Skelos.hideTip();
        });
        container.addEventListener("click", function(ev) {
            if (Skelos._suppressClick) { Skelos._suppressClick = false; ev.stopPropagation(); ev.preventDefault(); return; }
            if (!ev.target.closest("[data-skill], .sk-tip")) Skelos.hideTip();
            var d = ev.target.closest("[data-hpdelta]");
            if (d && Skelos._hpOpen == d.dataset.uid) {
                ev.stopPropagation(); ev.preventDefault();
                Skelos.life(d.dataset.uid, +d.dataset.hpdelta);
                return;
            }
            if (Skelos._hpOpen && !ev.target.closest("[data-hpwrap='" + Skelos._hpOpen + "']")) Skelos.closeHp();
        }, true);
        container.addEventListener("keydown", function(ev) {
            if (ev.key == "Escape") { Skelos.closeHp(); Skelos.hideTip(); return; }
            if ((ev.key == "Enter" || ev.key == " ") && ev.target.matches("[data-hp]")) { ev.preventDefault(); Skelos.openHp(ev.target.dataset.hp); return; }
            if ((ev.key == "Enter" || ev.key == " ") && ev.target.matches("[data-act=select], [data-act=paycost]")) { ev.preventDefault(); ev.target.click(); }
        });
    },

    showTip: function(el) {
        var sk = Skelos.skillById(el.dataset.skill); if (!sk) return;
        var tip = Skelos.root.querySelector("#sk-tip");
        var solo = (Skelos.state && Skelos.state.mode == "solo") || Skelos.prefs().alwaysSolo;
        tip.innerHTML = "<b>" + Skelos.esc(sk.title) + "</b><p>" + Skelos.esc(Skelos.fixDice(sk.text)) + "</p>"
            + (solo && sk.clarification ? "<p class='sk-solo'>" + Skelos.esc(Skelos.fixDice(sk.clarification)) + "</p>" : "");
        tip.classList.add("on");
        var b = el.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 16);
        tip.style.width = w + "px";
        var left = Math.max(8, Math.min(b.right + 8, window.innerWidth - w - 8));
        if (left < b.right && b.left - w - 8 >= 8) left = b.left - w - 8;
        var top = Math.max(8, Math.min(b.top, window.innerHeight - tip.offsetHeight - 8));
        tip.style.left = left + "px"; tip.style.top = top + "px";
    },

    hideTip: function() {
        var tip = Skelos.root && Skelos.root.querySelector("#sk-tip");
        if (tip) tip.classList.remove("on");
    },

    bindGame: function() {
        var r = Skelos.root;
        if (!Skelos._pressBound) { Skelos.bindPress(r); Skelos._pressBound = true; }
        r.querySelector(".skelos-game").addEventListener("click", function(ev) {
            var b = ev.target.closest("[data-act]"); if (!b) return;
            if (ev.target.closest(".sk-hpwrap")) return;
            var uid = b.dataset.uid, n = +b.dataset.n;
            switch (b.dataset.act) {
                case "select":
                    Skelos.selected = (Skelos.selected == uid ? null : uid);
                    Skelos.renderGame(); break;
                case "activate": Skelos.activate(uid); break;
                case "paycost":
                    if (uid != Skelos.selected) break;
                    var why = Skelos.canActivate(Skelos.slotByUid(uid));
                    if (why) Skelos.toast(why); else Skelos.activate(uid);
                    break;
                case "draw": Skelos.drawToken(); break;
                case "spend": Skelos.spend(n); break;
                case "boost": Skelos.boost(b.dataset.k); break;
                case "oend": Skelos.endOverlordTurn(); break;
                case "purge": Skelos.purge(uid); break;
                case "adj": Skelos.adjust(b.dataset.f, n); break;
                case "turnplus": Skelos.adjust("turn", 1); break;
                case "turnminus": if (Skelos.state.turn > 0) Skelos.adjust("turn", -1); break;
                case "oturn": Skelos.overlordTurn(); break;
                case "undo": Skelos.undo(); break;
                case "dead": Skelos.markDead(uid); break;
                case "reinf": Skelos.reinforce(uid); break;
                case "rmtoken": Skelos.removeToken(uid); break;
                case "lp": Skelos.life(uid, n); break;
                case "setup": Skelos.openGameMenu(b); break;
                case "xfer": Skelos.transferGem(b.dataset.dir); break;
            }
        });
    },

    toast: function(msg) {
        var el = Skelos.root.querySelector("#sk-toast");
        if (!el) { alert(msg); return; }
        el.textContent = msg; el.classList.add("on");
        clearTimeout(Skelos._toastTimer);
        Skelos._toastTimer = setTimeout(function() { el.classList.remove("on"); }, 3200);
    }
};
