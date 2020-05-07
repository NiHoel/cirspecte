'use strict';

/**
 * Summary: 
 * Keeps track of modifications to the modal and allows to undo them.
 * 
 * Usage: 
 * Call commit() when user initiated an action before any changes to the modal are applied
 * Call undo() and redo() to revert / re-revert user actions
 * 
 * Implementation details:
 * There is no limit for the number of actions to be stored.
 * Changes are received from the event system of the modal.
 * Each user action may cause several changes to the modal that happen asynchronously.
 * All of them are stored on a stack.
 * After calling commit() the stack for the previous action is closed
 * */
class commandHistory extends observable {
    get [Symbol.toStringTag]() {
        return 'Command History';
    }

    /**
     * 
     * @param {graph} modules.model
     * @param {logger} modules.logger
     * @param {panoramaViewer} modules.panorama
     * @param {filesystem} modules.filesys
     */
    constructor(modules) {
        super();
        this.modules = modules;
        this.undoStack = [];
        this.redoStack = [];
        this.undoRoutine = [];
        this.redoRoutine = [];
        this.undoStackCount = ko.observable(0);
        this.redoStackCount = ko.observable(0);
        this.mode = this.MODES.NORMAL;
        this.dirty = false;

        this.initialize();
        ko.applyBindings(this, $('#undo-button')[0]);
        ko.applyBindings(this, $('#redo-button')[0]);
    }

    /**
     * Add command as part of the current user action.
     * 
     * @private
     * @param {Function} command
     */
    add(command) {
        if (this.undoStack.length || this.redoStack.length) // ignore loading model from file
            this.dirty = true;

        if (this.mode === this.MODES.NORMAL) {
            this.undoRoutine.push(command);
            this.redoRoutine = [];
            this.redoStack = [];
        } else if (this.mode === this.MODES.REDOING) {
            this.undoRoutine.push(command);
        } else if (this.mode === this.MODES.UNDOING)
            this.redoRoutine.push(command);

        this.computeCounters();
    }

    /**
     * closes the current sequence of aggregated operations and pushes them as one routine on the stack (undo or redo depending on the mode)
     */
    commit() {
        if (this.mode === this.MODES.NORMAL || this.mode === this.MODES.REDOING) {
            if (this.undoRoutine.length !== 0) {
                this.undoStack.push(this.undoRoutine);
                this.undoRoutine = [];
            }
        }
        else if (this.mode === this.MODES.UNDOING) {
            if (this.redoRoutine.length !== 0) {
                this.redoStack.push(this.redoRoutine);
                this.redoRoutine = [];
            }
        }
        this.mode = this.MODES.NORMAL;

        this.computeCounters();
    }

    /*
     * Reverts the last user action.
     * Can be called arbitrarily often.
     * */
    undo() {
        this.commit();

        var routine = this.undoStack.pop();
        if (!routine)
            throw new error(this.ERROR.EMPTY_STACK);

        this.mode = this.MODES.UNDOING;
        this.dirty = true;
        var command;
        while (command = routine.pop()) {
            try {
                command();
            } catch (err) {
                this.modules.logger.log(err);
            }
        }

        this.computeCounters();
    }

    /**
     * Restores the previous user action if it was reverted.
     * It is possible to restore all reverts done before.
     * */
    redo() {
        this.commit();

        var routine = this.redoStack.pop();
        if (!routine)
            throw new error(this.ERROR.EMPTY_STACK);

        this.mode = this.MODES.REDOING;
        this.dirty = true;
        var command;
        while (command = routine.pop()) {
            try {
                command();
            } catch (err) {
                this.modules.logger.log(err);
            }
        }

        this.computeCounters();
    }

    /**
     * Clears the complete history
     * */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.undoRoutine = [];
        this.redoRoutine = [];
        this.mode = this.MODES.NORMAL;
        this.dirty = false;

