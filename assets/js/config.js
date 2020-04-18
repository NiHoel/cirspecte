'use strict';

var config = {
    "map": {
        "strings": {
            location: "GPS",
            connections: "Connections",
            savedAllTiles: "Saved all tiles",
            removedAllTiles: "Removed all tiles",
            backgrounds: "Backgrounds"
        },
        "options": {
            minimapControl: true,
            center: [0,0], 
            zoom: 2, // specify a custom center and zoom level to be displayed by the map when opening the site
            zoomControl: false
        },
        "tileLayers": [
            {
                label: "OpenStreetMap", // can be freely chosen, displayed to the user in the layers dropdown
                url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                options: {
                    maxZoom: 19,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                    subdomains: ['a', 'b', 'c']
                },
                base: "tileLayer",
                plugin: "offline" //allows the user to download the tiles, uncomment to disable, check for other tile serves whether it complies to the terms of use to store tiles locally
            },
            /*
            {
                label: "Satellite (Mapbox)",
                url: 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw',
                options: {
                    accessToken: "", // obtain access tocken from https://docs.mapbox.com/help/how-mapbox-works/access-tokens/
                    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="http://mapbox.com">Mapbox</a>',
                    maxZoom: 20,
                    id: 'mapbox.satellite', // valid values are 'mapbox.satellite', 'mapbox.streets-satellite', and 'mapbox.streets'
                    crossOrigin: true
                },
                base: "tileLayer",
            },
            */
            /*
            {
                url: "", // obtain API-Key from https://www.microsoft.com/en-us/maps/create-a-bing-maps-key and enter it here, do not get confused with the url parameter name, it is just the key
                label: "Satellite (Bing)",
                options: {
                    type: 'Aerial' // valid values are 'Aerial', 'AerialWithLabels', and 'Road'
                },
                base: "bingLayer"
            },
            */
			/**
			{
                label: "Satellite (Google Mutant)",
                options: {
                    type: 'satellite' // valid values are 'roadmap', 'satellite', 'terrain' and 'hybrid'
                },
                base: "gridLayer",
                plugin: "googleMutant"
            },
			**/
        ],
        control: {
            autoZIndex: true,
            hideSingleBase: true,
            sortLayers: false
        },
        tree: {
            collapsed: true,
            namedToggle: true,
            collapseAll: 'Collapse all',
            expandAll: 'Expand all',
        },
        saveTilesControl: {
            'saveWhatYouSee': true,
            'maxZoom': 18,
            'confirm': function (layer, successcallback) {
                if (window.confirm("Save " + layer._tilesforSave.length)) {
                    successcallback();
                }
            },
            'confirmRemoval': function (layer, successCallback) {
                if (window.confirm("Remove all the tiles?")) {
                    successCallback();
                }
            },
            'saveText': '<i class="glyphicon glyphicon-download-alt" aria-hidden="true" title="Save tiles"></i>',
            'rmText': '<i class="glyphicon glyphicon-trash" aria-hidden="true"  title="Remove tiles"></i>'
        },
        "findAccuratePosition": {
            maxWait: 60000, // defaults to 10000
            desiredAccuracy: 3 // defaults to 20
        },
        mobileRadius: 8,
        "point": {
            "panorama": {
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.5,
                radius: 4
            },
            "placeholder": {
                color: 'pink',
                fillColor: 'pink',
                fillOpacity: 0.5,
                radius: 3
            },
            "edit": {
                color: 'blue',
                fillColor: '#3030f0',
                fillOpacity: 0.5,
                radius: 2,
                draggable: true
            },
            "landmark": {
                color: 'green',
                fillColor: '#303f030',
                fillOpacity: 0.5,
                radius: 2,
                draggable: true
            },
            "location": {
                color: 'white',
                fillOpacity: 0,
                radius: 1
            }
        },
        "line": {
            "route": {
                color: 'black',
                fillColor: 'black',
                fillOpacity: 0.5,
                radius: 1
            },
            "placeholder": {
                color: 'grey',
                fillColor: 'grey',
                fillOpacity: 0.5,
                radius: 1
            },
            "spatial": {
                color: 'black',
                fillColor: 'black',
                fillOpacity: 0.5,
                radius: 1
            },
            "temp": {
                color: 'blue',
                fillColor: '#3030f0',
                fillOpacity: 0.5,
                radius: 1
            },
            "edit": {
                color: 'blue',
                fillColor: '#3030f0',
                fillOpacity: 0.5,
                radius: 1
            },
            "landmark": {
                color: 'green',
                fillColor: '#303f030',
                fillOpacity: 0.5,
                radius: 1
            },
        },
        "background": {
            "image": {
                opacity: 0.5
            },
            "marker": {
                color: 'blue',
                fillColor: '#3030f0',
                fillOpacity: 0.5,
                radius: 2,
                draggable: true
            }
        }
    },
    "timeline": {
        //       height: '150px',
        type: 'point',
        showMajorLabels: false,
        end: moment(),
        start: moment().subtract(1, "y"),
        zoomMin: 1728000000,//in milliseconds
        format: {
            minorLabels: {
                year: 'YYYY',
                month: 'MMM YY',
                day: 'D.M.YY'
            }
        },
        selectable: true,
        multiselect: true,
        editable: {
            add: false,         // add new items by double tapping
            updateTime: false,  // drag items horizontally
            updateGroup: false, // drag items from one group to another
            remove: false,       // delete an item by tapping the delete button top right
            overrideItems: false  // allow these options to override item.editable
        }

    },
    panorama: {
        default: {
            "sceneFadeDuration": 1000,
            "orientationOnByDefault": true,
            "mouseZoom": true,
            "showControls": true,
            "draggable": true,
 //           "author": "", // displayed on all panoramas without a dedicate author parameter
            "compass": false
        },
        previewOptions: {
            "sceneFadeDuration": 0,
            "orientationOnByDefault": false,
            "mouseZoom": true,
            "showControls": false,
            "draggable": false
        },
        maxZoomFactor: 4,
        navigationHotspotPitch: -15,
        tileResolution: 1024
    },
    settings: {
        vtempConfigurator : {
            update: true,
            create: true,
            colocated: false,
            deleteOriginal: false,

            settings: {
                types: ko.observableArray(["panorama", "placeholder", "landmark"]),
                coordinates: true,
                path: true,
                outgoingEdges: {
                    types: ko.observableArray(["route", "landmark", "spatial"]),
                    data: {
                        pitch: true,
                        yaw: true,
                    }
                },
                data: {
                    northOffset: true,
                    vOffset: true,
                    vaov: true,
                    type: true,
                }
            }
        },

        aggregateItems: true,
        persistLandmarks : false,
        copySceneAttributes : false,
        createVertexOnMapClick : false,
        autoDisplayPanorama : true,
        autoSaveSelectedItems : true,
        showGroupOnEditorSelection : true
    },
    tour: {
        /*
                temporalGroups: [
                    { id: "landmark", name: "Landmark", type: "landmark", multiselect: true }
                ]
                */
    }
}