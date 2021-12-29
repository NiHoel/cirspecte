'use strict';

/*
* Classes: directory, file, diskAccessor, fileTree, webkitAccessor, filesystem
*
* Usage:
* Call filesystem.request(...) to get a specific file or folder 
* Call filesystem.prepare*(...) on an instance of filesystem to gain access to the files or folders referenced by some model element
* Call file.readAs*() to get the content
* Call directory.scan() to get the contents
*/

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: directory
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class directory extends observable {
    get [Symbol.toStringTag]() {
        return 'Directory';
    }

    /**
     * @param {string} [name]
     * @param {FileSystemDirectoryEntry | DirectoryEntry}  [directoryHandle]
     */
    constructor(path) {
        super();

        path = path.replace(/\\/g, '/');

        this.path = path;
        if (path.endsWith('/'))
            this.name = path.split('/').splice(-2, 1)[0];
        else
            this.name = path.split('/').pop();
    }

    equals(otherDirectory) {
        if (!(otherDirectory instanceof directory))
            return false;

        return this.getPath() === otherDirectory.getPath();
    }

    canScan() {
        return false;
    }

    canWrite() {
        return false;
    }

    canTrackChanges() {
        return false;
    }

    /**
    * @returns {string}
    */
    getPath(rootDirectory = null) {
        if (!rootDirectory)
            return this.path;
        return directory.toRelativePath(rootDirectory.getPath(), this.path);
    }

    /**
     * 
     * 
     * @param {directory} dir
     * @returns {boolean} dir is ancestor of this
     */
    isAncestor(dir) {
        var thisPath = this.getPath();
        if (thisPath.endsWith('/'))
            thisPath = thisPath.slice(0, -1);

        var dirPath = dir.getPath();
        if (dirPath.endsWith('/'))
            dirPath = dirPath.slice(0, -1);

        return thisPath.startsWith(dirPath);
    }

    /**
 * 
 * @param {any} dir
 * @returns {boolean}
 */
    isDirectoryEntry(dir) {
        return dir[Symbol.toStringTag] === 'DirectoryEntry' || dir[Symbol.toStringTag] === 'FileSystemDirectoryEntry';
    }

    /**
     * 
     * @param {any} reader
     * @returns {boolean}
     */
    isDirectoryReader(reader) {
        if (typeof FileSystemDirectoryReader !== 'undefined')
            return reader instanceof FileSystemDirectoryReader;
        else if (typeof WebKitDirectoryReader !== 'undefined')
            return reader instanceof WebKitDirectoryReader;
        else
            return reader[Symbol.toStringTag] === 'DirectoryReader' || reader[Symbol.toStringTag] === 'FileSystemDirectoryReader' || !!reader.readEntries;

    }

    /**
* 
* @param {string} path
* @returns {Rx.Observablefile>}
*/
    searchFile(path) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot search", this.getPath()));
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<directory>}
*/
    searchDirectory(path) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot search", this.getPath()));
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<file|directory>}
*/
    searchEntry(path) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot search", this.getPath()));
    }


    /**
    *
    * @param {boolean} options.enforce - scan again
    * @param {boolean} options.onlyNewFiles
    * @param {boolean} options.onlyUnusedFiles
    *@returns {Rx.Observable<file | directory>}
    */
    scan(options = {}) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot scan", this.getPath()));


    }

    /**
 * 
 * @returns {Rx.Observable<directory|file>}
 */
    trackChanges() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot track changes", this.getPath()));
    }

    /**
    * @param {file|string} path
    * @param {string|Image|file}
    * @returns {Rx.Observable<file>}
    */
    write(path, content) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot write", this.getPath()));
    }

    /**
     * 
     * @param {string} path
     * @returns {Rx.Observable<directory>}
     */
    createDirectory(path) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot create", this.getPath()));
    }

    /**
 * 
 * Removes this directory and all its contents
 * @returns {Rx.Observable<>}
 */
    delete() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot delete", this.getPath()));
    }

    /**
     * @returns {JSON}
     * */
    toNode() {
        if (!this.node)
            this.node = {
                id: this.getPath(),
                text: this.name,
                children: true,
                icon: "jstree-folder",
                state: {
                    opened: false
                }
            };
        return this.node;
    }

    /**
     * @param {string} basePath
     * @param {string} path
     * @returns {path} common path of basePath and path removed from path
     */
    static toRelativePath(basePath, path) {
        if (!path)
            throw new error(directory.prototype.ERROR.INVALID_PATH, "", path);

        if (!basePath)
            return path;

        var basePathComponents = basePath.split('/');

        var pathComponents = path.split('/');

        while (basePathComponents.length && pathComponents.length && pathComponents[0] === basePathComponents[0]) {
            basePathComponents.shift();
            pathComponents.shift();
        }

        return pathComponents.join('/');
    }

    static isAbsolutePath(path) {
        return directory.prototype.ABSOLUTE_URL_TESTER.test(path);
    }

    static isRemotePath(path) {
        return directory.prototype.REMOTE_PATH_TESTER.test(path);
    }
}

directory.prototype.ABSOLUTE_URL_TESTER = new RegExp('^\\s*(?:(?:[a-z0-9]+:)?//+)|(?:[a-z0-9]+:/)', 'i');
directory.prototype.REMOTE_PATH_TESTER = new RegExp('^\\s*((https?)|(ftp)):.*', 'i');

directory.prototype.CREATE = "create";

