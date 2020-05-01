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
function animateLayout(settings, modules, startIndicators = Rx.Observable.empty(), endIndicators = Rx.Observable.empty()) {
    window.requestAnimationFrame = window.requestAnimationFrame
        || window.mozRequestAnimationFrame
        || window.webkitRequestAnimationFrame
        || window.msRequestAnimationFrame
        || function (f) { return setTimeout(f, 1000 / 60); };

    var animation = true;
    var animationEnded = function () { animation = false; };

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

        modules.map.invalidateSize();
        modules.panorama.invalidateSize();
        modules.timeline.invalidateSize();
    };


    function animate() {
        invalidateSize();

        if (animation)
            window.requestAnimationFrame(animate);
    }

    Rx.Observable.fromEvent($(window), 'resize')
        .subscribe(ev => invalidateSize());

    Rx.Observable.fromEvent($("#bottombar-expander"), 'click')
        .merge(Rx.Observable.fromEvent($("#bottombar-collapser"), 'click'))
        .merge(Rx.Observable.fromEvent($("#bottombar-expander"), 'touchend'))
        .merge(Rx.Observable.fromEvent($("#bottombar-collapser"), 'touchend'))
        .merge(Rx.Observable.fromEvent($(".widget-map"), 'transitionstart'))
        .merge(modules.timeline.observe(modules.timeline.VALUE, modules.timeline.HEIGHTUPDATE))
        .merge(startIndicators)
        .subscribe(() => {
            animation = true;
            clearTimeout(animationEnded);
            setTimeout(animationEnded, 1000); //timeout if there is no transitionend signal
            animate();
        });

    modules.panorama.observe(scene, modules.panorama.CREATE)
        .subscribe(() => {
            modules.map.toggleMinimap(true);
            invalidateSize();
        });

    Rx.Observable.fromEvent($("#bottombar-wrapper"), 'transitionend')
        .merge(Rx.Observable.fromEvent($(".widget-map"), 'transitionend'))
        .merge(endIndicators)
        .subscribe(() => {
            animationEnded();
        });

    settings.hideMap.subscribe(hide => hide ? $('.widget-map').hide() : $('.widget-map').show()); //KoObservable
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
        setTimeout(invalidateSize, 500);
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
                    .filter(success => success && t.settings)
                    .do(() => settings.setOptions(t.settings));

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

    return [
        // vertex -> point
        modules.model.observe(vertex, modules.model.CREATE)
            .do(v => modules.map.createPoint(v))
            .do(v => modules.nav.notifyVertexCreated(v))
            .do(v => v.image.file ? modules.filesys.link(v, v.image.file) : null),

        // edge -> line
        modules.model.observe(edge, modules.model.CREATE)
            .filter(e => e.type !== edge.prototype.LANDMARK) // only landmark connections to current panorama shown
            .do(e => modules.map.createLine(e))
        ,

        // spatialGroup -> layer (multi)
        modules.model.observe(spatialGroup, modules.model.CREATE)
            .do(g => {
                if (g.background && !(g.background instanceof background))
                    g.background = modules.map.getBackground(g.background);
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
            .mergeMap(g => modules.filesys.prepareDirectoryAccess(g))
        ,


        // edge -> hotspot
        modules.model.observe(edge, modules.model.CREATE)
            .filter(e => modules.panorama.getVertex() === e.from)
            .filter(e => e.type !== edge.prototype.TEMPORAL && e.type !== edge.prototype.TEMP)
            .do(e => modules.panorama.createHotspot(e)),


        modules.timeline.observe(item, modules.timeline.SELECT)
            .do(i => modules.map.showLayerGroup(i.spatialGroup)),

        modules.timeline.observe(item, modules.timeline.DESELECT)
            .do(i => modules.map.hideLayerGroup(i.spatialGroup)),

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
            .filter(sg => sg.background)
            .do(sg => sg.background.addSpatialGroup(sg))
            .do(sg => modules.map.showBackground(sg.background)),

        modules.map.observe(layerGroup, modules.map.HIDE)
            .map(l => l.spatialGroup)
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

        /*
         * Listen to all events that cause to load a new tour
         * Load the tour model and apply the view related settings from the tour specification
         * */
        Rx.Observable.fromEvent(document.querySelector('#import-tour'), 'click')
            .filter(f => f instanceof file && f.isType(file.prototype.JSON))
              .mergeMap(loadTour),

        // search for tours
        Rx.Observable.of(true)
            .mergeMap(() => {
                if (config.tour && Object.entries(config.tour).length) // check config file
                    return modules.filesys.getApplicationInternalDirectory()
                        .mergeMap(dir => {
                            modules.filesys.workspace = dir;
                            return loadTour(config.tour, dir)
                        });
                else
                    return Rx.Observable.throw();
            })
            .catch(() => Rx.Observable.of(true))
            .mergeMap(() => {
                var tourParam = new URLSearchParams(window.location.search).get("tour");
                if (tourParam) // check config file
                    return modules.filesys.getApplicationExternalDirectory()
                        .mergeMap(dir => {
                            return dir.searchFile(tourParam)
                                .mergeMap(f => {
                                    modules.filesys.workspace = dir;
                                    return loadTour(f, dir)
                                })
                        });
                else
                    return Rx.Observable.error();
            })
            .catch(() => {
                return modules.filesys.getApplicationExternalDirectory() // check application directory
                    .mergeMap(dir => modules.filesys.request({
                        name: "files/tour.json",
                        parent: dir
                    })
                        .mergeMap(f => {
                            modules.filesys.workspace = dir;
                            return loadTour(f, dir)
                        })
                    );
            })
            .catch(() => {
                return modules.filesys.request({ // ask to specify workspace
                    filter: {
                        folders: true,
                        files: false
                    }
                })
                    .first()
                    .mergeMap(dir => {
                        console.log(dir);
                        modules.filesys.workspace = dir;
                        return dir.searchFile("tour.json")
                            .mergeMap(f => {
                                return loadTour(f, dir);
                            }); 
                    });
            })
            .catch(() => { })
     ];


}

