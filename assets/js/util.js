'use strict';

/**
 *  run utility algorithms and methods that require other modules
 * */
class algorithms {
    get [Symbol.toStringTag]() {
        return 'Algorithms';
    }

    /**
     * 
     * @param {graph} modules.model
     * @param {logger} modules.logger
     * @param {panoramaViewer} modules.panorama
     * @param {filesystem} modules.filesys
     * @param {configurator} modules.settings
     */
    constructor(modules) {
        this.modules = modules;
        this.filenamePattern = /([+-]?\d+(?:\.\d+)?),\s+([+-]?\d+(?:\.\d+)?)\.jpg/;
    }

    /**
 * 
 * Resolves references to other tour files
 * Calls loadGraph(...) to create all the modal elements
 * View related settings will not be read
 * 
 * Required modules: modal, filesystem, map
 * 
 * @param {JSON} tour - Plain javascript object
* @param {directory} rootDirectory - Folder containing the file which content was passed as the first argument
 * @returns {Rx.Observable<boolean>} - Tour modal was created without errors
 */
    readTour(tour, rootDirectory) {
        var successful = true;
        for (let jsonBackground of ((tour.map || {}).backgrounds || [])) {
            var json = $.extend(true, { image: { directory: rootDirectory } }, jsonBackground);
            this.modules.map.createBackground(json);
        }

        //process temporal groups before others so that parent tour files can modify their hierarchy
        for (let jsonTemporalGroup of (tour.temporalGroups || [])) {
            try {
                var tg = this.modules.model.createTemporalGroup(Object.assign({}, jsonTemporalGroup, {
                    directory: rootDirectory,
                    subGroups: []
                }));
            } catch (err) {
                this.modules.logger.log(err);
                successful = false;
            }
        }

        var other = Rx.Observable.of(successful);
        if (tour.tours != null) {
            other = Rx.Observable.from(tour.tours)
                .mergeMap(path => rootDirectory.searchFile(path))
                .mergeMap(f =>
                    f.readAsJSON()
                        .mergeMap(t => this.readTour(t, f.getParent()))
                );
        }

        return other.map(successful => successful && this.loadGraph(tour, rootDirectory));
    }

    /**
     * 
     * Creates the groups and graph
     * Called by readTour(...)
     * 
     * Required modules: modal
     * 
     * @param {JSON} tour - Plain javascript object
     * @param {directory} dir - Folder containing the file which content was passed as the first argument
     * @returns {boolean} - Tour modal was created without errors
     */
    loadGraph(tour, rootDirectory) {
        var successful = true;
        rootDirectory = rootDirectory || this.filesys;

        var edges = [];
        var vertices = tour.vertices || [];
        var spatialGroups = tour.spatialGroups || [];
        var temporalGroups = tour.temporalGroups || [];

        for (let jsonTemporalGroup of temporalGroups) {
            try {
                var tg = this.modules.model.createTemporalGroup(Object.assign({}, jsonTemporalGroup, {
                    subGroups: []
                })); //copy vertex properties ignoring vertices, parsing date and storing directory

                var gr = jsonTemporalGroup.subGroups || [];
                gr.forEach(g => g.superGroup = tg);
                spatialGroups = spatialGroups.concat(gr);
            } catch (err) {
                this.modules.logger.log(err);
                successful = false;
            }
        }

        for (let jsonSpatialGroup of spatialGroups) {
            try {
                var sg = this.modules.model.createSpatialGroup(Object.assign({}, jsonSpatialGroup, {
                    vertices: []
                })); //copy vertex properties ignoring vertices, parsing date and storing directory

                sg.directory = rootDirectory;
                if (sg.background)
                    sg.background = this.modules.map.getBackground(sg.background)
                var ver = jsonSpatialGroup.vertices || [];
                ver.forEach(v => v.spatialGroup = sg);
                vertices = vertices.concat(ver);
            } catch (err) {
                this.modules.logger.log(err);
                successful = false;
            }
        }

        for (var jsonVertex of vertices) {
            try {
                var v = this.modules.model.createVertex(Object.assign({}, jsonVertex, {
                    outgoingEdges: [],
                })); //copy vertex properties ignoring outgoingEdges

                var ed = jsonVertex.outgoingEdges || [];
                ed.forEach(e => e.from = v);
                edges = edges.concat(ed);
            } catch (err) {
                this.modules.logger.log(err);
                successful = false;
            }
        }

        for (let e of edges) {
            try {
                this.modules.model.createEdge(e);
            } catch (err) {
                this.modules.logger.log(err);
                successful = false;
            }
        }
        return successful;
    }