directory.prototype.ERROR.FILE_NOT_FOUND = "file not found";
directory.prototype.ERROR.DIRECTORY_NOT_FOUND = "directory not found";
directory.prototype.ERROR.INVALID_PATH = "invalid path";
directory.prototype.ERROR.NO_DIRECTORY_HANDLE = "no directory handle";
directory.prototype.ERROR.UNSUPPORTED_OPERATION = "operation cannot be performed on this directory";
directory.prototype.ERROR.SECURITY_ERR = "security violation occured when accessing path";
directory.prototype.ERROR.ABORT_ERR = "failed to abort";
directory.prototype.ERROR.NOT_READABLE_ERR = "cannot read file";
directory.prototype.ERROR.ENCODING_ERR = "file has inproper encoding";
directory.prototype.ERROR.NO_MODIFICATION_ALLOWED_ERR = "modification not allowed";
directory.prototype.ERROR.INVALID_STATE_ERR = "invalid state";
directory.prototype.ERROR.SYNTAX_ERR = "syntax error";
directory.prototype.ERROR.INVALID_MODIFICATION_ERR = "invalid modification";
directory.prototype.ERROR.QUOTA_EXCEEDED_ERR = "storage quota exceeded";
directory.prototype.ERROR.TYPE_MISMATCH_ERR = "type mismatch";
directory.prototype.ERROR.PATH_EXISTS_ERR = "path already exists";


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: cordovadirectory
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class cordovadirectory extends directory {
    get [Symbol.toStringTag]() {
        return 'Cordovadirectory';
    }

    /**
     * @param {string} [name]
     * @param {FileSystemDirectoryEntry | DirectoryEntry}  [directoryHandle]
     */
    constructor(path) {
        super(path);
    }

    canScan() {
        return true;
    }

    canWrite() {
        return true;
    }

    canTrackChanges() {
        return true;
    }


    getEntries() {
        return this.entries ? this.entries.values() : [];
    }

    /**
     * @param {DirEntry} handle
     * */
    static handleToEntry(handle, fullPath) {
        if (handle.isFile) {
            return new cordovafile(handle.name, fullPath || handle.nativeURL || handle.fullPath);
        } else {
            return new cordovadirectory(fullPath || handle.nativeURL || handle.fullPath);
        }
    }

    /**
     * 
     * @param {string} path
     * @returns {Rx.Observable<DirectoryEntry|FileEntry>}
     */
    static resolve(path) {
        return Rx.Observable.create(obs => {
            window.resolveLocalFileSystemURL(path,
                (entry) => { obs.next(entry); obs.complete(); },
                (err) => { obs.error(cordovadirectory.toError(err, path)) }
            )
        });
    }

    /**
 * 
 * @param {string} path
 * @returns {Rx.Observable<DirectoryEntry|FileEntry>}
 */
    createPath(path) {
        var obs = cordovadirectory.resolve(this.path);
        var pathComponents = path.split('/');
        if (directory.isAbsolutePath(path)) {
            var protocol = this.ABSOLUTE_URL_TESTER.exec(path)[0];
            pathComponents = path.substr(protocol.length).split('/');

            obs = cordovadirectory.resolve(protocol + pathComponents.shift());
        }

        pathComponents = pathComponents.filter(p => p != null && p != "");
        return obs
            .map(handle => [handle, [...pathComponents]])
            .expand(elem => {
                var handle, pathComponents;
                [handle, pathComponents] = elem;

                if (!pathComponents.length)
                    return Rx.Observable.empty();

                var name = pathComponents.shift();

                if (pathComponents.length || name.indexOf('.') == -1)

                    return Rx.Observable.create(obs => {
                        handle.getDirectory(name, { create: true, exclusive: false },
                            (entry) => { obs.next(entry); obs.complete(); },
                            (err) => { obs.error(cordovadirectory.toError(err, filesystem.concatPaths(this.getPath(), path))) });
                    }).map(handle => [handle, [...pathComponents]]);
                else
                    return Rx.Observable.create(obs => {
                        handle.getFile(name, { create: true, exclusive: false },
                            (entry) => { obs.next(entry); obs.complete(); },
                            (err) => { obs.error(cordovadirectory.toError(err, filesystem.concatPaths(this.getPath(), path))) }
                        );
                    }).map(handle => [handle, [...pathComponents]]);
            })
            .last()
            .map(elem => elem[0]);
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<file>}
*/
    searchFile(path) {
        return this.searchEntry(path)
            .filter(elem => elem instanceof file)
            .defaultIfEmpty(null)
            .do(elem => {
                if (elem == null)
                    throw (new error(directory.prototype.ERROR.FILE_NOT_FOUND, "", path));
            });
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<directory>}
*/
    searchDirectory(path) {
        if (!path.endsWith('/'))
            path += '/';

        return this.searchEntry(path)
            .filter(elem => elem instanceof directory)
            .defaultIfEmpty(null)
            .do(elem => {
                if (elem == null)
                    throw (new error(directory.prototype.ERROR.FILE_NOT_FOUND, "", path));
            });
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<file|directory>}
*/
    searchEntry(path) {
        if (directory.isAbsolutePath(path)) {
            if (!directory.isRemotePath(path)) {
                return cordovadirectory.resolve(path)
                    .map((handle) => cordovadirectory.handleToEntry(handle, path));
            } else {
                return (new remotedirectory("")).searchEntry(path);
            }
        }

        path = filesystem.concatPaths(this.getPath(), path);
        return cordovadirectory.resolve(path)
            .map((handle) => cordovadirectory.handleToEntry(handle, path));

    }


    /**
    *
    * @param {boolean} options.enforce - scan again
    * @param {boolean} options.onlyNewFiles
    * @param {boolean} options.onlyUnusedFiles
    *@returns {Rx.Observable<file | directory>}
    */
    scan(options = {}) {
        if (options.onlyNewFiles && !this.entries)
            return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Call trackChanges() before scanning for new files.", this.getPath()));

        var defaultObservable;
        if (options.onlyNewFiles) {
            defaultObservable = Rx.Observable.empty();
        } else {
            defaultObservable = Rx.Observable.from(this.getEntries());
        }

        if (options.onlyUnusedFiles) {
            defaultObservable = defaultObservable.filter(f => !(f instanceof file) || !f.read || !f.vertex);
        }

        if (this.entries && !options.enforce)
            return defaultObservable;


        // get all entries
        return cordovadirectory.resolve(this.path)
            .map(dirEntry => dirEntry.createReader())
            .expand(reader => {
                if (this.isDirectoryReader(reader))
                    return Rx.Observable.create(observer => {

                        reader.readEntries(entries => {
                            entries.forEach(handle => {
                                var entr = cordovadirectory.handleToEntry(handle, filesystem.concatPaths(this.path, handle.name));
                                var isNew = !this.entries || !this.entries.has(entr.name);

                                if ((!options.onlyNewFiles || isNew || !(entr instanceof file)) &&
                                    (!options.onlyUnusedFiles || !(entr instanceof file) || !file.prototype.usedFiles.has(entr.name)))
                                    observer.next(entr);

                                if (this.entries)
                                    this.entries.set(entr.name, entr);
                            });

                            if (entries.length != 0)
                                observer.next(reader); // readEntries must be called iteratively since it returns at most 100 entries per call on Chrome and Edge 

                            observer.complete();
                        }, err => {
                            console.log(err);
                            observer.error(err);
                        });
                    });
                else
                    return Rx.Observable.empty();
            })
            .filter(entry => !this.isDirectoryReader(entry));


    }

    trackChanges() {
        if (this.entries)
            return Rx.Observable.empty();

        this.entries = new Map();

        return this.scan({ enforce: true })
            .do(e => { this.entries.set(e.name, e); });

    }



    /**
     * @param {file|string} path
     * @param {string|Image|file}
     */
    write(path, content) {
        path = path instanceof file ? file.getPath(this) : path;

        return this.createPath(path)
            .mergeMap(handle => Rx.Observable.create(obs => {
                handle.createWriter(writer => { obs.next(writer); obs.complete(); },
                    err => obs.error(cordovadirectory.toError(err, filesystem.concatPaths(this.getPath(), path)))
                )
            })
                .mergeMap(writer => {
                    var obs = Rx.Observable.of(content);
                    if (content instanceof file)
                        obs = content.readAsArrayBuffer();

                    return obs.mergeMap(content => Rx.Observable.create(obs => {
                        writer.onwriteend = () => { obs.next(cordovadirectory.handleToEntry(handle)); obs.complete(); };
                        writer.onerror = err => { obs.error(cordovadirectory.toError(err, filesystem.concatPaths(this.getPath(), path))) };
                        writer.write(content);
                        return () => { if (writer.readyState !== FileWriter.DONE) writer.abort(); };
                    }));
                }));
    }

    /**
     * 
     * @param {string} path
     */
    createDirectory(path) {
        return this.createPath(path)
            .map(cordovadirectory.handleToEntry);
    }

    /**
     * Removes this directory and all its contents
     * @returns {Rx.Observable<>}
     * */
    delete() {
        return cordovadirectory.resolve(this.path)
            .mergeMap(handle => Rx.Observable.create(obs => {
                handle.removeRecursively(() => obs.complete(), err => obs.error(cordovadirectory.toError(err, this.getPath(), path)));
            }));
    }

    /**
     * @returns {JSON}
     * */
    toNode() {
        if (!this.node)
            this.node = {
                id: this.getPath(),
                text: this.name,
                children: true,
                icon: "jstree-folder",
                state: {
                    opened: false
                }
            };
        return this.node;
    }

    /**
    * 
    * @param {FileError} err
    * @param {string} path
    */
    static toError(err, path) {
        var code = 0;
        if (typeof err === "number")
            code = err;
        else if (err.code)
            code = err.code;
        else
            return new error(directory.prototype.ERROR.INVALID_STATE_ERR, "", path);

        switch (code) {
            case FileError.NOT_FOUND_ERR:
                if (path && path.split('/').pop().indexOf('.') != -1)
                    return new error(directory.prototype.ERROR.FILE_NOT_FOUND, "", path);
                else
                    return new error(directory.prototype.ERROR.DIRECTORY_NOT_FOUND, "", path);
            case FileError.SECURITY_ERR:
                return new error(directory.prototype.ERROR.SECURITY_ERR, "", path);

            case FileError.ABORT_ERR
                :
                return new error(directory.prototype.ERROR.ABORT_ERR
                    , "", path);
            case FileError.NOT_READABLE_ERR
                :
                return new error(directory.prototype.ERROR.NOT_READABLE_ERR
                    , "", path);
            case FileError.ENCODING_ERR
                :
                return new error(directory.prototype.ERROR.ENCODING_ERR
                    , "", path);
            case FileError.NO_MODIFICATION_ALLOWED_ERR
                :
                return new error(directory.prototype.ERROR.NO_MODIFICATION_ALLOWED_ERR
                    , "", path);
            case FileError.INVALID_STATE_ERR
                :
                return new error(directory.prototype.ERROR.INVALID_STATE_ERR
                    , "", path);
            case FileError.SYNTAX_ERR
                :
                return new error(directory.prototype.ERROR.SYNTAX_ERR
                    , "", path);
            case FileError.INVALID_MODIFICATION_ERR
                :
                return new error(directory.prototype.ERROR.INVALID_MODIFICATION_ERR
                    , "", path);
            case FileError.QUOTA_EXCEEDED_ERR
                :
                return new error(directory.prototype.ERROR.QUOTA_EXCEEDED_ERR
                    , "", path);
            case FileError.TYPE_MISMATCH_ERR
                :
                return new error(directory.prototype.ERROR.TYPE_MISMATCH_ERR
                    , "", path);
            case FileError.PATH_EXISTS_ERR:
                return new error(directory.prototype.ERROR.PATH_EXISTS_ERR, "", path);

        }
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: webkitdirectory
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class webkitdirectory extends directory {
    get [Symbol.toStringTag]() {
        return 'Webkitdirectory';
    }

    /**
     * @param {string} [name]
     * @param {FileSystemDirectoryEntry | DirectoryEntry}  [directoryHandle]
     */
    constructor(name, directoryHandle) {
        super(name);

        this.files = new Map();
        this.directories = new Map();

        this.directoryHandle = directoryHandle;
        this.scanned = false;
    }

    equals(otherDirectory) {
        return this === otherDirectory;
    }

    /**
    * @param {webkitdirectory} elem
    * @returns {boolean} elem is ancestor of this
    */
    isAncestor(elem) {
        if (elem == null || this.equals(elem))
            return true;
        else if (this.getParent() == null)
            return false;
        else
            return this.getParent().isAncestor(elem);
    }

    canScan() {
        return !!this.directoryHandle;
    }

    canTrackChanges() {
        return this.canScan();
    }


    /**
 * 
 * @param {string} name
*@returns {file}
 */
    getFile(name) {
        let file = this.files.get(name);
        if (file == null)
            throw new error(this.ERROR.FILE_NOT_FOUND, "", this.getPath() + name);
        return file;
    }

    /**
 * 
 * @param {string} name
*@returns {directory}
 */
    getDirectory(name) {
        let dir = this.directories.get(name);
        if (dir == null)
            throw new error(this.ERROR.DIRECTORY_NOT_FOUND, "", this.getPath() + name);
        return dir;
    }

    /**
     * @returns {[directory | file]}
     */
    getEntries() {
        let entries = Array.from(this.files.values());
        return entries.concat(this.getDirectories());
    }

    /**
     * @returns {[directory]}
     * */
    getDirectories() {
        return Array.from(this.directories.values());
    }

    /**
     * 
     * @param {File | webkitdirectory} entry
    *@returns {boolean};
     */
    addEntry(entry) {
        if (entry instanceof file) {
            if (!this.files.has(entry.name, entry)) {
                this.files.set(entry.name, entry)
                entry.parent = this;
                this.emit(entry, this.CREATE);
                return true;
            }
            var f = this.getFile(entry.name);
            if (entry.fileHandle) {
                f.fileHandle = entry.fileHandle;
                delete f.file;
            }
            if (entry.file) {
                f.file = entry.file;
            }
        } else if (entry instanceof directory) {
            if (!this.directories.has(entry.name, entry)) {
                this.directories.set(entry.name, entry);
                entry.parent = this;
                this.emit(entry, this.CREATE);
                return true;
            }
            if (entry.directoryHandle) {
                this.getDirectory(entry.name).directoryHandle = entry.directoryHandle;
            }
        }
        return false;
    }


    /**
    * @returns {string}
    */
    getPath(rootDirectory = null) {
        if (this === null || this.equals(rootDirectory) || this.parent == null)
            return "";
        return this.parent.getPath(rootDirectory) + this.name + "/";
    }



    /**
     * @returns {webkitdirectory}
     * */
    getParent() {
        return this.parent;
    }


    /**
   * 
   * @param {string} path
   * @returns {Rx.Observable<[webkitdirectory, string]>} - parent of the element the path specifies, this if path is empty
   */
    searchParent(path = "") {
        var observable = Rx.Observable.of(null);
        if (!this.directoryHandle) {
            var root = this;
            while (root.getParent())
                root = root.getParent();

            observable = Rx.Observable.of(root)
                .expand(dir => {
                    return dir.scan()
                        .filter(d => d instanceof directory && this.isAncestor(d))
                })
                .last()
        }
        return observable.mapTo([this, path.split('/')])
            .expand(elem => {
                if (elem == null)
                    return Rx.Observable.empty();

                var path, parent;
                [parent, path] = elem;

                if (path.length <= 1)
                    return parent.scan().ignoreElements();

                let dirName = path.shift();
                if (!dirName)
                    return Rx.Observable.of([parent, path]);

                return parent.scan()
                    .filter(dir => dir instanceof directory && dir.name === dirName)
                    .defaultIfEmpty(null)
                    .map(dir => dir == null ? new webkitdirectory(dirName) : dir)
                    .last()
                    .do(dir => parent.addEntry(dir))
                    .map(dir => [dir, path]);
            })
            .last();
    }

    /**
    * 
    * @param {string} path
    * @returns {Rx.Observable<webkitfile>}
    */
    searchFile(path) {
        if (directory.isAbsolutePath(path) && directory.isRemotePath(path)) {
            return remotefile.fromPath(this.path);
        }

        return this.searchParent(path)
            .map(elem => elem[0].getFile(elem[1][0]));
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<webkitdirectory>}
*/
    searchDirectory(path) {
        if (path.length === 0)
            return Rx.Observable.of(this);

        if (directory.isAbsolutePath(path) && directory.isRemotePath(path)) {
            return Rx.Observable.of(new remotedirectory(path));
        }

        if (!path.endsWith('/'))
            path += '/';
        return this.searchParent(path)
            .map(elem => elem[0]);
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<webkitfile|webkitdirectory>}
*/
    searchEntry(path) {
        return this.searchDirectory(path)
            .catch(() => this.searchFile(path));
    }

    /**
    * @param {boolean} enforce
 * @returns {Rx.Observable<File>}
 */
    scanRecursive(options = {}) {
        return Rx.Observable.of(this)
            .expand(elem => {
                if (elem.canScan && elem.canScan())
                    return elem.scan(options);
                else
                    return Rx.Observable.empty();
            });
    }

    /**
    *
    * @param {boolean} options.enforce - scan again
    * @param {boolean} options.onlyNewFiles
    * @param {boolean} options.onlyUnusedFiles
    *@returns {Rx.Observable<File | webkitdirectory>}
    */
    scan(options = {}) {


        var defaultObservable;
        if (options.onlyNewFiles) {
            defaultObservable = Rx.Observable.from(this.getDirectories());
        } else {
            defaultObservable = Rx.Observable.from(this.getEntries());
        }

        if (options.onlyUnusedFiles) {
            defaultObservable = defaultObservable.filter(f => !(f instanceof file) || !f.read || !f.vertex);
        }

        if (this.scanned && !options.enforce)
            return defaultObservable;

        if (!this.directoryHandle) {
            this.emit(new error(this.ERROR.NO_DIRECTORY_HANDLE, "", this.getPath()), this.ERROR);
            return defaultObservable;
        }

        if (this.loading) {
            let targetSubject = new Rx.Subject();

            this.loadingCompleted.subscribe(null, null, () => {
                this.getEntries().forEach(e => {
                    targetSubject.next(e)
                });
                targetSubject.complete();
            });

            return targetSubject;
        }

        this.loading = true;
        this.loadingCompleted = new Rx.Subject();

        // get all entries
        return Rx.Observable.of(this.directoryHandle.createReader())
            .expand(reader => {
                if (this.isDirectoryReader(reader))
                    return Rx.Observable.create(observer => {
                        reader.readEntries(entries => {
                            entries.forEach(e => {
                                var entr;
                                if (e.isFile)
                                    entr = new webkitfile(e);
                                else
                                    entr = new webkitdirectory(e.name, e);

                                var isNew = this.addEntry(entr);
                                if (!isNew)
                                    if (e.isFile)
                                        entr = this.getFile(entr.name);
                                    else
                                        entr = this.getDirectory(entr.name);

                                if ((options.onlyNewFiles || isNew) &&
                                    (options.onlyUnusedFiles || !(entr instanceof file) || !entr.read || !entr.vertex))
                                    observer.next(entr);
                            });

                            if (entries.length != 0)
                                observer.next(reader); // readEntries must be called iteratively since it returns at most 100 entries per call on Chrome and Edge 
                            else if (this.loading) {
                                this.scanned = true;
                                this.loading = false;
                                this.loadingCompleted.complete();
                            }
                            observer.complete();
                        }, err => {
                            console.log(err);
                            observer.error(err);
                        });
                    });
                else
                    return Rx.Observable.empty();
            })
            .filter(entry => !this.isDirectoryReader(entry));
    }

    trackChanges() {
        return this.scan();
    }

    /**
   * Merge the information from a webkitfile input or drop event into the webkitdirectory tree
   * 
   * @param {DragEvent | Event} event - drag event
   *@param {webkitdirectory} options.root
   * @param {boolean} options.recursive
   * @param {boolean} options.allUnused
  * @returns {Rx.Observable<webkitfile>}
   */
    populate(event, options = {}) {
        var root = options.root || this;
        if (event.type === 'change') {
            return Rx.Observable.from(event.target.files)
                .mergeMap(f => {
                    return root.searchParent(f.webkitRelativePath)
                        .mergeMap(elem => {
                            var fl = new webkitfile(f);
                            if (elem[0].addEntry(fl))
                                return Rx.Observable.of(fl);
                            else if (options.allUnused) {
                                fl = elem[0].getFile(f.name);
                                if (!fl.vertex && !fl.read)
                                    return Rx.Observable.of(fl);
                            }
                            return Rx.Observable.empty();
                        });
                });

        } else if (event instanceof DragEvent) {

            /**
    * @type {array}
    */
            let items = event.dataTransfer.items || [];
            /**
            * @type {Rx.Observable}
            */
            var entries = Rx.Observable.from(items)
                .map(i => i.webkitGetAsEntry())
                .map(e => {
                    if (e.isFile) {
                        return new webkitfile(e);
                    } else {
                        return new webkitdirectory(e.name, e);
                    }
                })
                .mergeMap(i => {
                    if (root.addEntry(i))
                        return Rx.Observable.of(i);
                    else if (i instanceof webkitdirectory)
                        return Rx.Observable.of(root.getDirectory(i.name));
                    else if (options.allUnused) {
                        var fl = root.getFile(i.name);
                        if (!fl.vertex && !fl.read)
                            return Rx.Observable.of(fl);
                    }
                    return Rx.Observable.empty();
                });

            if (options.recursive || options.allUnused) {
                entries = entries
                    .mergeMap(e => {
                        if (e instanceof webkitdirectory)
                            return e.scanRecursive({ enforce: true, onlyUnusedFiles: options.allUnused });
                        else
                            return Rx.Observable.of(e);
                    });
            }

            return entries;
        }
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: remotedirectory
//
///////////////////////////////////////////////////////////////////////////////////////////////////
class remotedirectory extends directory {
    get [Symbol.toStringTag]() {
        return 'Directory';
    }

    /**
     * @param {string} path
     */
    constructor(path) {
        super(path);
    }

    equals(otherDirectory) {
        if (!(otherDirectory instanceof directory))
            return false;

        return this.getPath().substr(this.getPath().indexOf(':') + 1) === otherDirectory.getPath().substr(otherDirectory.getPath().indexOf(':') + 1);
    }

    canScan() {
        return false;
    }

    canWrite() {
        return false;
    }

    canTrackChanges() {
        return false;
    }



    /**
* 
* @param {string} path
* @returns {Rx.Observablefile>}
*/
    searchFile(path) {
        if (!directory.isAbsolutePath(path))
            path = filesystem.concatPaths(this.getPath(), path);

        return remotefile.fromPath(path);
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<directory>}
*/
    searchDirectory(path) {
        if (!directory.isAbsolutePath(path))
            path = filesystem.concatPaths(this.getPath(), path);

        return Rx.Observable.of(new remotedirectory(path));
    }

    /**
* 
* @param {string} path
* @returns {Rx.Observable<file|directory>}
*/
    searchEntry(path) {
        if (!directory.isAbsolutePath(path))
            path = filesystem.concatPaths(this.getPath(), path);

        return remotefile.fromPath(path)
            .catch(() => Rx.Observable.of(new remotedirectory(path)));

    }


    /**
    *
    * @param {boolean} options.enforce - scan again
    * @param {boolean} options.onlyNewFiles
    * @param {boolean} options.onlyUnusedFiles
    *@returns {Rx.Observable<file | directory>}
    */
    scan(options = {}) {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "", this.getPath()));


    }

}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: file
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class file {
    get [Symbol.toStringTag]() {
        return 'file';
    }

    /**
     * @param {File | FileSystemFileEntry | FileEntry}  fileHandle
     * @param {webkitdirectory} parent
     */
    constructor(name) {
        this.name = name;
    }

    equals(otherFile) {
        return this === otherFile;
    }


    /**
     * 
     * @param {webkitdirectory} rootDirectory
     */
    getPath(rootDirectory = null) {
        return this.name;
    }

    /**
     * @returns {webkitdirectory}
     * */
    getParent() {
        throw new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot determine parent", this.getPath());
    }

    /**
* @returns {string}
* */
    getContentType() {
        return this.contentType;
    }

    /**
    * 
    * @param {FileSystemFileEntry | FileEntry} entry
    * @returns {Rx.Observable<File>}
    */
    load() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot load content", this.getPath()));
    }

    /**
    *
    * @returns {Rx.observable<string>}
    */
    readAsDataURL() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot read URL", this.getPath()));
    }

    /**
 * 
 * @returns {Rx.Observable<JSON>}
 */
    readAsJSON() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot read JSON", this.getPath()));
    }

    /**
* @returns {Rx.observable<Image>}
 */
    readAsImage() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot read Image", this.getPath()));
    }

    /**
     * @returns {Rx.Observable<ImageBitmap>}
     * */
    readAsImageBitmap() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot read ImageBitmap", this.getPath()));
    }

    /**
     * @returns {Rx.Observable<ArrayBuffer>}
     * */
    readAsArrayBuffer() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot read ArrayBuffer", this.getPath()));
    }

    /**
 * @returns {Rx.Observable<Blob>}
 * */
    readAsBlob() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot read Blob", this.getPath()));
    }

    /**
* 
* @returns {Rx.Observable<>}
*/
    delete() {
        return Rx.Observable.throw(new error(this.ERROR.UNSUPPORTED_OPERATION, "Cannot delete", this.getPath()));
    }

    /**
     * 
     * @param {[string]} types
     * @returns {boolean} - is the type of this webkitfile contained in types?
     */
    isType(types) {
        if (!(types instanceof Array))
            types = [types];

        for (let type of types) {
            if (this.file && this.file.type === type ||
                this.name.endsWith("." + type.split('/')[1]) ||
                this.name.endsWith("." + type.split('/')[1].toUpperCase()))
                return true;

            if (type === file.prototype.JPG && (
                this.name.endsWith(".jpg") ||
                this.name.endsWith(".JPG")
            ))
                return true;
        }
        return false;
    }

    /**
* @returns {string}
* */
    contentTypeFromName() {
        for (var type of [file.prototype.JPG,
        file.prototype.PNG,
        file.prototype.TXT,
        file.prototype.WEBP,
        file.prototype.AVIF,
        file.prototype.JSON]) {
            if (this.isType(type))
                return type;
        }

    }

    /**
     * @returns {JSON}
     */
    toNode() {
        if (!this.node)
            this.node = {
                id: this.getPath(),
                text: this.name,
                children: false,
                icon: "jstree-file"
            };
        return this.node;
    }
}

