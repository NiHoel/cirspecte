'use strict';

/*
 * Presentation layer for manipulating temporal or spatial groups.
 *
 * Listen to events: groupEditor.observe(<class>, SELECT).subscribe(elem => / do something with element here /)
 * where <class> in {spatialGroup, temporalGroup}
 * */

class groupEditor extends observable {
    get [Symbol.toStringTag]() {
        return 'Group Editor';
    }

    /**
     *
     * @param {configurator} modules.settings
     * @param {graph} modules.model
     * @param {filesystem} modules.filesys
     * @param {algorithms} modules.alg
     */
    constructor(modules) {
        super();
        this.modules = modules;

        this.prev = {
            temporalGroup: null,
            spatialGroup: null,
            vertex: null // used for lines
        };

        this.current = {
            temporalGroup: ko.observable(),
            spatialGroup: ko.observable(),
            vertex: null // used for dragging
        };

        this.spatialGroupTypes = [spatialGroup.prototype.ROUTE, spatialGroup.prototype.LANDMARK, spatialGroup.prototype.SINGLESHOT];
        this.temporalGroupTypes = [temporalGroup.prototype.TOUR, temporalGroup.prototype.LANDMARK];
        this.multiresSceneTypes = [{
            type: "multiresrec",
            name: "Tiled equirectangular image",
            // only non common attributes
            attributes: new Set(["originalWidth", "originalHeight"]),
            path: "%l0/%x_%y"
        },
        //{
        //    type: "cubemap",
        //    name: "Six faces of a cube map",
        //    attributes: new Set(["baseHeight", "baseWidth", "maxLevel",])
        //},
        {
            type: "multires",
            name: "Tiled six faces of a cube map",
            attributes: new Set(["cubeResolution"]),
            path: "%f/%l0/%x_%y"
        }];
        this.extensionOptionsSDR = ["jpg", "webp", "png", "avif"];
        this.extensionOptionsHDR = ["hdr"];
        this.cubeSides = ['f', 'b', 'u', 'd', 'l', 'r']

        this.default = {
            temporalGroup: {
                id: '', name: '', description: '', type: temporalGroup.prototype.TOUR, superGroup: '', autoConnectColocated: true, colocatedRadius: 3, multiselect: false, exclusiveTemporalSubgroups: false
            },
            spatialGroup: {
                id: '', name: '', description: '', type: spatialGroup.prototype.SINGLESHOT, background: null, superGroup: '', path: ko.observable(''), timeslot: ko.observable(moment())
            },
            multiresPanorama: {
                sceneType: ko.observable(this.multiresSceneTypes[0]), hdr: false, extension: 'jpg', extensionOptions: this.extensionOptionsSDR, path: '%l0/%x_%y', basePath: '', directory: null, tileResolution: 2048, maxLevel: 4, originalWidth: 16384, originalHeight: 8192, cubeResolution: 4096
            }
        };

        this.editable = {
            temporalGroup: ko.observable(Object.assign({}, this.default.temporalGroup)),
            spatialGroup: ko.observable(Object.assign({}, this.default.spatialGroup)),
            multiresPanorama: ko.observable(ko.mapping.fromJS(this.default.multiresPanorama))
        };

        this.errors = {
            path: ko.observable("")
        }

        this.spatialGroupTemplate = ko.observable();

        this.spatialGroups = ko.observableArray();
        this.temporalGroups = ko.observableArray();
        this.backgrounds = ko.observableArray();
        this.shown = true;
        this.gpsCoordinates = ko.observable();



        this.scannable = ko.pureComputed(function () {
            return this.current.spatialGroup() && this.current.spatialGroup().images.directory && this.current.spatialGroup().images.directory.canScan();
        }, this);

        this.editingModes = ko.observableArray($.map(this.EDIT, function (value, index) {
            return [value];
        }));

        this.editingMode = ko.observable(this.EDIT.SCENE);

        this.dragCurrentVertex = ko.observable(false);

        // constraints for multires panorama import editor
        this.hdrSubscription = ko.computed(() => {
            if (this.editable.multiresPanorama().hdr())
                this.editable.multiresPanorama().extensionOptions(this.extensionOptionsHDR);
            else
                this.editable.multiresPanorama().extensionOptions(this.extensionOptionsSDR);
        });

        this.pathSubscription = ko.computed(() => {
            this.editable.multiresPanorama().path(this.editable.multiresPanorama().sceneType().path)
        })

        this.canAddMultiresPanorama = ko.pureComputed(() => {
            var p = this.editable.multiresPanorama();
            return this.current.spatialGroup() && p.path() && p.basePath() && p.extensionOptions().indexOf(p.extension()) != -1 &&
                parseInt(p.tileResolution()) > 0 && parseInt(p.originalWidth()) > 0 && parseInt(p.originalHeight()) > 0 && parseInt(p.cubeResolution()) > 0 && parseInt(p.maxLevel()) >= 0;
        });

        $('.js-example-responsive').select2();
        $('#timeslot').datetimepicker();

        ko.applyBindings(this, $('#group-editor')[0]);
        ko.applyBindings(this, $('#spatial-group-editor')[0]);
        ko.applyBindings(this, $('#temporal-group-editor')[0]);
        if ($('#template-application-dialog')[0])
            ko.applyBindings(this, $('#template-application-dialog')[0]);
        if ($('#import-multires-panorama-editor')[0])
            ko.applyBindings(this, $('#import-multires-panorama-editor')[0]);

        this.current.spatialGroup.subscribe(g => this.emit(g, this.SELECT, this.SPATIALGROUP));
        this.current.temporalGroup.subscribe(g => this.emit(g, this.SELECT, this.TEMPORALGROUP));

        this.initialize();
    }

