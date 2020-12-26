'use strict';

/**
 * Interaction between modules required for viewer and editor
 * /

/**
* Ensure that the layout is properly updated (not all modules are abel to self-detect this)
 * 
* @param {Rx.Observable<Event>} startIndicators
* @param {Rx.Observable<Event>} endIndicators
 * @param {JSON} modules
 * @param {panoramaViewer} modules.panorama
* @param {mapViewer} modules.map
* @param {timelineViewer} modules.timeline
 * @param {navigationViewer} modules.nav
*/
function animateLayout(settings, modules, responsiveElements = []) {
    window.requestAnimationFrame = window.requestAnimationFrame
        || window.mozRequestAnimationFrame
        || window.webkitRequestAnimationFrame
        || window.msRequestAnimationFrame
        || function (f) { return setTimeout(f, 1000 / 60); };

    responsiveElements = responsiveElements.concat(
        "#right-pane-wrapper",
        "#topbar-wrapper",
        "#bottombar-wrapper",
        "#timeline",
        ".widget-map"
    )

    var containers = [];
    var bottombarCollapsed = $("#bottombar-wrapper").hasClass("collapsed");
    for (var elem of responsiveElements) {
        containers.push({
            element: $(elem),
            width: $(elem).width(),
            height: $(elem).height()
        });
    }

    function isFullscreen() {
        return !!(document.fullscreen || document.mozFullScreen || document.webkitIsFullScreen || document.msFullscreenElement);
    }

    function invalidateSize() {
        if ($("#bottombar-wrapper").hasClass("collapsed"))
            $("#bottombar-wrapper").height(0);
        else
            $("#bottombar-wrapper").height($('#bottombar').height());

        var height = isFullscreen() ? window.screen.height : $(window).height();
        $('#content').height(height - $('#topbar-wrapper').height() - $('#bottombar-wrapper').height());
        $('#panorama').height($('#content').height());

        modules.panorama.invalidateSize();
        modules.map.invalidateSize();
    };


    function animate() {
        var changed = false;
        for (var con of containers) {
            var width = con.element.width();
            var height = con.element.height();

            if (width !== con.width || height !== con.height)
                changed = true;

            con.width = width;
            con.height = height;
        }

        if (bottombarCollapsed !== $("#bottombar-wrapper").hasClass("collapsed")) {
            bottombarCollapsed = $("#bottombar-wrapper").hasClass("collapsed");
            changed = true;
        }

        if (changed)
            invalidateSize();

        window.requestAnimationFrame(animate);
    }

    animate();

    modules.panorama.observe(scene, modules.panorama.CREATE)
        .subscribe(() => {
            modules.map.toggleMinimap(true);
            invalidateSize();
        });




    settings.fullscreen.subscribe(fullscreen => {
        if (fullscreen == isFullscreen())
            return;

        if (fullscreen) {
            try {
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.mozRequestFullScreen) {
                    document.documentElement.mozRequestFullScreen();
                } else if (document.documentElement.msRequestFullscreen) {
                    document.documentElement.msRequestFullscreen();
                } else {
                    document.documentElement.webkitRequestFullScreen();
                }
            } catch (event) {
                // Fullscreen doesn't work
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitCancelFullScreen) {
                document.webkitCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }

        $('#settings-dialog').modal('hide');
    }); //KoObservable

    Rx.Observable.fromEvent($('#settings-dialog'), 'show.bs.modal')
        .subscribe(() => settings.fullscreen(isFullscreen()));
}

/**
 * 
 * @param {JSON} modules
 * @param {graph} modules.model
 * @param {panoramaViewer} modules.panorama
* @param {filesystem} modules.filesys
* @param {mapViewer} modules.map
* @param {timelineViewer} modules.timeline
 * @param {algorithms} modules.alg
 * @param {navigationViewer} modules.nav
* @returns {[Rx.Observable]}
 */
