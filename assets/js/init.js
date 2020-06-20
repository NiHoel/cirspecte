function checkES6() {
    "use strict";

    try {
        if (typeof Symbol == "undefined")
            throw "";
        eval("class Foo {}");
        eval("var bar = (x) => x+1");
        eval("var a = async function(){}");
        eval("let a = 5");
    } catch (e) {
        window.confirm("Your browser does not support ES6. Pleasue update your browser to properly display this page.");
    }

}
checkES6();

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