file.prototype.JPG = "image/jpeg";
file.prototype.PNG = "image/png";
file.prototype.WEBP = "image/webp"
file.prototype.AVIF = "image/avif";
file.prototype.IMAGE = [file.prototype.JPG, file.prototype.PNG, file.prototype.WEBP, file.prototype.AVIF]
file.prototype.TXT = "text/plain";
file.prototype.JSON = "application/json";

file.prototype.ERROR = {};
file.prototype.ERROR.JSON_PARSE_EXCEPTION = "Syntax Error in JSON";
file.prototype.ERROR.READING_FILE_EXCEPTION = "Error reading file";
file.prototype.ERROR.UNSUPPORTED_OPERATION = "Operation cannot be performed on this file";
file.prototype.ERROR.LOAD_IMAGE = "Could not load image";

file.prototype.usedFiles = new Set();


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: webkitfile
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class webkitfile extends file {
    get [Symbol.toStringTag]() {
        return 'file';
    }

    /**
     * @param {File | FileSystemFileEntry | FileEntry}  fileHandle
     * @param {webkitdirectory} parent
     */
    constructor(fileHandle) {
        super(fileHandle.name);
        if (fileHandle instanceof File)
            this.file = fileHandle;
        else
            this.fileHandle = fileHandle;
        this.read = false;
    }

    equals(otherFile) {
        return this === otherFile;
    }


    /**
     * 
     * @param {webkitdirectory} rootDirectory
     */
    getPath(rootDirectory = null) {
        return this.parent.getPath(rootDirectory) + this.name;
    }

    /**
     * @returns {webkitdirectory}
     * */
    getParent() {
        return this.parent;
    }

    /**
     * @returns {string}
     * */
    getContentType() {
        if (!this.file)
            throw new error(this.ERROR.UNSUPPORTED_OPERATION, "load file before inspecting content type");
        else
            return this.contentType;
    }

    /**
    * 
    * @param {FileSystemFileEntry | FileEntry} entry
    * @returns {Rx.Observable<File>}
    */
    load() {
        if (this.file)
            return Rx.Observable.of(this.file);

        return Rx.Observable.create(observer => {
            this.fileHandle.file(
                file => {
                    this.file = file;
                    this.contentType = file.type || this.contentTypeFromName();
                    observer.next(file);
                    observer.complete();
                }
                //                , err => observer(err)
            );
        });
    }

    /**
    *
    * @returns {Rx.observable<string>}
    */
    readAsDataURL() {
        return this.load().mergeMap(file => {
            return Rx.Observable.create(observer => {
                var fileReader = new FileReader();

                fileReader.onload = function (event) {
                    this.read = true;
                    observer.next(event.target.result || event.currentTarget.result);
                    observer.complete();
                };
                fileReader.onerror = (err) => {
                    observer.error(cordovadirectory.toError(err.target.error, this.getPath()));
                };

                fileReader.readAsDataURL(file);

                return () => { if (fileReader.readyState !== FileReader.DONE) fileReader.abort(); };
            });
        });
    }

    /**
 * 
 * @returns {Rx.Observable<JSON>}
 */
    readAsJSON() {
        return this.load()
            .mergeMap(file => {
                return Rx.Observable.create(observer => {
                    var fileReader = new FileReader();

                    fileReader.onload = function (event) {
                        this.read = true;
                        if (event.target.result == "")
                            observer.next("");
                        else
                            observer.next(event.target.result || event.currentTarget.result);
                        observer.complete();
                    };
                    fileReader.onerror = (err) => {
                        observer.error(cordovadirectory.toError(err.target.error, this.getPath()));
                        observer.error(err);
                    };

                    fileReader.readAsText(file);

                    return () => { if (fileReader.readyState !== FileReader.DONE) fileReader.abort(); };
                })
            })
            .map(text => {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    e.fileName = this.name;
                    e.file = this;
                    var message = e.message.replace("JSON.parse: ", "");
                    message = message.replace("of the JSON data", `in "${this.getPath()}"`);
                    throw new error(this.ERROR.JSON_PARSE_EXCEPTION, message, e);
                }
            });
    }

    /**
* @returns {Rx.observable<Image>}
 */
    readAsImage() {
        return this.readAsDataURL()
            .mergeMap(src => {
                return Rx.Observable.create(observer => {

                    var img = new Image();

                    img.onload = () => {
                        observer.next(img);
                        observer.complete();
                    };
                    img.onerror = (err) => {
                        observer.error(err.target.error || file.prototype.ERROR.LOAD_IMAGE, this.getPath());
                    };

                    img.src = src;
                });
            });
    }

    /**
     * @returns {Rx.Observable<ImageBitmap>}
     * */
    readAsImageBitmap() {
        return this.load().mergeMap(f => {
            return createImageBitmap(f)
        }).catch(() => this.readAsImage());
    }

    /**
     * @returns {Rx.Observable<ArrayBuffer>}
     * */
    readAsArrayBuffer() {
        return this.load()
            .mergeMap(file => Rx.Observable.create(obs => {
                var fileReader = new FileReader();
                fileReader.readAsArrayBuffer(file);

                fileReader.onload = function (event) {
                    obs.next(event.target.result || event.currentTarget.result);
                    obs.complete();
                };
                fileReader.onerror = (err) => {
                    obs.error(cordovadirectory.toError(err.target.error, this.getPath()));
                };
            })
            );
    }

    /**
 * @returns {Rx.Observable<Blob>}
 * */
    readAsBlob() {
        return this.load();
    }


}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: cordovafile
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class cordovafile extends webkitfile {
    get [Symbol.toStringTag]() {
        return 'cordovafile';
    }

    /**
     * @param {String}  name
     * @param {String} path
     */
    constructor(name, path) {
        super({ name: name });
        this.path = path.replace(/\\/g, '/');
        delete this.fileHandle;
    }

    equals(otherFile) {
        if (!(otherFile instanceof file))
            return false;

        return this.getPath() === otherFile.getPath();
    }

    /**
     * 
     * @param {directory} rootDirectory
     */
    getPath(rootDirectory = null) {
        if (!rootDirectory)
            return this.path;

        return directory.toRelativePath(rootDirectory.getPath(), this.path);
    }

    /**
     * @returns {cordovadirectory}
     * */
    getParent() {
        var pathComponents = this.path.split('/');

        return new cordovadirectory(pathComponents.slice(0, -1).join('/'));
    }

    /**
    * 
    * @returns {Rx.Observable<File>}
    */
    load() {
        return Rx.Observable.create(obs => {
            window.resolveLocalFileSystemURL(this.path,
                (entry) => { obs.next(entry); obs.complete(); },
                (err) => { obs.error(cordovadirectory.toError(err, this.path)) }
            )
        })
            .mergeMap(handle => {

                return Rx.Observable.create(observer => {
                    handle.file(
                        file => {
                            this.contentType = file.type || this.contentTypeFromName();
                            this.file = file;
                            observer.next(file);
                            observer.complete();
                        }
                        //                , err => observer(err)
                    );
                });
            });
    }

    /**
* @returns {Rx.Observable<Blob>}
* */
    readAsBlob() {
        return this.readAsArrayBuffer()
            .map(buffer => new Blob([buffer], {
                type: this.getContentType()
            }));
    }

    /**
* @returns {Rx.Observable<Blob>}
* */
    readAsImageBitmap() {
        return this.readAsBlob().mergeMap(blob => createImageBitmap(blob));
    }

    /**
 * Removes this directory and all its contents
 * @returns {Rx.Observable<>}
 * */
    delete() {
        return Rx.Observable.create(obs => {
            window.resolveLocalFileSystemURL(this.path,
                (entry) => { obs.next(entry); obs.complete(); },
                (err) => { obs.error(cordovadirectory.toError(err, this.getPath())) }
            )
        }).mergeMap(handle => {

            return Rx.Observable.create(obs => {
                handle.remove(() => obs.complete(), err => obs.error(cordovadirectory.toError(err, this.getPath())));
            });
        });
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: remotefile
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class remotefile extends file {
    get [Symbol.toStringTag]() {
        return 'file';
    }

    /**
     * @param {string}  path
     *  @param {string}  responseHeader
     */
    constructor(path, responseHeader) {
        path = path.replace(/\\/g, '/')
        super(path.split('/').pop());

        this.path = path;

        this.contentType = /content-type: (.*)/.exec(responseHeader)[1];
    }

    equals(otherFile) {
        if (!(otherFile instanceof file))
            return false;

        return this.getPath().substr(this.getPath().indexOf(':') + 1) === otherFile.getPath().substr(otherFile.getPath().indexOf(':') + 1);
    }

    /**
* @returns {string}
* */
    getContentType() {
        if (this.contentType)
            return this.contentType;
        else
            throw new error(this.ERROR.UNSUPPORTED_OPERATION, "load file before inspecting content type");
    }

    static fromPath(path) {
        return Rx.Observable.create(obs => {
            var r = $.ajax({
                type: 'HEAD',
                url: encodeURI(path),
                success: () => {
                    obs.next(new remotefile(path, r.getAllResponseHeaders())); obs.complete();
                },
                error: (err) => obs.error(new error(file.prototype.ERROR.FILE_NOT_FOUND, path, err))
            });
        });
    }

    /**
     * 
     * @param {directory} rootDirectory
     */
    getPath(rootDirectory = null) {
        if (!rootDirectory)
            return this.path;

        return directory.toRelativePath(rootDirectory.getPath(), this.path);
    }

    /**
     * @returns {directory}
     * */
    getParent() {
        var pathComponents = this.path.split('/');

        return new remotedirectory(pathComponents.slice(0, -1).join('/'));;
    }

    /**
    *
    * @returns {Rx.observable<string>}
    */
    readAsDataURL() {
        return this.getPath();
    }

    /**
 * 
 * @returns {Rx.Observable<JSON>}
 */
    readAsJSON() {
        // Rx.Observable.ajax fails to load content from other sites
        return Rx.Observable.create(obs => {
            var r = $.ajax({
                type: 'GET',
                url: encodeURI(this.path),
                success: (data) => {
                    obs.next(data); obs.complete();
                },
                error: (err) => obs.error(new error(file.prototype.ERROR.FILE_NOT_FOUND, this.path, err))
            });
        })
            .map(text => {
                try {
                    if (typeof text === 'string')
                        return JSON.parse(text);
                    else
                        return text;
                } catch (e) {
                    e.fileName = this.name;
                    e.file = this;
                    var message = e.message.replace("JSON.parse: ", "");
                    message = message.replace("of the JSON data", `in "${this.getPath()}"`);
                    throw new error(this.ERROR.JSON_PARSE_EXCEPTION, message, e);
                }
            });
    }

    /**
* @returns {Rx.observable<Image>}
 */
    readAsImage() {

        return Rx.Observable.create(observer => {

            var img = new Image();

            img.onload = () => {
                observer.next(img);
                observer.complete();
            };
            img.onerror = (err) => {
                observer.error(err);
            };

            img.crossOrigin = "Anonymous";
            img.src = this.path;
        });
    }

    /**
     * @returns {Rx.Observable<ImageBitmap>}
     * */
    readAsImageBitmap() {
        return this.readAsImage().mergeMap(img => {
            return createImageBitmap(img)
        });
    }

    /**
     * @returns {Rx.Observable<ArrayBuffer>}
     * */
    readAsArrayBuffer() {
        return Rx.Observable.create(obs => {
            var request = new XMLHttpRequest();
            request.open('GET', this.path, true);
            request.responseType = 'arraybuffer';
            request.onload = function () {
                obs.next(request.response);
                obs.complete();
            };
            request.send();
            return () => { if (request.readyState !== request.DONE) request.abort(); }
        });
    }

    /**
 * @returns {Rx.Observable<Blob>}
 * */
    readAsBlob() {
        return Rx.Observable.create(obs => {
            var request = new XMLHttpRequest();
            request.open('GET', this.path, true);
            request.responseType = 'blob';
            request.onload = function () {
                obs.next(request.response);
                obs.complete();
            };
            request.send();
            return () => { if (request.readyState !== request.DONE) request.abort(); }
        });
    }



    /**
     * 
     * @param {[string]} types
     * @returns {boolean} - is the type of this webkitfile contained in types?
     */
    isType(types) {
        if (!(types instanceof Array))
            types = [types];

        for (let type of types) {
            if (this.contentType.startsWith(type))
                return true;

        }
        return false;
    }

}

/**************************************************************************************************
 * 
 *    Class: diskAccessor
 *    
 *    Observes webkitfile input buttons and drop areas.
 * 
 **************************************************************************************************/

class diskAccessor extends observable {
    get [Symbol.toStringTag]() {
        return 'Disk Accessor';
    }

    constructor() {
        super();

        try {

            if (platform.name)
                var browser = platform.name.split(" ")[0];

            var mobile = platform.isMobile;

            if(platform.version)
                var version = Number.parseInt(platform.version.split('.')[0]);

            if (platform.osVersion)
                var osVersion = Number.parseInt(platform.os.version.split('.')[0]);

            this.allowsDrop =
                browser == "Microsoft" && version >= 15 && !mobile ||
                browser == "Firefox" && version >= 4 && !mobile ||
                browser == "Chrome" && version >= 4 && !mobile && directory.isRemotePath(window.location.href) ||
                browser == "Safari" && version >= 3 && !mobile ||
                browser == "Opera" && version >= 12 && !mobile ||
                browser == "Safari" && version >= 11 && mobile ||
                browser == "IE" && version >= 10 && mobile
                ;

            this.allowsDirectorySelect =
                browser == "Microsoft" && version >= 15 && !mobile ||
                browser == "Firefox" && version >= 58 && !mobile ||
                browser == "Chrome" && version >= 49 && !mobile ||
                browser == "Safari" && version >= 12 && !mobile
                ;

            this.allowsMultiFileSelect =
                browser == "IE" && version >= 11 && !mobile ||
                browser == "Microsoft" && version >= 15 && !mobile ||
                browser == "Firefox" && version >= 58 && !mobile ||
                browser == "Chrome" && version >= 49 && !mobile ||
                browser == "Safari" && version >= 11 && !mobile ||
                browser == "Safari" && version >= 10 && mobile && osVersion >= 5 ||
                browser == "Chrome" && version >= 64 && mobile && osVersion >= 5
                ;

        } catch (e) {
            this.allowsDrop = false;
            this.allowsDirectorySelect = false;
            this.allowsMultiFileSelect = false;
        }

        this.path = ko.observable();
        this.name = ko.observable();
        this.multi = ko.observable(false);
        this.allowsFiles = ko.observable(true);
        this.allowsFolders = ko.observable(true);
        this.clipboard = new ClipboardJS('.clipboard');
        this.singleFile = false;

        document.addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "none";
        });

        if (document.querySelector('#webkit-droparea'))
            document.getElementById('webkit-droparea').addEventListener('dragover', e => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "link";
            });

        this.targetSubject = new Rx.Subject();
        this.fileObservable = Rx.Observable.empty();

        if (document.querySelector('#webkit-file-selector'))
            this.fileObservable = this.fileObservable
                .merge(Rx.Observable.fromEvent(document.querySelector('#webkit-file-selector'), 'change'))
                .do(() => this.forcedFile = true);

        if (document.querySelector('#webkit-files-selector'))
            this.fileObservable = this.fileObservable
                .merge(Rx.Observable.fromEvent(document.querySelector('#webkit-files-selector'), 'change'));

        if (document.querySelector('#webkit-directory-selector'))
            this.fileObservable = this.fileObservable
                .merge(Rx.Observable.fromEvent(document.querySelector('#webkit-directory-selector'), 'change'));

        if (document.querySelector('#webkit-droparea'))
            this.fileObservable = this.fileObservable
                .merge(Rx.Observable.fromEvent(document.getElementById('webkit-droparea'), 'drop'));

        this.fileObservable = this.fileObservable
            .do(e => {
                e.preventDefault();
                this.targetSubject.next(e);
                this.targetSubject.complete();
            })
            .subscribe();

        if ($('#webkit-access-disk-tab')[0])
            ko.applyBindings(this, $('#webkit-access-disk-tab')[0]);
    }

    /**
     * @returns {Boolean} - Pass that webkitfile even if it does not match the criteria
     * */
    isForcedFile() {
        return this.forcedFile;
    }

    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @returns {Rx.observable<webkitfile>}
     */
    request(options) {
        this.root = options.parent;

        this.path(this.root.getPath());
        this.name(options.name);
        this.multi(!!options.multi);
        this.allowsFiles(!!options.filter.files);
        this.allowsFolders(!!options.filter.folders);

        if (this.targetSubject)
            this.targetSubject.complete();
        this.targetSubject = new Rx.Subject();


        this.singleFile = !options.multi;
        delete this.forcedFile;


        return this.targetSubject.mergeMap(ev => options.parent.populate(ev, { root: this.root, allUnused: (this.name() == null || this.name().length == 0) }));
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: webkitWorkspaceSelector
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class webkitWorkspaceSelector {
    get [Symbol.toStringTag]() {
        return 'Webkit Workspace Accessor';
    }

    /**
     * @param {webkitdirectory} root
     * @param {diskAccessor} diskAcc
     **/
    constructor(root, diskAcc) {
        this.root = root;

        this.allowsDrop = diskAcc.allowsDrop;
        this.allowsDirectorySelect = diskAcc.allowsDirectorySelect;

        this.dialog = $('#webkit-select-workspace-dialog');

        document.getElementById('webkit-workspace-droparea').addEventListener('dragover', e => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "link";
        });

        this.targetSubject = new Rx.Subject();

        var observables = [];

        if (document.querySelector('#webkit-workspace-files-selector'))
            observables.push(
                Rx.Observable.fromEvent(document.querySelector('#webkit-workspace-files-selector'), 'change')
                    .mergeMap(ev => this.root.populate(ev, { root: this.root })
                        .defaultIfEmpty(null)
                        .last()
                        .mapTo(this.root)
                    )

            );


        if (document.querySelector('#webkit-workspace-directory-selector'))
            observables.push(
                Rx.Observable.fromEvent(document.querySelector('#webkit-workspace-directory-selector'), 'change')
                    .mergeMap(ev => this.root.populate(ev, { root: this.root })
                        .last()
                        .map(f => {
                            var parent = f;
                            while (parent.getParent() && parent.getParent() != this.root)
                                parent = parent.getParent();

                            return parent;
                        })
                    )
            );

        if (document.querySelector('#webkit-workspace-droparea'))
            observables.push(
                Rx.Observable.fromEvent(document.getElementById('webkit-workspace-droparea'), 'drop')
                    .do(e => e.preventDefault())
                    .mergeMap(ev => this.root.populate(ev, { root: this.root })
                        .filter(e => e instanceof directory)
                        .first()
                    )
            );


        this.subscriptions = observables.map(obs =>
            obs.do(e => {
                this.targetSubject.next(e);
                $(this.dialog).modal("hide");
            })
                .subscribe()
        );

        Rx.Observable.fromEvent($(this.dialog), 'hide.bs.modal')
            .subscribe(() => {

                if (this.targetSubject) {
                    this.targetSubject.complete();
                }
            });

        if ($('#webkit-select-workspace-dialog').length)
            ko.applyBindings(this, $('#webkit-select-workspace-dialog')[0]);

    }

    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @param {boolean} [options.filter.files]
     * @param {boolean} [options.filter.folders]
     * @returns {Rx.observable<webkitfile>}
     */
    request(options) {

        this.targetSubject.complete();
        this.targetSubject = new Rx.Subject();

        this.dialog.modal("show");

        if (options.workspace || !options.multi)
            return this.targetSubject.take(1);

        return this.targetSubject
    }
}

