'use strict';

(function (root, name) {
    'use strict';
    var _ = function () {

    };

    var conflict = root[name];

    root[name] = _;

    _.noConflict = function () {
        root[name] = conflict;

        return _;
    };

    Rx.Observable.fromEvent(document, 'drop')
        .subscribe(e => e.preventDefault());

    function readyFunction() {
        Rx.Observable.create(obs => {
            obs.next({ settings: new configurator(config.settings) });
            obs.complete();
        }).observeOn(Rx.Scheduler.asap)
            .do(modules => {
                modules.model = new graph(),
                    modules.logger = new logger(),
                    modules.filesys = new filesystem(),
                    modules.timeline = new timelineViewer("timeline", modules, config.timeline)
            }).observeOn(Rx.Scheduler.asap)
            .do(modules => {
                modules.map = new mapViewer("map", modules, config.map)

            }).observeOn(Rx.Scheduler.asap)
            .do(modules => {
                modules.panorama = new panoramaViewer("panorama", modules, config.panorama);
                modules.alg = new algorithms(modules);
                modules.nav = new navigationViewer(modules);
            }).observeOn(Rx.Scheduler.asap)
            .do(modules => {

                var settings = modules.settings;

                animateLayout(settings, modules);


                /**@type {Rx.Observable} */
                let vertexSelector = modules.map.observe(point, modules.map.CLICK)
                    .map(e => e.vertex);

                var routines = createCommonRoutines(modules, settings).concat([
                    vertexSelector
                        .filter(v => v.type === vertex.prototype.PANORAMA)
                        .do(v => modules.map.setView(v.coordinates))
                        .mergeMap(v => modules.panorama.loadScene(v)),

                    modules.panorama.observe(scene, modules.panorama.CREATE)
                        .do(s => {
                            modules.timeline.setAllActive(false);
                            modules.timeline.setActive(s.vertex.spatialGroup, true);
                            modules.timeline.center(s.vertex.spatialGroup);
                        })
                        .mergeMap(s => s.vertex.toObservable())
                        .filter(e => e.type === edge.prototype.TEMPORAL)
                        .map(e => modules.timeline.setActive(e.to.spatialGroup, true)),

                    modules.model.observe(edge, modules.model.CREATE)
                        .filter(e => modules.panorama.getVertex() === e.from && e.type === edge.prototype.TEMPORAL)
                        .map(e => modules.timeline.setActive(e.to.spatialGroup, true))
                ]);

                for (let r of routines) {
                    r.catch((err, caught) => {
                        console.log(err);
                        modules.logger.log(err);
                        return caught;
                    }).subscribe();
                }

            }).subscribe();
    }

    if (platform.isCordova) {
        document.addEventListener('deviceready', readyFunction, false);
    } else {
        $(document).ready(readyFunction);
    }

})(this || document, 'start');