    /**
     * Extracts model, settings and map (backgrounds)
     * */
    stateToJson() {
        if (this.modules.settings.autoSaveStartupView())
            this.saveCurrentView();

        var json = this.modules.model.toJSON({ persistLandmarks: this.modules.settings.persistLandmarks() });
        json.settings = this.modules.settings.toJSON();
        if (this.modules.settings.autoSaveSelectedItems())
            json.settings.timeline.selections = this.modules.timeline.getSelectionsIds();
        json.map = this.modules.map.toJSON();
        return json;
    }

    /**
     * Sets initial view parameters to current view 
     * */
    saveCurrentView() {
        this.modules.settings.map.center(this.modules.map.getCenter());
        this.modules.settings.map.zoom(this.modules.map.getZoom());
        this.modules.settings.timeline.start(this.modules.timeline.getStart());
        this.modules.settings.timeline.end(this.modules.timeline.getEnd());
        this.modules.settings.timeline.selections(this.modules.timeline.getSelectionsIds());

        if (this.modules.panorama.getVertex() && this.modules.model.hasVertex(this.modules.panorama.getVertex().id)) {
            this.modules.settings.panorama.scene(this.modules.panorama.getVertex() ? this.modules.panorama.getVertex().id : undefined);
            this.modules.settings.panorama.yaw(this.modules.panorama.getYaw());
            this.modules.settings.panorama.pitch(this.modules.panorama.getPitch());
            this.modules.settings.panorama.hfov(this.modules.panorama.getHfov());
        }
    }

    /**
     * Given: yaw from manually set landmark hotspots
     * Search space: Coordinates and northOffset of scene
     * Uses northOffset and coordinates to compute azimuth for each landmark hotspot
     * Objective function: Minimize difference between yaw and azimuth.
     * Performs gradient decent (with estimated gradients) to find the optimal solution
     * 
     * Required modules: panorama
     * 
      * @param {scene} scene
      * @param {[hotspot]} hotspots
      * @returns {Rx.Observable<JSON>} - {solution: {northOffset, coordinates}, f} where f is the standard deviation taken over all hotspots
      */
    optimize(scene, hotspots) {
        return Rx.Observable.create(observer => {

            let sqr = function (x) { return x * x; };
            let mean = function (angles) {
                var sin = 0, cos = 0;
                for (let a of angles) {
                    sin += Math.sin(a / 180 * Math.PI);
                    cos += Math.cos(a / 180 * Math.PI);
                }

                return Math.atan2(sin, cos) / Math.PI * 180;
            };
            let normalize = function (angle) {
                return angle > 180 ? angle - 360 : (angle < -180 ? angle + 360 : angle);
            };

            let objective = function (coordinates) {
                var [lat, lon] = coordinates;
                if (lat > 90.0 || lat < -90.0 || lon > 180.0 || lon < -180.0) {
                    //                       console.log([lat, lon]);
                    return Number.POSITIVE_INFINITY;

                }

                let angles = hotspots.map(hs => normalize(hs.yaw - algorithms.getAzimuth(coordinates, hs.edge.to)));
                var northOffset = mean(angles);
                var sum = angles.map(a => sqr(normalize(a - northOffset))).reduce((a, b) => a + b);
                //           console.log([coordinates, angles, sum]);
                if (!Number.isFinite(sum)) {
                    return Number.POSITIVE_INFINITY;
                }
                return Math.sqrt(sum / angles.length);
            };

            let start = scene.vertex.coordinates || config.coordinates;
            let result = numeric.uncmin(objective, start, 1e-7);
            // console.log(result);
            if (!result.solution)
                observer.error(result.message);
            else {
                result.solution = {
                    northOffset: mean(hotspots.map(hs => hs.yaw - algorithms.getAzimuth(result.solution, hs.edge.to))),
                    coordinates: result.solution
                };
            }


            observer.next(result);
            observer.complete();

        });
    }

