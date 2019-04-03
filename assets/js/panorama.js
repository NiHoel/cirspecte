/**
 * Classes: scene, hotspot, panoramaViewer
 * 
 * Usage:
 * Call createHotspot, deleteHotspot and updateHotspot on an instance of the mapViewer class to manipulate hotspots.
 * Call loadPanorama (or transition) and updateScene to manipulate basic scene settings.
 * 
 * Implementation details:
 * Interface to pannellum
 * Contains utility methods related to panorama loading, e. g. creating tiles from a spherically projected
 * panorama image on the fly, read metadata from file
 * */

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: scene
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Visual representation of a vertex as a panorama.
 * */
class scene {
    get [Symbol.toStringTag]() {
        return 'Scene';
    }

    /**
     * 
     * @param {vertex} vertex
     * @param {JSON} config
     */
    constructor(vertex, config) {
        Object.assign(this, vertex.data, config);

        this.vertex = vertex;
        vertex.scene = this;

        this.id = vertex.id + " " + moment().toISOString();

        var vOffset = this.vOffset || 0;
        this.vaov = this.vaov || 180;

        let vaov = vertex.data.vaov;
        this.vaov = vaov;

        this.minPitch = -this.vaov / 2 + vOffset;
        this.maxPitch = this.vaov / 2 + vOffset;

        this.type = this.type || "equirectangular";
        this.panorama = this.panorama || vertex.img;
        this.autoLoad = true;
        this.hotSpots = [];
    }

    /**
*
* @param {function(hotspot) : void} f
*/
    forEach(f) {
        Array.from(this.hotSpots.filter(hs => hs instanceof hotspot)).forEach(f);
    }