function createCommonRoutines(modules, settings) {
    if (platform.mobile == null)
        platform.mobile = platform.product != null || /Mobile/.test(platform.browser);



    /********************/
    /* common functions */
    /********************/

    /**@type {Rx.Observable} */
    let vertexSelector = modules.map.observe(point, modules.map.CLICK)
        .map(e => e.vertex);

    let timeEdgeSelector = modules.timeline.observe(item, modules.timeline.SELECT)
        .filter(i => modules.panorama.getVertex() != null && modules.panorama.getVertex().spatialGroup !== i.spatialGroup)
        .mergeMap(i => modules.panorama.getVertex().toObservable().filter(e => e.type === edge.prototype.TEMPORAL && e.to.spatialGroup === i.spatialGroup));

    let loadTour = (f, dir) => {
        var obs;

        if (!dir && f.getParent)
            dir = f.getParent();

        if (f instanceof file)
            obs = f.readAsJSON();
        else
            obs = Rx.Observable.of(f);

        return obs
            .mergeMap(t => {
                var obs = modules.alg.readTour(t, dir)
                    .do(success => {
                        if (success && t.settings)
                            settings.setOptions(t.settings);

                            // create temporal edges
                            try {
                                var applicationDir = window.location.href;
                                var lastSlash = applicationDir.lastIndexOf('/');
                                var lastPoint = applicationDir.lastIndexOf('.');
                                if (lastSlash >= 0 && lastPoint > lastSlash)
                                    applicationDir = applicationDir.substring(0, lastSlash);

                                var scripts = ["dms.js", "vector3d.js", "latlon-ellipsoidal.js", "latlon-vincenty.js"]
                                    .map(s => "geodesy/" + s)
                                    .concat(["priority-queue.min.js"])
                                    .map(s => "'" + applicationDir + "/assets/js/lib/" + s + "'")
                                    .join(",");

                                var worker = algorithms.createInlineWorker(json => {
                                    var model = new graph();
                                    var alg = new algorithms({
                                        model: model,
                                        logger: { log: console.log },
                                        map: { getBackground: () => { return null; } }
                                    });

                                    alg.loadGraph(json, new directory(""));
                                    var edges = alg.connectAllColocated();
                                    self.postMessage(edges.map(e => e.toJSON()));
                                }, ["self.window = self;",
                                    "importScripts(" + scripts + ");",
                                    algorithms,
                                    "class observable{constructor(){}emit(){}}",
                                    graph, edge, vertex, spatialGroup, temporalGroup, directory]);

                                worker.onmessage = msg => {
                                    for (var edge of msg.data)
                                        try {
                                            modules.model.createEdge(edge);
                                        } catch (e) { }

                                    worker.terminate();
                                };

                                worker.postMessage(modules.model.toJSON());
                            } catch (e) {
                                console.log(e);
                            }
                        
                    })
                    .filter(success => success && t.settings);

                if (t.settings && t.settings.panorama)
                    return obs
                        .filter(() => t.settings.panorama.scene)
                        .mapTo(t.settings.panorama.scene)
                else
                    return obs.ignoreElements();
            })
            //                   .subscribe({ error: console.log });
            .mergeMap(initialScene => {
                try {
                    return Rx.Observable.of(modules.model.getVertex(initialScene)); //throws if not existent
                } catch (err) {
                    return modules.model.observe(vertex, modules.model.CREATE)
                        .filter(v => v.id == initialScene);
                }
            })
            .delay(1000)  // give filesystem enough time to register all files
            .mergeMap(v => modules.panorama.loadScene(v, settings.getPanoramaOptions()));
    }

    /**************************/
    /* Rx.Observable routines */
    /**************************/

    var obs = [
        // vertex -> point
        modules.model.observe(vertex, modules.model.CREATE)
            .do(v => modules.map.createPoint(v))
            .do(v => modules.nav.notifyVertexCreated(v))
            .do(v => v.image.file ? modules.filesys.link(v, v.image.file) : null),

        // edge -> line
        modules.model.observe(edge, modules.model.CREATE, Rx.Scheduler.queue)
            .filter(e => e.type !== edge.prototype.LANDMARK) // only landmark connections to current panorama shown
            .do(e => modules.map.createLine(e))
        ,

        // spatialGroup -> layer (multi)
        modules.model.observe(spatialGroup, modules.model.CREATE)
            .do(g => {
                if (g.background && !(g.background instanceof background))
                    try {
                        g.background = modules.map.getBackground(g.background);
                    } catch (e) {
                        delete g.background;
                        throw e;
                    }

                modules.map.createLayerGroup(g)
            }),

        // spatialGroup -> item
        modules.model.observe(spatialGroup, modules.model.CREATE)
            .do(g => modules.timeline.createItem(g))
        ,

        // temporalGroup -> group
        modules.model.observe(temporalGroup, modules.model.CREATE)
            .do(g => modules.map.createControlGroup(g))
            .do(g => modules.timeline.createGroup(g))
        ,

        modules.model.observe(spatialGroup, modules.model.CREATE)
            .filter(g => g.type !== spatialGroup.prototype.LANDMARK)
            .mergeMap(g => modules.filesys.prepareDirectoryAccess(g)
                .catch(err => {
                    modules.logger.log(err);
                    modules.model.deleteSpatialGroup(g);
                    return Rx.Observable.empty();
                })
            )
        ,


        // edge -> hotspot
        modules.model.observe(edge, modules.model.CREATE, Rx.Scheduler.queue)
            .filter(e => modules.panorama.getVertex() === e.from)
            .filter(e => e.type !== edge.prototype.TEMPORAL && e.type !== edge.prototype.TEMP)
            .do(e => modules.panorama.createHotspot(e)),


        modules.timeline.observe(item, modules.timeline.SELECT)
            .do(i => modules.map.showLayerGroup(i.spatialGroup)),

        modules.timeline.observe(item, modules.timeline.DESELECT)
            .do(i => modules.map.hideLayerGroup(i.spatialGroup)),

        modules.timeline.observe(rangeItem, modules.timeline.CLICK)
            .do(i => modules.timeline.expandRange(i)),

        // exclusive groups
        modules.timeline.observe(item, modules.timeline.SELECT)
            .map(i => i.spatialGroup.superGroup)
            .mergeMap(selGroup => {
                return Rx.Observable.of(selGroup)
                    .expand(g => {
                        if (!g.superGroup)
                            return Rx.Observable.empty();
                        return Rx.Observable.of(g.superGroup);
                    })
                    .filter(g => g.exclusiveTemporalSubgroups && g != selGroup)
                    .mergeMap(g => g.toObservable())
                    .filter(g => g instanceof temporalGroup && !selGroup.isAncestor(g));;
            })
            .expand(g => {
                if (g instanceof spatialGroup)
                    return Rx.Observable.empty();
                return g.toObservable();
            })
            .filter(sg => sg instanceof spatialGroup && sg.item)
            .observeOn(Rx.Scheduler.queue)
            .do(sg => modules.timeline.toggleSelection(sg.item, false)),

        modules.panorama.observe(scene, modules.panorama.CREATE)
            .do(s => modules.map.setView(s.vertex.coordinates))
            .mergeMap(s => s.vertex.toObservable())
            .filter(e => e.type !== edge.prototype.TEMPORAL && e.type !== edge.prototype.PLACEHOLDER)
            .map(e => modules.panorama.createHotspot(e, e.type === edge.prototype.LANDMARK ? hotspot.prototype.LANDMARK : hotspot.prototype.ROUTE)) // error propagation fails when using do
        ,

        modules.panorama.observe(scene, modules.panorama.CREATE)
            .do(s => modules.nav.setVertex(s.vertex))
            .do(s => modules.timeline.toggleSelection(s.vertex.spatialGroup.item, true)),

        modules.map.observe(layerGroup, modules.map.SHOW)
            .map(l => l.spatialGroup)
            .do(sg => modules.nav.notifySpatialGroupShown(sg))
            .filter(sg => sg.background)
            .do(sg => sg.background.addSpatialGroup(sg))
            .do(sg => modules.map.showBackground(sg.background)),

        modules.map.observe(layerGroup, modules.map.HIDE)
            .map(l => l.spatialGroup)
            .do(sg => modules.nav.notifySpatialGroupHidden(sg))
            .filter(sg => sg.background)
            .do(sg => sg.background.removeSpatialGroup(sg))
            .filter(sg => !sg.background.hasShownSpatialGroups() && !sg.background.editable)
            .do(sg => modules.map.hideBackground(sg.background)),

        modules.model.afterUpdate(spatialGroup, spatialGroup.prototype.BACKGROUND)
            .filter(sg => modules.timeline.isSelected(sg.item) && sg.background)
            .do(sg => sg.background.addSpatialGroup(sg))
            .do(sg => modules.map.showBackground(sg.background)),

        modules.panorama.observe(hotspot, modules.panorama.CLICK)
            .inhibitBy(modules.panorama.afterUpdate(hotspot, hotspot.prototype.POSITION))
            .map(h => h.edge)
            .do(e => modules.panorama.lookAt(e))
            .merge(timeEdgeSelector)
            .filter(e => e.to.type === vertex.prototype.PANORAMA)
            .merge(modules.nav.observe(edge, modules.nav.CLICK))
            .mergeMap(e => {
                return modules.filesys.prepareFileAccess(e.to)
                    .mergeMap(v => modules.panorama.transition(e))
            })
        ,

        modules.nav.observe(vertex, modules.nav.LOCATIONUPDATE)
            .mergeMap(v => {
                return modules.filesys.prepareFileAccess(v)
                    .mergeMap(v => modules.panorama.loadScene(v))
            }),

        modules.filesys.observe(modules.filesys.DIRECTORY, modules.filesys.WORKSPACE)
            .filter(() => modules.settings.loadRecentWorkspace())
            .do(d => modules.settings.recentWorkspace(d.getPath())),


        // initial search for tours
        Rx.Observable.of(true)
            .mergeMap(() => {
                if (config.tour && Object.entries(config.tour).length) // check config file
                    return modules.filesys.getApplicationDirectory()
                        .map(dir => [config.tour, dir]);
                else
                    return Rx.Observable.throw();
            })
            .catch(() => {
                var tourParam = new URLSearchParams(window.location.search).get("tour");
                if (tourParam) // check query parameter
                    return modules.filesys.getApplicationDirectory()
                        .mergeMap(dir => {
                            return dir.searchFile(tourParam)
                                .map(f => [f, f.getParent()]);
                        });
                else
                    return Rx.Observable.throw();
            })
            .catch(() => {
                if (modules.settings.recentWorkspace()) // check recent workspace
                    return modules.filesys.getApplicationDirectory()
                        .mergeMap(d => d.searchDirectory(modules.settings.recentWorkspace()))
                        .mergeMap(dir => {
                            modules.filesys.setWorkspace(dir);
                            return dir.searchFile("tour.json")
                                .map(f => [f, dir]);
                        });
                else
                    return Rx.Observable.throw();
            })
            .catch(() => {
                return modules.filesys.request({ // ask to specify workspace
                    workspace: true,
                    filter: {
                        folders: true,
                        files: false
                    }
                })
                    .mergeMap(dir => {
                        modules.filesys.setWorkspace(dir);
                        return dir.searchFile("tour.json")
                            .map(f => [f, dir]);
                    });
            })
            .mergeMap(arr => {
                return loadTour(arr[0], arr[1]);
            })
            .catch((err, caught) => {
                console.log(err);
                modules.logger.log(err);
                return Rx.Observable.empty(); // avoid re-subscription
            })
    ];

    /*
   * Listen to all events that cause to load a new tour
   * Load the tour model and apply the view related settings from the tour specification
   * */
    if (document.querySelector('#import-tour'))
        obs.push(Rx.Observable.fromEvent(document.querySelector('#import-tour'), 'click')
            .mergeMap(() => modules.filesys.request({
                parent: modules.filesys.getWorkspace(),
                multi: false,
                filter: {
                    files: true,
                    folders: false
                }
            }))
            .filter(f => f instanceof file && f.isType(file.prototype.JSON))
            .mergeMap(f => loadTour(f))
        );

    if (document.querySelector('#import-workspace'))
        obs.push(Rx.Observable.fromEvent(document.querySelector('#import-workspace'), 'click')
            .mergeMap(() => modules.filesys.request({
                parent: modules.filesys.getWorkspace(),
                workspace: true,
                multi: false,
                filter: {
                    files: false,
                    folders: true
                }
            })
                .mergeMap(dir => dir.searchFile("tour.json")
                    .filter(f => f instanceof file && f.isType(file.prototype.JSON))
                    .mergeMap(f => loadTour(f, dir))
                )
            )
        );

    if (document.querySelector('#switch-workspace'))
        obs.push(Rx.Observable.fromEvent(document.querySelector('#switch-workspace'), 'click')
            .mergeMap(() => modules.filesys.request({
                parent: modules.filesys.getWorkspace(),
                workspace: true,
                multi: false,
                filter: {
                    files: false,
                    folders: true
                }
            }))
            .mergeMap(dir => dir.searchFile("tour.json")
                .filter(f => f instanceof file && f.isType(file.prototype.JSON))
                .do(() => {
                    if (modules.hist)
                        modules.hist.commit();

                    var temporalGroups = Array.from(modules.model.temporalGroups.values());
                    for (var tg of temporalGroups) {
                        modules.model.deleteTemporalGroup(tg);
                    }

                    for (var b of Array.from(modules.map.backgrounds.values())) {
                        modules.map.deleteBackground(b);
                    }

                    modules.filesys.setWorkspace(dir);

                    if (modules.hist)
                        modules.hist.clear();
                })
                .mergeMap(f => loadTour(f, dir))
            )
        );

    modules.settings.loadRecentWorkspace.subscribe(enabled => {
        var workspace = modules.filesys.getWorkspace();
        if (enabled && workspace)
            modules.settings.recentWorkspace(workspace.getPath())
        else
            modules.settings.recentWorkspace(null);
    });

    return obs;
}

