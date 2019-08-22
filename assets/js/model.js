/**
* 
* Classes: error, observable, temporalGroup, spatialGroup, vertex, edge, graph
*
* Usage:
* Call create*, delete* and update* on an instance of the graph class to manipulate
* temporalGroups, spatialGroups, vertices and edges.
*
* SpatialGroups partition vertices, temporalGroups aggregate temporalGroups and spatialGroups 
* (form a tree structure with spatialGroups as leaves)
*/

/*
* When notifier emits a value, skip all values of this observalbe for duration milliseconds.
*/
Rx.Observable.prototype.inhibitBy = function (notifier, duration) {
    var self = this;
    return Rx.Observable.create(observer => {
        var inhibitors = 0;
        notifier.subscribe(() => {
            inhibitors++;
            setTimeout(() => inhibitors--, duration);
        }
        );
        self.subscribe({
            next: val => {
                if (inhibitors == 0)
                    observer.next(val);
            },
            error: err => observer.error(err),
            complete: () => observer.complete()
        });
    });
};

/*
 * from: https://stackoverflow.com/questions/7593590/how-to-detect-array-equality-in-javascript
 * @returns {boolean} - obj is equal to reference when performing a deep comparison
 * */
function recursiveCompare(obj, reference) {
    if (obj === reference) return true;
    if (obj == null ? reference != null : reference == null)
        return false;
    if (obj.constructor !== reference.constructor) return false;
    if (obj instanceof Array) {
        if (obj.length !== reference.length) return false;
        for (var i = 0, len = obj.length; i < len; i++) {
            if (typeof obj[i] == "object" && typeof reference[i] == "object") {
                if (!recursiveCompare(obj[i], reference[i])) return false;
            }
            else if (obj[i] !== reference[i]) return false;
        }
    }
    else {
        var objListCounter = 0;
        var refListCounter = 0;
        for (var i in obj) {
            objListCounter++;
            if (typeof obj[i] == "object" && typeof reference[i] == "object") {
                if (!recursiveCompare(obj[i], reference[i])) return false;
            }
            else if (obj[i] !== reference[i]) return false;
        }
        for (var i in reference) refListCounter++;
        if (objListCounter !== refListCounter) return false;
    }
    return true; //Every object and array is equal
}