    /**
     * @returns {Rx.Observable<hotspot>}
     */
    toObservable() {
        return Rx.Observable.from(Array.from(this.hotSpots.filter(hs => hs instanceof hotspot)));
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: hotspot
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Visual representation of an edge on the panorama.
 * The style depends on the type of edge.
 * */
class hotspot {
    get [Symbol.toStringTag]() {
        return 'Hotspot';
    }

    /**
     *
     * @param {edge} e
     * @param {JSON} config
     */
    constructor(e, config) {
        Object.assign(this, config);
        this.id = this.id || e.id;

        this.edge = e;
        e.hotspot = this;

        if (e.type === edge.prototype.TEMP)
            this.type = this.PREVIEW;
        else if (e.type === edge.prototype.LANDMARK)
            this.type = this.LANDMARK;
        else if (this.draggable) {
            this.type = this.EDIT;
            this.pitch = e.data.pitch != null ? e.data.pitch : config.navigationHotspotPitch;
        } else if (e.type === edge.prototype.ROUTE || e.type === edge.prototype.SPATIAL) {
            this.type = this.ROUTE;
            this.pitch = e.data.pitch != null ? e.data.pitch : config.navigationHotspotPitch;
        } else {
            this.type = e.type;
        }

        if (this.pitch == null)
            this.pitch = e.data.pitch || 0;
        if (this.pitch > config.maxPitch) this.pitch = config.maxPitch;
        if (this.pitch < config.minPitch) this.pitch = config.minPitch;

        if (this.yaw == null)
            if (e.data.yaw == null)
                this.yaw = panoramaViewer.getAzimuth(e.from, e.to) + this.northOffset;
            else
                this.yaw = e.data.yaw + this.northOffset;
        this.text = this.text || e.id;
        this.draggable = this.draggable;
    }
}

hotspot.prototype.ROUTE = 'scene'; // edge is part of a tour
hotspot.prototype.PREVIEW = 'preview';
hotspot.prototype.LANDMARK = 'landmark';
hotspot.prototype.NORTH = 'north';
hotspot.prototype.EDIT = 'edit';
hotspot.prototype.SPATIAL = 'spatial';

hotspot.prototype.POSITION = 'position';


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: panoramaViewer
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Listen to events: this.observe(<class>, <action>).subscribe(elem => / do something with element here /)
 * where <class> in {scene, hotspot, this.NORTHHOTSPOT}
 * <action> in {this.CREATE, this.DELETE, this.DRAG, this.CLICK}
 * click and drag not available for scene
 * */
class panoramaViewer extends observable {
    get [Symbol.toStringTag]() {
        return 'Panorama Viewer';
    }

    /**
     *
     * @param {HTMLElement | string} domElement
     */
    constructor(domElement, modules, config) {
        super();
        this.domElement = typeof domElement === 'string' ? document.getElementById(domElement) : domElement;

        this.modules = modules;
        this.config = Object.assign({}, config);

        this.config.maxZoomFactor = config.maxZoomFactor || 1;
        this.config.navigationHotspotPitch = config.navigationHotspotPitch || 0;
        this.config["default"] = config["default"] || {};
        if (this.config.scenes == null)
            this.config.scenes = [];

        this.scene = null;

        // the settings from the tour file are applied in common.js after reading the file
        // therefore no listeners to the configurator are established
    }

    /**
     * @returns {scene}
     */
    getScene() {
        return this.scene;
    }

    /**
 * @returns {vertex}
 */
    getVertex() {
        return this.scene ? this.scene.vertex : null;
    }

    /**
     * @returns {[hotspot]}
     * */
    getHotspots() {
        return this.getScene().hotSpots.filter(h => h instanceof hotspot);
    }

    /**
     * @returns {number}
     * */
    getYaw() {
        return this.viewer ? this.viewer.getYaw() : null;
    }

    /**
     * @returns {number}
     * */
    getPitch() {
        return this.viewer ? this.viewer.getPitch() : null;
    }

    /**
     * @returns {number}
     * */
    getHfov() {
        return this.viewer ? this.viewer.getHfov() : null;
    }

    /**
     * 
     * @param {vertex} v
     * @param {JSON} config
     * @returns {JSON}
     */
    generatePanoramaConfig(v, config = {}) {
        var cfg = Object.assign({}, v.data, config);
        delete cfg.reload;
        let width = v.getImageConfig().width;
        cfg.northOffset = cfg.northOffset || 0;
        cfg.vOffset = cfg.vOffset || 0;
        cfg.pitch = cfg.pitch || (this.scene ? this.viewer.getPitch() : 0);
        cfg.yaw = cfg.yaw + cfg.northOffset || (this.scene ? this.viewer.getYaw() - this.getNorthOffset() + cfg.northOffset : cfg.northOffset);
        cfg.vaov = cfg.vaov || (this.scene ? this.scene.vaov : 120);
        cfg.minHfov = Math.min(120, config.minHfov || $(this.domElement).innerWidth() / width / this.config.maxZoomFactor * 360);
        cfg.hfov = cfg.hfov || (this.scene ? this.viewer.getHfov() : Math.min(cfg.vaov, 170));
        return cfg;
    }

    /**
     * 
     * @param {edge} edge
    * @returns {hotspot}
     */
    createHotspot(edge) {
        if (this.viewer == null || this.getScene() == null || this.getVertex() !== edge.from)
            return;

        var self = this;
        let hs = new hotspot(edge, {
            minPitch: this.getScene().minPitch,
            maxPitch: this.getScene().maxPitch,
            navigationHotspotPitch: this.config.navigationHotspotPitch,
            northOffset: this.getNorthOffset(),
            vOffset: this.getVOffset(),
            draggable: this.isEditable()
        });

        if (hs.type === hotspot.prototype.PREVIEW) {
            hs.createTooltipFunc = this.createPreviewTooltip.bind(this);
            hs.createTooltipArgs = hs;
        } else if (hs.type !== hotspot.prototype.ROUTE) {
            hs.createTooltipFunc = this.createHotspotMarker;
            hs.createTooltipArgs = "pnlm-" + hs.type;
        } else {
            hs.createTooltipFunc = this.createNavigationHotspot.bind(this);
        }

        // (event, clickHandlerArgs) => {...}
        if (!hs.draggable)
            hs.clickHandlerFunc = () => this.emit(hs, this.CLICK);
        else {
            hs.dragStartHandlerFunc = () => this.startUpdate(hs, hs.POSITION);
            hs.dragHandlerFunc = () => this.endUpdate(hs, hs.POSITION);
        }
        let sceneId = this.getScene().id;
        this.viewer.addHotSpot(hs, sceneId);

        this.emit(hotspot, this.CREATE);
        return hotspot;
    }

    /**
     * 
     * @param {HTMLElement} hotSpotDiv
     * @param {hotspot} args
     * @returns {void}
     */
    createPreviewTooltip(hotSpotDiv, args) {
        hotSpotDiv.classList.add('hotspot-container');
        hotSpotDiv.classList.add("pnlm-" + hotspot.prototype.EDIT);
        var preview = document.createElement('div');
        preview.classList.add('preview-tooltip');
        var previewPanorama = document.createElement('div');
        previewPanorama.classList.add('preview-panorama');
        preview.appendChild(previewPanorama);
        hotSpotDiv.appendChild(preview);

        var tooltipViewer = new panoramaViewer(previewPanorama, this.modules, this.config.previewOptions);
        let azimuth = panoramaViewer.getAzimuth(args.edge.from, args.edge.to);
        tooltipViewer.loadScene(args.edge.to, { yaw: azimuth, hfov: 70 }).subscribe();
    }

    /**
  * 
  * @param {HTMLElement} hotSpotDiv
  * @param {string} args
 *@returns {void}
  */
    createHotspotMarker(hotSpotDiv, args) {
        hotSpotDiv.classList.add(args);
    }

    /**
     * 
     * @param {HTMLElement} hotSpotDiv
     * @param {hotspot} args
     * @returns {void}
     */
    createNavigationHotspot(hotSpotDiv, args) {
        hotSpotDiv.classList.add('pnlm-navigation');
        hotSpotDiv.classList.remove('pnlm-hotspot', 'pnlm-sprite', 'pnlm-scene');
        var span = document.createElement('span');
        span.classList.add('glyphicon', 'glyphicon-menu-up');
        hotSpotDiv.appendChild(span);
    }

    /**
     * 
     * @param {vertex} v
     */
    updateCoordinates(v) {
        if (!v || !this.scene || v != this.scene.vertex)
            return;

        v.forEach(e => this.updateHotspot(e));
        this.invalidateSize();
    }

    /**
     * 
     * @param {edge} edge
     */
    updateHotspot(edge) {
        if (this.scene == null || edge.hotspot == null)
            return;

        var yaw = edge.data.yaw != null ? edge.data.yaw : panoramaViewer.getAzimuth(edge.from, edge.to);
        yaw += this.getNorthOffset();
        if (yaw < -180)
            yaw += 360;
        if (yaw > 180)
            yaw -= 360;

        var pitch = edge.data.pitch != null ? edge.data.pitch : 0;

        if (edge.hotspot.yaw != null && edge.hotspot.yaw != yaw || edge.hotspot.pitch != null && edge.hotspot.yaw != pitch) {
            this.startUpdate(edge, edge.POSITION);
            edge.hotspot.yaw = yaw;
            edge.hotspot.pitch = pitch;
            this.endUpdate(edge, edge.POSITION);
        }

        this.invalidateSize();
    }

    /**
     * 
     * @param {edge} e
     */
    deleteHotspot(e) {
        if (e.hotspot == null)
            return;

        var hs = e.hotspot;
        this.viewer.removeHotSpot(hs.id);

        this.emit(hotspot, this.DELETE);
    }

    /**
     * @returns {number}
     */
    getNorthOffset() {
        if (this.scene == null)
            return 0;
        return this.scene.northOffset;
    }

    /**
     * @returns {number}
     */
    getVOffset() {
        if (this.scene == null)
            return 0;
        return this.scene.vOffset;
    }

    /**
     * 
     * @param {vertex} v
     * @returns {Rx.Observable<scene>}
     */
    updateScene(v) {
        if (!this.scene || this.scene.vertex !== v)
            return;
        var modified = new Set();

        for (var prop in v.data) {
            if (this.scene[prop] !== v.data[prop])
                modified.add(prop);
        }

        if (modified.has("northOffset") && modified.size === 1) {
            this.setNorthOffset(v.data.northOffset);
            return Rx.Observable.of(this.scene);
        } else
            return this.reloadScene(v.data);
    }


    /**
     * Reads the metadata from the file associated to v and updates the attributes of v.
     * 
     * @param {vertex} v
     * @param {boolean} config.xmp
     * @param {boolean} config.forceResolution
     * @param {boolean} config.keepLoadedImage
     * @param {boolean} config.suppressUpdateNotification
     * @param {boolean} config.excludeTimeslot
     * @returns {Rx.Observable<vertex>}
     */
    updateMetadata(v, config) {
        //      EXIF.enableXmp();
        var base = config.suppressUpdateNotification ? v.image : v.getImageConfig();
        if (!base.file)
            throw new error(panoramaViewer.prototype.ERROR.NO_IMAGE, "", v);

        return base.file.load()
            .mergeMap(file => Rx.Observable.create(observer => {
                //if (config.xmp)
                //    EXIF.enableXmp();
                //else
                //    EXIF.disableXmp();

                if (!EXIF.getData(file, () => { observer.next(file), observer.complete(); }))
                    observer.error();
            }))
            .mergeMap(file => {
                base.file.exifdata = file.exifdata;
                base.file.iptcdata = file.iptcdata;

                if (file.exifdata.DateTime && !config.excludeTimeslot) {
                    var t = moment(file.exifdata.DateTime, "YYYY:MM:DD HH:mm:ss");
                    if (t.isValid()) {
                        if (config.suppressUpdateNotification)
                            v.timeslot = t;
                        else
                            this.modules.model.updateTimeslot(v, t);
                    }
                }

                if (file.exifdata.PixelXDimension && file.exifdata.PixelXDimension) {
                    v.image.width = file.exifdata.PixelXDimension;
                    v.image.height = file.exifdata.PixelYDimension;
                }
                if (config.xmp) {
                    return algorithms.parseGPanoXMP(base.file);
                } else {
                    return Rx.Observable.of({});
                }
            })
            .do(xmp => {
                var data = config.suppressUpdateNotification ? v.data : {};
                v.image.width = v.image.width || xmp.croppedWidth;
                v.image.height = v.image.height || xmp.croppedHeight;
                if (xmp.type)
                    data.type = "equirectangular";

                if (xmp.fullWidth && xmp.croppedWidth)
                    data.vaov = 360 * xmp.croppedWidth / xmp.fullWidth;

                if (xmp.fullHeight && xmp.croppedHeight)
                    data.vaov = 180 * xmp.croppedWidth / xmp.fullWidth;

                if (xmp.topPixels != null && xmp.croppedHeight && xmp.fullHeight)
                    data.vOffset = ((xmp.topPixels + xmp.croppedHeight / 2) / xmp.fullHeight - 0.5) * -180;

                if (xmp.heading != null)
                    data.northOffset = xmp.heading;

                if (xmp.horizonPitch !== null && xmp.horizonRoll !== null) {
                    data.horizonPitch = xmp.horizonPitch;
                    data.horizonRoll = xmp.horizonRoll;
                }

                if (!config.suppressUpdateNotification)
                    this.modules.model.updateData(v, data);

                if (!(v.image.height && v.image.width) && !(base.height && base.width))
                    throw null;
            })
            .catch(() => {
                if (config.forceResolution)
                    return base.file.readAsImage()
                        .do(img => {
                            v.image.width = img.width;
                            v.image.height = img.height;

                            if (config.keepLoadedImage)
                                v.image.file.img = img;
                        })
                else
                    throw new error("", "no XMP data available", base.file);
            })
            .mapTo(v);

    }

    /**
     * 
     * @param {number} offset
     */
    setNorthOffset(offset) {
        if (!this.scene)
            return;

        if (offset <= -180)
            offset += 360;
        if (offset > 180)
            offset -= 360;

        this.scene.northOffset = offset;
        this.scene.forEach(hs => {
            this.updateHotspot(hs.edge);
        });

        if (this.northHotspot) {
            this.northHotspot.yaw = offset;
            this.invalidateSize();
        }

        offset *= -1;
        if (offset < 0)
            offset += 360;
        this.viewer.setNorthOffset(offset);

    }

    /**
    * @param {edge|hotspot|number} [pitch]
    * @param {number} [yaw]
    */
    lookAt(pitch = 0, yaw = 0) {
        if (pitch instanceof hotspot)
            this.viewer.lookAt(pitch.pitch, pitch.yaw);
        else if (pitch instanceof edge)
            this.viewer.lookAt(0, panoramaViewer.getAzimuth(pitch.from, pitch.to) + this.getNorthOffset())
        else
            this.viewer.lookAt(pitch, yaw);
    }


    /**
     * Loads the image associated to vertex, resizes it to the specified resolution
     * Stores the result in vertex.img.
     * 
     * @param {vertex} vertex
     * @param {number} width
    *@returns {Rx.observable<vertex>}
     */
    static resize(vertex, width) {
        return Rx.Observable.create(observer => {
            if (panoramaViewer.maxWidth == null) {
                let canvas = document.createElement('canvas');
                let gl = canvas.getContext('experimental-webgl', { alpha: false, depth: false });
                panoramaViewer.maxWidth = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            }

            if (width == null)
                width = panoramaViewer.maxWidth;

            let img = vertex.image.file.img;
            width = Math.min(img.width, width, panoramaViewer.maxWidth);
            vertex.data.vaov = vertex.data.vaov || 360 * img.height / img.width;

            if (img.width > width) {
                if (/Firefox/.test(platform.name)) { //test for Firefox
                    if (width > 8000) { // problems with canvas otherwise
                        width = 8000;
                    }
                }
                let resizeFactor = width / img.width;
                if (panoramaViewer.resizeCanvas == null) {
                    panoramaViewer.resizeCanvas = document.createElement('canvas');
                    panoramaViewer.resizeContext = panoramaViewer.resizeCanvas.getContext('2d');
                }

                let resizeCanvas = panoramaViewer.resizeCanvas;
                let resizeContext = panoramaViewer.resizeContext;
                resizeCanvas.width = Number.parseInt(img.width * resizeFactor);
                resizeCanvas.height = Number.parseInt(img.height * resizeFactor);
                resizeContext.drawImage(img, 0, 0, resizeCanvas.width, resizeCanvas.height);
                vertex.img = new Image();
                vertex.img.addEventListener('load', () => {
                    observer.next(vertex);
                    observer.complete();
                });
                vertex.img.addEventListener('error', (err) => observer.error(err));
                vertex.img.src = resizeCanvas.toDataURL("image/jpeg", 0.8);
            } else {
                observer.next(vertex);
                observer.complete();
            }


        });
    }

    /**
 * 
 * 
 * @param {vertex | [number]} from
 * @param {vertex | [number]} to
    * @returns {number} - angle in ° between to, from, geographical north
 */
    static getAzimuth(from, to) {
        if (from instanceof vertex)
            from = from.coordinates;
        if (to instanceof vertex)
            to = to.coordinates;

        from = new LatLon(from[0], from[1]);
        to = new LatLon(to[0], to[1]);

        var bearing = from.initialBearingTo(to);
        if (bearing > 180)
            bearing -= 360;

        return bearing;
    }

    /**
* 
* @param {vertex | [number]} from
* @param {vertex | [number]} to
   * @returns {number} - in meters
*/
    static getDistance(from, to) {
        if (from instanceof vertex)
            from = from.coordinates;
        if (to instanceof vertex)
            to = to.coordinates;

        from = new LatLon(from[0], from[1]);
        to = new LatLon(to[0], to[1]);

        return from.distanceTo(to);
    }

    /**
     * 
     * @param {vertex | [number]} from
     * @param {number} distance - in meters
     * @param {number} bearing - angle from north measured in °
    * @returns {[number]}
     */
    static getCoords(from, distance, bearing) {
        if (from instanceof vertex)
            from = from.coordinates;

        var dest = (new LatLon(from[0], from[1])).destinationPoint(distance, bearing);
        return [dest.lat, dest.lon];
    }

    /**
     * Center view in the direction the hotspot points to.
     * Load the panorama the hotspot leads to.
     * 
     * @param {edge} e
     * @returns {Rx.Observable<scene>}
     */
    transition(e) {
        if (e.to.type !== vertex.prototype.PANORAMA)
            throw new error(panoramaViewer.ERROR.UNSUPPORTED_VERTEX_TYPE, e.to.type, e);

        if (this.scene && e.from === this.scene.vertex && e.type !== edge.prototype.TEMPORAL) {
            return this.loadScene(e.to, { yaw: panoramaViewer.getAzimuth(e.from, e.to), pitch: 0 });
        } else {
            return this.loadScene(e.to);
        }
    }

    /**
     * Display the panorama.
     * 
     * @param {vertex} v
     * @param {JSON} config
    *@returns {vertex}
     */
    loadScene(v, config = {}) {
        if (v.type !== vertex.prototype.PANORAMA)
            throw new error(this.ERROR.UNSUPPORTED_VERTEX_TYPE, v.type, v)

        if (!v.data.panorama && !v.image && !v.image.file)
            throw new error(this.ERROR.NO_IMAGE, "", v);

        var obs = this.modules.filesys.prepareFileAccess(v);
        if (this.config.tileResolution && (v.data.type == "equirectangular" || !v.data.type))
            obs = obs.mergeMap(() => this.autoTile(v, config));
        else
            obs = obs.mergeMap(v => this.modules.filesys.loadImage(v))
                .mergeMap(v => panoramaViewer.resize(v))
                .map(() => new scene(v, this.generatePanoramaConfig(v, config)));

        return obs.map(newScene => {
            if (this.viewer == null || !this.viewer.getScene() || !this.viewer.isLoaded()) {
                if (this.viewer != null) { //viewer displays error
                    this.viewer.destroy();
                    this.viewer = null;
                    this.scene = null;
                }
                let cfg = { 'default': {}, 'scenes': {} };
                Object.assign(cfg.default, this.config.default);
                cfg['scenes'][newScene.id] = newScene;
                cfg['default']['firstScene'] = newScene.id;

                /** @type {pannellum.Viewer} */
                this.viewer = pannellum.viewer(this.domElement, cfg);
                this.scene = newScene;

            } else {
                this.viewer.addScene(newScene.id, newScene);

                if (this.scene != null) {
                    this.scene.forEach(hs => {
                        this.deleteHotspot(hs);
                    });

                    if (this.scene.vertex !== newScene.vertex) {
                        delete this.scene.vertex.image.file.img;
                        delete this.scene.vertex.scene;
                        delete this.scene.base;
                        delete this.scene.thumb;
                        if (this.scene.multiRes && this.scene.multiRes.loader) {
                            var obj = this.scene.multiRes;
                            if (obj.base) {
                                delete obj.base.file.img;
                                delete obj.base.img;
                                delete obj.base.imgObs;
                            }

                            if (obj.thumb) {
                                delete obj.thumb.file.img;
                                delete obj.thumb.img;
                                delete obj.thumb.imgObs;
                            }

                            delete this.scene.multiRes.loader;
                        }

                    }

                    this.viewer.removeScene(this.scene.id);

                    if (!config.reload)
                        this.emit(this.scene, this.DELETE);
                }

                this.viewer.loadScene(newScene.id);
                this.scene = newScene;

                if (this.northHotspot != null) {
                    this.northHotspot.yaw = this.getNorthOffset();
                    this.northHotspot.pitch = 0;
                    this.viewer.addHotSpot(this.northHotspot, newScene.id);
                }
            }
            this.setNorthOffset(newScene.northOffset); // scene and viewer northOffset differ in sign

            if (!config.reload)
                this.emit(newScene, this.CREATE);

            return newScene;
        });
    }

    /**
     * 
     * @param {any} config
     * @returns {Rx.Observable<scene>}
     */
    reloadScene(config = {}) {
        if (this.viewer != null) {
            var hotspots = this.getHotspots();
            return this.loadScene(this.scene.vertex, Object.assign({ reload: true }, config))
                .do(() => hotspots.forEach(hs => this.createHotspot(hs.edge)));
        }
        return Rx.Observable.empty();
    }

    /**
     * @returns {boolean}
     * */
    isEditable() {
        return this.northHotspot != null;
    }

    /**
     * 
     * @param {boolean} [enable]
     * @returns {Rx.Observable<scene>}
     */
    toggleEditable(enable) {
        if (enable == null)
            enable = this.northHotspot == null;

        if (enable && !this.northHotspot) {
            var northOffset = this.getNorthOffset();

            let hs = {
                id: "northCross",
                pitch: 0,
                yaw: northOffset,
                text: "north",
                createTooltipFunc: this.createCompassHotspot,
                type: hotspot.prototype.NORTH
            };

            hs.draggable = true;
            hs.dragStartHandlerFunc = () => this.startUpdate(hs, hotspot.prototype.POSITION, this.NORTHHOTSPOT);
            hs.dragHandlerFunc = () => this.endUpdate(hs, hotspot.prototype.POSITION, this.NORTHHOTSPOT);
            this.northHotspot = hs;
            return this.reloadScene();
        } else if (!enable && this.northHotspot) {
            this.northHotspot = null;
            return this.reloadScene();
        }

        return Rx.Observable.of(this.scene)
    }

    /**
     * Redraw element
     * */
    invalidateSize() {
        var height = $(this.domElement).innerHeight();
        var width = $(this.domElement).innerWidth();
        if (this.viewer != null) {
            this.viewer.setVfovBounds([null, Math.min(this.scene.vaov, 170)]);
            this.viewer.resize();
        }
    }

    /**
     * 
     * @param {scene} s
     * @returns {function(object, Image) : Promise<ImageData>} - A function that returns the specified tile from a hierarchy of tiles that is created on the file from the image.
     */
    createLoader(s) {
        let v = s.vertex;

        s.base = v.getImageConfig();
        // avoid memory leaks by ensuring that there are no
        // references to those objects once the scene is deleted

        let loadBase = () => {
            if (!s.base.img) {
                s.base.imgObs = new Rx.ReplaySubject(1, null /* unlimited time buffer */,
                    Rx.Scheduler.timeout);
                s.base.imgObs.subscribe(img => s.base.img = img);

                if (!s.base.img) {
                    s.base.file.readAsImage()
                        .catch(this.emit)
                        .subscribe(img => s.base.imgObs.next(img));
                }
            }
        }

        s.thumb = v.getThumbConfig();


        if (s.thumb.file && s.thumb.file != s.base.file) {
            s.thumb.imgObs = new Rx.ReplaySubject(1, null /* unlimited time buffer */,
                Rx.Scheduler.immediate);
            s.thumb.file.readAsImage()
                .catch(this.emit)
                .subscribe(img => s.thumb.imgObs.next(img));
            s.thumb.imgObs.subscribe(img => s.thumb.img = img);
        } else {
            loadBase();
        }


        let width = s.multiRes.originalWidth;
        let height = s.multiRes.originalHeight;
        let tileResolution = s.multiRes.tileResolution;
        let maxLevel = s.multiRes.maxLevel;

        if (width * height > 200000000) {
            // Otherwise Firefox shows a black image
            this.modules.logger.log(new warning(this.ERROR.IMAGE_TOO_BIG, "Resolution should be less than 200,000,000 megapixel."));
            console.warn(this.ERROR.IMAGE_TOO_BIG, s);
        }

        if (!this.loaderCanvas) {
            this.loaderCanvas = document.createElement('canvas');
            this.loaderContext = this.loaderCanvas.getContext('2d');
        }

        let promise = (node, img) => new Promise((resolve, reject) => {
            if (node.level > maxLevel || node.level < 0) {
                reject();
                return;
            }
            let f = Math.pow(2, node.level - maxLevel);
            var conf;
            if (width * f <= s.thumb.width && s.thumb.imgObs)
                conf = s.thumb;
            else {
                if (!s.base.img && !s.base.imgObs)
                    loadBase();
                conf = s.base;
            }

            let handleImage = img => {
                this.loaderCanvas.width = Math.min(tileResolution, Math.ceil(width * f) - tileResolution * node.x);
                this.loaderCanvas.height = Math.min(tileResolution, Math.ceil(height * f) - tileResolution * node.y);
                if (!this.loaderCanvas.width || !this.loaderCanvas.height) {
                    reject();
                    return;
                }
                try {
                    this.loaderContext.drawImage(img, -tileResolution * node.x, -tileResolution * node.y, Math.ceil(width * f), Math.ceil(height * f));
                    resolve(this.loaderContext.getImageData(0, 0, this.loaderCanvas.width, this.loaderCanvas.height));
                } catch (e) {
                    reject(e);
                }
            }


            if (conf.img)
                handleImage(conf.img);
            else if (conf.imgObs)
                conf.imgObs.subscribe(handleImage);
            else
                reject();
        });


        if (s.base.img || s.thumb.img)
            return Rx.Observable.of(promise);

        if (s.thumb.imgObs)
            return s.thumb.imgObs.mapTo(promise);
        else
            return s.base.imgObs.mapTo(promise);
    }

    /**
     * Computes the parameters for a tile hierarchy. 
     * Adds a loader function to vertex.data that lazily creats
     * tiles from the source image at the specified level of resolution.
     * 
     * @param {vertex} v
     * @param {object} config
     */
    autoTile(v, config) {
        if (!v.image && !v.image.file)
            throw new error(this.ERROR.NO_IMAGE, "", v);

        v.data = v.data || {}

        var base = v.getImageConfig();

        let tileResolution = this.config.tileResolution;
        //if (!base.width || !base.height)
        //    throw new error(this.ERROR.MISSING_PARAMETERS, "width or height", v);

        var obs = Rx.Observable.of(v);
        if (!base.width || !base.height)
            obs = this.updateMetadata(v, { forceResolution: true, keepLoadedImage: true, excludeTimeslot: true });

        return obs.mergeMap(() => {
            base = v.getImageConfig();
            let maxLevel = Math.ceil(Math.log2(Math.max(base.width, base.height) / tileResolution)) + 1;

            v.data.vaov = v.data.vaov || 360 * base.height / base.width;

            let cfg = this.generatePanoramaConfig(v, config);
            let newScene = new scene(v, cfg);

            newScene.type = "multiresrec";
            newScene.vaov = v.data.vaov;
            if (!newScene.multiRes) {
                newScene.multiRes = {
                    tileResolution: tileResolution,
                    originalWidth: base.width,
                    originalHeight: base.height,
                    maxLevel: maxLevel
                };
            }

            return this.createLoader(newScene)
                .do(loader => newScene.multiRes.loader = loader)
                .mapTo(newScene);
        });
    }

}

panoramaViewer.prototype.CLICK = 'click';
panoramaViewer.prototype.DRAG = 'drag';
panoramaViewer.prototype.CREATE = 'create';
panoramaViewer.prototype.NORTHHOTSPOT = 'north hotspot';
panoramaViewer.prototype.DELETE = 'delete';

panoramaViewer.prototype.ERROR.NO_IMAGE = 'no image associated to vertex'
panoramaViewer.prototype.ERROR.IMAGE_TOO_BIG = 'image resolution too high'
panoramaViewer.prototype.ERROR.UNSUPPORTED_VERTEX_TYPE = 'unsupported vertex type'
panoramaViewer.prototype.ERROR.MISSING_PARAMETERS = 'missing parameters'