    /**
     * Setup of event listeners.
     * */
    initialize() {
        /**@type {Rx.Observable} */
        var vertexSelector = new Rx.Subject();

        let modules = this.modules;

        this.dragCurrentVertex.subscribe((enabled) => {
            if (enabled)
                modules.map.setEditable(this.modules.panorama.getVertex());
            else
                modules.map.unsetEditable(this.modules.panorama.getVertex());
        });

        let routines = [
            Rx.Observable.fromEvent($('.nav-tabs a'), 'show.bs.tab')
                .filter(ev => ev.target === $('.nav-tabs a[href="#group-editor"]')[0])
                .do(() => this.shown = true)
                .mergeMap(() => this.setEditable(this.current.spatialGroup()))
            ,

            Rx.Observable.fromEvent($('.nav-tabs a'), 'hide.bs.tab')
                .filter(ev => ev.target === $('.nav-tabs a[href="#group-editor"]')[0])
                .do(() => this.shown = false)
                .mergeMap(() => this.unsetEditable(this.current.spatialGroup()))
            ,

            // edge -> line
            modules.map.observe(line, modules.map.CREATE)
                .filter(l => l.edge.isAncestor(this.current.spatialGroup()))
                .mergeMap(l => this.setEditable(l.edge)),

            // spatialGroup -> item
            modules.model.observe(spatialGroup, modules.model.CREATE)
                .do(g => this.spatialGroups.push(g))
            ,

            // temporalGroup -> group
            modules.model.observe(temporalGroup, modules.model.CREATE)
                .do(g => this.temporalGroups.push(g))
            ,

            modules.model.observe(spatialGroup, modules.model.DELETE)
                .do(g => this.spatialGroups.remove(g)),

            modules.model.observe(temporalGroup, modules.model.DELETE)
                .do(g => this.temporalGroups.remove(g)),

            modules.map.observe(point, modules.map.CLICK)
                .filter(() => this.isShown())
                .do(() => modules.hist.commit())
                .map(e => e.vertex)
                .do(vertexSelector),

            vertexSelector
                .filter(() => this.editingMode() === this.EDIT.SCENE)
                .filter(v => v.type === vertex.prototype.PANORAMA)
                .do(v => modules.map.setView(v.coordinates))
                .mergeMap(v => modules.panorama.loadScene(v))
            ,

            vertexSelector
                .filter(() => this.editingMode() === this.EDIT.LINE || this.editingMode() === this.EDIT.POLYLINE)
                .do(v => this.addToLine(v)),

            // create panorama vertex from placeholder by requesting a file
            vertexSelector.filter(v => this.editingMode() === this.EDIT.SCENE && v.type === vertex.prototype.PLACEHOLDER)
                .filter(v => {
                    if (this.current.spatialGroup() && this.modules.settings.multiresPanoramaImport()) {
                        this.beginMultiresPanoramaImport(v);
                        return false;
                    }

                    return true;
                })
                .mergeMap(v =>
                    modules.filesys.request({
                        parent: v.spatialGroup.images.directory,
                        multi: false,
                        filter: { files: true, folders: false }
                    })
                        .do(f => {
                            if (!f.isType(file.prototype.IMAGE))
                                throw new error(this.ERROR.UNSUPPORTED_IMAGE_TYPE, "", f.name);
                            var parentDir = v.spatialGroup.images.directory || v.spatialGroup.directory || (this.current.spatialGroup() ? this.current.spatialGroup().images.directory : modules.filesys.getWorkspace());
                            if (!f.getParent().isAncestor(parentDir))
                                throw new error(this.ERROR.INVALID_PATH, f.getPath() + " is not contained in " + parentDir.getPath(), f.getPath());
                        })
                        .map(f => {
                            var vert = modules.model.createVertex(Object.assign({}, v.toJSON(), {
                                type: vertex.prototype.PANORAMA,
                                image: {
                                    file: f
                                },
                                path: f.getPath(v.spatialGroup.images.directory),
                                id: null,
                                spatialGroup: v.spatialGroup
                            }));

                            vert.data = vert.data || {};
                            vert.data.type = "equirectangular";

                            v.forEach(e => {
                                let eConfig = Object.assign({}, e.toJSON(), { from: vert, id: null, type: null });
                                modules.model.createEdge(eConfig);
                            })
                            modules.model.deleteVertex(v);
                            return vert;
                        })
                )
                .filter(() => this.modules.settings.autoDisplayPanorama())
                .do(v => vertexSelector.next(v))
            ,

            vertexSelector
                .filter(() => this.editingMode() === this.EDIT.COPY)
                .do(v => this.copyVertex(v)),

            vertexSelector
                .filter(() => this.editingMode() === this.EDIT.DELETE)
                .do(v => modules.model.deleteVertex(v)),

            vertexSelector
                .filter(() => this.editingMode() === this.EDIT.LOG)
                .do(v => console.log(v)),

            modules.map.observe(modules.map.COORDINATES, modules.map.CLICK)
                .inhibitBy(vertexSelector, 100)
                .inhibitBy(modules.map.observe(line, modules.map.CLICK), 100)
                .do(() => this.resetLine()),

            modules.map.observe(modules.map.COORDINATES, modules.map.CLICK)
                .filter(() => this.isShown())
                .inhibitBy(modules.map.observe(point, modules.map.CLICK), 100)
                .inhibitBy(modules.map.observe(line, modules.map.CLICK), 100)
                .filter(() => this.modules.settings.createVertexOnMapClick())
                .filter(() => this.current.spatialGroup() != null)
                .do(() => modules.hist.commit())
                .map(c => modules.model.createVertex({ coordinates: c, type: vertex.prototype.PLACEHOLDER, spatialGroup: this.current.spatialGroup() }))
            ,

            modules.map.observe(modules.map.COORDINATES, modules.map.GPS)
                .do(coord => this.gpsCoordinates(coord)),

            modules.timeline.observe(item, modules.timeline.CREATE)
                .filter(i => i.spatialGroup === this.current.spatialGroup())
                .do(i => modules.timeline.toggleSelection(i, true)),

            modules.panorama.observe(scene, modules.panorama.CREATE)
                .do(s => {
                    modules.map.unsetEditable(this.current.vertex);
                    if (this.dragCurrentVertex())
                        modules.map.setEditable(s.vertex);

                    this.current.vertex = s.vertex;
                }),
        ];

        this.vertexSelector = vertexSelector;

        this.current.spatialGroup.subscribe(sg => {
            if (this.prev.spatialGroup)
                this.unsetEditable(this.prev.spatialGroup).subscribe();

            if (this.isShown())
                this.setEditable(sg).subscribe();

            this.prev.spatialGroup = sg;
        });

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
     * @returns {spatialGroup}
     */
    getSpatialGroup() {
        return this.current.spatialGroup();
    }

    /**
     * @returns {temporalGroup}
     */
    getTemporalGroup() {
        return this.current.temporalGroup();
    }

    /**
     * Logic for drawing lines and polylines.
     * 
     * @param {vertex} v
     */
    addToLine(v) {
        if (v === this.prev.vertex) {
            this.prev.vertex = null;
        } else if (v instanceof vertex) {
            if (this.prev.vertex != null) {

                var type;
                //determine type of edge
                if (this.prev.vertex.spatialGroup === v.spatialGroup)
                    type = edge.prototype.ROUTE;
                else {
                    var radius = this.prev.vertex.spatialGroup.superGroup.getColocatedRadius();
                    var dist = algorithms.getDistance(this.prev.vertex, v);
                    if (dist < radius)
                        type = edge.prototype.TEMPORAL;
                    else
                        type = edge.prototype.SPATIAL;
                }

                this.modules.model.createEdge({
                    from: this.prev.vertex,
                    to: v,
                    type: type,
                    bidirectional: true
                });

                if (this.editingMode() === this.EDIT.LINE) {
                    this.resetLine();
                } else {
                    this.prev.vertex = v;
                }
            } else {
                this.prev.vertex = v;
            }
        }
    }

    /**
     * Aborts drawing a line
     * */
    resetLine() {
        this.prev.vertex = null;
    }

    /**
     * 
     * @param {any} elem
     * @returns {Rx.Observable<edge>}
     */
    setEditable(elem) {
        return Rx.Observable.of(elem)
            .expand(elem => {
                if (elem == null || elem instanceof edge)
                    return Rx.Observable.empty();
                return elem.toObservable();
            })
            .filter(elem => elem instanceof edge)
            .do(elem => modules.map.setEditable(elem));

    }

    /**
 * 
 * @param {any} elem
 * @returns {Rx.Observable<edge>}
 */
    unsetEditable(elem) {
        return Rx.Observable.of(elem)
            .expand(elem => {
                if (elem == null || elem instanceof edge)
                    return Rx.Observable.empty();
                return elem.toObservable();
            })
            .filter(elem => elem instanceof edge)
            .do(elem => modules.map.unsetEditable(elem));

    }

    /**
     * Creates the spatial group after the user filled the form.
     * */
    createSpatialGroup() {
        this.modules.hist.commit();
        try {
            var sg = this.modules.model.createSpatialGroup(Object.assign({}, this.editable.spatialGroup(), { timeslot: this.editable.spatialGroup().timeslot(), path: this.editable.spatialGroup().path() }));
            setTimeout(() => {
                this.current.spatialGroup(sg);
                this.modules.timeline.toggleSelection(sg.item, true);
            }, 100);
        } catch (err) {
            console.log(err)
            this.modules.logger.log(err);
        }
    }

    /**
     * Creates the temporal group after the user filled the form.
     * */
    createTemporalGroup() {
        this.modules.hist.commit();
        try {
            var tg = this.modules.model.createTemporalGroup(this.editable.temporalGroup());
            setTimeout(() => { this.current.temporalGroup(tg); }, 100);

        } catch (err) {
            console.log(err)
            this.modules.logger.log(err);
        }
    }

    /**
     * Creates placeholder at current GPS location.
     * */
    createPlaceholder() {
        if (!this.gpsCoordinates())
            return;
        this.modules.hist.commit();
        try {
            this.modules.model.createVertex({
                coordinates: this.gpsCoordinates(),
                type: this.current.spatialGroup().type == spatialGroup.prototype.LANDMARK ? vertex.prototype.LANDMARK : vertex.prototype.PLACEHOLDER,
                spatialGroup: this.current.spatialGroup(),
                timeslot: new Date()
            });
        } catch (err) {
            console.log(err)
            this.modules.logger.log(err);
        }
    }

    /**
     * Copy all attributes from source to target that are contained in mask
     * 
     * @private
     * @param {JSON} target
     * @param {JSON} source
     * @param {JSON} mask
     */
    assign(target = {}, source = {}, mask = {}) {
        for (var prop in source) {
            if (mask[prop]) {
                if (typeof mask[prop] === 'object') { // use mask on subobject
                    var src = source[prop];
                    var msk = mask[prop];
                    if (!msk.types || msk.types.indexOf(src.type) !== -1) {
                        target[prop] = this.assign(target[prop], src, msk);
                    }
                } else {
                    target[prop] = source[prop];
                }
            }
        }
        return target;
    }

    /**
     * @private
     * @param {file} f
     * @param {spatialGroup | temporalGroup} g
     * @returns {Rx.Observable<vertex>}
     */
    createVertex(g, f) {
        var parentDir = this.current.spatialGroup() ? this.current.spatialGroup().images.directory : modules.filesys.getWorkspace();
        if (f && !f.isType(file.prototype.IMAGE))
            throw new error(this.ERROR.UNSUPPORTED_IMAGE_TYPE, "", f.name);
        if (f && !f.getParent().isAncestor(parentDir))
            throw new error(this.ERROR.INVALID_PATH, f.getPath() + " is not contained in " + parentDir.getPath(), f.getPath());

        if (f instanceof file && f.isType(file.prototype.IMAGE)) {
            var jsonVertex = {
                coordinates: this.modules.alg.extractCoordinates(f.name) || this.modules.map.getCenter(),
                type: vertex.prototype.PANORAMA,
                image: {
                    file: f
                },
                data: {
                    type: "equirectangular"
                }
            };

            try {
                jsonVertex.image.directory = f.getParent();
            } catch (e) { }

            var obs = Rx.Observable.of(jsonVertex);
            if (g instanceof temporalGroup) {
                obs = this.modules.panorama.updateMetadata(jsonVertex, { xmp: true, forceResolution: true, suppressUpdateNotification: true })
            }

            return obs.map(jsonVertex => {
                if (g instanceof temporalGroup) {
                    var timeslot = moment(jsonVertex.timeslot);
                    if (!timeslot.isValid())
                        timeslot = moment();

                    g = this.modules.model.createSpatialGroup({
                        timeslot: timeslot.toDate(),
                        name: timeslot.format('MMMM YYYY'),
                        type: spatialGroup.prototype.SINGLESHOT,
                        superGroup: g,
                        path: f.getParent().getPath(g.directory),
                        images: {
                            directory: f.getParent()
                        }
                    });

                    setTimeout(() => {
                        this.current.spatialGroup(g);
                        this.modules.timeline.toggleSelection(g.item, true);
                    }, 0);

                    this.current.spatialGroup(g);
                    this.modules.timeline.toggleSelection(g.item, true);
                }

                jsonVertex.path = f.getPath(g.images.directory);
                jsonVertex.spatialGroup = g;
                var v;

                if (this.modules.settings.copySceneAttributes() && this.modules.panorama.getScene()) {
                    v = this.createVertexFromTemplate(this.modules.panorama.getVertex(), jsonVertex);

                    if (f) {
                        delete v.image.file; // ensure a relink with the new file
                        this.modules.filesys.link(v, f);
                    }

                    if (this.modules.settings.getTemplateOptions().deleteOriginal)
                        this.modules.model.deleteVertex(this.modules.panorama.getVertex());

                } else {
                    v = this.modules.model.createVertex(jsonVertex);
                }

                return v;
            });
        }

        return Rx.Observable.empty();
    }

    /**
     * @private
     * @param {vertex} template
     * @param {JSON} defaultConfig
     * @returns {vertex}
     */
    createVertexFromTemplate(template, defaultConfig = {}) {
        var mask = this.modules.settings.getTemplateMask();
        mask.type = true;
        if (defaultConfig.file) delete mask.path;

        defaultConfig = this.assign(defaultConfig, template, mask);
        var v = this.modules.model.createVertex(defaultConfig);
        this.createEdgesFromTemplate(template, v);

        return v;
    }

    /**
     * @private
     * @param {vertex} template
     * @param {vertex} target
     */
    createEdgesFromTemplate(template, target) {
        var distanceThreshold = this.modules.settings.getTemplateOptions().colocated ? this.current.spatialGroup().superGroup.colocatedRadius : 0;
        var mask = this.modules.settings.getTemplateMask().outgoingEdges;
        template.forEach(e => {
            if (mask.types.indexOf(e.type) !== -1) {
                //if 'to' is in the template group, choose corresponding vertex of the group of 'v' to recreate the graph, otherwise ('to' is in a different group) just use 'to'
                var to = e.to.spatialGroup === template.spatialGroup ? this.modules.alg.getColocated(this.current.spatialGroup(), e.to.coordinates, distanceThreshold) : e.to
                if (to) {
                    var jsonEdge = {
                        from: target,
                        to: to,
                        bidirectional: true
                    }
                    this.modules.model.createEdge(this.assign(jsonEdge, e, mask));
                }
            }
        });
    }

    /**
     * Scans the directory associated to the currently selected spatial group.
     * If enabled, vertices will be created for all new files
     * If enabled, missing parameters are taken from the currently displayed panorama
     * */
    reload() {
        this.modules.hist.commit();
        var g = this.current.spatialGroup();
        g.toObservable()
            .filter(v => !v.image.file && v.type !== vertex.prototype.LANDMARK)
            .mergeMap(v => this.modules.filesys.prepareFileAccess(v))
            .catch(() => Rx.Observable.empty())
            .defaultIfEmpty(null)
            .last()
            .mergeMap(() => g.images.directory.scan({ enforce: true, onlyNewFiles: true }))
            .mergeMap(entry => this.createVertex(this.current.spatialGroup(), entry))
            .defaultIfEmpty(null)
            .last()
            .filter(v => v instanceof vertex && this.modules.settings.autoDisplayPanorama())
            .mergeMap(v => this.modules.panorama.loadScene(v))
            .subscribe({
                error: err => this.modules.logger.log(err)
            });
    }

    /**
     * 
     * @param {spatialGroup | temporalGroup} g
     */
    addFiles(g) {
        if (g instanceof spatialGroup && this.modules.settings.multiresPanoramaImport()) {
            this.beginMultiresPanoramaImport();
            return;
        }

        this.modules.hist.commit();

        this.modules.filesys.request({
            parent: g.directory,
            multi: true,
            filter: { files: true, folders: false }
        })
            .mergeMap(entry => this.createVertex(g, entry))
            .defaultIfEmpty(null)
            //.first() // filesys might not complete
            .filter(v => v instanceof vertex && this.modules.settings.autoDisplayPanorama())
            .mergeMap(v => this.modules.panorama.loadScene(v))
            .subscribe({
                error: err => this.modules.logger.log(err)
            });
    }

    /**
     * Opens the creation modal.
     * 
     * @param {spatialGroup | temporalGroup} clazz
     */
    beginCreate(clazz) {
        this.backgrounds(this.modules.map.getBackgrounds());
        this.errors.path("");
        if (clazz === spatialGroup) {
            this.editable.spatialGroup(Object.assign({}, this.default.spatialGroup));
            $('#spatial-group-editor').modal();
        } else {
            this.editable.temporalGroup(Object.assign({}, this.default.temporalGroup));
            $('#temporal-group-editor').modal();
        }

    }

    /**
     * Opens the directory selector to choose a path that is associated to the current spatial group
     * */
    selectPath() {
        modules.filesys.request({
            parent: modules.filesys.getWorkspace(),
            multi: false,
            filter: { folders: true, files: false }
        })
            .subscribe(dir => {
                if (!dir.isAncestor(modules.filesys.getWorkspace())) {
                    this.errors.path(dir.getPath() + " is not contained in " + modules.filesys.getWorkspace().getPath());
                } else {
                    this.errors.path("");

                    this.editable.spatialGroup().path(dir.getPath(modules.filesys.getWorkspace()));
                    this.editable.spatialGroup().directory = modules.filesys.getWorkspace();
                }
                return null;
            });
    }

    selectMultiresPath() {
        modules.filesys.request({
            parent: modules.filesys.getWorkspace(),
            multi: false,
            filter: { folders: true, files: false }
        })
            .subscribe(dir => {
                var parentDir = this.current.spatialGroup() ? this.current.spatialGroup().images.directory : modules.filesys.getWorkspace();
                if (!dir.isAncestor(parentDir)) {
                    this.errors.path(dir.getPath() + " is not contained in " + parentDir.getPath());
                } else {
                    this.errors.path("");

                    this.editable.multiresPanorama().basePath(dir.getPath(parentDir));
                    this.editable.multiresPanorama().directory = dir;
                }
                return null;
            });
    }

    /**
     * @param {vertex} v to be copied to this.current.spatialGroup(), applies options for copying templates
     */
    copyVertex(v) {
        if (!this.current.spatialGroup() || !v || v.spatialGroup == this.current.spatialGroup())
            return;

        this.modules.hist.commit();
        var options = this.modules.settings.getTemplateOptions();
        var mask = this.modules.settings.getTemplateMask();
        var path;

        if (mask.path && v.type === vertex.prototype.PANORAMA) {
            var imgConfig = v.getImageConfig();
            var root = imgConfig.directory || this.modules.filesys.getWorkspace();
            path = filesystem.concatPaths(v.path, imgConfig.path, imgConfig.prefix);
            path = filesystem.concatPaths(root.getPath(), path);

            var sgDir = this.current.spatialGroup().images
                ? this.current.spatialGroup().images.directory
                : this.current.spatialGroup().directory;
            var sgPath = sgDir.getPath()
            if (!path.startsWith(sgPath))
                throw new error(this.ERROR.INVALID_PATH, path + " is not contained in " + sgPath, path);

            path = path.substr(sgPath.length)
        }

        var distanceThreshold = options.colocated ? this.current.spatialGroup().superGroup.colocatedRadius : 0;


        if (mask.types.indexOf(v.type) !== -1) {
            var targ = this.modules.alg.getColocated(this.current.spatialGroup(), v.coordinates, distanceThreshold);
            var copied = false;
            if (!targ && options.create) {
                var config = { spatialGroup: this.current.spatialGroup() };
                if (path) {
                    config.path = path;
                    mask.path = false;
                }

                mask.type = true;

                config = this.assign(config, v, mask);
                var newV = this.modules.model.createVertex(config);
                this.createEdgesFromTemplate(v, newV);

                copied = true;
            } else if (targ && options.update) {
                if (mask.coordinates)
                    this.modules.model.updateCoordinates(targ, v.coordinates);
                if (mask.data)
                    this.modules.model.updateData(targ, this.assign(targ.data, v.data, mask.data));
                if (mask.path)
                    this.modules.model.updatePath(targ, v.path);
                this.createEdgesFromTemplate(v, targ);
                copied = true;
            }

            if (copied && this.modules.settings.getTemplateOptions().deleteOriginal)
                this.modules.model.deleteVertex(v);
        }

    }

    /**
     * Copies vertices from spatialGroupTemplate to current.spatialGroup applying the copy vertex options.
     * */
    applyTemplate() {
        this.modules.hist.commit();
        var options = this.modules.settings.getTemplateOptions();
        var mask = this.modules.settings.getTemplateMask();
        var distanceThreshold = options.colocated ? this.current.spatialGroup().superGroup.colocatedRadius : 0;
        var verticesToDelete = [];
        this.spatialGroupTemplate().forEach(src => {
            if (mask.types.indexOf(src.type) !== -1) {
                var targ = this.modules.alg.getColocated(this.current.spatialGroup(), src.coordinates, distanceThreshold);
                var copied = false;
                if (!targ && options.create) {
                    this.createVertexFromTemplate(src, { spatialGroup: this.current.spatialGroup() });
                    copied = true;
                } else if (targ && options.update) {
                    if (mask.coordinates)
                        this.modules.model.updateCoordinates(targ, src.coordinates);
                    if (mask.data)
                        this.modules.model.updateData(targ, this.assign(targ.data, src.data, mask.data));
                    if (mask.path)
                        this.modules.model.updatePath(targ, src.path); // TODO method does not exist
                    this.createEdgesFromTemplate(src, targ);
                    copied = true;
                }

                if (copied && this.modules.settings.getTemplateOptions().deleteOriginal)
                    verticesToDelete.push(src);
            }
        });
        verticesToDelete.forEach(v => this.modules.model.deleteVertex(v));
    }

    deleteCurrentTemporalGroup() {
        let tg = this.current.temporalGroup();

        if (!tg)
            return;

        if (window.confirm(`Are you sure Are you sure you want to delete "${tg.name}"?`)) {
            this.modules.hist.commit();
            this.modules.model.deleteTemporalGroup(tg);
        }
    }

    deleteCurrentSpatialGroup() {
        let sg = this.current.spatialGroup();

        if (!sg)
            return;

        if (window.confirm(`Are you sure Are you sure you want to delete "${sg.superGroup.name}: ${sg.name}"?`)) {
            this.modules.hist.commit();
            this.modules.model.deleteSpatialGroup(sg);
        }
    }

    /**
     * 
     * @param {vertex} v - old vertex to be replaced
     */
    beginMultiresPanoramaImport(v) {
        this.editable.multiresPanorama(ko.mapping.fromJS(this.default.multiresPanorama));
        this.default.multiresPanorama.oldV = v;

        this.errors.path('');
        $('#import-multires-panorama-editor').modal();
    }



    addMultiresPanorama() {
        if (!this.canAddMultiresPanorama())
            return;

        this.modules.hist.commit();

        var cfg = this.editable.multiresPanorama();
        var g = this.current.spatialGroup();

        var data = {};
        data.type = cfg.sceneType().type;
        data.hdr = cfg.hdr();
        if (cfg.sceneType().type === "multiresrec")
            data.vaov = 360 * cfg.originalHeight() / cfg.originalWidth();

        data.multiRes = {
            tileResolution: parseInt(cfg.tileResolution()),
            maxLevel: parseInt(cfg.maxLevel()),
            path: cfg.path(),
            extension: cfg.extension()
        };

        for (var attr of cfg.sceneType().attributes.keys())
            data.multiRes[attr] = parseInt(cfg[attr]());

        var jsonVertex = {
            id: cfg.oldV ? cfg.oldV.id : undefined,
            coordinates: cfg.oldV ? cfg.oldV.coordinates : this.modules.map.getCenter(),
            type: vertex.prototype.PANORAMA,
            spatialGroup: g,
            path: cfg.directory.getPath(g.images.directory),
            image: {
                directory: cfg.directory
            },
            data: data
        };


        if (!cfg.oldV && this.modules.settings.copySceneAttributes() && this.modules.panorama.getScene()) {
            var v = this.createVertexFromTemplate(this.modules.panorama.getVertex(), jsonVertex);

            if (this.modules.settings.getTemplateOptions().deleteOriginal)
                this.modules.model.deleteVertex(this.modules.panorama.getVertex());

        } else {
            var v = this.modules.model.createVertex(jsonVertex);

            if (cfg.oldV) {
                cfg.oldV.forEach(e => {
                    let eConfig = Object.assign({}, e.toJSON(), { from: vert, id: null, type: null });
                    modules.model.createEdge(eConfig);
                })
                modules.model.deleteVertex(cfg.oldV);
            }
        }

        if (this.modules.settings.autoDisplayPanorama())
            this.vertexSelector.next(v);

        return v;

    }
}

groupEditor.prototype.SELECT = "select";
groupEditor.prototype.TEMPORALGROUP = "temporal group";
groupEditor.prototype.SPATIALGROUP = "spatial group";
groupEditor.prototype.EDIT = {};
groupEditor.prototype.EDIT.SCENE = "Load Panorama";
groupEditor.prototype.EDIT.LINE = "Draw Line";
groupEditor.prototype.EDIT.POLYLINE = "Draw Polyline";
groupEditor.prototype.EDIT.COPY = "Copy Point";
groupEditor.prototype.EDIT.DELETE = "Delete Point";
groupEditor.prototype.EDIT.LOG = "Log to Console";
