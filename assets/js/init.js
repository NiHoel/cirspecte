function checkES6() {
    "use strict";

    if (typeof Symbol == "undefined") return false;
    try {
        eval("class Foo {}");
        eval("var bar = (x) => x+1");
        eval("var a = async function(){}");
    } catch (e) {
        window.confirm("Your browser does not support ES6. Pleasue update your browser to properly display this page.");
    }

    return true;
}
checkES6();

delete window.export;
delete window.module;

platform.isBrowser = !window._cordovaNative && !window.electron;
platform.isCordova = !!window._cordovaNative;
platform.isElectron = !!window.electron;
platform.isMobile = navigator.userAgent.toLowerCase().indexOf('mobi') >= 0;
platform.hasOrientationSensor = window.DeviceOrientationEvent && (location.protocol == 'https:' || navigator.userAgent.toLowerCase().indexOf('android') &&
    navigator.userAgent.toLowerCase().indexOf('mobi') >= 0) //from pannellum.js
platform.hasGPSSensor = !!navigator.geolocation;

if (window.electron && window.electron.ipcRenderer && window.electron.ipcRenderer.on)
    window.electron.ipcRenderer.on("main-proc-error", console.error);