/*
 * some global utility classes 
 * */

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: error
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class error {
    get [Symbol.toStringTag]() {
        return 'Error';
    }

    /**
     * 
     * @param {string} type
     * @param {string} message
     * @param {any} data
     */
    constructor(type, message, data) {
        this.type = type;
        this.message = message;
        this.data = data;
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: warning
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class warning {
    get [Symbol.toStringTag]() {
        return 'Warning';
    }

    /**
     * 
     * @param {string} type
     * @param {string} message
     * @param {any} data
     */
    constructor(type, message, data) {
        this.type = type;
        this.message = message;
        this.data = data;
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: observable
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class observable {
    get [Symbol.toStringTag]() {
        return 'Observable';
    }

    constructor() {
        this.subjects = [];
    }

    /**
     *
     * @param {string} clazz
     * @param {string} operation
     * @param {string} [modifiers]
    * @returns {string}
     */
    createName(clazz, operation, modifiers = "") {
        return `${modifiers} ${clazz}.${operation}`;
    }

    /**
     * @private
     * @param {any} data
     * @param {string} operation
     * @param {string} [clazz] 
     */
    emit(data, operation, clazz) {
        if (clazz == null)
            clazz = data.constructor.name;

        let name = this.createName(clazz, operation);
        this.subjects[name] || (this.subjects[name] = new Rx.Subject());
        this.subjects[name].next(data);
    }


    /**
* @private
* @param {string} attribute
* @param {any} data
*/
    startUpdate(data, attribute, clazz) {
        if (clazz == null)
            clazz = data.constructor.name;

        let name = this.createName(clazz, attribute, "before update");
        this.subjects[name] || (this.subjects[name] = new Rx.Subject());
        this.subjects[name].next(data);
    }

    /**
* @private
* @param {string} attribute
* @param {any} data
*/
    endUpdate(data, attribute, clazz) {
        if (clazz == null)
            clazz = data.constructor.name;

        let name = this.createName(clazz, attribute, "update");
        this.subjects[name] || (this.subjects[name] = new Rx.Subject());
        this.subjects[name].next(data);
    }

    /**
     *
     * @param {class} clazz
     * @param {string} operation
     * @param {Rx.Scheduler} [scheduler] when passing null the synchronous queue is used 
    * @returns {Rx.Subject}
     */
    observe(clazz, operation, scheduler = Rx.Scheduler.asap) {
        if (typeof clazz !== 'string') {
            clazz = clazz.name;
        }
        var fnName = this.createName(clazz, operation);
        this.subjects[fnName] || (this.subjects[fnName] = new Rx.Subject());
        if (scheduler instanceof Rx.Scheduler.constructor)
            return this.subjects[fnName].observeOn(scheduler);
        return this.subjects[fnName];
    }

    /**
 *
 * @param {class} clazz
 * @param {string} operation
* @returns {Rx.Subject}
 */
    beforeUpdate(clazz, attribute) {
        if (typeof clazz !== 'string') {
            clazz = clazz.name;
        }
        var fnName = this.createName(clazz, attribute, "before update");
        this.subjects[fnName] || (this.subjects[fnName] = new Rx.Subject());
        return this.subjects[fnName];
    }

    /**
*
* @param {class} clazz
* @param {string} operation
* @param {Rx.Scheduler} [scheduler] when passing null the synchronous queue is used 
* @returns {Rx.Subject}
*/
    afterUpdate(clazz, attribute, scheduler = Rx.Scheduler.asap) {
        if (typeof clazz !== 'string') {
            clazz = clazz.name;
        }
        var fnName = this.createName(clazz, attribute, "update");
        this.subjects[fnName] || (this.subjects[fnName] = new Rx.Subject());
        if (scheduler instanceof Rx.Scheduler.constructor)
            return this.subjects[fnName].observeOn(scheduler)
        return this.subjects[fnName];
    }

    dispose() {
        var subjects = this.subjects;
        for (var prop in subjects) {
            if (hasOwnProp.call(subjects, prop)) {
                subjects[prop].dispose();
            }
        }

        this.subjects = {};
    }
}

observable.prototype.ERROR = {};

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: temporalGroup
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Aggregates other temporal groups in a tree-like manner where the leaves are spatial groups.
 * */
class temporalGroup {
    get [Symbol.toStringTag]() {
        return 'Temporal Group';
    }

    constructor(config = {}) {
        Object.assign(this, config);
        this.id = this.id || this.name || this.description;
        this.type = this.type || this.TOUR;
        this.subGroups = new Map();

        if (this.colocatedRadius && !(this.colocatedRadius instanceof Number)) {
            this.colocatedRadius = parseFloat(this.colocatedRadius);
        }
    }

    /**
    * @param {spatialGroup | temporalGroup} g - add g as a child
    */
    add(g) {
        if (g.superGroup != null) {
            g.superGroup.remove(g);
        }

        g.superGroup = this;
        this.subGroups.set(g.id, g);
    }

    /**
* @param {spatialGroup | temporalGroup} g - remove g as a child
*/
    remove(g) {
        delete g.superGroup;
        this.subGroups.delete(g.id);
    }

    /**
     * @returns {boolean}
     */
    isMultiselect() {
        if (this.multiselect != null)
            return this.multiselect;
        else if (this.superGroup)
            return this.superGroup.isMultiselect();
        else
            return true;
    }

    /**
    * @param {temporalGroup} elem
    * @returns {boolean} elem is ancestor of this
    */
    isAncestor(elem) {
        if (this === elem)
            return true;
        else if (this.superGroup == null)
            return false;
        else
            return this.superGroup.isAncestor(elem);
    }

    /**
     * @returns {temporalGroup}
     */
    getRoot() {
        if (this.superGroup == null)
            return this;
        return this.superGroup.getRoot();
    }

    /**
     * @returns {Number} 
     */
    getColocatedRadius() {
        if (this.colocatedRadius != null)
            return this.colocatedRadius;
        if (this.superGroup == null)
            return 0;
        return this.superGroup.getColocatedRadius();
    }

    /**
     * 
     * @param {Number} Number of ancestors
     */
    getDepth() {
        if (this.superGroup == null)
            return 0;
        return this.superGroup.getDepth() + 1;
    }

    /**
     *
     * @param {function(temporalGroup) : void} f
     */
    forEach(f) {
        Array.from(this.subGroups.values()).forEach(f);
    }

    /**
     * @returns {Rx.Observable<temporalGroup>}
     */
    toObservable() {
        return Rx.Observable.from(Array.from(this.subGroups.values()));
    }

    /**
    * @param  {boolean} [config.ignoreSubGroups] - children not included
    * @param  {boolean} [config.ignoreSuperGroup] - id of parent not included
    * @param  {boolean} [config.ignoreVertices]
    * @param  {boolean} [config.ignoreSpatialGroup]
    * @param  {boolean} [config.ignoreEdges]
    * @param  {boolean} [config.persistLandmarks]
    * @param  {boolean} [config.ignoreFrom] - exclude source of edge
    * @returns {JSON}
    */
    toJSON(config = {}) {
        var subGroups;
        if (!config.ignoreSubGroups) {
            subGroups = Array.from(this.subGroups.values()).map(g => g.toJSON(Object.assign({}, config, { ignoreSuperGroup: true })));
        }
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            description: this.description,
            superGroup: !config.ignoreSuperGroup && this.superGroup ? this.superGroup.id : undefined,
            path: this.path,
            autoConnectColocated: this.autoConnectColocated,
            colocatedRadius: this.colocatedRadius,
            multiselect: this.multiselect,
            subGroups: subGroups
        };
    }
}

temporalGroup.prototype.TOUR = 'tour';
temporalGroup.prototype.LANDMARK = 'landmark';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: spatialGroup
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Formes a partition of vertices.
 * */
class spatialGroup {
    get [Symbol.toStringTag]() {
        return 'Spatial Group';
    }

    /**
     * 
     * @param {Date} timeslot
     * @param {string} name
     * @param {string} description
     */
    constructor(config = {}) {
        Object.assign(this, config);
        this.type = this.type || this.superGroup.type || this.ROUTE;
        if (typeof this.timeslot === 'string')
            this.timeslot = new Date(this.timeslot);
        if (this.timeslot == null)
            this.timeslot = new Date();

        if (this.name == null) {
            this.name = moment(this.timeslot).format('MMMM YYYY');
        }

        this.vertices = new Map();
        if (this.type === spatialGroup.prototype.ROUTE) {
            this.images = this.images || {};
            this.thumbnails = this.thumbnails || {};
        }

        this.id = this.id || this.name + ' ' + this.superGroup.id;

        this.images = this.images || {};
        this.thumbnails = this.thumbnails || {};
    }

    /**
    * @param {spatialGroup | temporalGroup} v - add v as a child
    */
    add(v) {
        if (v.spatialGroup != null) {
            v.spatialGroup.remove(v);
        }

        v.spatialGroup = this;
        this.vertices.set(v.id, v);
    }

    /**
    * @param {vertex} v
    */
    remove(v) {
        this.vertices.delete(v.id);
    }

    /**
 * @returns {boolean}
 */
    isMultiselect() {
        if (this.superGroup)
            return this.superGroup.isMultiselect();
        else
            return true;
    }

    /**
    * @param {temporalGroup | spatialGroup} elem
    * @returns {boolean} - elem is ancestor of this
    */
    isAncestor(elem) {
        if (this === elem)
            return true;
        else if (this.superGroup == null)
            return false;
        else
            return this.superGroup.isAncestor(elem);
    }

    /**
 * @returns {temporalGroup}
 */
    getRoot() {
        return this.superGroup.getRoot();
    }

    /**
 *
 * @param {function(vertex) : void} f
 */
    forEach(f) {
        Array.from(this.vertices.values()).forEach(f);
    }

    /**
     * @returns {Rx.Observable<vertex>}
     */
    toObservable() {
        return Rx.Observable.from(Array.from(this.vertices.values()));
    }

    /**
    * @param  {boolean} [config.ignoreSuperGroup] - id of parent not included
    * @param  {boolean} [config.ignoreVertices]
    * @param  {boolean} [config.ignoreSpatialGroup]
    * @param  {boolean} [config.ignoreEdges]
    * @param  {boolean} [config.persistLandmarks]
    * @param  {boolean} [config.ignoreFrom] - exclude source of edge
    * @returns {JSON}
    */
    toJSON(config = {}) {
        var vertices;
        if (!config.ignoreVertices)
            vertices = Array.from(this.vertices.values()).map(v => v.toJSON(Object.assign({}, config, { ignoreSpatialGroup: true })));
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            timeslot: this.timeslot,
            description: this.description,
            superGroup: !config.ignoreSuperGroup && this.superGroup ? this.superGroup.id : undefined,
            path: this.path,
            images: algorithms.extractAtomicProperties(this.images),
            thumbnails: algorithms.extractAtomicProperties(this.thumbnails),
            background: this.background ? this.background.label : undefined,
            vertices: vertices
        };
    }
}

spatialGroup.prototype.ROUTE = 'route'; // vertex is part of a tour
spatialGroup.prototype.SINGLESHOT = 'singleshot'; // vertices shall be inserted into temporal navigation of other temporal groups
spatialGroup.prototype.LANDMARK = 'landmark';

spatialGroup.prototype.TIMESLOT = 'timeslot';
spatialGroup.prototype.BACKGROUND = 'background';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: vertex
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Start or end of an edge, contained in a graph.
 * */
class vertex {
    get [Symbol.toStringTag]() {
        return 'Vertex';
    }

    /**
 *
 * @param {JSON} config
* 
 */
    constructor(config) {
        Object.assign(this, config);

        this.image = this.image || {};
        this.thumbnail = this.thumbnail || {};

        if (!this.data) {
            this.data = {};
        }
        for (var prop of ["vaov", "northOffset", "vOffset"]) {
            if (this[prop]) {
                if (!this.data[prop])
                    this.data[prop] = this[prop];
                delete this[prop];
            }
        }
        if (typeof this.timeslot === 'string')
            this.timeslot = new Date(this.timeslot);

        if (config.outgoingEdges == null)
            this.outgoingEdges = [];

        if (this.image.file) {
            if (this.path == null && this.image.path == null) {
                this.path = this.image.file.getPath(config.spatialGroup.images.directory);
            }
        }

        if (this.type === vertex.prototype.PANORAMA) {
            this.image = this.image || {};
            this.thumbnail = this.thumbnail || {};
        }

        if (config.id == null) {
            this.id = this.getTimeslot().toISOString().split('T')[0]
                + '_' + this.coordinates[0].toFixed(6) + ','
                + this.coordinates[1].toFixed(6) + '_' + this.type;
        }


    }

    /**
* @param {temporalGroup | spatialGroup} elem
* @returns {boolean} - elem is ancestor of this
*/
    isAncestor(elem) {
        if (this === elem)
            return true;
        else if (this.spatialGroup == null)
            return false;
        else
            return this.spatialGroup.isAncestor(elem);
    }

    /**
 * @returns {boolean}
 */
    hasData() {
        if (!this.data)
            return false;
        for (let prop in this.data) {
            if (this.data[prop] != null)
                return true;
        }
        return false;
    }

    /**
     * @returns {object} with attributes directory, path, prefix, file, width, height
     * */
    getImageConfig() {
        return {
            directory: this.spatialGroup.images.directory,
            path: this.image.path,
            prefix: this.spatialGroup.images.prefix,
            file: this.image.file,
            height: (this.img ? this.img.height : this.image.height) || this.spatialGroup.images.height,
            width: (this.img ? this.img.width : this.image.width) || this.spatialGroup.images.width,
            img: this.image.file ? this.image.file.img : undefined
        };
    }

    /**
 * @returns {object} with attributes directory, path, prefix, file, width, height
 * */
    getThumbConfig() {
        let imgConfig = this.getImageConfig();
        return {
            directory: this.spatialGroup.thumbnails.directory,
            path: this.thumbnail.path,
            prefix: this.spatialGroup.thumbnails.prefix,
            file: this.thumbnail.file,
            height: this.thumbnail.height || this.spatialGroup.thumbnails.height,
            width: this.thumbnail.width || this.spatialGroup.thumbnails.width,
            img: this.thumbnail.file ? this.thumbnail.file.img : undefined
        };
    }

    /**
    *
    * @param {function(edge) : void} f
    */
    forEach(f) {
        Array.from(this.outgoingEdges).forEach(f);
    }

    /**
     * @returns {Rx.Observable<edge>}
     */
    toObservable() {
        return Rx.Observable.from(Array.from(this.outgoingEdges));
    }

    /**
    * @param  {boolean} [config.ignoreSpatialGroup]
    * @param  {boolean} [config.ignoreEdges]
    * @param  {boolean} [config.persistLandmarks]
    * @param  {boolean} [config.ignoreFrom] - exclude source of edge
    * @returns {JSON}
    */
    toJSON(config = {}) {
        if (!config.ignoreEdges) {
            var edges = [];
            this.forEach(e => {
                if ((e.opposite == null || e.from.id < e.to.id)
                    && (e.type === edge.prototype.ROUTE || e.type === edge.prototype.SPATIAL))
                    edges.push(e.toJSON(Object.assign({}, config, { ignoreFrom: true })));
                else if (config.persistLandmarks && e.type === edge.prototype.LANDMARK && this.type !== vertex.prototype.LANDMARK)
                    edges.push(e.toJSON(Object.assign({}, config, { ignoreFrom: true })));
            });

            if (edges.length == 0)
                edges = undefined;
        }



        return {
            id: this.id,
            type: this.type,
            name: this.name,
            spatialGroup: !config.ignoreSpatialGroup ? this.spatialGroup.id : undefined,
            timeslot: this.timeslot,
            coordinates: this.coordinates,
            path: this.path,
            image: algorithms.extractAtomicProperties(this.image),
            thumbnail: algorithms.extractAtomicProperties(this.thumbnail),
            data: this.hasData() ? this.data : undefined,
            outgoingEdges: edges,
        };
    }

    /**
    * @returns {Date}
    */
    getTimeslot() {
        return this.timeslot || this.spatialGroup.timeslot || new Date();
    }

    /*
    * @returns {boolean}
    */
    hasOutgoingEdges() {
        return this.outgoingEdges.length !== 0;
    }
}

vertex.prototype.PANORAMA = 'panorama';
vertex.prototype.PLACEHOLDER = 'placeholder';
vertex.prototype.LANDMARK = 'landmark';

vertex.prototype.COORDINATES = 'coordinates';
vertex.prototype.DATA = 'data';
vertex.prototype.TIMESLOT = 'timeslot';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: edge
//
///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Contained in a graph.
 * */
class edge {
    get [Symbol.toStringTag]() {
        return 'Edge';
    }

    constructor(config) {
        Object.assign(this, config);
        this.type = this.deriveType();

        if (config.id == null)
            this.id = this.from.id + " to " + this.to.id + ' ' + this.type;

        this.data = this.data || {};
    }

    /**
* @param {temporalGroup | spatialGroup} elem
* @returns {boolean} - elem is ancestor of this
*/
    isAncestor(elem) {
        if (this === elem)
            return true;
        else if (this.from == null)
            return false;
        else
            return this.from.isAncestor(elem);
    }

    /**
     * 
     * @returns {string}
     */
    deriveType() {
        var type = this.type;

        if (this.from.type === vertex.prototype.LANDMARK || this.to.type === vertex.prototype.LANDMARK)
            type = edge.prototype.LANDMARK;
        else if (this.from.type === vertex.prototype.PLACEHOLDER || this.to.type === vertex.prototype.PLACEHOLDER)
            type = edge.prototype.PLACEHOLDER;

        if (type == null) {
            if (this.from.spatialGroup === this.to.spatialGroup)
                type = edge.prototype.ROUTE;
            else if (this.from.spatialGroup.superGroup === this.to.spatialGroup.superGroup)
                type = edge.prototype.TEMPORAL;
            else
                type = edge.prototype.TEMP;
        }

        return type;
    }

    /**
     * @returns {boolean}
     */
    hasData() {
        if (!this.data)
            return false;
        for (let prop in this.data) {
            if (this.data[prop] != null)
                return true;
        }
        return false;
    }

    /**
    * @param  {boolean} [config.ignoreFrom] - exclude source of edge
    * @returns {JSON}
    */
    toJSON(config = {}) {
        return {
            id: this.id,
            from: !config.ignoreFrom ? this.from.id : undefined,
            to: this.to.id,
            type: this.type,
            data: this.hasData() ? this.data : undefined,
            bidirectional: this.opposite != null,
            oppositeData: this.opposite && this.opposite.hasData() ? this.opposite.data : undefined
        };
    }
}

edge.prototype.ROUTE = 'route'; // edge is part of a tour (within a spatial group)
edge.prototype.TEMP = 'temp'; // edge is created for temporary display
edge.prototype.SPATIAL = 'spatial'; //edge leads to an isolated panorama (between spatial groups)
edge.prototype.LANDMARK = 'landmark'; // edge leads to landmark (no panorama associated)
edge.prototype.TEMPORAL = 'temporal'; // edge connects vertices at the same place at different times (lowest common temporal group in common)
edge.prototype.PLACEHOLDER = 'placeholder'; // edge leads to placeholder (no panorama associated)

edge.prototype.DATA = 'data';

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: graph
//
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * A graph consisting of vertices and edges, aggregated by spatial and temporal groups.
 * 
 * Listen to events: this.observe(<class>, <action>).subscribe(elem => / do something with element here /)
 * where <class> in {vertex, edge, spatialGroup, temporalGroup}
 * <action> in {this.CREATE, this.DELETE}
 * */
class graph extends observable {
    get [Symbol.toStringTag]() {
        return 'Graph';
    }

    constructor() {
        super();
        this.vertices = new Map();
        this.edges = new Map();
        this.temporalGroups = new Map();
        this.spatialGroups = new Map();
    }

    /**
     * 
     * @param {string} id
     * @returns {vertex}
     * @throws {error}
     */
    getVertex(id) {
        if (!this.vertices.has(id))
            throw new error(this.ERROR.VERTEX_NOT_FOUND, "", id);

        return this.vertices.get(id);
    }

    /**
 * 
 * @param {string} id
 * @returns {edge}
 * @throws {error}
 */
    getEdge(id) {
        if (!this.edges.has(id))
            throw new error(this.ERROR.EDGE_NOT_FOUND, "", id);

        return this.edges.get(id);
    }

    /**
* 
* @param {string} id
* @returns {spatialGroup}
* @throws {error}
*/
    getSpatialGroup(id) {
        if (!this.spatialGroups.has(id))
            throw new error(this.ERROR.GROUP_NOT_FOUND, "", id);

        return this.spatialGroups.get(id);
    }

    /**
* 
* @param {string} id
* @returns {temporalGroup}
* @throws {error}
*/
    getTemporalGroup(id) {
        if (!this.temporalGroups.has(id))
            throw new error(this.ERROR.GROUP_NOT_FOUND, "", id);

        return this.temporalGroups.get(id);
    }

    /**
     * @returns {[spatialGroup]}
     */
    getSpatialGroups() {
        return Array.from(this.spatialGroups.values());
    }

    /**
  *
  * @param {JSON} config
     * @returns {temporalGroup}
  */
    createTemporalGroup(config = {}) {
        if (config.superGroup != null && !(config.superGroup instanceof temporalGroup))
            config.superGroup = this.getTemporalGroup(config.superGroup);

        var g = new temporalGroup(config);
        if (this.temporalGroups.get(g.id) != null) {
            return this.temporalGroups.get(g.id);
        }

        if (g.superGroup instanceof temporalGroup) {
            g.superGroup.add(g);
        }

        this.temporalGroups.set(g.id, g);
        this.emit(g, this.CREATE);
        return g;
    }

    /**
     * 
     * @param {JSON} config
     * @returns {spatialGroup}
     */
    createSpatialGroup(config = {}) {
        if (config.superGroup == null) {
            config.superGroup = this.createTemporalGroup({ name: "default" });
        } else if (!(config.superGroup instanceof temporalGroup)) {
            config.superGroup = this.getTemporalGroup(config.superGroup);
        }

        var g = new spatialGroup(config);
        if (this.spatialGroups.get(g.id) != null) {
            return this.spatialGroups.get(g.id);
        }

        if (g.superGroup instanceof temporalGroup) {
            g.superGroup.add(g);
        }

        if (config.vertices != null) {
            for (let v of config.vertices) {
                g.add(v.id, v);
            }
        }

        this.spatialGroups.set(g.id, g);
        this.emit(g, this.CREATE);
        return g;
    }

    /**
     *
     * @param {JSON} config
    * @param {string} [config.id]
    * @param {string} [config.type]
    * @param {Date} [config.timeslot]
    * @param {[number]} [config.coordinates]
    * @param {File} [config.file]
    * @param {spatialGroup} [config.spatialGroup]
    * @returns {vertex}
     */
    createVertex(config = {}) {
        if (config.id != null && this.vertices.get(config.id) != null)
            return this.vertices.get(config.id);

        if (!config.type && !config.file || config.type === vertex.prototype.PANORAMA && config.path == null)
            config.type = vertex.prototype.PLACEHOLDER;
        else if (!config.type)
            config.type = vertex.prototype.PANORAMA;

        if (config.coordinates == null) {
            config.coordinates = [0, 0];
        }

        if (config.spatialGroup == null) {
            if (config.timeslot == null && config.file != null) {
                var d = new Date(config.file.created || config.file.lastModified);
                config.timeslot = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            }

            config.timeslot = config.timeslot || new Date();

            config.spatialGroup = this.createSpatialGroup({
                timeslot: config.timeslot,
                superGroup: this.createTemporalGroup({
                    name: config.type,
                    type: config.type
                }),
                type: config.type === vertex.prototype.LANDMARK ? spatialGroup.prototype.LANDMARK : spatialGroup.prototype.ROUTE
            });
        } else if (!(config.spatialGroup instanceof spatialGroup)) {
            config.spatialGroup = this.getSpatialGroup(config.spatialGroup);
        }

        let v = new vertex(config);
        if (this.vertices.get(v.id) != null) {
            return this.vertices.get(v.id);
        }

        config.spatialGroup.add(v);

        var self = this;

        this.vertices.set(v.id, v);

        this.emit(v, this.CREATE);
        return v;

    }

    /**
     * 
     * @param {JSON} config
    * @returns {edge}
     */
    createEdge(config) {
        if (!(config.from instanceof vertex)) {
            config.from = this.getVertex(config.from);
        }

        if (!(config.to instanceof vertex)) {
            config.to = this.getVertex(config.to);
        }

        if (!(config.from instanceof vertex && config.to instanceof vertex))
            throw new error(this.INVALID_PARAMETERS, "", { from: config.from, to: config.to });

        var e = new edge(Object.assign({}, config, { bidirectional: null }));
        if (this.edges.get(e.id) != null) {
            e = this.edges.get(e.id); // edge already exists
        }

        if (e.opposite == null) {
            let eOpp = new edge({ from: config.to, to: config.from, type: config.type, data: config.oppositeData });

            if (this.edges.get(eOpp.id) != null) {
                eOpp = this.edges.get(eOpp.id);
            }
            e.opposite = eOpp;
            eOpp.opposite = e;

            delete e.bidirectional;
            delete e.oppositeData;

            if (this.edges.get(e.id) == null && config.bidirectional) {
                this.edges.set(eOpp.id, eOpp);
                eOpp.from.outgoingEdges.push(eOpp);
                this.emit(eOpp, this.CREATE);
            }
        }

        if (this.edges.get(e.id) == null) {
            config.from.outgoingEdges.push(e);
            this.edges.set(e.id, e);
            this.emit(e, this.CREATE);
        }

        return e;
    }

    /**
     * 
     * @param {vertex} v
     * @param {coordinates} coordinates
     * @returns {vertex}
     */
    updateCoordinates(v, coordinates) {
        if (!recursiveCompare(v.coordinates, coordinates)) {
            this.startUpdate(v, v.COORDINATES);
            v.coordinates = coordinates;
            this.endUpdate(v, v.COORDINATES);
        }

        return v;
    }

    /**
     *@param {vertex|edge} v
     * @param {JSON} data - data to update
     * @param {boolean} overwrite replace existing data object, when false incremental updates are possible
     * @returns {vertex}
     */
    updateData(v, data, overwrite = false) {
        var changed = false;
        for (var prop in Object.assign({}, v.data, data)) {
            if (data[prop] !== v.data[prop]) {
                changed = true;
                break;
            }
        }

        if (changed) {
            this.startUpdate(v, v.DATA);
            if (overwrite)
                v.data = data;
            else
                Object.assign(v.data, data);
            this.endUpdate(v, v.DATA);
        }

        return v;
    }

    /**
    * @param {vertex} v
    * @param {Date} timeslot
    */
    updateTimeslot(v, timeslot) {
        if (timeslot != v.timeslot) {
            this.startUpdate(v, v.TIMESLOT);
            v.timeslot = timeslot;
            this.endUpdate(v, v.TIMESLOT);
        }
    }

    /**
     * 
     * @param {spatialGroup} sg
     * @param {background} b
     */
    updateBackground(sg, b) {
        if (b != sg.background) {
            this.startUpdate(sg, sg.BACKGROUND);
            sg.background = b;
            this.endUpdate(sg, sg.BACKGROUND);
        }
    }

    /**
    * Adds bottom as a child of top.
    * 
    * @param {vertex | spatialGroup | temporalGroup} bottom
    * @param {spatialGroup | temporalGroup} top
    */
    addTo(bottom, top) {
        if (bottom.superGroup === top || bottom === top)
            return;

        if (bottom.superGroup != null)
            this.removeFrom(bottom, bottom.superGroup);

        top.add(bottom);
        //       this.emit( bottom, this.GROUPUPDATE);
    }

    /**
    *
    * @param {vertex | spatialGroup | temporalGroup} bottom
    * @param {spatialGroup | temporalGroup} top
    */
    removeFrom(bottom, top) {
        if (bottom.superGroup !== top || bottom === top)
            return;

        top.remove(bottom);
        //        this.emit( bottom, this.GROUPUPDATE)
    }


    /**
 *
 * @param {temporalGroup | string} g
 */
    deleteTemporalGroup(g) {
        g.forEach(e => {
            if (e instanceof temporalGroup)
                this.deleteTemporalGroup(e);
            else
                this.deleteSpatialGroup(e);
        });

        let superGroup = g.superGroup;
        if (superGroup != null) {
            this.removeFrom(g, g.superGroup);
        }
        g.superGroup = superGroup;

        this.temporalGroups.delete(g.id);
        this.emit(g, this.DELETE);
    }

    /**
 * 
 * @param {spatialGroup} g
 */
    deleteSpatialGroup(g) {
        g.forEach(v => {
            this.deleteVertex(v);
        });

        let superGroup = g.superGroup;
        if (g.superGroup != null) {
            this.removeFrom(g, g.superGroup);
        }
        g.superGroup = superGroup;

        this.spatialGroups.delete(g.id);
        this.emit(g, this.DELETE);
    }

    /**
     * 
     * @param {vertex} v
     */
    deleteVertex(v) {
        this.vertices.delete(v.id);

        v.spatialGroup.remove(v);

        v.forEach(e => {
            this.deleteEdge(e);
        });

        this.emit(v, this.DELETE);
    }

    /**
     * 
     * @param {edge} e
     */
    deleteEdge(e) {
        /**
         * @type {[edge]}
         */
        var arr = e.from.outgoingEdges;
        let index = arr.findIndex(elem => elem === e);
        if (index !== -1) {
            arr.splice(index, 1);
        }

        this.edges.delete(e.id);

        if (e.opposite != null) {
            let eOpposite = e.opposite;
            delete e.opposite;
            delete eOpposite.opposite;
            this.deleteEdge(eOpposite);
        }

        this.emit(e, this.DELETE);
    }


    /**
    * @param  {boolean} [config.ignoreSubGroups] - children not included
    * @param  {boolean} [config.ignoreSuperGroup] - id of parent not included
    * @param  {boolean} [config.ignoreVertices]
    * @param  {boolean} [config.ignoreSpatialGroup]
    * @param  {boolean} [config.ignoreEdges]
    * @param  {boolean} [config.persistLandmarks]
    * @param  {boolean} [config.ignoreFrom] - exclude source of edge
    * @returns {JSON}
    */
    toJSON(config) {

        var spatialGroups = [];
        var jsonTemporalGroups = [];
        for (let g of this.temporalGroups.values()) {
            if (g.type !== temporalGroup.prototype.LANDMARK || config.persistLandmarks) {
                jsonTemporalGroups.push(g.toJSON(Object.assign({}, config, { ignoreSubGroups: true })));
                g.subGroups.forEach(s => {
                    if (s instanceof spatialGroup)
                        spatialGroups.push(s)
                });
            }
        }

        var jsonSpatialGroups = [];
        for (let g of spatialGroups) {
            if (g.id !== spatialGroup.prototype.LANDMARK || config.persistLandmarks) {
                jsonSpatialGroups.push(g.toJSON(config));
            }
        }

        return { version: 1, temporalGroups: jsonTemporalGroups, spatialGroups: jsonSpatialGroups };
    }

}
graph.prototype.CREATE = 'create';
graph.prototype.DELETE = 'delete';
graph.prototype.ERROR.VERTEX_NOT_FOUND = "no such vertex";
graph.prototype.ERROR.EDGE_NOT_FOUND = "no such edge";
graph.prototype.ERROR.GROUP_NOT_FOUND = "no such spatialGroup";
graph.prototype.ERROR.INVALID_PARAMETERS = "invalid parameters";


