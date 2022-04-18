# Cirspecte
Circumspectus in tempore - A panorama through time.

[![Demo](screenshot.jpg?raw=true "Screenshot")](https://nihoel.github.io/cirspecte/index.html?tour=https%3A%2F%2Fnihoel.github.io%2Fcirspecte-demo%2Ftour.json)
[Demo](https://nihoel.github.io/cirspecte/index.html?tour=https%3A%2F%2Fnihoel.github.io%2Fcirspecte-demo%2Ftour.json)

[Demo with HDR panoramas](https://nihoel.github.io/cirspecte/index.html?tour=https%3A%2F%2Fnihoel.github.io%2Fcirspecte-hdr-demo%2Ftour.json) (requires 2 MB/s of download speed and an up-to-date browser - preferably  Chrome)

https://github.com/NiHoel/cirspecte

Pre-built binaries of the editor software can be found here: [https://github.com/NiHoel/cirspecte-cordova/releases/latest](https://github.com/NiHoel/cirspecte-cordova/releases/latest)

## About
Cirspecte is a browser based, free, and open source tool for creating and viewing panorama tours. Built using HTML5, CSS3, JavaScript, and WebGL, it is plug-in free.

## Features
* Browser-based, offline application
* Display 360° spherical or cubemap panoramas (cropped panoramas are supported too)
* Small storage footprint for panoramas (just a single image file required)
* Viewing tours from the local filesystem
* Application runs on mobile devices (with some limitations)
* Navigate tour in space and time
* Editor for compositing custom tours
* Support for precise panorama placement and orientation

## Not supported
* Displaying single panoramas (not the focus of this software)
* Fancy features added to a panorama

## How to use
* Use external programs to stitch panorams, see (https://havecamerawilltravel.com/photographer/panorama-stitching-best-apps/) for an overview
* Open edit.html with Firefox or Chrome 
* Configure the browser to ask for the download location (https://www.lifewire.com/change-the-file-download-location-4046428)
* Follow the instructions in the help dialog (accessible via the '?' button on the top left of the website)


## Browser Compatibility
Since Cirspecte is built with recent web standards, it requires a modern browser to function.

#### Full support (with appropriate graphics drivers):
* Firefox 50+
* Chrome 30+
* Edge 14+
* Opera 64+

#### No support:
* Internet Explorer
* Safari

## License
Cirspecte is distributed under the Apache License 2.0. For more information, read the file `LICENSE` or peruse the license [online](https://github.com/nihoel/cirspecte/blob/master/LICENSE).
Some library files are distributed under different licenses (see the files in assets/lib)

## Development
To update the modified vis timeline:
1. Follow the build instructions from: https://github.com/visjs/vis-timeline
2. Apply the patch vis-timeline-add-toggleGroupShowNested.patch
3. Build the library and copy the non-minified .css to assets/css and the minified .js and .map to assets/js/lib

## Credits
Nico Höllerich

