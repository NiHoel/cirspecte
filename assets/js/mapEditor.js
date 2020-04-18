'use strict';

/**
 * Presentation layer for manipulating the tile layers and image overlays of the map.
 * */
class mapEditor extends observable {
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

        this.currentBackground = ko.observable();
        this.prevBackground = null;
        this.backgrounds = ko.observableArray();
        this.opacity = ko.observable(0.5);
        this.corners; // store corners of selected background when dragging
        this.skewEditable = ko.observable(false);

        this.landmarkGroups = ko.observableArray();
        this.landmarkGroup = ko.observable();

        this.shown = false;

        ko.applyBindings(this, $('#map-editor')[0]);

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
                .filter(ev => ev.target === $('.nav-tabs a[href="#map-editor"]')[0])
                .do(() => this.shown = true)
                .do(() => this.modules.map.toggleMinimap(false))
                .do(() => this.opacity(this.currentBackground() ? this.currentBackground().opacity : 0.5))
                .do(() => this.modules.map.setEditable(this.currentBackground()))
            ,

            Rx.Observable.fromEvent($('.nav-tabs a'), 'hide.bs.tab')
                .filter(ev => ev.target === $('.nav-tabs a[href="#map-editor"]')[0])
                .do(() => this.shown = false)
                .do(() => this.modules.map.unsetEditable(this.currentBackground()))
            ,

            modules.map.observe(background, modules.map.CREATE)
                .do(b => this.backgrounds.push(b)),

            modules.map.observe(background, modules.map.DELETE)
                .do(b => this.backgrounds.remove(b)),

            modules.model.observe(spatialGroup, modules.model.CREATE)
                .filter(g => g.type == spatialGroup.prototype.LANDMARK)
                .do(g => this.landmarkGroups.push(g)),

            modules.model.observe(spatialGroup, modules.model.DELETE)
                .do(g => this.landmarkGroups.remove(g)),

            modules.map.observe(point, modules.map.CLICK)
                .filter(() => this.isShown() && modules.panorama.getScene() != null)
                .do(() => modules.hist.commit())
                .map(e => e.vertex)
                .filter(v => modules.panorama.getVertex() !== v)
                .mergeMap(v => modules.panorama.loadScene(v)),

            modules.timeline.observe(item, modules.timeline.CREATE)
                .do(i => {
                    if (this.isShown())
                        modules.timeline.toggleSelection(i, true);
                }),
            
            modules.map.observe(modules.map.COORDINATES, modules.map.CLICK)
                .filter(() => this.isShown())
                .inhibitBy(modules.map.observe(point, modules.map.CLICK), 100)
                .inhibitBy(modules.map.observe(line, modules.map.CLICK), 100)
                .filter(() => this.settings.createVertexOnMapClick())
                .do(() => modules.hist.commit())
                .map(c => modules.model.createVertex({ coordinates: c, type: vertex.prototype.LANDMARK, spatialGroup: this.landmarkGroup() })),

            modules.map.afterUpdate(background, background.prototype.OPACITY)
                .filter(b => this.currentBackground() === b)
                .do(b => this.opacity(b.opacity)),

            modules.map.beforeUpdate(background, background.prototype.CORNERS)
                .do(b => {
                    this.corners = $.extend(true, [], b.corners);
                }),

