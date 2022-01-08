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

        this.vtempConfigurator = ko.mapping.fromJS({

            update: false,
            create: false,
            colocated: false,
            deleteOriginal: false,

            settings: {
                types: [],
                coordinates: false,
                path: false,
                file: false, // never copy file handle
                outgoingEdges: {
                    types: [],
                    data: {
                        pitch: false,
                        yaw: false
                    }
                },
                data: {
                    northOffset: false,
                    vOffset: false,
                    vaov: false,
                    type: false,
                }
            }
        });

        this.vtempConfigurator.vtypes = [vertex.prototype.PANORAMA, vertex.prototype.LANDMARK, vertex.prototype.PLACEHOLDER];
        this.vtempConfigurator.etypes = [edge.prototype.ROUTE, edge.prototype.SPATIAL, edge.prototype.LANDMARK];


        var subscribeRecursive = (obj, subscription) => {
            for (var attr in obj) {
                if (obj[attr].subscribe)
                    obj[attr].subscribe(subscription);
                else if (typeof obj[attr] === 'object')
                    subscribeRecursive(obj[attr], subscription);

            }
        };

        subscribeRecursive(this.vtempConfigurator, () => {
            localStorage.setItem("vtempConfigurator", ko.mapping.toJSON(this.vtempConfigurator));
        });

        this.localOptions = {
            hideMap: false,
            fullscreen: false,
            aggregateItems: true,
            persistLandmarks: false,
            copySceneAttributes: false,
            createVertexOnMapClick: true,
            autoDisplayPanorama: true,
            autoSave: true,
            autoSaveInterval: 5,
            autoSaveSelectedItems: true,
            autoSaveStartupView: false,
            showGroupOnEditorSelection: true,
            loadRecentWorkspace: false,
            trackChanges: false,
            enableBatchCopying: false,
            multiresPanoramaImport: false,
            enableOrientation: true,
            enableGPS: false,
            requiredGPSAccuracy: 10,
            currentGPSAccuracy: 0,
            recentWorkspace: null,
            autoRotateSpeed: -5,
            autoRotateInactivityEnabled: true,
            autoRotateInactivityDelay: 10,
            cycleTimepointsBindToAutoRotate: true,
            cycleTimepointsFadeDuration: 8,
            cycleTimepointsDelay: 10
        }

        ko.mapping.fromJS(this.localOptions, {}, this);

        if (localStorage.getItem("settings") || localStorage.getItem("vtempConfigurator")) {
            ko.mapping.fromJSON(localStorage.getItem("settings"), {}, this);
            ko.mapping.fromJSON(localStorage.getItem("vtempConfigurator"), {}, this.vtempConfigurator);
        }
        else
            ko.mapping.fromJS(config, {}, this);

        this.fullscreen(false);

        for (var attr in this.localOptions) {
            this[attr].subscribe(() => {
                localStorage.setItem("settings", JSON.stringify(this.getLocalOptions()));
            })
        }

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

    getLocalOptions() {
        var settings = {};
        for (var attr in this.localOptions) {
            settings[attr] = this[attr]();
        }
        return settings;
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