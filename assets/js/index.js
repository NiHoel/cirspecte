
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

    $(document).ready(function () {
        var settings = new configurator(config.settings);

        var modules = {
            model: new graph(config.model),
            logger: new logger(),
            filesys: new filesystem(),
            timeline: new timelineViewer("timeline", config.timeline, settings)
        };
        modules.map = new mapViewer("map", config.map, settings, modules),
        modules.panorama = new panoramaViewer("panorama", modules, config.panorama);
        modules.alg = new algorithms(modules);
        modules.nav = new navigationViewer(modules);

        animateLayout(settings, modules);


        /**@type {Rx.Observable} */
        let vertexSelector = modules.map.observe(point, modules.map.CLICK)
            .map(e => e.vertex);

        var routines = createCommonRoutines(modules, settings).concat([
            vertexSelector
                .filter(v => v.type === vertex.prototype.PANORAMA)
                .do(v => modules.map.setView(v.coordinates))
                .mergeMap(v => modules.panorama.loadScene(v)),
        ]);

        if (config.tour) {
            routines.push(modules.alg.readTour(config.tour, modules.filesys));
        }

        for (let r of routines) {
            r.catch((err, caught) => {
                console.log(err);
                modules.logger.log(err);
                return caught;
            }).subscribe();
        }
    });

})(this || document, 'start');