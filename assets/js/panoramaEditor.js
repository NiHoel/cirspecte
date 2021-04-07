'use strict';

/**
 * Presentation layer for manipulating the current panorama.
 * */
class panoramaEditor extends observable {
    get [Symbol.toStringTag]() {
        return 'Panorama Editor';
    }

	/**
     * @param {JSON} modules
     */
    constructor(modules) {
        super();
        this.modules = modules;

        this.currentVertex = ko.observable();
        this.vOffsetEditable = ko.observable(false);
        this.optimizeCoordinates = ko.observable(true);
        this.optimizeNorthOffset = ko.observable(true);
        this.optimizeHaov = ko.observable(false);
        this.haov = ko.observable(360);
        this.haov.subscribe(val => {
            var num = parseFloat(val);

            if (typeof num == "number" && isFinite(num) && val !== num)
                this.haov(num);
            else if (typeof num != "number" || !isFinite(num)) {
                var defaultVal = 360;
                if (this.currentVertex() && this.currentVertex().data.haov)
                    defaultVal = this.currentVertex().data.haov;
                this.haov(defaultVal);
            }
        });

        this.pendingHaovUpdate = false;

        this.haov.subscribe(haov => {
            if (Math.abs(haov - this.currentVertex().data.haov) < 1e-6 ||
                !this.currentVertex().data.haov && haov == 360)
                return;

            if (this.modules.panorama.loading)
                this.pendingHaovUpdate = true;
            else
                this.updateHaov();
        });

        this.landmarkGroups = ko.observableArray();
        this.landmarkGroup = ko.observable();

        this.shown = false;

        ko.applyBindings(this, $('#panorama-editor')[0]);
        ko.applyBindings(this, $('.nav-tabs a[href="#panorama-editor"]')[0]);

        this.landmarkGroup.subscribe(g => {
            if (g)
                this.modules.timeline.toggleSelection(g.item, true)
        });

        this.initialize();
    }