            modules.map.observe(background, modules.map.DRAG)
                .do(b => {
                    if (!this.skewEditable()) {
                        var dragged = b.corners.map((c, i) => !recursiveCompare(c, this.corners[i]));
                        var corners = $.extend(true, [], b.corners);

                        // translate image when dragging marker in top left corner
                        if (dragged[0]) {
                            corners[1][0] += b.corners[0][0] - this.corners[0][0];
                            corners[1][1] += b.corners[0][1] - this.corners[0][1];
                            corners[2][0] += b.corners[0][0] - this.corners[0][0];
                            corners[2][1] += b.corners[0][1] - this.corners[0][1];
                        }

                        // scale width and rotate image when dragging marker in top right corner
                        else if (dragged[1]) {
                            //compute angle(b.corners[1], this.corners[0], this.corners[1])
                            /*(
                             (this.corners[0][0] - b.corners[1][0]) * (this.corners[1][0] - this.corners[0][0])
                             + (this.corners[0][1] - b.corners[1][1]) * (this.corners[1][1] - this.corners[0][1])
                         ) / (Math.sqrt(
                             Math.pow(this.corners[0][0] - b.corners[1][0], 2)
                             + Math.pow(this.corners[0][1] - b.corners[1][1], 2)
                         ) * Math.sqrt(
                             Math.pow(this.corners[1][0] - this.corners[0][0], 2)
                             + Math.pow(this.corners[1][1] - this.corners[0][1], 2)
                         ));*/
                            var height = algorithms.getDistance(this.corners[0], b.corners[2]);
                            var bearingHeight = algorithms.getAzimuth(this.corners[0], b.corners[1])
                                + algorithms.getAzimuth(this.corners[0], this.corners[2])
                                - algorithms.getAzimuth(this.corners[0], this.corners[1]);
                            corners[2] = algorithms.getCoords(this.corners[0], height, bearingHeight);
                        }

                        // scale height and rotate image when dragging marker in top right corner
                        else if (dragged[2]) {
                            var width = algorithms.getDistance(this.corners[0], b.corners[1]);
                            var bearingWidth = algorithms.getAzimuth(this.corners[0], b.corners[2])
                                + algorithms.getAzimuth(this.corners[0], this.corners[1])
                                - algorithms.getAzimuth(this.corners[0], this.corners[2]);
                            corners[1] = algorithms.getCoords(this.corners[0], width, bearingWidth);
                        }

                        // discard invalid results
                        if (corners.flat().map(Number.isFinite).reduce((a, b) => a && b, true))
                            this.corners = corners;

                        this.modules.map.updateCorners(b, this.corners);
                    }
                }),
        ];

        this.currentBackground.subscribe(b => {
            if (this.prevBackground && this.backgrounds().indexOf(this.prevBackground) != -1)
                this.modules.map.unsetEditable(this.prevBackground);
	
            if(b)
		this.opacity(b.opacity);
	
            if (this.isShown())
                this.modules.map.setEditable(this.currentBackground());

            this.prevBackground = b;
        });

        this.opacity.subscribe(val => {
            if (this.currentBackground())
                this.modules.map.updateOpacity(this.currentBackground(), val);
        })

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

    createBackground() {
        this.modules.hist.commit();

        this.modules.filesys.request({ filter: { folders: false }, multi: false })
            .filter(f => f.isType([file.prototype.JPG, file.prototype.PNG]))
            .map(f => {
                var c = modules.map.getCenter();
                var bounds = modules.map.getBoundsArray();
                var b = modules.map.createBackground({
                    image: {
                        file: f,
                        path: f.getPath(this.modules.filesys.getRoot())
                    },
                    label: f.name,
                    corners: [ // cover 1/4 of the map around the center
                        [(c[0] + bounds[1][0]) / 2, (c[1] + bounds[0][1]) / 2],
                        [(c[0] + bounds[1][0]) / 2, (c[1] + bounds[1][1]) / 2],
                        [(c[0] + bounds[0][0]) / 2, (c[1] + bounds[0][1]) / 2]
                    ]
                });
                setTimeout(() => { this.currentBackground(b); }, 1000)
                return b;
            })
            .catch((err, caught) => {
                console.log(err);
                modules.logger.log(err);
                return caught;
            }).subscribe();
    }

    deleteCurrentBackground() {
        this.modules.hist.commit();

        this.modules.model.spatialGroups.forEach(sg => {
            if (sg.background === this.currentBackground())
                this.modules.model.updateBackground(sg, null);
        });

        this.modules.map.deleteBackground(this.currentBackground());
    }
}