///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: fileTree
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class fileTree {
    get [Symbol.toStringTag]() {
        return 'File Tree';
    }

    constructor(root, dom) {
        let self = this;
        this.nodes = new Map();
        this.hasSelections = ko.observable(false);
        this.nodeIdToEntry = new Map();
        this.root = root;

        $('#webkit-access-browser-tab-jstree').jstree({
            'core': {
                'data': function (n, cb) {
                    if (n.id == '#') {
                        let cNode = root.toNode();
                        self.nodeIdToEntry.set(cNode.id, root);
                        cb(cNode);
                        return;
                    }

                    if (!self.nodeIdToEntry.has(n.id)) {
                        cb(false);
                        return;
                    }

                    let dir = self.nodeIdToEntry.get(n.id);


                    dir.scan()
                        .filter(e => !(e instanceof file) || e.isType([file.prototype.JPG, file.prototype.PNG, file.prototype.WEBP, file.prototype.AVIF, file.prototype.JSON]))
                        .map(e => {
                            let cNode = e.toNode();
                            self.nodeIdToEntry.set(cNode.id, e);
                            return cNode;
                        })
                        .toArray()
                        .do(() => {
                            dir.observe(webkitfile, dir.CREATE)
                                .merge(dir.observe(webkitdirectory, dir.CREATE))
                                .subscribe(e => {
                                    if (!e.node) {
                                        let cNode = e.toNode();
                                        self.nodeIdToEntry.set(cNode.id, e);
                                        self.tree.create_node(n, cNode);
                                    }
                                });
                        })
                        .subscribe(arr => cb({ id: n.id, text: n.text, icon: n.icon, children: arr }));

                },
                'check_callback': true,
                'themes': {
                    'responsive': false,
                    'variant': 'small',
                    'stripes': true
                }
            },
            'sort': function (a, b) {
                let a_directory = self.nodeIdToEntry.has(a) && (self.nodeIdToEntry.get(a) instanceof directory);
                let b_directory = self.nodeIdToEntry.has(b) && (self.nodeIdToEntry.get(b) instanceof directory);
                return a_directory.equals(b_directory) ? (this.get_text(a) > this.get_text(b) ? 1 : -1) : (b_directory ? 1 : -1);
            },
            /*          'contextmenu': {
                          'items': function (node) {
                              var tmp = $.jstree.defaults.contextmenu.items();
                              delete tmp.create.action;
                              tmp.create.label = "New";
                              tmp.create.submenu = {
                                  "create_folder": {
                                      "separator_after": true,
                                      "label": "Folder",
                                      "action": function (data) {
                                          var inst = $.jstree.reference(data.reference),
                                              obj = inst.get_node(data.reference);
                                          inst.create_node(obj, { type: "default" }, "last", function (new_node) {
                                              setTimeout(function () { inst.edit(new_node); }, 0);
                                          });
                                      }
                                  },
                                  "create_file": {
                                      "label": "File",
                                      "action": function (data) {
                                          var inst = $.jstree.reference(data.reference),
                                              obj = inst.get_node(data.reference);
                                          inst.create_node(obj, { type: "webkitfile" }, "last", function (new_node) {
                                              setTimeout(function () { inst.edit(new_node); }, 0);
                                          });
                                      }
                                  }
                              };
                              if (this.get_type(node) === "webkitfile") {
                                  delete tmp.create;
                              }
                              return tmp;
                          }
                      }, */
            'types': {
                'default': { 'icon': 'folder' },
                'file': { 'valid_children': [], 'icon': 'file' },
                '#': null
            },
            'unique': {
                'duplicate': function (name, counter) {
                    return name + ' ' + counter;
                }
            },
            'plugins': ['state', 'dnd', 'sort', 'types', /*'contextmenu'*/, 'unique']
        })
            .on('delete_node.jstree', function (e, data) {
                self.nodes.delete(data.node.id);
            })
            .on('select_node.jstree', function (e, data) {
                if (data.node.id == "#")
                    return;

                if (!self.matchesFilter(data.node)) {
                    self.tree.deselect_node(data.node);
                    return;
                }

                self.hasSelections(self.tree.get_selected().length >= 1);

                if (!self.multi && self.tree.get_selected().length > 1) {
                    self.tree.get_selected(true).forEach(n => { if (n.id != data.node.id) self.tree.deselect_node(n) });
                }
            })
            .on('deselect_node.jstree', function (e, data) {
                self.hasSelections(self.tree.get_selected().length >= 1);
            });

        if ($('#webkit-access-browser-tab').length) {
            this.tree = $('#webkit-access-browser-tab-jstree').jstree(true);
            ko.applyBindings(this, $('#webkit-access-browser-tab')[0]);
        }
    }

    /**
 * @returns {Boolean} - Pass that webkitfile even if it does not match the criteria
 * */
    isForcedFile() {
        return this.forcedFile;
    }

    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @param {boolean} [options.filter.files]
     * @param {boolean} [options.filter.folders]
     * @returns {Rx.observable<webkitfile>}
     */
    request(options) {
        delete this.forcedFile;

        this.nodes.forEach(n => {
            if (!this.nodeIdToEntry.get(n.id) || !this.nodeIdToEntry.get(n.id).isAncestor(options.parent)) {
                this.tree.disable_node(n);
                this.tree.deselect_node(n);
                this.tree.close_node(n, 0);
            } else {
                this.tree.enable_node(n);
            }
        });

        this.filter = options.filter;
        this.tree.get_selected(true).forEach(n => {
            if (!this.matchesFilter(n))
                this.tree.deselect_node(n);
        });

        this.multi = options.multi;
        if (!this.multi && this.tree.get_selected().length > 1) {
            this.tree.deselect_all();
        }

        if (this.targetSubject)
            this.targetSubject.complete();
        this.targetSubject = new Rx.Subject();
        return this.targetSubject;
    }

    /**
     * Forwards selected entries to requester
     * */
    confirmSelection() {
        if (this.targetSubject) {
            var count = 0;
            this.tree.get_selected(true).forEach(n => {
                if (this.nodeIdToEntry.get(n.id)) {
                    this.targetSubject.next(this.nodeIdToEntry.get(n.id));
                    count++;
                }
            });
            if (count == 1)
                this.forcedFile = true;
            this.targetSubject.complete();
            delete this.targetSubject;
        }
    }

    /**
     * 
     * @param {any} n - node of the fileTree
     */
    matchesFilter(n) {
        if (!this.filter)
            return true;

        if (!this.nodeIdToEntry.get(n.id))
            return false;

        let entr = this.nodeIdToEntry.get(n.id);
        if (this.filter.files && entr instanceof file)
            return true;

        if (this.filter.folders && entr instanceof directory)
            return true;

        return false;
    }
}

