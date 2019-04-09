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
        this.corners = ko.observable();
        this.skewEditable = ko.observable(false);

        this.shown = false;

        ko.applyBindings(this, $('#map-editor')[0]);

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

            modules.map.afterUpdate(background, background.prototype.OPACITY)
                .filter(b => this.currentBackground() === b)
                .do(b => this.opacity(b.opacity)),

            modules.map.beforeUpdate(background, background.prototype.CORNERS)
                .do(b => {
                    if (!this.skewEditable()) {
                        // TODO
                    }

                }),
        ];

        this.currentBackground.subscribe(b => {
            if (this.prevBackground && this.backgrounds().indexOf(this.prevBackground) != -1)
                this.modules.map.unsetEditable(this.prevBackground);

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
                        path: f.getPath()
                    },
                    label: f.name,
                    corners: [ // cover 1/4 of the map around the center
                        [(c[0] + bounds[1][0]) / 2, (c[1] + bounds[0][1]) / 2],
                        [(c[0] + bounds[1][0]) / 2, (c[1] + bounds[1][1]) / 2],
                        [(c[0] + bounds[0][0]) / 2, (c[1] + bounds[0][1]) / 2]
                    ]
                });
                setTimeout(() => { this.currentBackground(b); }, 0)
                return b;
            })
            .catch((err, caught) => {
                console.log(err);
                modules.logger.log(err);
                return caught;
            }).subscribe();
    }
}