    /**
  * Given: yaw of the landmark with respect to different panoramas (computed from all landmark edges ending in v)
  * Search space: Coordinates of v
  * Uses coordinates to compute azimuth for each landmark hotspot
  * Objective function: Minimize difference between yaw and azimuth.
  * Performs gradient decent (with estimated gradients) to find the optimal solution
  * 
  * Required modules: panorama
  * 
   * @param {vertex} v
   * @returns {Rx.Observable<JSON>} - {solution: {northOffset, coordinates}, f} where f is the standard deviation taken over all hotspots
   */
    static optimizeLandmark(v) {
        return Rx.Observable.create(observer => {
            let edges = v.outgoingEdges.map(e => e.opposite).filter(e => e.from.type === vertex.prototype.PANORAMA);

            let sqr = function (x) { return x * x; };
            let mean = function (angles) {
                var sin = 0, cos = 0;
                for (let a of angles) {
                    sin += Math.sin(a / 180 * Math.PI);
                    cos += Math.cos(a / 180 * Math.PI);
                }

                return Math.atan2(sin, cos) / Math.PI * 180;
            };
            let normalize = function (angle) {
                return angle > 180 ? angle - 360 : (angle < -180 ? angle + 360 : angle);
            };

            let objective = function (coordinates) {
                var [lat, lon] = coordinates;
                if (lat > 90.0 || lat < -90.0 || lon > 180.0 || lon < -180.0) {
                    //                       console.log([lat, lon]);
                    return Number.POSITIVE_INFINITY;

                }

                let angles = edges.filter(e => e.data.yaw != null)
                    .map(e => normalize(e.data.yaw - algorithms.getAzimuth(e.from, coordinates)));
                let sum = angles.map(a => sqr(a)).reduce((a, b) => a + b);

                if (!Number.isFinite(sum)) {
                    return Number.POSITIVE_INFINITY;
                }
                return Math.sqrt(sum / angles.length);
            };

            let start = v.coordinates;
            let result = numeric.uncmin(objective, start, 1e-7);
            // console.log(result);
            if (!result.solution)
                observer.error(result.message);

            observer.next(result);
            observer.complete();

        });
    }

    /**
     * Required modules: modal
     * 
     * @param {spatialGroup} sg
     * @param {[number]} coordinates
     * @param {number} [distanceThreshold]
     * @returns {vertex | null} - vertex from sg closest to coordinates and within distanceThreshold
     */
    getColocated(sg, coordinates, distanceThreshold = null) {
        var vMin = null;
        var minDist = distanceThreshold;
        if (distanceThreshold == null)
            minDist = sg.superGroup.getColocatedRadius() || 0;

        sg.forEach(other => {
            let distance = algorithms.getDistance(coordinates, other);
            if (distance <= minDist) { //for minDist == 0
                minDist = distance;
                vMin = other;
            }
        });

        return vMin;
    }

    /**
     * Required modules: modal
     * 
     * @param {vertex} v
     * @returns {[edge]} - destination vertex computed by getColocated(...)
     */
    connectColocated(v) {
        var established = new Map();
        var edges = [];
        established.set(v.spatialGroup.id, v.spatialGroup);
        v.forEach(e => {
            if (e.type === edge.prototype.TEMPORAL) {
                let g = e.to.spatialGroup.superGroup;
                established.set(g.id, g);
                edges.push(e);
            }
        });

        var groupsToTest = [];
        for (var sg of this.modules.model.getSpatialGroups()) {
            if (established.get(sg.id) != null || sg.type == spatialGroup.prototype.LANDMARK)
                continue;

            if (sg.type === spatialGroup.prototype.SINGLESHOT || sg.superGroup === v.spatialGroup.superGroup)
                groupsToTest.push(sg);
        }

        for (var sg of groupsToTest) {
            var vMin = this.getColocated(sg, v.coordinates, Math.min(sg.superGroup.getColocatedRadius(), v.spatialGroup.superGroup.getColocatedRadius()));

            if (!vMin)
                continue;

            if (vMin.outgoingEdges.find(e => e.type === edge.prototype.TEMPORAL && e.to.spatialGroup == v.spatialGroup))
                continue;

            edges.push(this.modules.model.createEdge({
                from: v,
                to: vMin,
                type: edge.prototype.TEMPORAL,
                bidirectional: true
            }));
        }


        return edges;
    }