/**************************************************************************************************
 * 
 *    Class: androidAccessor
 *    
 *    Forwards request to filebrowser plugin from cordova.
 * 
 **************************************************************************************************/

class androidAccessor extends observable {
    get [Symbol.toStringTag]() {
        return 'Filebrowser Accessor';
    }

    constructor(filesys) {
        super();

        this.root = filesys;
    }



    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @param {boolean} [options.filter.files]
     * @param {boolean} [options.filter.folders]
     * @returns {Rx.observable<webkitfile>}
     */
    request(options) {
        var myOptions = $.extend({}, options);

        if (this.targetSubject)
            this.targetSubject.complete();
        this.targetSubject = new Rx.Subject();

        var picker;

        if (myOptions.filter && !myOptions.filter.folders) {
            picker = window.OurCodeWorld.Filebrowser.filePicker;
            if (myOptions.multi)
                picker = picker.multi;
            else
                picker = picker.single;
        }
        else if (myOptions.filter && !myOptions.filter.files) {
            picker = window.OurCodeWorld.Filebrowser.folderPicker;
            if (myOptions.multi)
                picker = picker.multi;
            else {
                picker = picker.single;
            }
        }
        else
            picker = window.OurCodeWorld.Filebrowser.mixedPicker;

        picker({
            success: paths => {
                for (var path of paths) {
                    this.targetSubject.next(path);
                }

                this.targetSubject.complete();

            },
            error: err => {
                this.targetSubject.error(err);
            },
            //startupPath: options.parent ? options.parent.getPath() : null
        });

        return this.targetSubject
            .mergeMap(path => cordovadirectory.resolve(path).map(handle => cordovadirectory.handleToEntry(handle, path)));
    }