    /**
     * Setup of event listeners.
     * */
    initialize() {
        let modules = this.modules;
        let haovSlider = $("div + #panorama-edit-haov-slider").prev()[0];

        let routines = [
            Rx.Observable.fromEvent($('.nav-tabs a'), 'show.bs.tab')
                .filter(ev => ev.target === $('.nav-tabs a[href="#panorama-editor"]')[0])
                .do(() => this.shown = true)
                .do(() => this.modules.map.toggleMinimap(true))
                .mergeMap(() => modules.panorama.toggleEditable(true))
                .do(() => this.setEditable())
            ,

            Rx.Observable.fromEvent($('.nav-tabs a'), 'hide.bs.tab')
                .filter(ev => ev.target === $('.nav-tabs a[href="#panorama-editor"]')[0])
                .do(() => this.shown = false)
                .mergeMap(() => modules.panorama.toggleEditable(false))
                .do(() => this.unsetEditable())
            ,

            modules.panorama.observe(scene, modules.panorama.CREATE)
                .do(s => this.currentVertex(s.vertex))
                .do(() => this.updateView())
                .filter(() => this.isShown())
                .do(() => this.setEditable()),

            modules.panorama.observe(scene, modules.panorama.DELETE)
                .filter(() => this.isShown())
                .do(s => this.unsetEditable(s.vertex)),

            modules.model.observe(spatialGroup, modules.model.CREATE)
                .filter(g => g.type == spatialGroup.prototype.LANDMARK)
                .do(g => this.landmarkGroups.push(g)),

            modules.model.observe(spatialGroup, modules.model.DELETE)
                .do(g => this.landmarkGroups.remove(g)),

            modules.map.observe(modules.map.COORDINATES, modules.map.CLICK)
                .filter(() => this.isShown() && modules.panorama.getScene() != null)
                .inhibitBy(modules.map.observe(point, modules.map.CLICK), 100)
                .inhibitBy(modules.map.observe(line, modules.map.CLICK), 100)
                .filter(() => this.modules.settings.createVertexOnMapClick())
                .do(() => modules.hist.commit())
                .map(c => modules.model.createVertex({ coordinates: c, type: vertex.prototype.LANDMARK, spatialGroup: this.landmarkGroup() }))
                .do(v => modules.model.createEdge({ from: modules.panorama.getVertex(), to: v, bidirectional: true })),

            // edge[TEMP] -> hotspot[PREVIEW]
            modules.model.observe(edge, modules.model.CREATE)
                .filter(e => e.type === edge.prototype.TEMP && e.from === modules.panorama.getVertex() && e.to.type === vertex.prototype.PANORAMA)
                .mergeMap(e => {
                    return modules.filesys.loadImage(e.to)
                        .mergeMap(v => panoramaViewer.resize(v, 2000))
                        .do(() => modules.panorama.createHotspot(e));
                }),

            modules.panorama.afterUpdate(modules.panorama.NORTHHOTSPOT, hotspot.prototype.POSITION)
                .filter(() => !this.vOffsetEditable())
                .do(() => modules.hist.commit())
                .do(hs => modules.model.updateData(modules.panorama.getVertex(), { northOffset: hs.yaw })),

            // update hotspots such that they stick at the same position relative to the image
            modules.panorama.afterUpdate(modules.panorama.NORTHHOTSPOT, hotspot.prototype.POSITION)
                .filter(() => this.vOffsetEditable())
                .do(() => modules.hist.commit())
                .mergeMap(hs => {
                    return modules.panorama.getVertex().toObservable()
                        .filter(e => e.data.pitch != null)
                        .do(e => modules.model.updateData(e, { pitch: e.data.pitch - hs.pitch }))
                }),

            // then update vertical offset
            modules.panorama.afterUpdate(modules.panorama.NORTHHOTSPOT, hotspot.prototype.POSITION)
                .filter(() => this.vOffsetEditable())
                .do(hs => modules.model.updateData(modules.panorama.getVertex(), { vOffset: -hs.pitch + (modules.panorama.getScene().vOffset || 0) }))
            ,

            modules.panorama.afterUpdate(hotspot, hotspot.prototype.POSITION)
                .do(() => modules.hist.commit())
                .do(hs => modules.model.updateData(hs.edge, { yaw: hs.yaw - modules.panorama.getNorthOffset(), pitch: hs.pitch }))
            ,

            modules.panorama.observe(hotspot, modules.panorama.DELETE)
                .filter(hs => hs.type === hotspot.prototype.PREVIEW)
                .do(hs => delete hs.edge.to.img), // delete the low resolution preview image

            modules.map.observe(point, modules.map.CLICK)
                .filter(() => this.isShown() && modules.panorama.getScene() != null)
                .do(() => modules.hist.commit())
                .map(e => e.vertex)
                .filter(v => modules.panorama.getVertex() !== v)
                .do(v => modules.model.createEdge({ from: modules.panorama.getVertex(), to: v, bidirectional: true, type: edge.prototype.TEMP })),

            modules.timeline.observe(item, modules.timeline.CREATE)
                .do(i => {
                    if (this.isShown())
                        modules.timeline.toggleSelection(i, true);
                }),

            modules.panorama.observe(scene, modules.panorama.CREATE)
                .map(s => s.vertex)
                .merge(modules.model.afterUpdate(vertex, vertex.prototype.COORDINATES))
                .merge(modules.model.afterUpdate(vertex, vertex.prototype.DATA))
                .merge(modules.filesys.observe(vertex, modules.filesys.LINK))
                .filter(v => v === modules.panorama.getVertex())
                .do(v => this.updateView()),

            modules.panorama.observe(scene, modules.panorama.LOADED)
                .do(() => {
                    if (this.pendingHaovUpdate) {
                        this.pendingHaovUpdate = false;
                        this.updateHaov();
                    }
            }),

            Rx.Observable.from(['mousedown', 'pointerdown', 'touchstart'])
                .mergeMap(ev => Rx.Observable.fromEvent(haovSlider, ev))
                .do(() => modules.hist.commit()),


            Rx.Observable.fromEvent(document.querySelector('#optimize-button'), 'click')
                .do(() => modules.hist.commit())
                .filter(() => modules.panorama.getScene() != null)
                .mergeMap(() => modules.alg.optimize(modules.panorama.getScene(),
                    modules.panorama.getHotspots().filter(h => h.type === h.LANDMARK || h.type === h.PREVIEW),
                    {
                        coordinates: this.optimizeCoordinates(),
                        northOffset: this.optimizeNorthOffset(),
                        haov: this.optimizeHaov()
                    }))
                .do(res => {
                    var v = modules.panorama.getVertex();
                    if (res.solution.coordinates)
                        modules.model.updateCoordinates(v, res.solution.coordinates);
                    if (res.solution.northOffset != null)
                        modules.model.updateData(v, { northOffset: res.solution.northOffset });
                    if (res.solution.haov != null)
                        this.haov(Math.round(10 * res.solution.haov)/10);
                    $('#optimize-error-text').text(res.f.toFixed(3) + '°');
                })
                .map(res => modules.panorama.getVertex())
                .mergeMap(v => v.toObservable())
                .filter(e => e.type === e.LANDMARK || e.type === e.TEMP)
                .do(e => modules.model.updateData(e, Object.assign({}, e.data, { yaw: null }), true)),
        ];

        for (let r of routines) {
            r.catch((err, caught) => {
                console.log(err);
                modules.logger.log(err);
                return caught;
            }).subscribe();
        }
    }