        this.computeCounters();
    }

    /**
     * Update stack counters
     * 
     * @private
     * */
    computeCounters() {
        this.undoStackCount(this.undoStack.length + this.undoRoutine.length > 0 ? 1 : 0);
        this.redoStackCount(this.redoStack.length + this.redoRoutine.length > 0 ? 1 : 0);
    }

    /**
     * Registers all events relevant to keep track of.
     * Contains logic to reverse an operation
     * @private
     * */
    initialize() {
        var model = this.modules.model;
        var panorama = this.modules.panorama;
        var map = this.modules.map;
        var filesys = this.modules.filesys;

        model.observe(temporalGroup, model.CREATE, null)
            .subscribe(g => this.add(
                () => model.deleteTemporalGroup(model.getTemporalGroup(g.id))
            ));

        model.observe(spatialGroup, model.CREATE, null)
            .subscribe(g => this.add(
                () => model.deleteSpatialGroup(model.getSpatialGroup(g.id))
            ));

        model.observe(vertex, model.CREATE, null)
            .subscribe(v => this.add(
                () => model.deleteVertex(model.getVertex(v.id))
            ));

        model.observe(edge, model.CREATE, null)
            .subscribe(e => this.add(() => {
                try {
                    model.deleteEdge(model.getEdge(e.id))
                } catch (err) { } //ignore errors caused by already deleted bidirectional edges
            })
            );

        panorama.observe(scene, panorama.DELETE, null)
            .subscribe(s => {
                let id = s.vertex.id;
                this.add(() => panorama.loadScene(model.getVertex(id))
                    .subscribe()
                )
            });

        model.observe(temporalGroup, model.DELETE, null)
            .subscribe(g => {
                let json = g.toJSON({ ignoreSubGroups: true });
                json.directory = g.directory;
                this.add(
                    () => model.createTemporalGroup(json)
                )
            });

        model.observe(spatialGroup, model.DELETE, null)
            .subscribe(g => {
                let json = g.toJSON({ ignoreVertices: true });
                json.directory = g.directory;
                json.images = (json.images || {});
                json.images.directory = g.images.directory;
                json.thumbnails = (json.thumbnails || {});
                json.thumbnails.directory = g.thumbnails.directory;
                this.add(
                    () => model.createSpatialGroup(json)
                )
            });

        model.observe(vertex, model.DELETE, null)
            .subscribe(v => {
                let json = v.toJSON({ ignoreEdges: true });
                json.file = v.image.file;
                this.add(
                    () => model.createVertex(json)
                )
            });

        model.observe(edge, model.DELETE, null)
            .subscribe(e => {
                let json = e.toJSON();
                this.add(
                    () => model.createEdge(json)
                )
            });

        model.beforeUpdate(vertex, vertex.prototype.COORDINATES)
            .subscribe(v => {
                let coordinates = v.coordinates;
                let id = v.id;
                this.add(
                    () => model.updateCoordinates(model.getVertex(id), coordinates)
                )
            });

        model.beforeUpdate(vertex, vertex.prototype.DATA)
            .subscribe(v => {
                let data = Object.assign({}, v.data);
                let id = v.id;
                this.add(
                    () => model.updateData(model.getVertex(id), data, true)
                )
            });

        model.beforeUpdate(edge, edge.prototype.DATA)
            .subscribe(e => {
                let data = Object.assign({}, e.data);
                let id = e.id;
                this.add(
                    () => model.updateData(model.getEdge(id), data, true)
                )
            });

        model.beforeUpdate(spatialGroup, spatialGroup.prototype.BACKGROUND)
            .subscribe(sg => {
                let label = sg.background ? sg.background.label : null;
                let id = sg.id;
                this.add(
                    () => model.updateBackground(model.getSpatialGroup(id), label ? map.getBackground(label) : null)
                )
            });

        map.observe(background, map.CREATE, null)
            .subscribe(b => {
                let label = b.label;
                this.add(
                    () => map.deleteBackground(map.getBackground(label))
                );
            });

        map.observe(background, map.DELETE, null)
            .subscribe(b => {
                let json = b.toJSON();
                json.image.directory = b.image.directory;
                this.add(
                    () => map.createBackground(json)
                );
            });

        map.beforeUpdate(background, background.prototype.CORNERS)
            .subscribe(b => {
                let label = b.label;
                let corners = $.extend(true, [], b.corners);
                this.add(
                    () => map.updateCorners(map.getBackground(label), corners)
                )
            });

        map.afterUpdate(background, background.prototype.OPACITY)
            .subscribe(b => {
                let label = b.label;
                let opacity = b.opacity;
                this.add(
                    () => map.updateCorners(map.getBackground(label), opacity)
                )
            });

        filesys.observe(vertex, filesystem.prototype.LINK, null)
            .subscribe(v => this.add(
                () => filesys.unlink(v)
            ));

        filesys.observe(vertex, filesystem.prototype.UNLINK, null)
            .subscribe(v => {
                let file = v.image.file;
                this.add(
                    () => filesys.link(v, file)
                );
            });

        Rx.Observable.fromEvent(document.querySelector('#import-tour'), 'click')
            .subscribe(() => this.commit());
    }
}

commandHistory.prototype.MODES = {};
commandHistory.prototype.MODES.NORMAL = "normal";
commandHistory.prototype.MODES.OFF = "off";
commandHistory.prototype.MODES.UNDOING = "undoing";
commandHistory.prototype.MODES.REDOING = "redoing";
commandHistory.prototype.ERROR.OPERATION_IN_PROGRESS = "other operation in progress";
commandHistory.prototype.ERROR.EMPTY_STACK = "no commands on the stack";