    /**
* @returns {Rx.observable<string>}
 * */
    selectNewFilePath() {
        return Rx.Observable.create(obs => {
            window.OurCodeWorld.Filebrowser.createFileDialog({
                success: paths => {
                    if (paths.length)
                        obs.next(paths[0]);

                    this.targetSubject.complete();

                },
                error: err => {
                    this.targetSubject.error(err);
                },
                //startupPath: options.parent ? options.parent.getPath() : null
            });
        });
    }
}

/**************************************************************************************************
 * 
 *    Class: electronAccessor
 *    
 *    Forwards request to filebrowser from Electron.
 * 
 **************************************************************************************************/

class electronAccessor extends observable {
    get [Symbol.toStringTag]() {
        return 'Electron Accessor';
    }

    constructor(filesys) {
        super();

        this.root = filesys;
        this.dialog = $('#select-directory-dialog');
        this.workspace = ko.observable(true);




        if ($('#select-directory-dialog').length) {
            if (document.querySelector('#workspace-directory-selector'))
                Rx.Observable.fromEvent(document.querySelector('#workspace-directory-selector'), 'click')
                    .subscribe(() => window.electron.ipcRenderer.send("fs-request", $.extend(true, {
                        filter: { files: false, folders: true }
                    }, this.options)));

            document.getElementById('workspace-droparea').addEventListener('dragover', e => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "link";
            });

            ko.applyBindings(this, $('#select-directory-dialog')[0]);
        }
    }

    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @param {boolean} [options.filter.files]
     * @param {boolean} [options.filter.folders]
     * @returns {Rx.observable<cordovafile>}
     */
    request(options) {
        this.workspace(options.workspace);
        this.options = $.extend({}, options, { parent: options.parent ? options.parent.getPath() : null });

        if (this.targetSubject)
            this.targetSubject.complete();
        this.targetSubject = new Rx.Subject();

        if (options.workspace && $('#select-directory-dialog').length) {
            if (this.subscription)
                this.subscription.unsubscribe();

            this.subscription = Rx.Observable.fromEvent(document.getElementById('workspace-droparea'), 'drop')
                .do(e => e.preventDefault())
                .mergeMap(ev => Rx.Observable.from(ev.dataTransfer.files))
                .map(f => f.path)
                .merge(this.getDialogResponse())
                .mergeMap(path => cordovadirectory.resolve(path).map(handle => cordovadirectory.handleToEntry(handle, path)))
                .filter(e => e instanceof directory)
                .first()
                .subscribe(this.targetSubject);

            $(this.dialog).modal("show");

            return this.targetSubject.do(() => $(this.dialog).modal("hide"));
        }


        if (window.electron && window.electron.ipcRenderer) {

            if (this.subscription)
                this.subscription.unsubscribe();

            this.subscription = this.getDialogResponse()
                .subscribe(this.targetSubject);


            window.electron.ipcRenderer.send("fs-request", this.options);

        } else {
            this.targetSubject.error(new error(cordovadirectory.prototype.ERROR.UNSUPPORTED_OPERATION, "window.electron not available"));
        }



        return this.targetSubject
            .mergeMap(path => cordovadirectory.resolve(path).map(handle => cordovadirectory.handleToEntry(handle, path)));
    }

    /**
    * @returns {Rx.observable<string>}
     * */
    selectNewFilePath() {
        if (this.targetSubject)
            this.targetSubject.complete();
        this.targetSubject = new Rx.Subject();

        if (window.electron && window.electron.ipcRenderer) {

            if (this.subscription)
                this.subscription.unsubscribe();

            this.subscription = this.getDialogResponse()
                .subscribe(this.targetSubject);
            window.electron.ipcRenderer.send("fs-create", this.options);
        }

        return this.targetSubject;
    }

    /**
     * @private
     * @returns {Rx.Observable<string>}
     * */
    getDialogResponse() {
        return Rx.Observable.create(obs => {
            var responseHandler = (emitter, result) => {
                for (var path of (result.filePaths || result.paths || []))
                    obs.next(path.replace(/\\/g, '/'));

                obs.complete();
            };

            window.electron.ipcRenderer.on("fs-response", responseHandler);

            return () => window.electron.ipcRenderer.off("fs-response", responseHandler);
        });
    }
}