    /**
     * Unlike running connectColocated for all vertices (which can deliver different output
     * when the order of vertices it is performed on changes),
     * the output of this function is always the same.
     * 
     * */
    connectAllColocated() {
        var pairQueue = new PriorityQueue({
            comparator: (a, b) => a.distance - b.distance
        });
        var pairSet = new Set();

        /**
         * @type {vertex} first
         * @type {vertex} second
         * */
        var addPair = (first, second, distance) => {
            if (first.id > second.id) {
                var tmp = first;
                first = second;
                second = tmp;
            }

            var edgeId = first.id + " to " + second.id;
            if (pairSet.has(edgeId))
                return;

            pairQueue.queue({
                first: first,
                second: second,
                distance: distance
            });

            pairSet.add(edgeId);
        }

        // generate all vertex pairs to the queue that are candidate for a temporal edge
        for (var v of Array.from(this.modules.model.vertices.values())) {
            if (v.spatialGroup.type === spatialGroup.prototype.SINGLESHOT)
                var spatialGroups = Array.from(this.modules.model.spatialGroups.values());
            else {
                var spatialGroups = [];
                v.spatialGroup.superGroup.forEach(g => {
                    if (g instanceof spatialGroup && g != v.spatialGroup)
                        spatialGroups.push(g);
                });
            }

            for (var sg of spatialGroups) {
                if (sg == v.spatialGroup)
                    continue;

                var distanceThreshold = Math.min(sg.superGroup.getColocatedRadius(), v.spatialGroup.superGroup.getColocatedRadius());
                sg.forEach(otherV => {
                    var distance = algorithms.getDistance(v, otherV);

                    if (distance <= distanceThreshold)
                        addPair(v, otherV, distance);
                });
            }
        }

        var isConnectedTo = (v, sg) => {
            for (var e of v.outgoingEdges.values()) {
                if (e.to.spatialGroup == sg)
                    return true;
            }

            return false;
        }

        var edges = [];
        while (pairQueue.length) {
            var { first, second } = pairQueue.dequeue();

            if (isConnectedTo(first, second.spatialGroup) || isConnectedTo(second, first.spatialGroup))
                continue;

            edges.push(this.modules.model.createEdge({
                from: first,
                to: second,
                type: edge.prototype.TEMPORAL,
                bidirectional: true
            }))
        }

        return edges;
    }


    /**
     * Tries to parse coordinates from filename
     * 
     * @param {string} filename
     * @returns {[number] | null}
     */
    extractCoordinates(filename) {
        if (filename == null)
            return null;

        let match = this.filenamePattern.exec(filename);
        if (match) {
            return [Number.parseFloat(match[1]), Number.parseFloat(match[2])];
        } else {
            return null;
        }

    }

    /**
     * 
     * @param {any} obj
     * @returns {any} - all numbers, booleans, and non-empty strings in obj
     *  - undefined if the return value would otherwise be empty
     */
    static extractAtomicProperties(obj) {
        if (obj == null)
            return undefined;

        var res = {};
        var count = 0;

        for (let attr in obj) {
            let type = typeof obj[attr];
            if (type === 'number' || type === 'boolean' || type === 'symbol') {
                res[attr] = obj[attr];
                count++;
            }
            if (type === 'string' && obj[attr].length > 0) {
                res[attr] = obj[attr];
                count++;
            }
        }

        return count > 0 ? res : undefined;
    }

    /**
     * 
     * @param {function} main
     * @param {[function]} calledFunctions functions or classes invoked by main
     * @returns {Worker} - runs fn
     */
    static createInlineWorker(main, calledFunctions = []) {
        var content = calledFunctions.map(f => {
            var fstr = f.toString();
            if (fstr.startsWith('('))
                return f.name + fstr;
            else
                return fstr;
        });
        content.push(
            'self.main = ', main.toString(), ';',
            'self.onmessage = function (e) { self.main(e.data) };'
        );
        let blob = new Blob(
            content, {
            type: 'text/javascript'
        }
        )

        let url = URL.createObjectURL(blob);

        var worker = new Worker(url);
        worker.release = () => {
            URL.revokeObjectURL(url);
        }
        return worker;
    }