    /**
     * @returns {boolean}
     * */
    isShown() {
        return this.shown;
    }

    /**
     * Make corresponding point on map draggable and show connected landmark edges.
     * 
     * @private
     * */
    setEditable() {
        if (!this.currentVertex())
            return;
        modules.map.setEditable(this.currentVertex());
        this.currentVertex().forEach(e => e.type === edge.prototype.LANDMARK ? modules.map.createLine(e) : {});
    }

    /**
     * Reverse setEditable()
     * 
     * @private
     * */
    unsetEditable() {
        if (!this.currentVertex())
            return;
        modules.map.unsetEditable(this.currentVertex());
        this.currentVertex().forEach(e => e.type === edge.prototype.LANDMARK ? modules.map.deleteLine(e) : {});
    }

    /**
     * Update displayed values.
     * */
    updateView() {
        let v = this.currentVertex();
        v = v || modules.panorama.getVertex();
        $('#coord-text').text(v.coordinates[0].toFixed(6) + ", " + v.coordinates[1].toFixed(6));
        $('#file-text').text((v.image.file ? v.image.file.name : null)|| v.path);
        var imgConf = v.getImageConfig();
        if (imgConf.width && imgConf.height)
            $('#image-display-resolution-text').text(imgConf.width + " × " + imgConf.height + " Pixel");
        $('#northOffset-text').text((v.data.northOffset || 0).toFixed(3) + '°');
        $('#vOffset-text').text((v.data.vOffset || 0).toFixed(3) + '°');
        this.haov(v.data.haov || 360);
    }

    updateHaov() {
        var haov = this.haov();
        let v = this.currentVertex();
        let conf = v.getImageConfig();
        let width = conf.width;
        let height = conf.height;
        if (!width) {
            if (v.data.multiRes) {
                width = v.data.multiRes.originalWidth || 4 * v.data.multiRes.cubeResolution;
            } else {
                width = 4096;
            }
        }
        if (!height) {
            if (v.data.multiRes) {
                height = v.data.multiRes.originalHeight || 2 * v.data.multiRes.cubeResolution;
            } else {
                height = 2048;
            }
        }

        let oldVOffset = v.data.vOffset || 0;
        let oldVaov = v.data.vaov || 180;
        let oldHaov = v.data.haov || 360;

        var vaov = haov * height / width;
        var vOffset = oldVOffset * vaov / oldVaov;

        var haovFactor = haov / (v.data.haov || 360);

        var northOffset = v.data.northOffset || 0;

        v.forEach(e => {
            var update = {};

            if (e.data.yaw != null)
                update.yaw = (e.data.yaw + northOffset) * haovFactor - northOffset;

            if (e.data.pitch != null)
                update.pitch = e.data.pitch/oldVaov * vaov ;

            if (update.yaw != null || update.pitch != null)
                this.modules.model.updateData(e, update);
        });

        this.modules.model.updateData(v,
            {
                haov: haov,
                vaov: vaov,
                vOffset: vOffset
            });
    }
}