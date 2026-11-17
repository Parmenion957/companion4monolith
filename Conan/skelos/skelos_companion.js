// Livre de Skelos : module de suivi du plateau de l'Overlord pour le Compagnon de Conan.
// Code sous licence LGPL-3.0, comme le Compagnon. Images et données du jeu : Monolith, avec l'autorisation accordée au Compagnon ;
// le module reprend celles du Compagnon (Encyclopedia, Tile, CardEquipment, CardSpell) et ajoute les fonds du livre (img/fond/).
// Branchement du Livre de Skelos dans le Compagnon : entrée de menu, données et préférences communes.
Skelos.inCompanion = true;
Skelos.companionInit = function()
{
    Nav.addIcon(Skelos._i18n.menu, "skelos-icon", "skelos");
    Nav.addAction("skelos", Skelos._i18n.xfer_export, "skelos-export-icon", "skelos-export", function() { Skelos.openExport(); });
    Nav.addAction("skelos", Skelos._i18n.xfer_import, "skelos-import-icon", "skelos-import", function() { Skelos.openImport(); });
    Nav.addAction("skelos", Skelos._i18n.theme_toggle, "skelos-theme-icon", "theme", function() { Skelos.toggleTheme(); });
    Nav.addAction("skelos", Skelos._i18n.fullscreen, "skelos-fullscreen-icon", "fullscreen", function() { Skelos.toggleFullscreen(); });
    Nav.addAction("skelos", Skelos._i18n.settings, "skelos-settings-icon", "settings", function() { if (Skelos.root) Skelos.renderSettings(); });
    var started = false;
    var start = function() {
        if (started) return;
        // Les données de l'encyclopédie se chargent en arrière-plan : on attend qu'elles soient prêtes.
        if (!Encyclopedia.tiles || !Encyclopedia.skills || !Encyclopedia.equipments || !Encyclopedia.spells) { setTimeout(start, 200); return; }
        started = true;
        var host = document.getElementById("skelos");
        host.classList.add("skelos-host");
        // Le panneau du bas se pose au-dessus de la barre de navigation du Compagnon.
        var fit = function() {
            var bar = document.querySelector("#" + Nav._id), h = 0;
            if (bar) { var r = bar.getBoundingClientRect(); if (r.bottom >= window.innerHeight - 2 && r.top > window.innerHeight / 2) h = r.height; }
            document.documentElement.style.setProperty("--sk-bottom", h + "px");
        };
        fit(); window.addEventListener("resize", fit);
        Skelos.init(document.getElementById("skelos"));
    };
    $("#skelos").on("show", start);
    if ($("#skelos").is(".active")) start();
};
Utils._toInitialize.push(Skelos.companionInit);