    /**
     * adopted from pannellum.js 
    * Parses Google Photo Sphere XMP Metadata.
    * https://developers.google.com/photo-sphere/metadata/
    * 
    * Required modules: filesystem
    * 
    * @private
    * @param { file } file - Image to read XMP metadata from.
    * @returns {Rx.Observable<JSON>} - xmp data
    */
    static parseGPanoXMP(file) {
        return file.readAsBinaryString().mergeMap(img =>
            Rx.Observable.create(observer => {

                // This awful browser specific test exists because iOS 8 does not work
                // with non-progressive encoded JPEGs.
                if (navigator.userAgent.toLowerCase().match(/(iphone|ipod|ipad).* os 8_/)) {
                    var flagIndex = img.indexOf('\xff\xc2');
                    if (flagIndex < 0 || flagIndex > 65536)
                        anError(config.strings.iOS8WebGLError);
                }

                var start = img.indexOf('<x:xmpmeta');
                if (start > -1 && config.ignoreGPanoXMP !== true) {
                    var xmpData = img.substring(start, img.indexOf('</x:xmpmeta>') + 12);

                    // Extract the requested tag from the XMP data
                    var getTag = function (tag) {
                        var result;
                        if (xmpData.indexOf(tag + '="') >= 0) {
                            result = xmpData.substring(xmpData.indexOf(tag + '="') + tag.length + 2);
                            result = result.substring(0, result.indexOf('"'));
                        } else if (xmpData.indexOf(tag + '>') >= 0) {
                            result = xmpData.substring(xmpData.indexOf(tag + '>') + tag.length + 1);
                            result = result.substring(0, result.indexOf('<'));
                        }
                        if (result !== undefined) {
                            return Number(result);
                        }
                        return null;
                    };

                    // Relevant XMP data
                    var xmp = {
                        fullWidth: getTag('GPano:FullPanoWidthPixels'),
                        croppedWidth: getTag('GPano:CroppedAreaImageWidthPixels'),
                        fullHeight: getTag('GPano:FullPanoHeightPixels'),
                        croppedHeight: getTag('GPano:CroppedAreaImageHeightPixels'),
                        topPixels: getTag('GPano:CroppedAreaTopPixels'),
                        heading: getTag('GPano:PoseHeadingDegrees'),
                        horizonPitch: getTag('GPano:PosePitchDegrees'),
                        horizonRoll: getTag('GPano:PoseRollDegrees'),
                        type: getTag('GPano: ProjectionType')
                    };

                    observer.next(xmp);
                    observer.complete();
                } else {
                    observer.error();
                }
            })
        );
    }

    /**
* 
* 
* @param {vertex | [number]} from
* @param {vertex | [number]} to
   * @returns {number} - angle in ° between to, from, geographical north
*/
    static getAzimuth(from, to) {
        if (from instanceof vertex)
            from = from.coordinates;
        if (to instanceof vertex)
            to = to.coordinates;

        from = new LatLon(from[0], from[1]);
        to = new LatLon(to[0], to[1]);

        var bearing = from.initialBearingTo(to);
        if (bearing > 180)
            bearing -= 360;

        return bearing;
    }

    /**
* 
* @param {vertex | [number]} from
* @param {vertex | [number]} to
   * @returns {number} - in meters
*/
    static getDistance(from, to) {
        if (from instanceof vertex)
            from = from.coordinates;
        if (to instanceof vertex)
            to = to.coordinates;

        from = new LatLon(from[0], from[1]);
        to = new LatLon(to[0], to[1]);

        return from.distanceTo(to);
    }

    /**
     * 
     * @param {vertex | [number]} from
     * @param {number} distance - in meters
     * @param {number} bearing - angle from north measured in °
    * @returns {[number]}
     */
    static getCoords(from, distance, bearing) {
        if (from instanceof vertex)
            from = from.coordinates;

        var dest = (new LatLon(from[0], from[1])).destinationPoint(distance, bearing);
        return [dest.lat, dest.lon];
    }

}

class imageConverter extends observable {
    constructor() {
        super();
        this.loaderCanvas = document.createElement('canvas');
        this.loaderContext = this.loaderCanvas.getContext('2d');
    }

    toImage(img) {
        if (img instanceof Image) {
            return Rx.Observable.of(img);
        } else if (img instanceof Blob) {
            var img = blob;
            return Rx.Observable.create(obs => {
                var url = URL.createObjectURL(blob);
                img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = function () {
                    URL.revokeObjectURL(this.src);             // free memory held by Object URL
                    obs.next(img);
                    obs.complete();
                };
                img.onerror = (err) => { obs.error(new error(this.CONVERSION_ERROR, "", err)) };

                img.src = url;
            });
        } else if (img instanceof ImageData) {
            return this.toDataURL(img).mergeMap(i => this.toImage(i));
        } else if (img instanceof ArrayBuffer) {
            return this.toBlob(img).mergeMap(blob => this.toImage(blob));
        } else if (typeof img === "string") {
            var img = url;
            return Rx.Observable.create(obs => {
                img = new Image();
                img.crossOrigin = 'Anonymous';
                img.onload = function () {
                    obs.next(img);
                    obs.complete();
                };
                img.onerror = (err) => { obs.error(new error(this.CONVERSION_ERROR, "", err)) };
                img.src = url;
            });
        }

        return Rx.Observable.throw(new error(directory.prototype.ERROR.UNSUPPORED_OPERATION, "cannot convert this object to an Image"));
    }

