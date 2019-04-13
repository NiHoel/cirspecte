/**
 * Updates the navigation elements that let the user 
 * switch to the panorama that was shot before or after the current one.
 * 
 * Listen to events: this.observe(edge, this.CLICK).subscribe(elem => / do something here /)
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
            || v.spatialGroup.superGroup !== this.currentVertex.spatialGroup.superGroup
            || !v.spatialGroup.superGroup.autoConnectColocated
            || algorithms.getDistance(this.currentVertex, v) > this.currentVertex.spatialGroup.superGroup.colocatedRadius)
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
}

navigationViewer.prototype.CLICK = "click";
navigationViewer.prototype.HEIGHTUPDATE = 'update height';
navigationViewer.prototype.VALUE = 'value';