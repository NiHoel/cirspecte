// JavaScript source code
self.addEventListener('message', (e) => {
    var fileReader = new FileReader();
    fileReader.readAsDataURL(e.data);

    fileReader.onload = function (event) {
        self.postMessage(event.target.result || event.currentTarget.result);
    };
    fileReader.onerror = function (err) {
        self.postMessage(err);
    };
}, false);