'use strict';

/**
 * Updates the navigation elements that let the user 
 * switch to the panorama that was shot before or after the current one.
 * 
 * Listen to events: this.observe(edge, this.CLICK).subscribe(elem => / do something here /)
 * this.observe(vertex, this.LOCATIONUPDATE).subscribe(elem => / do something here /)
 * or: this.observe(this.VALUE, this.HEIGHTUPDATE).subscribe(elem => / do something here /)
 * */
class navigationViewer extends observable {
    get [Symbol.toStringTag]() {
        return 'Navigation Header';
    }

    /**
     *
     * @param {configurator} settings
     * @param {graph} modules.model
     * @param {algorithms} modules.alg
     */
    constructor(modules) {
        super();
        this.modules = modules;
        this.height = $('#navigation-header').height();
        this.visibleSpatialGroups = new Set();

        var complete = () => {
            delete this.subscription;
            this.modules.settings.enableGPS(false);
            this.modules.settings.currentGPSAccuracy(0);
        };

        var subscribeGPS = () => this.getGeolocationObservable()
            .filter(pos => {
                this.modules.settings.currentGPSAccuracy(pos.coords.accuracy);

                if (pos.coords.accuracy > this.modules.settings.requiredGPSAccuracy())
                    return false;

                var v = this.modules.panorama.getVertex()
                if (v && algorithms.getDistance(v, [pos.coords.latitude, pos.coords.longitude]) < pos.coords.accuracy)
                    return false;
                return true;
            })
            .sampleTime(5000)
            .subscribe(pos => this.updateClosestVertex(pos),
                err => {
                    this.modules.logger.log(err);
                    complete();
                },
                complete);

        if (this.modules.settings.enableGPS())
            this.subscription = subscribeGPS();

        this.modules.settings.enableGPS.subscribe(enabled => {
            if (enabled)
                this.subscription = subscribeGPS();
            else if (this.subscription) {
                this.subscription.unsubscribe();
                complete();
            }
        });

        this.isCycleTimepoints = ko.observable(false);

        this.cycleTimepointsSubscription = ko.computed(() => {
            if (this.modules.settings.cycleTimepointsBindToAutoRotate())
                if (this.modules.panorama.isAutoRotating())
                    this.startCycleTimepoints();
                else
                    this.stopCycleTimepoints();
        });

        var startButton = $('#start-cycle-timepoints-button')[0];
        var stopButton = $('#stop-cycle-timepoints-button')[0];

        if (startButton)
            startButton.onclick = () => this.startCycleTimepoints();

        if (stopButton) {
            stopButton.style.display = 'none';
            stopButton.onclick = () => this.stopCycleTimepoints();
        }

        this.isCycleTimepoints.subscribe(enabled => {
            if (startButton)
                startButton.style.display = enabled ? 'none' : 'inherit';

            if (stopButton)
                stopButton.style.display = enabled ? 'inherit' : 'none';
        });
    }



    /**
     * If the height of the HTML element changed, emit.
     * 
     * @private
     * */
    heightChangeCheck() {
        var height = $('#navigation-header').height();
        if (this.height != height) {
            this.height = height;
            this.emit(height, this.HEIGHTUPDATE, this.VALUE);
            return true;
        }
        return false;
    }

    /**
     * @private
     * @param {edge} e
     */
    setPredecessor(e) {
        this.predecessor = e;

        if (e != null) {
            $('#navigation-header .left .text').text(e.to.spatialGroup.name);
            $('#navigation-header .left')[0].onclick = () => this.emit(e, this.CLICK);
            $('#navigation-header .left').contents().show();
        } else {
            $('#navigation-header .left').contents().hide();
        }

        this.heightChangeCheck();
    }

    /**
 * @private
 * @param {edge} e
 */
    setSuccessor(e) {
        this.successor = e;

        if (e != null) {
            $('#navigation-header .right .text').text(e.to.spatialGroup.name);
            $('#navigation-header .right')[0].onclick = () => this.emit(e, this.CLICK);
            $('#navigation-header .right').contents().show();
        } else {
            $('#navigation-header .right').contents().hide();
        }

        this.heightChangeCheck();
    }

    /**
     * Display title for current panorama.
     * 
     * @param {string} title
     */
    setTitle(title) {
        if (typeof title === 'string' && title.trim() !== "") {
            $('#navigation-header .center .text').text(title);
            $('#navigation-header .center').contents().show();
        } else {
            $('#navigation-header .center').contents().hide();
        }

        this.heightChangeCheck();
    }

    /**
     * The vertex for the current panorama. Updates navigation elements.
     * 
     * @param {vertex} v
     */
    setVertex(v) {
        this.currentVertex = v;

        if (v == null) {
            this.setPredecessor(null);
            this.setSuccessor(null);
            this.setTitle(null)
            return;
        }

        var edges = [];
        if (v.spatialGroup && v.spatialGroup.superGroup && v.spatialGroup.superGroup.autoConnectColocated)
            edges = this.modules.alg.connectColocated(v);
        else
            v.forEach(e => { if (e.type === edge.prototype.TEMPORAL) edges.push(e); });

        var predecessor, successor;
        let centerTime = v.getTimeslot();
        this.setPredecessor(null);
        this.setSuccessor(null);
        for (let e of edges) {
            if (e.to.getTimeslot() < centerTime) {
                if (predecessor == null || predecessor.to.getTimeslot() < e.to.getTimeslot())
                    predecessor = e;
            }

            if (e.to.getTimeslot() > centerTime) {
                if (successor == null || successor.to.getTimeslot() > e.to.getTimeslot())
                    successor = e;
            }
        }

        var title = v.spatialGroup.superGroup.name;
        title += ": " + v.spatialGroup.name;
        if (v.name)
            title += " - " + v.name;

        this.setTitle(title);
        this.setPredecessor(predecessor);
        this.setSuccessor(successor);
    }

