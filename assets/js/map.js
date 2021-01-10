'use strict';

/**
 * Classes: point, line, layerGroup, controlGroup, mapViewer
 * 
 * Usage:
 * Call create*, delete* and update* on an instance of the mapViewer class to manipulate
 * points, lines, layerGroups and controlGroups.
 *
 * Implementation details:
 * Interface to leaflet.
 * controlGroup > layerGroup > point form a hierarchy
 * lines are contained in a separate layer
 * */

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: point
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Visual representation of a vertex on the map.
 * Style depends on the type of the vertex.
 * */
class point {
    get [Symbol.toStringTag]() {
        return 'Point';
    }

    /**
     * @constructor
     * @param {vertex} v
    * @param {string} type
    * @param {json} options
     */
    constructor(v, type, options = {}) {
        this.vertex = v;
        v.point = this;

        if (type === this.EDIT) {
            this.layer = new L.Marker(v.coordinates, options);
        } else {
            this.layer = new L.circleMarker(v.coordinates, options);
        }
        this.type = type;
    }

    /**
     * @returns {[Number]}
     */
    getCoordinates() {
        return latLngToCoords(this.layer.getLatLng());
    }

    /**
     * 
     * @param {string} type
     * @param {EventListener | Function} listener
    * @param {boolean} [useCapture]
     */
    addEventListener(type, listener, useCapture) {
        this.layer.addEventListener(type, (e) => { e.target = this; listener(e); }, useCapture);
    }

    /**
 * 
 * @param {[Number]} coords
 */
    setCoordinates(coords) {
        this.layer.setLatLng(coordsToLatLng(coords));
    }

    /**
    * @returns {[line]}
    */
    getLines() {
        var lines = [];
        this.vertex.forEach(e => {
            if (e.line)
                lines.push(e.line);
        });

        return lines;
    }
}

point.prototype.PANORAMA = 'panorama';
point.prototype.PLACEHOLDER = 'placeholder';
point.prototype.EDIT = 'edit';
point.prototype.LANDMARK = 'landmark';

point.prototype.COORDINATES = 'coordinates';


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: line
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Visual representation of an edge on the map.
 * Style depends on the type of the edge.
 * */
class line {
    get [Symbol.toStringTag]() {
        return 'Line';
    }

    /**
     * 
     * @param {edge} e
     * @param {string} type
     * @param {json} options
     */
    constructor(e, type, options = {}) {
        this.edge = e;
        e.line = this;
        if (e.opposite != null)
            e.opposite.line = this;

        this.layer = new L.Polyline([e.from.coordinates, e.to.coordinates], options);
        this.type = type;
    }

    /**
     * @returns {[[Number]]}
     */
    getCoordinates() {
        return latLngsToCoords(this.layer.getLatLngs());
    }

    /**
     * 
     * @param {string} type
     * @param {EventListener | Function} listener
    * @param {boolean} [useCapture]
     */
    addEventListener(type, listener, useCapture) {
        this.layer.addEventListener(type, (e) => { e.target = this; listener(e); }, useCapture);
    }

    /**
     * 
     * @param {[[Number]]} coords
     * @returns {layer}
     */
    setCoordinates(coords) {
        return this.layer.setLatLngs(coordsToLatLngs(coords));
    }
}

line.prototype.ROUTE = 'route'; // edge is part of a tour
line.prototype.TEMP = 'temp'; // edge is created for temporary display
line.prototype.EDIT = 'edit';
line.prototype.LANDMARK = 'landmark';
line.prototype.SPATIAL = 'spatial';


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: controlGroup
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Visual representation of a temporal group on the map.
 * Used to show / hide contained points
 * */
class controlGroup {
    /**
     *
     * @param {spatialGroup} g
     */
    constructor(g) {
        this.label = g.name;
        this.temporalGroup = g;
        g.controlGroup = this;
        this.layer = new L.featureGroup();
    }