    toImageData(img) {
        if (img instanceof ImageData)
            return Rx.Observable.of(img);
        else if (img instanceof Image)
            return Rx.Observable.create(obs => {
                this.drawOnInternalCanvas(img);
                obs.next(this.loaderContext.getImageData(0, 0, this.loaderCanvas.width, this.loaderCanvas.height));
                obs.complete();
            });
        else if (typeof img === "string" || img instanceof Blob || img instanceof ArrayBuffer)
            return this.toImage().mergeMap(i => this.toImageData(i));

    }

    toDataURL(img, contentType = "image/png", quality = 1) {
        if (typeof img === "string")
            return Rx.Observable.of(img);
        else if (img instanceof Image) {
            return Rx.Observable.create(obs => {
                this.drawOnInternalCanvas(img);
                obs.next(this.loaderCanvas.toDataURL(contentType, quality));
                obs.complete();
            });
        } else if (img instanceof ImageData) {
            return Rx.Observable.create(obs => {
                this.loaderCanvas.width = img.width;
                this.loaderCanvas.height = img.height;
                this.loaderContext.putImageData(img, img.width, img.height);
                obs.next(this.loaderCanvas.toDataURL(contentType, quality));
                obs.complete();
            });
        } else if (img instanceof Blob) {
            return Rx.Observable.create(obs => {
                let reader = new FileReader();
                reader.onload = function () {
                    obs.next(reader.result);
                    obs.complete();
                };
                reader.onerror = (err) => { obs.error(new error(this.CONVERSION_ERROR, "", err)) };

                reader.readAsDataURL(img); // converts the blob to base64 and calls onload

                return () => reader.abort();
            });
        }
    }

    toBlob(img, contentType = "image/png", quality = 1) {
        if (img instanceof Blob && img.type === contentType)
            return Rx.Observable.of(img);
        else if (img instanceof Blob) {
            return this.toImage(img).mergeMap(i => this.toBlob(i, contentType, quality));
        }
        else if (img instanceof Image) {
            return Rx.Observable.create(obs => {
                this.drawOnInternalCanvas(img);
                this.loaderCanvas.toBlob(blob => {
                    obs.next(blob);
                    obs.complete();
                }, contentType, quality);

            });
        } else if (img instanceof ImageData) {
            return Rx.Observable.create(obs => {
                this.loaderCanvas.width = img.width;
                this.loaderCanvas.height = img.height;
                this.loaderContext.putImageData(img, img.width, img.height);
                this.loaderCanvas.toBlob(blob => {
                    obs.next(blob);
                    obs.complete();
                }, contentType, quality);
            });
        } else if (typeof img === "string") {
            var url = img;
            var dataType;
            return Rx.Observable.create(obs => {
                var block = url.split(';');
                dataType = block[0].split(':')[1];
                var realData = block[1].split(',')[1];
                contentType = contentType || '';
                sliceSize = sliceSize || 512;

                var byteCharacters = atob(realData);
                var byteArrays = [];

                for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                    var slice = byteCharacters.slice(offset, offset + sliceSize);

                    var byteNumbers = new Array(slice.length);
                    for (var i = 0; i < slice.length; i++) {
                        byteNumbers[i] = slice.charCodeAt(i);
                    }

                    var byteArray = new Uint8Array(byteNumbers);

                    byteArrays.push(byteArray);
                }

                var blob = new Blob(byteArrays, { type: dataType });
                obs.next(blob);
                obs.complete();
            }).mergeMap(blob => this.toBlob(blob, contentType));
        } else if (img instanceof ArrayBuffer) {
            return Rx.Observable.of(new Blob([new Uint8Array(img, 0, img.byteLength)]));
        }
    }

    /**
     *  @private
     **/
    drawOnInternalCanvas(img) {
        this.loaderCanvas.width = img.width;
        this.loaderCanvas.height = img.height;
        this.loaderContext.drawImage(img, 0, 0);
    }
}

imageConverter.prototype.ERROR.CONVERSION_ERROR = "unable to convert image";