    /**
     * Call when a new vertex was created.
     * Updates predecessor or successor if necessary.
     * 
     * @param {vertex} v
     */
    notifyVertexCreated(v) {
        if (!this.currentVertex
            || !v.spatialGroup.superGroup.autoConnectColocated
            || algorithms.getDistance(this.currentVertex, v) > this.currentVertex.spatialGroup.superGroup.colocatedRadius)
            return;

        if (v.spatialGroup.superGroup !== this.currentVertex.spatialGroup.superGroup
            && v.spatialGroup.superGroup.type !== spatialGroup.prototype.SINGLESHOT
            && this.currentVertex.spatialGroup.superGroup.type !== spatialGroup.prototype.SINGLESHOT)
            return;

        let centerTime = this.currentVertex.getTimeslot();

        if (v.getTimeslot() < centerTime) {
            if (this.predecessor == null || this.predecessor.to.getTimeslot() < v.getTimeslot()) {
                var e = this.modules.model.createEdge({ from: this.currentVertex, to: v, type: edge.prototype.TEMPORAL, bidirectional: true });
                this.setPredecessor(e);
            }
        }



        if (v.getTimeslot() > centerTime) {
            if (this.successor == null || this.successor.to.getTimeslot() > v.getTimeslot()) {
                var e = this.modules.model.createEdge({ from: this.currentVertex, to: v, type: edge.prototype.TEMPORAL, bidirectional: true });
                this.setSuccessor(e);
            }

        }
    }

    /**
     * Call when a edge was deleted.
     * 
     * @param {edge} e
     */
    notifyEdgeDeleted(e) {
        if (this.predecessor === e || e.opposite && e.opposite === this.predecessor)
            this.setVertex(this.currentVertex);

        if (this.successor === e || e.opposite && e.opposite === this.successor)
            this.setVertex(this.currentVertex);
    }

    notifySpatialGroupShown(sg) {
        this.visibleSpatialGroups.add(sg);
    }

    notifySpatialGroupHidden(sg) {
        this.visibleSpatialGroups.delete(sg);
    }


    getGeolocationObservable() {
        return Rx.Observable.create((obs) => {
            var locationWatchId =
                navigator.geolocation.watchPosition(pos => obs.next(pos),
                    err => {
                        if (err.code === 1)
                            obs.error(new error(this.ERROR.PERMISSION_DENIED, "", err));
                        else if (err.code === 2)
                            obs.error(new error(this.ERROR.NO_POSTION, "", err));
                        else
                            obs.error(err);
                    }, {
                    enableHighAccuracy: true
                });

            return () => {
                navigator.geolocation.clearWatch(locationWatchId);
            }
        });
    }

    notifySceneLoaded(s) {
        if (this.isCycleTimepoints() && s.vertex == this.currentVertex) {
            if (this.cycleTimepointsDelayTimeout)
                clearTimeout(this.cycleTimepointsDelayTimeout);

            this.cycleTimepointsDelayTimeout = setTimeout(this.startCycleTimepoints.bind(this),
                this.modules.settings.cycleTimepointsDelay() * 1000);
        }
    }

    /**
     * 
     * @param { GeolocationPosition} pos
     */
    updateClosestVertex(pos) {
        var closest;
        var distance = Infinity;
        var current = this.modules.panorama.getVertex();
        var coords = [pos.coords.latitude, pos.coords.longitude];
        var distCurrent = current ? algorithms.getDistance(current, coords) : null;

        for (var sg of this.visibleSpatialGroups.values())
            sg.forEach(v => {
                if (v.type !== vertex.prototype.PANORAMA || v === current)
                    return;

                var dist = algorithms.getDistance(v, coords);

                if (dist > distance || dist > (sg.superGroup.getColocatedRadius() || this.modules.settings.requiredGPSAccuracy()))
                    return;

                // avoid permantent swichting in the middle between two vertices
                if (distCurrent != null && distCurrent < 2 * dist)
                    return;

                closest = v;
                distance = dist;
            });

        if (closest)
            this.emit(closest, this.LOCATIONUPDATE);
    }

    stopCycleTimepoints() {
        this.isCycleTimepoints(false);

        clearTimeout(this.cycleTimepointsDelayTimeout);
        delete this.cycleTimepointsDelayTimeout;
    }

    startCycleTimepoints() {
        if (!this.currentVertex && !this.predecessor && !this.successor) {
            this.stopCycleTimepoints();
            return;
        }

        clearTimeout(this.cycleTimepointsDelayTimeout);
        delete this.cycleTimepointsDelayTimeout;

        this.isCycleTimepoints(true);

        var nextV;
        if (this.successor) {
            nextV = this.successor.to;

        } else if (this.predecessor) {
            nextV = this.currentVertex;
            this.currentVertex.forEach(e => {
                if (e.type === edge.prototype.TEMPORAL && e.to.getTimeslot() < nextV.getTimeslot())
                    nextV = e.to;
            });
        }

        if (nextV) {
            this.modules.panorama
                .loadScene(nextV,
                    { sceneFadeDuration: this.modules.settings.cycleTimepointsFadeDuration() * 1000 })
                .catch((err) => {
                    console.log(err);
                    this.modules.logger.log(err);
                }).subscribe();
        }
    }
}

navigationViewer.prototype.CLICK = "click";
navigationViewer.prototype.HEIGHTUPDATE = 'update height';
navigationViewer.prototype.VALUE = 'value';
navigationViewer.prototype.LOCATIONUPDATE = 'update location';
navigationViewer.prototype.ERROR.PERMISSION_DENIED = 'permission denied';
navigationViewer.prototype.ERROR.NO_POSTION = 'position unavailable';