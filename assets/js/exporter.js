'use strict';

/*
 * Exports project to another location. Performs panorama tiling
 *
 * */

class exporter extends observable {
    get [Symbol.toStringTag]() {
        return 'Exporter';
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

        this.path = ko.observable('');
        this.directory;


        this.setStartup = ko.observable(true);
        this.overwriteExisting = ko.observable(false);
        this.enableTiling = ko.observable(true);
        this.tileResolution = ko.observable(512);
        this.enableMaxWidth = ko.observable(false);
        this.maxWidth = ko.observable(4096);
        this.enableMaxHeight = ko.observable(false);
        this.maxHeight = ko.observable(2048);
        this.canThreads = ko.observable(typeof OffscreenCanvas !== 'undefined' && typeof Worker !== 'undefined');
        this.enableThreads = ko.observable(this.canThreads());
        this.threads = ko.observable(8);
        //       this.truncatePaths = ko.observable(false);
        this.contentTypes = file.prototype.IMAGE;
        this.contentType = ko.observable(file.prototype.JPG);
        this.quality = ko.observable(0.9);
        this.tilePathPattern = ko.observable("%l/%x_%y");

        var sanitize = obs => obs.subscribe(val => {
            if (typeof val === 'string') {
                try {
                    obs(parseInt(val));
                } catch (e) {
                }
            }
        });

        sanitize(this.maxWidth);
        sanitize(this.maxHeight);
        sanitize(this.tileResolution);
        sanitize(this.threads);

        this.enableTiling.subscribe(enable => this.enableThreads(enable));

        this.panoramasToCreateCount = ko.observable(0);
        this.panoramasToCreateTotal = ko.observable(0);
        this.filesToCreateCount = ko.observable(0);
        this.filesToCreateTotal = ko.observable(0);
        this.done = ko.observable(true);
        this.cleanedUp = ko.observable(true);

        this.errors = {
            path: ko.observable(""),
            log: ko.observableArray()
        }

        this.canExport = ko.computed(() => {
            return this.path() && this.path !== '';
        });

        ko.bindingHandlers.progress = {
            init: function (element, valueAccessor) {
                $(element).css('width', '0%');
            },
            update: function (element, valueAccessor) {
                var val = Math.round(parseFloat(ko.utils.unwrapObservable(valueAccessor())) * 100);
                $(element).css('width', val + '%');
            }
        };

        if ($('#export-dialog')[0])
            ko.applyBindings(this, $('#export-dialog')[0]);

        if ($('#export-progress-dialog')[0])
            ko.applyBindings(this, $('#export-progress-dialog')[0]);

        Rx.Observable.fromEvent($('#export-dialog'), 'show.bs.modal')
            .subscribe(() => {
                if (!this.cleanedUp()) {
                    setTimeout(() => {
                        $('#export-dialog').modal("hide");
                        $('#export-progress-dialog').modal("show");
                    }, 500);
                }

            });

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
                if (!dir.canWrite()) {
                    this.errors.path("Cannot write to " + dir.getPath());
                } else {
                    this.errors.path("");
                    this.path(dir.getPath());
                    this.directory = dir;
                }
                return null;
            });
    }

    export() {
        this.createdFiles = new Map();
        this.filesToCreate = new Map();
        this.createdDirectories = new Map();
        this.done(false);
        this.cleanedUp(false);
        this.panoramasToCreateCount(0);
        this.panoramasToCreateTotal(0);
        this.filesToCreateCount(0);
        this.filesToCreateTotal(1); //tour.json
        this.errors.log.removeAll();

        $('#export-dialog').modal("hide");
        $('#export-progress-dialog').modal("show");

        // create copy of tour
        this.exportGraph = new graph();
        var json = this.modules.alg.stateToJson();
        this.exportAlg = new algorithms($.extend(false, {}, this.modules, { model: this.exportGraph }));
        this.exportAlg.loadGraph(json, this.directory);

        this.destinationGraph = new graph();
        this.destinationAlg = new algorithms($.extend(false, {}, this.modules, { model: this.destinationGraph }));

        // remove utility objects (landmarks, placeholders) from tour
        for (var tg of Array.from(this.exportGraph.temporalGroups.values())) {
            if (tg.type === temporalGroup.prototype.LANDMARK)
                this.exportGraph.deleteTemporalGroup(tg);
        }

        for (var sg of Array.from(this.exportGraph.spatialGroups.values())) {
            if (sg.type === spatialGroup.prototype.LANDMARK)
                this.exportGraph.deleteSpatialGroup(sg);
            else
                sg.path = this.modules.model.getSpatialGroup(sg.id).images.directory.getPath(this.modules.filesys.getWorkspace());

            if (sg.images)
                delete sg.images.path;

            if (this.enableTiling()) {
                delete sg.thumbnails;
                if (sg.images) {
                    delete sg.images.prefix;

                    if (sg.images.width && this.enableMaxWidth())
                        sg.images.width = Math.min(sg.images.width, this.maxWidth());

                    if (sg.images.height && this.enableMaxHeight())
                        sg.images.height = Math.min(sg.images.height, this.maxHeight());
                }
            }
        }

        for (var v of Array.from(this.exportGraph.vertices.values())) {
            if (v.type === vertex.prototype.LANDMARK || v.type === vertex.prototype.PLACEHOLDER)
                this.exportGraph.deleteVertex(v);
        }



        this.workerPool = new Rx.ReplaySubject(this.threads(), null, Rx.Scheduler.queue);

        this.subscription = this.directory.searchFile("tour.json")
            .mergeMap(f => f.readAsJSON())
            .mergeMap(json => {
                this.destinationJson = json;
                return this.destinationAlg.loadGraph(json, this.directory)
            })
            .catch(() => Rx.Observable.of(false))
            .mergeMap(() => {
                var verticesToCreate = [];
                // estimate files to create
                for (var v of Array.from(this.exportGraph.vertices.values())) {
                    if (!this.overwriteExisting() && this.destinationGraph.hasVertex(v.id)) {
                        var dV = this.destinationGraph.getVertex(v.id);
                        $.extend(true, v.data, dV.data);
                        v.image = dV.image;
                        v.thumbnail = dV.thumbnail;
                        v.path = dV.path;

                        continue;
                    }

                    verticesToCreate.push(v);

                    if (v.data && v.data.type) {
                        if (this.enableTiling() || v.data.type.startsWith('multires')) {
                            try {
                                var width = v.image.width || v.data.multiRes.width;
                                var height = v.image.height || v.data.multiRes.height;

                                if (width && height)
                                    this.setFilesToCreate(v.id, this.getTilesCount(width, height));
                                else
                                    this.setFilesToCreate(v.id, 100);
                            } catch (e) {
                                this.setFilesToCreate(v.id, 1);
                            }
                        } else {
                            this.setFilesToCreate(v.id, 1);
                        }
                    }
                }


                for (var b of json.map.backgrounds) {
                    this.setFilesToCreate(b.label, 1);
                }

                setTimeout(() => {
                    this.workers = [];
                    var threadsCount = this.enableThreads() ? Math.min(this.threads(), verticesToCreate.length) : 1;
                    threadsCount = Math.max(threadsCount, 1);
                    for (var i = 0; i < threadsCount; i++) {
                        var worker = this.createWebworker();
                        this.workers.push(worker);
                        this.workerPool.next(worker);
                    }
                }, 100);

                return Rx.Observable.from(verticesToCreate);
            })
            .zip(this.workerPool)
            .mergeMap(arr => { // converting panoramas
                var newV = arr[0];
                var oldV = this.modules.model.getVertex(newV.id);
                var worker = arr[1];
                var obs = this.modules.filesys.prepareFileAccess(oldV);

                // copy multires files
                if (oldV.data.type && oldV.data.type.startsWith('multires')) {

                    obs = obs.mergeMap(oldV => {
                        var newPath = oldV.image.directory.getPath(this.modules.filesys.getWorkspace());

                        var tries = 0;
                        return this.directory.searchDirectory(newPath)
                            .filter(() => {
                                if (this.overwriteExisting())
                                    return true;
                                this.finished(newV.id);
                                this.workerPool.next(worker);
                                return false;
                            })
                            .catch(() => this.directory.createDirectory(newPath)
                                .do(dir => this.createdDirectories.set(newV.id, dir))) // only the last created directory is stored
                            .retry(2)
                            .mergeMap(dir => this.copyMultipleFiles(newV, dir, worker))
                    });

                    // equirectangular to multiresrec
                } else if (this.enableTiling()) {
                    obs = obs.mergeMap(() => {
                        newV.path = filesystem.concatPaths(newV.path, newV.image.path);
                        newV.path = newV.path.replace(/\./g, '_');
                        delete newV.image.path;

                        var newPath = filesystem.concatPaths(oldV.image.directory.getPath(this.modules.filesys.getWorkspace()), newV.path.split('/').pop());


                        return this.directory.searchDirectory(newPath)
                            .mergeMap(dir => dir.delete())
                            .catch(() => Rx.Observable.of(null))
                            .mergeMap(() => this.directory.createDirectory(newPath))
                            .retry(2)
                            .do(dir => this.createdDirectories.set(newV.id, dir)) // only the last created directory is stored
                            .mergeMap(dir => this.tilePanorama(newV, dir, worker))
                    });

                    // copy euqirectangular
                } else {
                    obs = obs.mergeMap(() => {
                        var path = oldV.image.file.getPath(this.modules.filesys.getWorkspace());

                        return this.directory.searchFile(path)
                            .filter(() => {
                                if (this.overwriteExisting())
                                    return true;
                                this.finished(newV.id);
                                this.workerPool.next(worker);
                                return false;
                            })
                            .catch(() => Rx.Observable.of(newV))
                            .mergeMap(() => this.copySingleFile(newV, worker))
                    });
                }

                return obs
                    .catch(err => {
                        err.message = "excluding panorama from export";
                        this.errors.log.push(err);
                        this.exportGraph.deleteVertex(newV);
                        return this.deleteCreatedFiles(newV.id);
                    })
                    .do(() => this.workerPool.next(worker));
            })
            .defaultIfEmpty(null)
            .last()
            .mergeMap(() => {
                // cleanup - delete empty groups
                for (var sg of Array.from(this.exportGraph.spatialGroups.values())) {
                    if (sg.vertices.size === 0)
                        this.exportGraph.deleteSpatialGroup(sg);
                }

                for (var tg of Array.from(this.exportGraph.temporalGroups.values())) {
                    if (tg.subGroups.size === 0)
                        this.exportGraph.deleteTemporalGroup(tg);
                }

                // copy background images
                var backgrounds = new Set();
                for (var sg of Array.from(this.exportGraph.spatialGroups.values())) {
                    if (sg.background)
                        backgrounds.add(sg.background);
                }



                return Rx.Observable.from(backgrounds.values());
            })
            .mergeMap(b => this.modules.filesys.prepareFileAccess(b)
                .mergeMap(() => {
                    var path = b.image.file.getPath(this.modules.filesys.getWorkspace());
                    return this.directory.searchFile(path)
                        .mapTo(this.overwriteExisting())
                        .catch(() => Rx.Observable.of(true));
                })
                .mergeMap(overwrite => {
                    if (overwrite)
                        return this.copyBackground(b).mapTo(b);
                    else
                        return Rx.Observable.of(b);
                })
                .catch(err => {
                    this.errors.log.push(err);
                    return Rx.Observable.empty()
                })

            )
            .toArray()
            .map(backgrounds => {
                // set startup view
                if (this.setStartup())
                    this.exportAlg.saveCurrentView();
                var json = this.exportAlg.stateToJson();
                json.map.backgrounds = backgrounds.map(b => b.toJSON());

                if (this.setStartup()) {
                    json.settings.timeline.selections = [];
                    for (var id of this.modules.timeline.getSelectionsIds()) {
                        if (this.exportGraph.hasSpatialGroup(id))
                            json.settings.timeline.selections.push(id);
                    }
                }

                return new Blob([JSON.stringify(json, null, 4)], { type: "text/json" });
            })
            .mergeMap(blob => this.directory.write("tour.json", blob).retry(2))
            .subscribe(() => {

                this.filesToCreateCount(this.filesToCreateTotal());
                this.panoramasToCreateCount(this.panoramasToCreateTotal());
                this.done(true);
            }, err => {
                this.modules.logger.log(new error(this.ERROR.EXPORT_FAILED, "", err));
                console.log(err);
                this.abort();
            });


    }

    /**
* 
* @returns {Worker} - Send it a blob and it outputs the full tile hierarchy of that image
*/
    createWebworker() {
        var worker = algorithms.createInlineWorker(async function (node) {
            if (node === "terminate") {
                this.terminate = true;
                return;
            }

            if (!(node instanceof Blob)) {
                this.terminate = false;
                this.tileResolution = node.tileResolution;

                this.contentType = node.contentType;
                this.quality = node.quality;
                this.maxWidth = node.width;
                this.maxHeight = node.height;

                this.canvas = new OffscreenCanvas(100, 100);
                this.ctx = this.canvas.getContext('2d');
                this.thumb = new OffscreenCanvas(100, 100);

                return;
            }

            try {
                this.terminate = false;
                this.img = await createImageBitmap(node);
                if (this.terminate)
                    return;

                var ratioX = 1;
                var ratioY = 1;
                if (this.maxWidth && this.img.width > this.maxWidth)
                    ratioX = this.maxWidth / this.img.width;
                if (this.maxHeight && this.img.height > this.maxHeight)
                    ratioY = this.maxHeight / this.img.height;

                var ratio = Math.min(ratioX, ratioY);

                this.width = Math.round(ratio * this.img.width);
                this.height = Math.round(ratio * this.img.height);

                this.maxLevel = Math.ceil(Math.log2(Math.max(this.width, this.height) / this.tileResolution)) + 1;
                this.hasThumb = false;

                self.postMessage({
                    tileResolution: this.tileResolution,
                    originalWidth: this.width,
                    originalHeight: this.height,
                    maxLevel: this.maxLevel
                })

                for (var level = this.maxLevel; level >= 1; level--) {
                    let f = Math.pow(2, level - this.maxLevel);
                    var width = Math.ceil(this.width * f);
                    var height = Math.ceil(this.height * f);

                    var img = level < 2 && this.hasThumb ? this.thumb : this.img;
                    if (level == 3) {
                        this.hasThumb = true;
                        this.thumb.width = width;
                        this.thumb.height = height;
                    }

                    for (var x = 0; x < Math.ceil(width / this.tileResolution); x++) {
                        for (var y = 0; y < Math.ceil(height / this.tileResolution); y++) {

                            var cWidth = Math.min(this.tileResolution, width - this.tileResolution * x);
                            var cHeight = Math.min(this.tileResolution, height - this.tileResolution * y);
                            if (!cWidth || !cHeight || cWidth < 0 || cHeight < 0) {
                                if (level == 3)
                                    this.hasThumb = false;
                                continue;
                            }

                            this.canvas.width = cWidth;
                            this.canvas.height = cHeight;

                            try {
                                this.ctx.drawImage(img, -this.tileResolution * x, -this.tileResolution * y, width, height);

                                if (level == 3) {
                                    this.thumb.getContext('2d').putImageData(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height), x * this.tileResolution, y * this.tileResolution)
                                }

                                var blob = await this.canvas.convertToBlob({ type: this.contentType, quality: this.quality });
                                if (this.terminate)
                                    return;
                                self.postMessage({
                                    x: x,
                                    y: y,
                                    l: level,
                                    blob: blob
                                })


                            } catch (e) {
                                if (level == 3)
                                    this.hasThumb = false;
                            }
                        }
                    }


                }

                if (this.terminate)
                    return;
                // ensure completion
                self.postMessage({
                    x: 0,
                    y: 0,
                    l: 1
                })

            } catch (err) {
                self.postMessage(err.toString())
            }


        });

        worker.postMessage({
            tileResolution: this.tileResolution(),
            contentType: this.contentType(),
            quality: this.quality(),
            width: this.enableMaxWidth() ? this.maxWidth() : null,
            height: this.enableMaxHeight() ? this.maxHeight() : null
        });

        return worker;
    }

    /**
    * @param {Worker} worker
    * @param {blob} b
    * @returns {Rx.Observable<object>} - A function that returns all tiles from the hierarchy created from the image.
    */
    workerToObservable(worker, b) {
        return Rx.Observable.create(obs => {
            worker.onmessage = e => {
                if (typeof e.data === 'string')
                    obs.error(e.data);
                else {
                    obs.next(e.data);
                    if (e.data.l == 1)
                        obs.complete();
                }
            }

            worker.postMessage(b);

            return () => {
                delete worker.onmessage;
                worker.postMessage("terminate");
            }
        });
    }

    /**
    *  @param {vertex} newV 
    *  @param {Worker} worker
    *   
    *   Precondition: prepareFileAccess
    */
    copySingleFile(newV, worker = null) {
        var oldV = this.modules.model.getVertex(newV.id);

        var path = oldV.image.file.getPath(this.modules.filesys.getWorkspace());

        var obs = this.directory.write(path, oldV.image.file).retry(2)
            .do(f => this.created(newV.id, f));
        if (oldV.thumbnail && oldV.thumbnail.file && !oldV.thumbnail.file.equals(oldV.image.file)) {
            var thumbPath = oldV.thumbnail.file.getPath(this.modules.filesys.getWorkspace());
            obs = obs.mergeMap(() => this.directory.write(thumbPath, oldV.image.file).retry(2))
                .do(f => this.created(newV.id, f));
        }

        return obs.defaultIfEmpty(null)
            .last()
            .do(() => this.finished(newV.id))
            .mapTo(worker);
    }

    /**
     *  @param {vertex} newV 
     *  @param {directory} toDir
     *  @param {Worker} worker
     *   
     *   Precondition: prepareFileAccess
     */
    copyMultipleFiles(newV, toDir, worker) {
        var originalWidth = newV.data.multiRes.originalWidth || newV.data.multiRes.cubeResolution;
        var originalHeight = newV.data.multiRes.originalHeight || newV.data.multiRes.cubeResolution;
        var maxLevel = newV.data.multiRes.maxLevel;
        var tileResolution = newV.data.multiRes.tileResolution;

        var nodes = [];


        for (var level = maxLevel; level >= 1; level--) {
            let f = Math.pow(2, level - maxLevel);
            var width = Math.ceil(originalWidth * f);
            var height = Math.ceil(originalHeight * f);

            for (var x = 0; x < Math.ceil(width / tileResolution); x++) {
                for (var y = 0; x < Math.ceil(height / tileResolution); y++) {
                    if (newV.data.type === "multires")
                        for (var side of ['f', 'r', 'b', 'l', 'u', 'd'])
                            nodes.push({
                                x: x,
                                y: y,
                                l: level,
                                s: side
                            })
                    else
                        nodes.push({
                            x: x,
                            y: y,
                            l: level
                        });
                }
            }
        }

        var fromDir = this.modules.model.getVertex(newV.id).image.directory;


        return Rx.Observable.from(nodes)
            .mergeMap(node => {
                var path = this.resolvePathPattern(newV.data.multiRes, node);

                return fromDir.searchFile(path)
                    .mergeMap(f => toDir.write(path, f))
                    .retry(2)
                    .do(f => {
                        this.created(newV.id, f);
                    }).catch(() => Rx.Observable.empty());
            })
            .last()
            .do(() => this.finished(newV.id))
            .mapTo(worker);
    }




    /**
    *  @param {vertex} newV
    *  @param {directory} toDir
    *  @param {Worker} worker
    *  
    *  Precondition: prepareFileAccess
    */
    tilePanorama(newV, toDir, worker) {
        var oldV = this.modules.model.getVertex(newV.id);
        return oldV.image.file.readAsBlob()
            .mergeMap(b => this.workerToObservable(worker, b))
            .mergeMap(tile => {
                if (tile.maxLevel) { //init params
                    oldV.image.width = tile.width;
                    oldV.image.height = tile.height;
                    newV.data.type = 'multiresrec';
                    newV.data.multiRes = tile;
                    newV.data.multiRes.path = this.tilePathPattern();
                    newV.data.multiRes.extension = this.contentType() == "image/jpeg" ? "jpg" : this.contentType().split('/').pop();
                    this.setFilesToCreate(newV.id, this.getTilesCount(tile.originalWidth, tile.originalHeight));
                    return Rx.Observable.empty();
                } else if (tile.blob) {
                    var tries = 0;
                    return toDir.write(this.resolvePathPattern(newV.data.multiRes, tile), tile.blob)
                        .retry(2)
                        .do(f => {
                            this.created(newV.id, f)
                        }).catch((err, caught) => {
                            if (tries++ < 3)
                                return caught;

                            this.errors.log.push(err);
                            return Rx.Observable.empty()
                        })
                } else {
                    return Rx.Observable.empty();
                }
            })
            .defaultIfEmpty(null)
            .last()
            .do(() => this.finished(newV.id))
            .mapTo(worker);
    }

    /**
     * 
     * @param {object} multiRes
     * @param {object} node
     * @returns {string}
     */
    resolvePathPattern(multiRes, node) {
        var path = multiRes.path;
        for (var param in node) {
            path = path.replace(new RegExp("%" + param, "gi"), "" + node[param]);
        }

        if (multiRes.extension && multiRes.extension.length)
            path += "." + multiRes.extension;

        return path;
    }

    /**
*  @param {background} newB 
*   
*   Precondition: prepareFileAccess
*/
    copyBackground(newB) {
        var oldB = this.modules.map.getBackground(newB.label);

        var path = oldB.image.file.getPath(this.modules.filesys.getWorkspace());

        return this.directory.write(path, oldB.image.file)
            .retry(2)
            .do(f => {
                newB.image.path = path;

                this.created(newB.label, f);
                this.finished(newB.label);
            })
            .catch((err, caught) => {
                err.message = "excluding background from export";
                this.errors.log.push(err);
                for (var sg of this.exportGraph.spatialGroups.values())
                    if (sg.background.label === newB.label)
                        delete sg.background;

                this.deleteCreatedFiles(newB.label);
                return Rx.Observable.empty();
            });

        return obs.mapTo(worker).do(v => this.finished(v.id));
    }

    /**
     * 
     * @param {string} id
     */
    finished(id) {
        this.panoramasToCreateCount(this.panoramasToCreateCount() + 1);

        if (!this.filesToCreate.has(id)) {
            this.panoramasToCreateTotal(this.panoramasToCreateTotal() + 1);
        }

        if (this.filesToCreate.has(id)) {

            this.filesToCreateTotal(this.filesToCreateTotal() - this.filesToCreate.get(id));
        }

        this.filesToCreate.delete(id);

        if (this.exportGraph.hasVertex(id)) {
            var v = this.exportGraph.getVertex(id);

            var tGroups = [];
            var tg = v.spatialGroup.superGroup;
            while (tg) {
                tGroups.unshift(tg);
                tg = tg.superGroup;
            }
            for (tg of tGroups) {
                if (tg && !this.destinationGraph.hasTemporalGroup(tg.id))
                    this.destinationGraph.createTemporalGroup(tg.toJSON({
                        ignoreSpatialGroups: true
                    }))
            }

            if (!this.destinationGraph.hasSpatialGroup(v.spatialGroup.id))
                this.destinationGraph.createSpatialGroup(v.spatialGroup.toJSON({
                    ignoreVertices: true
                }));
            this.destinationGraph.createVertex(v.toJSON({
                ignoreEdges: true
            }));
        }
    }

    /**
     * 
     * @param {string} id
     * @param {file} f
     */
    created(id, f) {
        if (this.filesToCreate.has(id)) {
            var remaining = this.filesToCreate.get(id);
            if (remaining > 0) {
                this.filesToCreate.set(id, remaining - 1);
                this.filesToCreateCount(this.filesToCreateCount() + 1);
            } else {
                this.filesToCreateCount(this.filesToCreateCount() + 1);
                this.filesToCreateTotal(this.filesToCreateTotal() + 1);
            }
        }

        if (this.createdFiles.has(id))
            this.createdFiles.get(id).push(f);
        else
            this.createdFiles.set(id, [f]);

    }

    /**
    * 
    * @param {string} id
    * @param {number} count
    */
    setFilesToCreate(id, count) {
        if (this.filesToCreate.has(id)) {
            var oldCount = this.filesToCreate.get(id);
            this.filesToCreateTotal(this.filesToCreateTotal() + count - oldCount);
        } else {
            this.filesToCreateTotal(this.filesToCreateTotal() + count);
            this.panoramasToCreateTotal(this.panoramasToCreateTotal() + 1);
        }

        this.filesToCreate.set(id, count);
    }

    /**
     * 
     * @param {number} width
     * @param {number} height
     * @returns {number}
     */
    getTilesCount(width, height) {
        var count = 0;

        var ratioX = 1;
        var ratioY = 1;
        if (this.enableMaxWidth() && width > this.maxWidth())
            ratioX = this.maxWidth() / width;
        if (this.enableMaxHeight() && height > this.maxHeight())
            ratioY = this.maxHeight() / height;

        var ratio = Math.min(ratioX, ratioY);

        var tilesX = Math.ceil(ratio * width / this.tileResolution());
        var tilesY = Math.ceil(ratio * height / this.tileResolution());
        count += tilesX * tilesY;
        while (tilesX > 1 || tilesY > 1) {
            tilesX = Math.ceil(tilesX / 2);
            tilesY = Math.ceil(tilesY / 2);
            count += tilesX * tilesY;
        }

        return count;
    }

    revert() {
        if (this.subscription) {
            this.subscription.unsubscribe();

            Rx.Observable.from(this.createdFiles.keys())
                .mergeMap(key => this.deleteCreatedFiles(key))
                .defaultIfEmpty(null)
                .last()
                .subscribe({
                    complete: () => this.complete(),
                    error: err => {
                        this.modules.logger.log(err);
                        console.log(err);
                        this.complete();
                    }
                })
        }
    }

    abort() {
        if (this.subscription) {
            this.subscription.unsubscribe();

            Rx.Observable.from(this.createdFiles.entries())
                .filter(entry => this.filesToCreate.has(entry[0]))
                .mergeMap(entry => this.deleteCreatedFiles(entry[0]))
                .defaultIfEmpty(null)
                .last()
                .mergeMap(() => {
                    var json = this.destinationAlg.stateToJson();
                    if (this.destinationJson) {
                        json.settings = this.destinationJson.settings;
                        json.map = this.destinationJson.map;
                    }

                    var blob = new Blob([JSON.stringify(json, null, 4)], { type: "text/json" });
                    return this.directory.write("tour.json", blob).retry(2);
                })
                .subscribe({
                    complete: () => this.complete(),
                    error: err => {
                        this.modules.logger.log(err);
                        console.log(err);
                        this.revert();
                    }
                })
        }
    }

    /**
     * 
     * @param {string} id
     */
    deleteCreatedFiles(id) {
        if (this.createdDirectories.has(id))
            var obs = this.createdDirectories.get(id).delete()
                .catch(() => Rx.Observable.empty());
        else if (this.createdFiles.has(id))
            var obs = Rx.Observable.from(this.createdFiles.get(id))
                .mergeMap(f => f.delete())
                .catch(() => Rx.Observable.empty())
        else
            var obs = Rx.Observable.empty();

        return obs.defaultIfEmpty(null)
            .last()
            .do(() => {
                var files = this.createdFiles.get(id);
                if (files.length) {
                    this.filesToCreateTotal(this.filesToCreateTotal() - files.length);
                    this.filesToCreateCount(this.filesToCreateCount() - files.length);
                }
                if (this.filesToCreate.has(id)) {
                    this.filesToCreateTotal(this.filesToCreateTotal() - this.filesToCreate.get(id));
                    this.panoramasToCreateTotal(this.panoramasToCreateTotal() - 1);
                }


                this.filesToCreate.delete(id);
                this.createdFiles.delete(id);
                this.createdDirectories.delete(id);
            });
    }

    complete() {
        if (!this.cleanedUp()) {
            $('#export-dialog').modal("hide");
            $('#export-progress-dialog').modal("hide");

            delete this.workerPool;
            if (this.workers)
                for (var w of this.workers) {
                    if (w.release)
                        w.release();
                    w.terminate();
                }
            delete this.workers;

            delete this.filesToCreate;
            delete this.createdFiles;
            delete this.createdDirectories;
            delete this.subscription;

            delete this.exportGraph;
            delete this.exportAlg;
            delete this.destinationAlg;
            delete this.destinationGraph;
            delete this.destinationJson;

            this.cleanedUp(true);
        }
    }
}

exporter.prototype.ERROR.EXPORT_FAILED = "export failed"
