'use strict';

/**
 * Summary: 
 * Keep track of all settings (map, timeline, panorama, template)
 * 
 * Usage:
 * Use getters and setters to pass and receive plain javascript objects 
 * with the current settings, the settings to be applied respectively.
 * */
class configurator {
    get [Symbol.toStringTag]() {
        return 'Configurator';
    }

    constructor(config = {}) {

        this.vtempConfigurator = {
            vtypes: [vertex.prototype.PANORAMA, vertex.prototype.LANDMARK, vertex.prototype.PLACEHOLDER],
            etypes: [edge.prototype.ROUTE, edge.prototype.SPATIAL, edge.prototype.LANDMARK],

            update: ko.observable(false),
            create: ko.observable(false),
            colocated: ko.observable(),
            deleteOriginal: ko.observable(false),

            settings: {
                types: ko.observableArray([]),
                coordinates: ko.observable(false),
                path: ko.observable(false),
                file: ko.observable(false), // never copy file handle
                outgoingEdges: {
                    types: ko.observableArray([]),
                    data: {
                        pitch: ko.observable(false),
                        yaw: ko.observable(false)
                    }
                },
                data: {
                    northOffset: ko.observable(false),
                    vOffset: ko.observable(false),
                    vaov: ko.observable(false),
                    type: ko.observable(false),
                }
            }
        }

        this.hideMap = ko.observable(false);
        this.fullscreen = ko.observable(false);
        this.aggregateItems = ko.observable(false);
        this.persistLandmarks = ko.observable(false);
        this.copySceneAttributes = ko.observable(false);
        this.createVertexOnMapClick = ko.observable(false);
        this.autoDisplayPanorama = ko.observable(false);
        this.autoSaveSelectedItems = ko.observable(false);
        this.showGroupOnEditorSelection = ko.observable(false);

        ko.mapping.fromJS(config, {}, this);

        this.timeline = ko.mapping.fromJS({
            max: undefined,
            min: undefined,
            end: undefined,
            start: undefined,
            selections: undefined
        });
        this.setTimelineOptions(config.timeline);

        this.map = ko.mapping.fromJS({
            center: undefined,
            zoom: undefined,
            minZoom: undefined,
            maxZoom: undefined, // null would be interpreted as 0
            maxBounds: undefined
        });
        this.setMapOptions((config.map || {}).options);

        this.panorama = ko.mapping.fromJS({
            scene: undefined,
            yaw: undefined,
            pitch: undefined,
            hfov: undefined
        });
        this.setPanoramaOptions(config.panorama);

        if ($('#vertex-template-settings-dialog').length > 0)
            ko.applyBindings(this.vtempConfigurator, $('#vertex-template-settings-dialog')[0]);
        ko.applyBindings(this, $('#settings-dialog')[0]);
        if ($('.js-select').length > 0)
            $('.js-select').select2({
                dropdownAutoWidth: true
            });
    }

    getTemplateMask() {
        return ko.mapping.toJS(this.vtempConfigurator.settings);
    }

    getTemplateOptions() {
        return {
            update: this.vtempConfigurator.update(),
            create: this.vtempConfigurator.create(),
            colocated: this.vtempConfigurator.colocated(),
            deleteOriginal: this.vtempConfigurator.deleteOriginal()
        }
    }

    getMapOptions() {
        return ko.mapping.toJS(this.map);
    }

    getTimelineOptions() {
        return ko.mapping.toJS(this.timeline);
    }

    getPanoramaOptions() {
        return ko.mapping.toJS(this.panorama);
    }

    setMapOptions(options = {}) {
        ko.mapping.fromJS(options, {}, this.map);
    }

    setTimelineOptions(options = {}) {
        ko.mapping.fromJS(options, {}, this.timeline);
    }

    setPanoramaOptions(options = {}) {
        ko.mapping.fromJS(options, {}, this.panorama);
    }

    setOptions(options = {}) {
        this.setMapOptions(options.map);
        this.setTimelineOptions(options.timeline);
        this.setPanoramaOptions(options.panorama);
    }

    toJSON() {
        return {
            map: this.getMapOptions(),
            timeline: this.getTimelineOptions(),
            panorama: this.getPanoramaOptions()
        }
    }
}