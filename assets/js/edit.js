'use strict';

Rx.Observable.fromEvent(document, 'drop')
    .do(e => e.preventDefault());

function readyFunction() {

    Rx.Observable.create(obs => {
        obs.next({ settings: new configurator(config.settings) });
        obs.complete();
    }).observeOn(Rx.Scheduler.asap)
        .do(modules => {
            modules.model = new graph();
            modules.logger = new logger();
            modules.filesys = new filesystem({ requestMissingFiles: true, trackChanges: modules.settings.trackChanges() });
            modules.persist = new persistence(modules);
            modules.timeline = new timelineViewer("timeline", modules, config.timeline);
        }).observeOn(Rx.Scheduler.asap)
        .do(modules => {
            modules.map = new mapViewer("map", modules, config.map)

        }).observeOn(Rx.Scheduler.asap)
        .do(modules => {
            modules.panorama = new panoramaViewer("panorama", modules, config.panorama);
            modules.alg = new algorithms(modules);
            modules.nav = new navigationViewer(modules);
            modules.hist = new commandHistory(modules);
            modules.export = new exporter(modules);
        }).observeOn(Rx.Scheduler.asap)
        .do(modules => {
            modules.editors = {
                groupEdit: new groupEditor(modules),
                mapEdit: new mapEditor(modules),
                panoramaEdit: new panoramaEditor(modules)
            };
        }).observeOn(Rx.Scheduler.asap)
        .do(modules => {

            // for debugging
            //   Object.assign(window, modules); // name collision with timeline-plus
            //   Object.assign(window, editors);

            var settings = modules.settings;
            var editors = modules.editors;

            window.modules = modules;
            window.editors = modules.editors;
            window.settings = modules.settings;


            /********************/
            /* layout animation */
            /********************/

            animateLayout(settings, modules, ["#sidebar-wrapper"]);



            /**************************/
            /* Rx.Observable routines */
            /**************************/

            var routines = createCommonRoutines(modules, settings).concat([

                modules.model.observe(edge, modules.model.CREATE)
                    .filter(e => e.type === edge.prototype.LANDMARK && e.from === modules.panorama.getVertex())
                    .do(e => modules.map.createLine(e)),

                // vertex -[coordinates]-> point
                modules.model.afterUpdate(vertex, vertex.prototype.COORDINATES)
                    .do(v => modules.map.updatePointCoordinates(v))
                    .filter(v => v === modules.panorama.getVertex())
                    .do(v => modules.panorama.updateCoordinates(v)),

                // point -[coordinates]-> vertex
                modules.map.afterUpdate(point, point.prototype.COORDINATES)
                    .do(p => modules.model.updateCoordinates(p.vertex, p.getCoordinates())),

                modules.model.afterUpdate(vertex, vertex.prototype.DATA)
                    .filter(v => modules.panorama.getVertex() === v)
                    .mergeMap(v => modules.panorama.updateScene(v)),

                modules.model.afterUpdate(edge, edge.prototype.DATA)
                    .do(e => modules.panorama.updateHotspot(e)),

                modules.model.observe(edge, modules.model.DELETE)
                    .do(e => modules.nav.notifyEdgeDeleted(e))
                    .do(e => modules.map.deleteLine(e))
                    .do(e => modules.panorama.deleteHotspot(e)),

                modules.model.observe(vertex, modules.model.DELETE)
                    .do(v => { if (v.image.file) delete v.image.file.vertex; })
                    .do(v => modules.map.deletePoint(v)),

                modules.model.observe(spatialGroup, modules.model.DELETE)
                    .do(g => modules.timeline.deleteItem(g))
                    .do(g => modules.map.deleteLayerGroup(g)),

                modules.model.observe(temporalGroup, modules.model.DELETE)
                    .do(g => modules.timeline.deleteGroup(g))
                    .do(g => modules.map.deleteControlGroup(g)),

                modules.panorama.observe(scene, modules.panorama.DELETE)
                    .mergeMap(s => s.vertex.toObservable())
                    .filter(e => e.type === edge.prototype.TEMP || !settings.persistLandmarks() && e.type === edge.prototype.LANDMARK)
                    .do(e => modules.model.deleteEdge(e)),

                modules.map.observe(line, modules.map.CLICK)
                    .filter(l => l.type === line.prototype.LANDMARK || l.type === line.prototype.EDIT)
                    .do(() => modules.hist.commit())
                    .do(l => modules.model.deleteEdge(l.edge)),

                editors.groupEdit.observe(editors.groupEdit.SPATIALGROUP, editors.groupEdit.SELECT)
                    .filter(sg => sg && settings.showGroupOnEditorSelection())
                    .do(sg => modules.timeline.toggleSelection(sg.item, true)),

                Rx.Observable.fromEvent(window, 'keydown')
                    .filter(ev => ev.keyCode === 90 && ev.ctrlKey)
                    .filter(() => modules.hist.undoStackCount() > 0)
                    .do(() => modules.hist.undo()),

                Rx.Observable.fromEvent(window, 'keydown')
                    .filter(ev => ev.keyCode === 89 && ev.ctrlKey)
                    .filter(() => modules.hist.redoStackCount() > 0)
                    .do(() => modules.hist.redo()),

                modules.panorama.observe(hotspot, modules.panorama.CLICK)
                    .inhibitBy(modules.panorama.afterUpdate(hotspot, hotspot.prototype.POSITION))
                    .merge(modules.timeline.observe(item, modules.timeline.SELECT))
                    .merge(modules.nav.observe(edge, modules.nav.CLICK))
                    .do(() => modules.hist.commit()),

            ]);

            /*************************************/
            /* logic for buttons in configurator */
            /*************************************/

            routines = routines.concat([
                Rx.Observable.fromEvent(document.querySelector('#set-center-map-settings-button'), 'click')
                    .do(() => settings.map.center(modules.map.getCenter())),

                Rx.Observable.fromEvent(document.querySelector('#set-zoom-map-settings-button'), 'click')
                    .do(() => settings.map.zoom(modules.map.getZoom())),

                Rx.Observable.fromEvent(document.querySelector('#set-minZoom-map-settings-button'), 'click')
                    .do(() => settings.map.minZoom(modules.map.getZoom())),

                Rx.Observable.fromEvent(document.querySelector('#set-maxZoom-map-settings-button'), 'click')
                    .do(() => settings.map.maxZoom(modules.map.getZoom())),

                Rx.Observable.fromEvent(document.querySelector('#set-maxBounds-map-settings-button'), 'click')
                    .do(() => settings.map.maxBounds(modules.map.getBounds())),

                Rx.Observable.fromEvent(document.querySelector('#set-start-timeline-settings-button'), 'click')
                    .do(() => settings.timeline.start(modules.timeline.getStart())),

                Rx.Observable.fromEvent(document.querySelector('#set-end-timeline-settings-button'), 'click')
                    .do(() => settings.timeline.end(modules.timeline.getEnd())),

                Rx.Observable.fromEvent(document.querySelector('#set-min-timeline-settings-button'), 'click')
                    .do(() => settings.timeline.min(modules.timeline.getStart())),

                Rx.Observable.fromEvent(document.querySelector('#set-max-timeline-settings-button'), 'click')
                    .do(() => settings.timeline.max(modules.timeline.getEnd())),

                Rx.Observable.fromEvent(document.querySelector('#set-selections-timeline-settings-button'), 'click')
                    .do(() => settings.timeline.selections(modules.timeline.getSelectionsIds())),

                Rx.Observable.fromEvent(document.querySelector('#set-scene-panorama-settings-button'), 'click')
                    .do(() => settings.panorama.scene(modules.panorama.getVertex() ? modules.panorama.getVertex().id : undefined)),

                Rx.Observable.fromEvent(document.querySelector('#set-yaw-panorama-settings-button'), 'click')
                    .do(() => settings.panorama.yaw(modules.panorama.getYaw())),

                Rx.Observable.fromEvent(document.querySelector('#set-pitch-panorama-settings-button'), 'click')
                    .do(() => settings.panorama.pitch(modules.panorama.getPitch())),

                Rx.Observable.fromEvent(document.querySelector('#set-hfov-panorama-settings-button'), 'click')
                    .do(() => settings.panorama.hfov(modules.panorama.getHfov())),
            ])

            for (let attr in settings.map) {
                let button = document.querySelector('#unset-' + attr + '-map-settings-button');
                if (button)
                    routines.push(
                        Rx.Observable.fromEvent(button, 'click')
                            .do(() => settings.map[attr](undefined))
                    );
            }

            for (let attr in settings.timeline) {
                let button = document.querySelector('#unset-' + attr + '-timeline-settings-button');
                if (button)
                    routines.push(
                        Rx.Observable.fromEvent(button, 'click')
                            .do(() => settings.timeline[attr](undefined))
                    );
            }

            for (let attr in settings.panorama) {
                let button = document.querySelector('#unset-' + attr + '-panorama-settings-button');
                if (button)
                    routines.push(
                        Rx.Observable.fromEvent(button, 'click')
                            .do(() => settings.panorama[attr](undefined))
                    );
            }

            /**************************/
            /* initialization */
            /**************************/

            for (let r of routines) {
                r.catch((err, caught) => {
                    console.log(err);
                    modules.logger.log(err);
                    return caught;
                }).subscribe();
            }


            /**************************/
            /* debugging functions */
            /**************************/

            /**
            * @param {number} count - elements to generate
            */
            var testPerformance = function (count) {
                var vertices = [];
                let start = new Date();
                let tg = modules.model.createTemporalGroup({
                    name: "Testing"
                });
                let sg = modules.model.createSpatialGroup({
                    superGroup: tg,
                    timeslot: new Date(),
                    name: "count = " + count
                });

                for (let i = 0; i < count; i++) {
                    if (i >= 10 && Math.random() < 2 / 3) {
                        modules.model.createEdge({
                            from: vertices[Math.floor(Math.random() * (vertices.length - 1))],
                            to: vertices[Math.floor(Math.random() * (vertices.length - 1))],
                            name: i

                        });
                    } else {
                        vertices.push(modules.model.createVertex({
                            coordinates: [Math.random(), Math.random()],
                            name: i,
                            spatialGroup: sg
                        }));
                    }
                }

                modules.map.observe(point, modules.map.CREATE)
                    .subscribe(p => {
                        if (p.vertex.name === (count - 1)) {
                            console.log(new Date() - start);
                        }
                    });

                modules.map.observe(line, modules.map.CREATE)
                    .subscribe(l => {
                        if (l.edge.name === (count - 1)) {
                            console.log(new Date() - start);
                        }
                    })
            }

            /**
         * 
         * @param {vertes} vertex
        * @returns {vertex}
         */
            var showImage = function (img) {
                if (img.image)
                    img = img.image;
                if (img.img)
                    img = img.img;
                if (typeof img === 'string') {
                    let element = document.createElement('img');
                    element.src = img;
                    img = element;
                } else if (img instanceof ImageBitmap || img instanceof ImageData) {
                    self.canvas = canvas = document.createElement('canvas');
                    self.canvas.width = img.width;
                    self.canvas.height = img.height;
                    self.canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
                    img = canvas;
                }
                $('#help-dialog .modal-body').append(img);
            }

        }).subscribe();
};

if (platform.isCordova) {
    document.addEventListener('deviceready', readyFunction, false);
} else {
    $(document).ready(readyFunction);
}







