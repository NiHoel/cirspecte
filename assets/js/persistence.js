'use strict';

/**
 * Handles autosaving and the confirmation dialog before leaving
 * 
 * */
class persistence {
    get [Symbol.toStringTag]() {
        return 'Command History';
    }

    constructor(modules) {
        this.modules = modules;
        this.saveError = ko.observable("");

        var obs = [];


        // logic for save buttons
    if (document.querySelector('#save-workspace'))
            obs.push(Rx.Observable.fromEvent(document.querySelector('#save-workspace'), 'click')
                .mergeMap(() => this.getSaveObservable())
            );

        if (document.querySelector('#save-workspace-as'))
            obs.push(Rx.Observable.fromEvent(document.querySelector('#save-workspace-as'), 'click')
                .mergeMap(() => modules.filesys.saveWorkspaceAs(modules.alg.stateToJson()))
            );

        if (document.querySelector('#backup-tour'))
            obs.push(Rx.Observable.fromEvent(document.querySelector('#backup-tour'), 'click')
                .mergeMap(() => modules.filesys.saveWorkspaceAs(modules.alg.stateToJson()))
            );

        if (document.querySelector('#save-workspace') && (document.querySelector('#save-workspace-as')))
            obs.push(modules.filesys.observe(modules.filesys.DIRECTORY, modules.filesys.WORKSPACE)
                .do(workspace => {
                    if (workspace.canWrite()) {
                        $('#save-workspace-as').hide();
                        $('#save-workspace').show();
                    }
                })
            );


        // unloading
        var saveRequired = () => modules.filesys.getWorkspace() && (!modules.hist || modules.hist.dirty);
        var autoSave = () => modules.settings.autoSave();
        if (platform.isBrowser) {
            $(window).bind('beforeunload', e => {
                if (saveRequired()) {
                    return 'Are you sure you want to leave? All unsaved changes will be lost!';
                }
            });
        } else if (platform.isElectron) {
            window.onbeforeunload = (e) => {
                if (this.quit)
                    return;

                if (saveRequired()) {
                    if (autoSave()) {
                        this.getSaveObservable()
                            .subscribe({
                                complete: () => this.forceClose(),
                                error: err => this.openLeaveConfirmation(err)
                            })
                    } else {
                        this.openLeaveConfirmation();
                    }
                    e.returnValue = false;
                }
            }
        } else if (platform.isCordova) {
            obs.push(Rx.Observable.fromEvent(document, 'pause')
                .filter(() => autoSave() && saveRequired())
                .mergeMap(() => getSaveObservable())
            );
        }

        for (let r of obs) {
            r.catch((err, caught) => {
                console.log(err);
                modules.logger.log(err);
                return caught;
            }).subscribe();
        }

        if (autoSave())
            this.createAutoSaveHandle();

        modules.settings.autoSave.subscribe(enabled => {
            if (enabled)
                this.createAutoSaveHandle();
            else {
                this.autoSaveSubscription.unsubscribe();
                delete this.autoSaveSubscription;
            }
        })
        modules.settings.autoSaveInterval.subscribe(() => this.createAutoSaveHandle());

        if ($('#leave-confirmation-dialog').length)
            ko.applyBindings(this, $('#leave-confirmation-dialog')[0]);
    }

    getSaveObservable() {
        return this.modules.filesys.saveWorkspace(modules.alg.stateToJson())
            .do(() => {
                if (this.modules.hist)
                    this.modules.hist.dirty = false;
            });
    }

    /**
     * @private
     * @returns void
     * */
    openLeaveConfirmation(err = null) {
        if (err)
            this.saveError(logger.errorToString(err));
        else
            this.saveError("");

        if ($('#leave-confirmation-dialog').length)
            $('#leave-confirmation-dialog').modal("show");


    }

    /**
     *  @private
     * */
    save() {
        this.getSaveObservable()
            .subscribe({
                complete: () => this.forceClose(),
                error: err => this.openLeaveConfirmation(err)
            });
    }

    /**
     *  @private
     * */
    forceClose() {
        this.quit = true;
        window.close();
    }

    /**
     *  @private
     */
    createAutoSaveHandle() {
        if (this.autoSaveSubscription)
            this.autoSaveSubscription.unsubscribe();

        this.autoSaveSubscription = Rx.Observable.interval(this.modules.settings.autoSaveInterval() * 60000)
            .filter(() => this.modules.filesys.getWorkspace() && this.modules.filesys.getWorkspace().canWrite() && (!modules.hist || modules.hist.dirty))
            .mergeMap(() => this.getSaveObservable())
            .catch((err, caught) => {
                console.log(err);
                this.modules.logger.log(err);
                return caught;
            }).subscribe();
    }
};