///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: webkitAccessor
//
///////////////////////////////////////////////////////////////////////////////////////////////////

class webkitAccessor {
    get [Symbol.toStringTag]() {
        return 'Entry Accessor';
    }

    /**
     * @param {filesystem} filesys
     **/
    constructor(filesys) {
        this.filesys = filesys;

        this.accessors = [new diskAccessor(filesys)];
        if ($('#webkit-access-browser-tab')[0])
            this.accessors.push(new fileTree(filesys));

        this.workspaceSelector = new webkitWorkspaceSelector(filesys, this.accessors[0]);

        this.allowsFiles = ko.observable(false);
        this.allowsFolders = ko.observable(false);
        this.multi = ko.observable(false);

        this.dialog = $('#webkit-access-dialog');
        this.hasEntries = ko.observable(false);
        filesys.observe(webkitfile, filesys.CREATE)
            .merge(filesys.observe(webkitdirectory, filesys.CREATE))
            .subscribe(() => this.hasEntries(true));

        if ($('#webkit-access-dialog-header')[0])
            ko.applyBindings(this, $('#webkit-access-dialog-header')[0]);

        Rx.Observable.fromEvent($(this.dialog), 'hide.bs.modal')
            .subscribe(() => {
                //                if (this.subscriptions)
                //                    this.subscriptions.map(sub => sub.unsubscribe());

                if (this.targetSubject) {
                    delete this.targetSubject;
                }
            });
    }

    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @param {boolean} [options.filter.files]
     * @param {boolean} [options.filter.folders]
     * @returns {Rx.observable<webkitfile>}
     */
    request(options) {
        if (options.workspace)
            return this.workspaceSelector.request(options);

        var opt = $.extend(true, {
            parent: this.filesys,
            multi: true,
            filter: {
                files: true,
                folders: true
            }
        }, options);

        if (this.subscriptions) {
            this.subscriptions.forEach(sub => sub.unsubscribe());
        }

        this.allowsFiles(options.filter.files);
        this.allowsFolders(options.filter.folders);
        this.multi(options.multi);

        this.filter = opt.filter;
        this.targetSubject = new Rx.Subject();

        let complete = () => {
            $('#webkit-access-dialog').modal("hide");
        }

        let next = (e) => this.targetSubject.next(e);

        this.subscriptions = this.accessors
            .map(acc => acc.request(opt))
            .map(obs => obs.subscribe(next, () => { }, complete));

        // use timeout to prevent remaining black overlay when new dialog is immediatly opened
        // after the previous one was closed
        let openDialog = (force = false) => {
            if (!force && $('.modal-backdrop').length)
                setTimeout(() => openDialog(true), 500);
            else
                this.dialog.modal("show");
        }
        openDialog();

        return this.targetSubject.filter(e => {
            // user wants to open that webkitfile although it does not match the criteria
            if (this.accessors.map(acc => acc.isForcedFile()).reduce((l, r) => l || r))
                return true;

            if (!this.matchesFilter(opt.filter, e))
                return false;

            if (!opt.multi || opt.name == null || opt.name.length == 0)
                return true;

            return e.name.split("/").pop() == opt.name;
        });
    }

    /**
     * 
     * @param {boolean} [filter.files]
     * @param {boolean} [filter.folders]
     * @param {webkitfile | webkitdirectory} entr
     * @returns {boolean}
     */
    matchesFilter(filter, entr) {
        if (!filter)
            return true;

        if (filter.files && entr instanceof file)
            return true;

        if (filter.folders && entr instanceof directory)
            return true;

        return false;
    }
}



///////////////////////////////////////////////////////////////////////////////////////////////////
//
//    Class: filesystem
//
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * Listen to events: this.observe(vertex, <action>).subscribe(elem => / do something with element here /)
 * <action> in {this.LINK, this.UNLINK}
 * this.observe(this.DIRECTORY, this.WORKSPACE)
 * */
class filesystem extends observable {
    get [Symbol.toStringTag]() {
        return 'Filesystem';
    }

    constructor(config = {}) {
        super();


        if (platform.name === "Electron") {
            console.log("Accessor: Electron");
            this.acc = new electronAccessor(this);
        } else if (window.OurCodeWorld && window.OurCodeWorld.Filebrowser && platform.name === "Android Browser") {
            console.log("Accessor: Android");
            this.acc = new androidAccessor(this);
        } else {
            console.log("Accessor: Web");
            this.root = new webkitdirectory("");
            this.root.node = this.toNode();
            this.acc = new webkitAccessor(this.root);
        }
        this.requestMissingFiles = !!config.requestMissingFiles;
        this.trackChanges = !!config.trackChanges;
    }



    /**
     * @returns {webkitdirectory} - first webkitdirectory or this
     * */
    getWorkspace() {
        return this.workspace;
    }

    /**
     * 
     * 
     * @param {directory} dir
     */
    setWorkspace(dir) {
        this.workspace = dir;
        this.emit(dir, this.WORKSPACE, this.DIRECTORY);
    }