    /**
 * 
 * @param {string} type
 * @param {EventListener | Function} listener
* @param {boolean} [useCapture]
 */
    addEventListener(type, listener, useCapture) {
        this.layer.addEventListener(type, (e) => { e.target = this; listener(e); }, useCapture);
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: layerGroup
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Representation of a spatialGroup on the map.
 * Aggregates points.
 * */
class layerGroup {
    /**
     *
     * @param {spatialGroup} g
     */
    constructor(g) {
        this.spatialGroup = g;
        g.layerGroup = this;

        this.layer = new L.featureGroup();
    }

    /**
 * 
 * @param {string} type
 * @param {EventListener | Function} listener
* @param {boolean} [useCapture]
 */
    addEventListener(type, listener, useCapture) {
        this.layer.addEventListener(type, (e) => { e.target = this; listener(e); }, useCapture);
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: background
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Background for a spatialGroup on the map.
 * */
class background {
    /**
     *
     * @param {JSON} config
     */
    constructor(config) {
        $.extend(this, config);
        this.layer = new L.featureGroup();
        this.shownSpatialGroups = [];
    }

    /**
 * @returns {object} with attributes directory, path, prefix, file, width, height
 * */
    getImageConfig() {
        return {
            directory: this.image.directory,
            path: this.image.path,
            file: this.image.file,
            height: this.img ? this.img.height : this.image.height,
            width: this.img ? this.img.width : this.image.width,
            img: this.image.file ? this.image.file.img : undefined
        };
    }

    getThumbConfig() {
        return null;
    }

    /**
     * @returns {Boolean}
     * */
    hasShownSpatialGroups() {
        return this.shownSpatialGroups.length;
    }

    /**
     * 
     * @param {spatialGroup} sg
     */
    addSpatialGroup(sg) {
        if (this.shownSpatialGroups.indexOf(sg) == -1)
            this.shownSpatialGroups.push(sg);
    }

    /**
 * 
 * @param {spatialGroup} sg
 */
    removeSpatialGroup(sg) {
        let idx = this.shownSpatialGroups.indexOf(sg);
        if (idx != -1)
            this.shownSpatialGroups.splice(idx, 1);
    }


    /**
     * 
     * @param {[[Number]]} corners
     */
    setCorners(corners) {
        this.corners = corners;
        if (this.markers) {
            this.imageLayer.reposition(...this.corners);
            this.markers.forEach((m, i) => {
                m.setLatLng(this.corners[i]);
            });
        }
    }

    /**
     * 
     * @param {Number} value
     */
    setOpacity(value) {
        this.opacity = value;
        if (this.imageLayer)
            this.imageLayer.setOpacity(value);
    }

    /**
 * 
 * @param {string} type
 * @param {EventListener | Function} listener
* @param {boolean} [useCapture]
 */
    addEventListener(type, listener, useCapture) {
        this.layer.addEventListener(type, (e) => { e.target = this; listener(e); }, useCapture);
    }

    toJSON() {
        return {
            corners: this.corners,
            opacity: this.opacity,
            label: this.label,
            image: algorithms.extractAtomicProperties(this.image)
        };
    }
}

background.prototype.CORNERS = "corners";
background.prototype.OPACITY = "opacity";


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: mapViewer
//
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Listen to events: this.observe(<class>, <action>).subscribe(elem => / do something with element here /)
 * where <class> in {line, point, layerGroup, controlGroup}
 * <action> in {this.CREATE, this.DELETE, this.SHOW, this.HIDE, this.CLICK}
 * special combinations (this.COORDINATES, this.GPS), (point, this.DRAG), (this.COORDINATES, this.CLICK)
 * */
class mapViewer extends observable {
    get [Symbol.toStringTag]() {
        return 'Map Viewer';
    }

    /**
    *
    * @param {string} domElement
    * @param {filesystem} modules.filesys
    *
    **/
    constructor(domElement, modules, config) {
        super();
        this.config = config;
        this.modules = modules;
        this.map = new L.Map(domElement, config.options);

        let parent = this.map.getContainer().parentElement;

        parent.addEventListener('transitionend', () => {
            this.map.invalidateSize();
            if (this.pendingAnimation)
                this.pendingAnimation();

            delete this.pendingAnimation;
        });


        //layer to map element lookup
        this.layers = new Map();
        this.backgrounds = new Map();
        this.locationLayer = new L.featureGroup();

        if (this.config.fieldOfView) {
            this.fieldOfView = {
                layer: new L.featureGroup(),
                line: L.polyline([], this.config.fieldOfView),
            }
            this.fieldOfView.line.addTo(this.fieldOfView.layer);
            if (this.config.fieldOfView.fillColor)
                var fillConfig = $.extend({}, this.config.fieldOfView, {
                    opacity: 0
                });
            this.fieldOfView.fill = L.polygon([], fillConfig);
            this.fieldOfView.fill.addTo(this.fieldOfView.layer);
        }

        this.lineGroup = new L.featureGroup();
        this.lineGroup.setZIndex(10);
        this.lineGroup.addEventListener('add', event => {
            this.lineGroup.bringToBack();
        });
        this.backgroundGroup = null; // will be created when adding the first background

        // initialize tile grid with offline capabilities
        var tileLayers = config.tileLayers.map(
            l => {
                var arg0, arg1;
                if (l.url) {
                    arg0 = l.url;
                    arg1 = l.options;
                } else {
                    arg0 = l.options;
                }
                var constr = L[l.base];
                var ctx = L;

                if (constr == null)
                    console.error(this.ERROR.UNDEFINED_NAMESPACE, "", l.base);

                if (l.plugin) {
                    ctx = constr;
                    constr = constr[l.plugin];

                    if (constr == null)
                        console.error(this.ERROR.UNDEFINED_NAMESPACE, "", l.base + "." + l.plugin);
                }

                return {
                    label: l.label,
                    offline: l.plugin === "offline",
                    layer: constr.bind(ctx)(arg0, arg1).addTo(this.map)
                };
            }
        );


        // set up structure for layer control panel
        this.baseTree = {
            label: 'BaseLayers',
            noShow: true,
            children: tileLayers
        };

        this.overlayTree = [];
        if (this.config.findAccuratePosition)
            this.overlayTree.push({
                label: this.config.strings.location,
                layer: this.locationLayer
            });

        if (this.fieldOfView) {
            this.overlayTree.push({
                label: this.config.strings.fieldOfView,
                layer: this.fieldOfView.layer
            });

            this.fieldOfView.layer.addTo(this.map) // show on startup
        }

        this.overlayTree.push({
            label: this.config.strings.connections,
            layer: this.lineGroup
        });
        this.layerControl = L.control.layers.tree(this.baseTree, this.overlayTree, config.tree);
        this.layerControl.addTo(this.map).collapseTree().expandSelected();


        // set up event listeners for storing tiles
        tileLayers.forEach(tl => {
            this.layers.set(tl.layer, tl);

            setTimeout(function () {
                //Remove Google Maps overlay "Do you own this site?"
                //The overlay "For development purpose" is not removed because otherwise reloading tiles fails
                if (tl.layer._mutantContainer && tl.layer._mutantContainer.children.length) {
                    for (var c of tl.layer._mutantContainer.children)
                        if (c.children.length > 1)
                            c.hidden = true;
                }
            }, 5000);

            //events while saving a tile layer

            var progress;
            tl.layer.on('savestart', e => {
                progress = 0;
                $('#save-tiles-progress').text(progress);
                $('#save-tiles-total').text(e._tilesforSave.length);
                $('#save-tiles-dialog').modal('show');
            });
            tl.layer.on('savetileend', e => {
                progress++;
                $('#save-tiles-progress').text(progress);
            });


            tl.layer.on('loadend', e => {
                if (($("#save-tiles-dialog").data('bs.modal') || {}).isShown)
                    $('#save-tiles-dialog').modal('hide');
                else
                    alert(this.config.strings.savedAllTiles);
            });
            tl.layer.on('tilesremoved', e => {
                alert(this.config.strings.removedAllTiles);
            });
        });

        // events when toggling visibility of layers or clicking features
        this.map.addEventListener('click', e => this.emit(latLngToCoords(e.latlng), this.CLICK, this.COORDINATES));
        this.map.addEventListener('layeradd', e => {
            let elem = this.layers.get(e.layer);
            if (elem)
                this.emit(elem, this.SHOW);
            if (e.layer == this.locationLayer)
                this.map.findAccuratePosition(this.config.findAccuratePosition);

        });
        this.map.addEventListener('layerremove', e => {
            let elem = this.layers.get(e.layer);
            if (elem instanceof layerGroup)
                if (elem)
                    this.emit(elem, this.HIDE);
        });
        this.map.addEventListener('baselayerchange', e => {
            if (this.controlSaveTiles) {
                this.map.removeControl(this.controlSaveTiles);
            }
            this.controlSaveTiles = null;
            let l = this.layers.get(e.layer);
            if (l.offline) {
                this.controlSaveTiles = L.control.savetiles(l.layer, this.config.saveTilesControl);
                this.controlSaveTiles.addTo(this.map);
            }

            setTimeout(function () {
                //Remove Google Maps overlay "Do you own this site?"
                //The overlay "For development purpose" is not removed because otherwise reloading tiles fails
                if (l.layer._mutantContainer && l.layer._mutantContainer.children.length) {
                    for (var c of l.layer._mutantContainer.children)
                        if (c.children.length > 1)
                            c.hidden = true;
                }
            }, 1000);
        });

        setTimeout(() => this.map.invalidateSize(), 1000);

        // GPS position marking
        var locationCircle;
        var locationMarker;
        var markLocation = (e) => {
            var radius = e.accuracy / 2;

            if (locationCircle) {
                locationCircle.remove();
                locationMarker.remove();
                this.locationLayer.removeLayer(locationCircle);
                this.locationLayer.removeLayer(locationMarker);
            }

            locationCircle = L.circle(e.latlng, Object.assign({}, this.config.point.location, { radius: radius })).addTo(this.locationLayer);
            locationMarker = L.circleMarker(e.latlng, Object.assign({}, this.config.point.location)).addTo(this.locationLayer);

            this.emit(latLngToCoords(e.latlng), this.GPS, this.COORDINATES);
        };
        this.map.on('accuratepositionprogress', markLocation);
        this.map.on('accuratepositionfound', markLocation);

        // Field of view
        if (this.fieldOfView)
            requestAnimationFrame(() => this.updateFieldOfView());

        if (this.modules.settings.hideMap())
            $('.widget-map').hide();

        // Listen when values in configurator change
        this.modules.settings.hideMap.subscribe(hide => hide ? $('.widget-map').hide() : $('.widget-map').show()); //KoObservable
        this.modules.settings.map.zoom.subscribe(val => {
            if (val != null)
                setTimeout(() => this.setView(null, val), 0); // avoid long, blocking operation (up to 250 ms on mobile devices)
        });
        this.modules.settings.map.minZoom.subscribe(val => this.map.setMinZoom(val));
        this.modules.settings.map.maxZoom.subscribe(val => this.map.setMaxZoom(val));
        this.modules.settings.map.center.subscribe(val => {
            if (val)
                this.setView(val);
        });
        this.modules.settings.map.maxBounds.subscribe(val => this.map.setMaxBounds(val));

        this.map.on('moveend', ev => {
            delete this.moveTarget;
        });
    }

    /**
     * @returns {boolean} - in minimap status?
     * */
    isMinimap() { return this.map.isMinimap(); }

    /**
     * 
     * @param {boolean} [enable]
     */
    toggleMinimap(enable) {
        if (enable != this.isMinimap())
            this.map.toggleMinimap();
    }

    /**
     *
     * @param {line | point } elem
     */
    isVisible(elem) {
        return this.map.hasLayer(elem.layer);
    }

    /**
     * 
     * @returns [Number]
     */
    getCenter() {
        let latlng = this.map.getCenter();
        return [latlng.lat, latlng.lng];
    }

    /**
      * 
      * @returns Number
      */
    getZoom() {
        return this.map.getZoom();
    }

	/**
     * 
     * @returns [[Number]]
     */
    getBoundsArray() {
        let bounds = this.getBounds();
        return [[bounds.getSouthWest().lat, bounds.getSouthWest().lng],
        [bounds.getNorthEast().lat, bounds.getNorthEast().lng]];
    }

    /**
 * 
 * @returns {Bounds}
 */
    getBounds() {
        return this.map.getBounds()
    }

    /**
     * 
     * @param {string | background} label
     * @returns {background}
     */
    getBackground(label) {
        if (typeof label === "string") {
            var background = this.backgrounds.get(label);
        } else {
            var background = label;
        }
        if (background == null)
            throw new error(this.ERROR.NO_SUCH_BACKGROUND, null, label);

        return background;
    }

    /**
     * @returns {[background]}
     * */
    getBackgrounds() {
        return Array.from(this.backgrounds.values());
    }

    /**
     * @private
     * Used by animation frame to update field of view
     * */
    updateFieldOfView() {
        if (!this.modules.panorama || this.modules.panorama.getAzimuth() == null || this.modules.panorama.getHfov() == null || !this.config.fieldOfView || !this.config.fieldOfView.radius) {
            requestAnimationFrame(() => this.updateFieldOfView());
            return;
        }

        var azimuth = this.modules.panorama.getAzimuth() / 180 * Math.PI;
        var aov = this.modules.panorama.getHfov() / 180 * Math.PI;
        var centerCoords = this.modules.panorama.getVertex().coordinates;
        var centerPoint = this.map.latLngToContainerPoint(coordsToLatLng(centerCoords));
        var minBearing = azimuth - aov / 2;
        if (minBearing < -Math.PI)
            minBearing += 2 * Math.PI;
        var maxBearing = azimuth + aov / 2;
        if (maxBearing > Math.PI)
            maxBearing -= 2 * Math.PI;

        var lineStart = new L.Point(Math.sin(minBearing) * this.config.fieldOfView.radius + centerPoint.x, -Math.cos(minBearing) * this.config.fieldOfView.radius + centerPoint.y);
        var lineEnd = new L.Point(Math.sin(maxBearing) * this.config.fieldOfView.radius + centerPoint.x, -Math.cos(maxBearing) * this.config.fieldOfView.radius + centerPoint.y);
        var points = [this.map.containerPointToLatLng(lineStart), this.map.containerPointToLatLng(centerPoint), this.map.containerPointToLatLng(lineEnd)];

        this.fieldOfView.line.setLatLngs(points);
        if (this.fieldOfView.fill)
            this.fieldOfView.fill.setLatLngs(points);

        requestAnimationFrame(() => this.updateFieldOfView());
    }

    /**
 * Derives the container from the corresponding model elements
 * 
 * @private
 * @param {controlGroup | spatialGroup | point | background} mapelem
* @returns {controlGroup | layerGroup}
 */
    deriveParent(mapelem) {
        if (mapelem instanceof background) {
            if (!this.backgroundGroup && this.config.strings.backgrounds) {
                this.backgroundGroup = new L.featureGroup();
                this.backgroundGroup.addTo(this.map);
                this.overlayTree.push({
                    label: this.config.strings.backgrounds,
                    layer: this.backgroundGroup
                });
                this.updateLayerTree();
            }
            return { layer: this.backgroundGroup };
        }


        var elem = mapelem.vertex || mapelem.spatialGroup || mapelem.temporalGroup;
        if (elem == null)
            throw new error(this.ERROR.INVALID_MODEL_OBJECT, null, mapelem);

        else if (elem instanceof vertex) {
            return elem.spatialGroup.layerGroup;
        } else if (elem.superGroup) {
            return elem.superGroup.controlGroup;
        }

        return null;
    }

    /**
 *
 * @private
 * @param {controlGroup | spatialGroup | point | background} elem
 */
    addToDerivedParent(elem) {
        elem.parent = this.deriveParent(elem);
        elem.layer.addTo(elem.parent ? elem.parent.layer : this.map);
        if (elem instanceof controlGroup) {
            var container;
            if (elem.parent) {
                container = elem.parent.children = elem.parent.children || [];
            } else {
                container = this.overlayTree;
            }
            container.push(elem);
        }
    }

    /**
     * @private
     * @param {controlGroup} cg
     */
    removeFromParentControlGroup(cg) {
        if (cg.parent) {
            let containerArray = cg.parent.children;
            let index = containerArray.indexOf(cg);
            if (index !== -1) {
                containerArray.splice(index, 1);
            }
            if (cg.parent.children.length === 0) {
                delete cg.parent.children;
            }
        } else {
            let containerArray = this.overlayTree;
            let index = containerArray.indexOf(cg);
            if (index !== -1) {
                containerArray.splice(index, 1);
            }
        }
        cg.parent = null;
    }

    /**
 * @private
 * @param {controlGroup | spatialGroup | point | line} elem
 */
    removeFromParent(elem) {
        if (elem.parent != null) {
            elem.parent.layer.removeLayer(elem.layer);
        }
        if (elem instanceof controlGroup) { // parent can be null if it is overlayTree
            this.removeFromParentControlGroup(elem);
        }

        elem.parent = null;
    }

    /**
     *
     * @param {temporalGroup} g
     * @returns {controlGroup}
     */
    createControlGroup(g) {
        if (g.controlGroup != null)
            return g.controlGroup;

        var cg = new controlGroup(g);
        this.addToDerivedParent(cg);
        this.updateLayerTree();
        this.layers.set(cg.layer, cg);
        this.emit(cg, this.CREATE);
        return cg;
    }

    /**
     *
     * @param {spatialGroup} g
     * @returns {layerGroup}
     */
    createLayerGroup(g) {
        if (g.layerGroup != null)
            return g.layerGroup;

        var initClustering = false;
        if (!this.markerGroup) {
            initClustering = true;
            this.markerGroup = new L.markerClusterGroup.layerSupport(this.config.markerClusterGroup);
        }

        var lg = new layerGroup(g);
        //       this.addToDerivedParent(lg);
        this.layers.set(lg.layer, lg);

        if (this.config.markerClusterGroup)
            this.markerGroup.checkIn(lg.layer);

        if (initClustering)
            this.markerGroup.addTo(this.map);

        this.emit(lg, this.CREATE);

        return lg;
    }

    /**
     * 
     * @param {vertex} v
    * @returns {point}
     */
    createPoint(v, config = {}) {
        if (v.point != null)
            return v.point;

        var type = config.type || v.type;
        var cfg = this.config.point[type];
        if (cfg && platform.isMobile && this.config.mobile)
            cfg = $.extend({}, cfg, this.config.mobile);
        let p = new point(v, type, cfg);

        let self = this;

        //listen to events
        if (this.config.point[type].draggable) {
            p.addEventListener('dragstart', (event) => {
                this.modules.hist.commit();
                /** @type {point}*/
                let p = event.target;
                self.startUpdate(p, p.COORDINATES);
            });

            p.addEventListener('drag', (event) => {
                /** @type {point}*/
                let p = event.target;
                p.vertex.forEach(self.updateLineCoordinates.bind(self));
                self.emit(event.target, self.DRAG);
            });

            p.addEventListener('dragend', (event) =>
                self.endUpdate(p, p.COORDINATES));
        }
        let id = v.id;
        var listener = e => this.emit(p, this.CLICK);
        p.addEventListener('add', event => {
            (p.layer._path || p.layer._marker || p.layer).addEventListener('click', listener);
            p.vertex.forEach(e => {
                if (e.line && e.to.point && this.isVisible(e.to.point)) {
                    e.line.layer.addTo(this.lineGroup);
                    if (e.line.layer._map)
                        e.line.layer.bringToBack();
                }
            });
        });

        p.addEventListener('remove', event => {
            (p.layer._path || p.layer._marker || p.layer).removeEventListener('click', listener);
            p.vertex.forEach(e => {
                if (e.line)
                    this.lineGroup.removeLayer(e.line.layer);
            });
        });

        this.addToDerivedParent(p); // trigger add event handler
        this.layers.set(p.layer, p);

        if (p.layer.bringToFront != null)
            p.layer.bringToFront();


        this.emit(p, this.CREATE);
        return p;
    }

    /**
     * 
     * @param {edge} e
    * @returns {line}
     */
    createLine(e, config = {}) {
        if (e.line != null)
            return e.line;

        if (e.type === edge.prototype.TEMPORAL)
            return null;

        var type = config.type || e.type;
        if (type === edge.prototype.TEMP)
            type = line.prototype.EDIT;

        let self = this;
        let l = new line(e, type, this.config.line[type]);
        this.layers.set(l.layer, l);

        if (e.from.point && e.to.point &&
            this.isVisible(e.from.point) && this.isVisible(e.to.point))
            l.layer.addTo(this.lineGroup);

        if (l.layer.bringToBack != null)
            l.layer.bringToBack();

        if (l.type === line.prototype.EDIT || l.type === line.prototype.LANDMARK) {
            l.addEventListener('click', (event) =>
                self.emit(event.target, self.CLICK));
        }

        this.emit(l, this.CREATE);
        return l;
    }

    /**
     * 
     * @param {JSON} config
     */
    createBackground(config) {
        var b = this.backgrounds.get(config.label);
        if (b != null)
            return b;

        b = new background($.extend({}, this.config.background.image, config));

        this.modules.filesys.prepareFileAccess(b)
            .mergeMap(() => b.image.file.readAsDataURL())
            .do(url => {
                b.imageLayer = L.imageOverlay.rotated(url, b.corners[0], b.corners[1], b.corners[2], b)
                    .addTo(b.layer);
            })
            .catch((err, caught) => {
                console.log(err);
                this.modules.logger.log(err);
                return Rx.Observable.empty();
            }).subscribe();

        this.backgrounds.set(b.label, b);
        this.layers.set(b.layer, b);
        this.emit(b, this.CREATE);

        return b;

    }

    /**
     *
     * @param {spatialGroup} g
     * @returns {layerGroup}
     */
    showLayerGroup(g) {
        if (g.layerGroup == null)
            this.createLayerGroup(g);

        this.addToDerivedParent(g.layerGroup);

        // globally done on map
        //        this.emit( g.layerGroup, this.SHOW);
        return g.layerGroup;
    }

    /**
 *
 * @param {spatialGroup} g
 * @returns {layerGroup}
 */
    hideLayerGroup(g) {
        if (g.layerGroup == null)
            return;

        this.removeFromParent(g.layerGroup);

        // globally done on map
        //        this.emit( g.layerGroup, this.HIDE);

        return g.layerGroup;
    }

    /**
 * 
 * @param {background} b
 */
    showBackground(b) {
        this.addToDerivedParent(b);
    }

    /**
     * 
     * @param {background} b
     */
    hideBackground(b) {
        this.removeFromParent(b);
    }

    /**
     * @private
     * @param {vertex} fix
    * @returns {function(vertex,vertex) : number}
     */
    distanceComp(fix) {
        return (left, right) => {
            return this.map.distance(left.coordinates, fix.coordinates) - this.map.distance(right.coordinates, fix.coordinates);
        };
    }

    /**
     * 
     * @param {vertex} v
    * @returns {point}
     */
    updatePointCoordinates(v) {
        if (v.point == null)
            return;

        var coordinates = v.point.getCoordinates();
        if (!recursiveCompare(v.coordinates, coordinates)) {

            this.startUpdate(v.point, v.point.COORDINATES);
            v.point.setCoordinates(v.coordinates);
            this.endUpdate(v.point, v.point.COORDINATES);

            v.forEach(e => this.updateLineCoordinates(e));
        }

        return v.point;
    }

    /**
     * 
     * @param {edge} e
    * @returns {line}
     */
    updateLineCoordinates(e) {
        if (e.line == null)
            return e.line;

        let targetCoords = [e.from.point.getCoordinates(), e.to.point.getCoordinates()];
        if (!recursiveCompare(e.line.getCoordinates(), targetCoords)) {
            e.line.setCoordinates(targetCoords);
        }

        return e.line;
    }

    /**
     * 
     * @param {background} b
     * @param {[[Number]]} corners
     */
    updateCorners(b, corners) {
        if (!recursiveCompare(b.corners, corners)) {
            if (!b.dragging)
                this.startUpdate(b, b.CORNERS);
            b.setCorners(corners);
            if (!b.dragging)
                this.endUpdate(b, b.CORNERS);
        }
    }

    /**
     * 
     * @param {background} b
     * @param {Number} value
     */
    updateOpacity(b, value) {
        if (value != b.opacity) {
            this.startUpdate(b, b.OPACITY);
            b.setOpacity(value);
            this.endUpdate(b, b.OPACITY);
        }
    }

    /**
     * 
     * @param {vertex | edge | background} elem
     */
    setEditable(elem) {
        if (elem instanceof vertex) { // show point if not visible
            if (elem.point && elem.point.type === point.prototype.EDIT)
                return elem.point;
            var lines = elem.point ? elem.point.getLines() : [];
            this.deletePoint(elem);
            var p = this.createPoint(elem, { type: point.prototype.EDIT });
            lines.forEach(l => this.createLine(l.edge));
            return p;
        } else if (elem instanceof edge && elem.line && elem.line.edge === elem
            && elem.type !== edge.prototype.LANDMARK && elem.line.type !== line.prototype.EDIT) {
            this.deleteLine(elem);
            return this.createLine(elem, { type: line.prototype.EDIT });
        } else if (elem instanceof background) {
            if (!elem.markers) {
                elem.markers = elem.corners.map(c => new L.Marker(c, this.config.background.marker));
                elem.markers.forEach((m, i) => {
                    m.addEventListener('dragstart', () => {
                        this.modules.hist.commit();
                        elem.dragging = true;
                        this.startUpdate(elem, elem.CORNERS);
                    });
                    m.addEventListener('drag', (event) => {

                        var corners = $.extend(true, [], elem.corners);
                        corners[i] = latLngToCoords(event.latlng);
                        elem.setCorners(corners);
                        this.emit(elem, this.DRAG);
                    });
                    m.addEventListener('dragend', () => {
                        this.endUpdate(elem, elem.CORNERS);
                        delete elem.dragging;
                    });
                });
            }
            elem.markers.forEach(m => m.addTo(elem.layer));
            elem.editable = true;
            this.showBackground(elem);
        }
    }

    /**
     * 
     * @param {edge | vertex | background} e
     */
    unsetEditable(elem) {
        if (elem instanceof vertex && elem.point) {
            var lines = elem.point.getLines();
            this.deletePoint(elem);
            var p = this.createPoint(elem);
            lines.forEach(l => this.createLine(l.edge));
            return p;
        } else if (elem instanceof edge && elem.line && elem.line.edge === elem && elem.type !== edge.prototype.LANDMARK) {
            this.deleteLine(elem);
            return this.createLine(elem);
        } else if (elem instanceof background) {
            elem.markers.forEach(m => elem.layer.removeLayer(m));
            if (!elem.hasShownSpatialGroups())
                this.hideBackground(elem);
            elem.editable = false;
        }
    }

    /**
     *
     * @param {vertex | edge | spatialGroup | temporalGroup} elem
     * @returns {point | line | layerGroup | controlGroup}
     */
    updateParent(elem) {
        var mapelem = elem.line || elem.point || elem.layerGroup || elem.controlGroup;

        if (mapelem.parent === this.deriveParent(mapelem))
            return mapelem;

        this.startUpdate(mapelem, mapViewer.LAYER);
        this.removeFromParent(mapelem);
        this.addToDerivedParent(mapelem);
        this.updateLayerTree();

        this.endUpdate(mapelem, mapViewer.LAYER);
        return mapelem;
    }

    /**
*
* @param {temporalGroup} g
*/
    deleteControlGroup(g) {
        if (g.controlGroup == null)
            return;

        this.removeFromParent(g.controlGroup);
        g.controlGroup.layer.remove();
        this.layers.delete(g.controlGroup.layer);
        var elem = g.controlGroup;
        delete g.controlGroup;

        this.emit(elem, this.DELETE);
    }

    /**
*
* @param {spatialGroup} g
*/
    deleteLayerGroup(g) {
        if (g.layerGroup == null)
            return;

        this.removeFromParent(g.layerGroup);
        g.layerGroup.layer.remove();
        this.layers.delete(g.layerGroup.layer);
        var elem = g.layerGroup;
        delete g.layerGroup;

        this.emit(elem, this.DELETE);
    }

    /**
     *
     * @param {vertex} v
     */
    deletePoint(v) {
        if (v.point == null)
            return;

        let elem = v.point;
        v.forEach(e => this.deleteLine(e));
        this.removeFromParent(elem);
        elem.layer.remove();
        this.layers.delete(elem.layer);
        delete elem.layer;
        //        elem.getConnectedLines().forEach(this.deleteLine.bind(this));
        delete v.point;

        this.emit(elem, this.DELETE);
    }

    /**
     *
     * @param {edge} e
     */
    deleteLine(e) {
        if (e.line == null)
            return;

        let elem = e.line;
        if (elem.layer) { // false when opposite edge is handeled
            this.lineGroup.removeLayer(elem.layer);
            elem.layer.remove();
            this.layers.delete(elem.layer);
            delete elem.layer;
        }
        delete e.line;
        if (e.opposite != null)
            delete e.opposite.line;

        this.emit(elem, this.DELETE);
    }

    /**
     * 
     * @param {background} b
     */
    deleteBackground(b) {
        this.removeFromParent(b);
        b.layer.remove();
        this.layers.delete(b.layer);
        this.backgrounds.delete(b.label);
        delete b.layer;

        this.emit(b, this.DELETE);
    }

    /**
     * 
     * @param {[number]} coords
     * @param {number} zoom
     */
    setView(coords, zoom) {
        if (this.map.isInTransition())
            this.pendingAnimation = () => this.setView(coords, zoom);

        if (this.moveTarget) {
            this.map.setView(coords || this.moveTarget.center, zoom || this.moveTarget.zoom);
        } else {
            this.moveTarget = {
                center: coords || this.getCenter(),
                zoom: zoom || this.getZoom()
            }
            this.map.setView(this.moveTarget.center, this.moveTarget.zoom);
        }
    }

    /**
     * Redraw element
     * */
    invalidateSize() {
        this.map.invalidateSize();
    }

    /**
     * Refresh layer tree
     * */
    updateLayerTree() {
        if (this.layerTreeUpdateScheduled)
            return;

        this.layerTreeUpdateScheduled = true;
        setTimeout(() => {
            this.layerTreeUpdateScheduled = false;
            this.layerControl.setOverlayTree(this.overlayTree).collapseTree(true).expandSelected(true);
            },
            100);
    }

    toJSON() {
        return {
            backgrounds: Array.from(this.backgrounds.values()).map(b => b.toJSON())
        };
    }
}

mapViewer.prototype.CLICK = 'click';
mapViewer.prototype.DRAG = 'drag';
mapViewer.prototype.SHOW = 'show';
mapViewer.prototype.HIDE = 'hide';
mapViewer.prototype.CREATE = 'create';
mapViewer.prototype.DELETE = 'delete';
mapViewer.prototype.GPS = 'gps';
mapViewer.prototype.COORDINATES = 'coordinates';
mapViewer.prototype.ERROR.INVALID_MODEL_OBJECT = 'invalid model object';
mapViewer.prototype.ERROR.UNDEFINED_NAMESPACE = 'undefined namespace';
mapViewer.prototype.ERROR.NO_SUCH_BACKGROUND = 'no such background';

// utility functions

function latLngToCoords(latlng) {
    return [latlng.lat, latlng.lng];
}

function latLngsToCoords(latlngs) {
    var coords = [];
    for (let latlng of latlngs) {
        coords.push(latLngToCoords(latlng));
    }
    return coords;
}

function coordsToLatLngs(coords) {
    var latlngs = [];
    for (let coord of coords) {
        latlngs.push(coordsToLatLng(coord));
    }
    return latlngs;
}

function coordsToLatLng(coords) {
    return { lat: coords[0], lng: coords[1] };
}