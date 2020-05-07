if (window.require)
    window.electron = require('electron');
delete window.export;
delete window.module;

platform.isBrowser = !window._cordovaNative && !window.electron;
platform.isCordova = !!window._cordovaNative;
platform.isElectron = !window.electron;
platform.isMobile = navigator.userAgent.toLowerCase().indexOf('mobi') >= 0;
platform.hasOrientationSensor = window.DeviceOrientationEvent && (location.protocol == 'https:' || navigator.userAgent.toLowerCase().indexOf('android') &&
    navigator.userAgent.toLowerCase().indexOf('mobi') >= 0) //from pannellum.js
platform.hasGPSSensor = !!navigator.geolocation;