    /**
     * @param {JSON} json representation of the worksapce state
     * */
    saveWorkspace(json) {
        return Rx.Observable.of(true)
            .mergeMap(() => {
                if (this.workspace && this.workspace.canWrite()) {
                    return this.workspace.write("tour.json", JSON.stringify(json, null, 4));
                }
                return Rx.Observable.throw();
            })
            .catch(() => {
                return this.saveWorkspaceAs(json);
            });
    }

    /**
    * @param {JSON} json representation of the worksapce state
    * */
    saveWorkspaceAs(json) {
        var blob = new Blob([JSON.stringify(json, null, 4)], { type: "text/json" });
        if (this.acc instanceof webkitAccessor)
            return filesystem.saveByDownload("tour.json", blob);

        return this.acc.selectNewFilePath()
            .mergeMap(path => this.workspace.write(path, blob));
    }

    /**
    * Create a file and offer it for download
    *
    * @param {Blob} content
    */
    static saveByDownload(name, blob) {
        var saveData = (function () {
            var a = document.createElement("a");
            document.body.appendChild(a);
            a.style = "display: none";
            return function (fileName, data) {
                var url = window.URL.createObjectURL(data);
                a.href = url;
                a.download = fileName;
                a.click();
                window.URL.revokeObjectURL(url);
            };
        }());

        saveData(name, blob);
    }

    toNode() {
        if (!this.node)
            this.node = {
                id: "root",
                text: "root",
                children: true,
                icon: "jstree-folder",
                state: {
                    opened: false,
                    disabled: true
                }
            };
        return this.node;
    }

    /**
     * 
     * @param {vertex | background} v
     * @param {webkitfile} f
     */
    link(v, f) {
        if (f.equals(v.image.file)) {
            if (v instanceof background)
                v.background = f;
            else
                f.vertex = v;

            file.prototype.usedFiles.add(f.getPath());
            return;
        }

        if (v.image.file) {
            this.unlink(v);
        }

        v.image.file = f;
        v.image.directory = f.getParent();
        let imgConf = v.getImageConfig();
        let path = f.getPath(imgConf.directory);
        if (v instanceof background) {
            v.image.path = path;
        } else {
            v.path = path;
            delete v.image.path;
        }

        if (v instanceof background)
            v.background = f;
        else
            f.vertex = v;

        file.prototype.usedFiles.add(f.getPath());

        this.emit(v, this.LINK);
    }

    /**
     * Removes the link between vertex and webkitfile.
     * 
     * @param {vertex} v
     */
    unlink(v) {
        if (v.image.file == null && v.image.directory == null)
            return;

        if (v.image.file.vertex === v) {
            file.prototype.usedFiles.delete(v.image.file.getPath());
            delete v.image.file.vertex;
        }
        delete v.image.file;
        delete v.image.directory;

        this.emit(v, this.UNLINK);
    }

    /**
     * 
     * @param {string} parentPath - left hand side of concatenation
     * @param {string} childPath - right hand side of concatenation (prefixed by '/' if necessary)
     * @param {any} prefix - inserted after the last '/' (or at the beginning)
     * @returns {string}
     */
    static concatPaths(parentPath = "", childPath = "", prefix = "") {
        parentPath = parentPath.replace(/\\/g, '/');
        childPath = childPath.replace(/\\/g, '/');
        prefix = prefix.replace(/\\/g, '/');

        var path = parentPath;
        if (path[path.length - 1] != '/' && childPath.length && childPath[0] !== '/' && parentPath.length) {
            path += '/';
        }
        path += childPath;

        let idxLastSlash = path.lastIndexOf("/");
        if (idxLastSlash == -1)
            return prefix + path;
        else {
            return path.slice(0, idxLastSlash + 1) + prefix + path.slice(idxLastSlash + 1, path.length);
        }
    }

    /**
     * checks specified directories for existence
     * and provides handles via webkitdirectory attribute in sg.images and sg.thumbnails
     * @param {spatialGroup} sg
     * @returns {Rx.Observable<spatialGroup>}
     */
    prepareDirectoryAccess(sg) {
        sg.directory = sg.directory || this.getWorkspace();

        var obs = Rx.Observable.of(sg);

        var imgPath = filesystem.concatPaths(sg.path, sg.images.path);
        if (!imgPath || imgPath.length == 0) {
            sg.images.directory = sg.directory;
        } else {
            obs = sg.directory.searchDirectory(imgPath)
                .do(dir => sg.images.directory = dir);
        }

        obs = obs.mergeMap(() => {
            if (this.trackChanges && sg.images.directory.canTrackChanges())
                return sg.images.directory.trackChanges()
                    .defaultIfEmpty(null)
                    .last();
            else
                return Rx.Observable.of(sg);
        })

        var thumbPath = filesystem.concatPaths(sg.path, sg.thumbnails.path);
        if (!thumbPath || thumbPath.length == 0) {
            obs = obs.do(() => sg.thumbnails.directory = sg.images.directory);
        } else {
            obs = obs.mergeMap(() => sg.directory.searchDirectory(thumbPath))
                .do(dir => sg.thumbnails.directory = dir);
        }

        return obs
            .mapTo(sg);
    }

    /**
     * checks specified files for existence
     * and provides handles via file attribute in v.image and v.thumbnail
     * @param {vertex|background} v
     * @returns {Rx.observable<vertex>}
     */
    prepareFileAccess(v) {
        if (v.path == null && v.image.path == null)
            throw new error(this.ERROR.INVALID_PATH, '""');

        var obs = Rx.Observable.of(v);
        var imgConfig = v.getImageConfig();

        var root = imgConfig.directory || this.getWorkspace();
        var path = filesystem.concatPaths(v.path, imgConfig.path, imgConfig.prefix);

        if (v.type === vertex.prototype.PANORAMA && v.data && v.data.type && v.data.type.startsWith('multires')) {
            if (!v.image.directory)
                obs = root.searchDirectory(path)
                    .do(dir => v.image.directory = dir);
        } else {
            if (!imgConfig.file) {
                obs = root.searchFile(path);

                if (this.requestMissingFiles)
                    obs = obs.catch((err, caught) => {

                        return root.searchDirectory(path.split("/").slice(0, -1).join('/'))
                            .delay(100) // prevent UI bugs, e.g. pop up window does not appear
                            .mergeMap(parent => this.request({
                                name: path.split("/").pop(),
                                parent: parent,
                                multi: false,
                                filter: {
                                    folders: false,
                                    files: true
                                }
                            }))
                            .defaultIfEmpty(null)
                            .map(f => {
                                if (f == null)
                                    throw err;
                                this.link(v, f);
                                return f;
                            })
                            .first();
                    });

                obs = obs.do(f => this.link(v, f));
            }


            var thumbConfig = v.getThumbConfig();
            if (thumbConfig && !thumbConfig.file) {
                var thumbRoot = thumbConfig.directory || this.getWorkspace(); // do not use the same variable names as above
                var thumbPath = filesystem.concatPaths(v.path, thumbConfig.path, thumbConfig.prefix);
                obs = obs.mergeMap(() => thumbRoot.searchFile(thumbPath)
                    .do(f => {
                        v.thumbnail.file = f;
                        v.thumbnail.directory = f.getParent();
                    })
                    .catch((err, caught) => Rx.Observable.of(v))
                );
            }
        }

        return obs.mapTo(v);
    }

    /**
     *
     * @param {vertex} v
    * @returns {Rx.observable<vertex>}
     */
    loadImage(v) {
        return this.prepareFileAccess(v)
            .mergeMap(v => v.image.file.readAsImage())
            .do(i => v.image.file.img = i)
            .mapTo(v);
    }

    /**
     * 
     * @param {JSON} options
     * @param {string} [options.name]
     * @param {webkitdirectory} [options.parent]
     * @param {boolean} [options.multi]
     * @param {boolean} [options.filter.files]
     * @param {boolean} [options.filter.folders]
     * @returns {Rx.observable<webkitfile>}
     */
    request(options) {


        return this.acc.request(options);
    }

    /**
     * @param {string} path  absolute path refering to a directory or file
     * @return {Rx.Observable<directory>}
     */
    resolvePath(path) {
        path = path.replace(/\\/g, '/');
        if (path.split('/').pop().indexOf('.') != -1)
            path = path.split('/').slice(0, -1).join('/');

        if (!directory.isRemotePath(path) && window.resolveLocalFileSystemURL)
            return cordovadirectory.resolve(path)
                .map(handle => cordovadirectory.handleToEntry(handle));
        else if (directory.isRemotePath(path)) {
            if (path.split('/').pop().indexOf('.') >= 0)
                return remotefile.fromPath(path);
            else
                return Rx.Observable.of(new remotedirectory(path));
        }
        else
            return Rx.Observable.throw(new error(directory.prototype.ERROR.DIRECTORY_NOT_FOUND, "", path));
    }


    /*
 * @return {Rx.Observable<directory>} Directory the application resides
 */
    getApplicationDirectory() {
        if (window.cordova && window.cordova.file && window.cordova.file.applicationDirectory) {
            var path = window.cordova.file.applicationDirectory;
            var folders = path.replace(/\\/g, '/').split('/');
            if (folders.length > 1) {
                var lastFolder = folders.pop() || folders.pop();
                if (lastFolder !== 'www' && lastFolder !== 'app.asar')
                    path = filesystem.concatPaths(path, platform.isElectron ? 'app.asar' : 'www');
            }

            return this.resolvePath(path);
        }

        else
            return this.resolvePath(window.location.href)
                .map(entry => entry instanceof file ? entry.getParent() : entry);
    }
}

filesystem.prototype.LINK = "link file";
filesystem.prototype.UNLINK = "unlink file";
filesystem.prototype.UPDATE = "unlink file";
filesystem.prototype.WORKSPACE = "update workspace";
filesystem.prototype.DIRECTORY = "directory";