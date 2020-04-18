'use strict';

/**
 * Presentation layer for manipulating the current panorama.
 * */
class panoramaEditor extends observable {
    get [Symbol.toStringTag]() {
        return 'Panorama Editor';
    }

	/**
     * @param {configurator} settings
     * @param {JSON} modules
     */
    constructor(settings, modules) {
        super();
        this.settings = settings;
        this.modules = modules;

        this.currentVertex = ko.observable();
        this.vOffsetEditable = ko.observable(false);

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
                .filter(() => this.settings.createVertexOnMapClick())
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

            Rx.Observable.fromEvent(document.querySelector('#optimize-button'), 'click')
                .do(() => modules.hist.commit())
                .filter(() => modules.panorama.getScene() != null)
                .mergeMap(() => modules.alg.optimize(modules.panorama.getScene(), modules.panorama.getHotspots().filter(h => h.type === h.LANDMARK || h.type === h.PREVIEW)))
                .do(res => {
                    var v = modules.panorama.getVertex();
                    modules.model.updateCoordinates(v, res.solution.coordinates);
                    modules.model.updateData(v, { northOffset: res.solution.northOffset });
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
        $('#file-text').text(v.image.file.name || v.path);
        var imgConf = v.getImageConfig();
        if (imgConf.width && imgConf.height)
            $('#image-display-resolution-text').text(imgConf.width + " × " + imgConf.height + " Pixel");
        $('#northOffset-text').text((v.data.northOffset || 0).toFixed(3) + '°');
        $('#vOffset-text').text((v.data.vOffset || 0).toFixed(3) + '°');
    }
}