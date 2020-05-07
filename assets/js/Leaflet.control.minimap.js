/*!
 * Original resources from: 
 * Leaflet Fullscreen (https://github.com/Leaflet/Leaflet.fullscreen)
 * Licensed under ISC (https://github.com/Leaflet/Leaflet.fullscreen/blob/gh-pages/LICENSE)
 */

(function () {

    L.Control.Minimap = L.Control.extend({
        options: {
            position: 'topleft',
            title: {
                'false': 'Shrink to minimap',
                'true': 'Fullscreen map'
            }
        },

        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control-minimap leaflet-bar leaflet-control');

            this.link = L.DomUtil.create('a', 'leaflet-control-minimap-button leaflet-bar-part', container);
            this.link.href = '#';

            this._map = map;
            this._map.on('mapsizechange', this._toggleTitle, this);
            this._toggleTitle();

            L.DomEvent.on(this.link, 'click', this._click, this);

            return container;
        },

        _click: function (e) {
            L.DomEvent.stopPropagation(e);
            L.DomEvent.preventDefault(e);
            this._map.toggleMinimap(this.options);
        },

        _toggleTitle: function () {
            this.link.title = this.options.title[this._map.isMinimap()];
        }
    });

    L.Map.include({
        isMinimap: function () {
            return $(this.getContainer().parentElement).hasClass('widget-minimap');
        },

        isInTransition: function () {
            return this._inTransition;
        },

        toggleMinimap: function (options) {
            this._inTransition = true;
            $(this.getContainer().parentElement).toggleClass('widget-minimap');
            this.fire('mapsizechange');
        },
    });

    L.Map.mergeOptions({
        minimapControl: true
    });

    L.Map.addInitHook(function () {
        if (this.options.minimapControl) {
            this.minimapControl = new L.Control.Minimap(this.options.minimapControl);
            this.addControl(this.minimapControl);
        }
        $(this.getContainer().parentElement).on('transitionend', () => { this._inTransition = false; })
    });

    L.control.minimap = function (options) {
        return new L.Control.Minimap(options);
    };
})();