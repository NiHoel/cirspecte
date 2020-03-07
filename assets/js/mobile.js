
Rx.Observable.fromEvent(document, 'drop')
    .do(e => e.preventDefault()),

    $(window).bind('beforeunload', function () {
        return 'Are you sure you want to leave? All unsaved changes will be lost!';
    });

$(document).ready(function () {
    settings = new configurator(config.settings);

    modules = {
        model: new graph(),
        logger: new logger(),
        filesys: new filesystem(),
        timeline: new timelineViewer("timeline", config.timeline, settings)
    };
    modules.map = new mapViewer("map", config.map, settings, modules),
    modules.panorama = new panoramaViewer("panorama", modules, config.panorama);
    modules.alg = new algorithms(modules);
    modules.nav = new navigationViewer(modules);
    modules.hist = new commandHistory(modules);

    editors = {
        groupEdit: new groupEditor(settings, modules)
    };



    /********************/
    /* layout animation */
    /********************/

    var startIndicators = Rx.Observable.fromEvent($("#sidebar-expander"), 'click')
        .merge(Rx.Observable.fromEvent($("#sidebar-collapser"), 'click'))
        .merge(Rx.Observable.fromEvent($("#sidebar-expander"), 'touchend'))
        .merge(Rx.Observable.fromEvent($("#sidebar-collapser"), 'touchend'))

    animateLayout(settings, modules, startIndicators, Rx.Observable.fromEvent($("#sidebar-wrapper"), 'transitionend'));



    /**************************/
    /* Rx.Observable routines */
    /**************************/

    let routines = createCommonRoutines(modules, settings).concat([

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

        modules.panorama.observe(hotspot, modules.panorama.CLICK)
            .inhibitBy(modules.panorama.afterUpdate(hotspot, hotspot.prototype.POSITION))
            .merge(modules.timeline.observe(item, modules.timeline.SELECT))
            .merge(modules.nav.observe(edge, modules.nav.CLICK))
            .do(() => modules.hist.commit()),

        // logic for save button
        Rx.Observable.fromEvent(document.querySelector('#export'), 'click')
            .do(() => {
                var json = modules.model.toJSON({ persistLandmarks: settings.persistLandmarks() });
                json.settings = settings.toJSON();
                if (settings.autoSaveSelectedItems())
                    json.settings.timeline.selections = modules.timeline.getSelectionsIds();
                json.map = modules.map.toJSON();
                modules.alg.saveJSON(json);
            }),


    ]);


    /**************************/
    /* initialization */
    /**************************/

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







