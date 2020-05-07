'use strict';

/**
 * Displays errors and messages to the user
 * */
class logger extends observable {
    get [Symbol.toStringTag]() {
        return 'Logger';
    }

    /**
     * 
     * @param {JSON} config
     */
    constructor(config = {}) {
        super();
        this.logs = ko.observableArray();
        this.logCount = ko.pureComputed(() => this.logs().length);
        this.hasLogs = ko.pureComputed(() => this.logs().length > 0);

        ko.applyBindings(this, $('#log-count')[0]);
        ko.applyBindings(this, $('#logs-dialog')[0]);
    }

    /**
     * 
     * @param {string | error | warning} message
     */
    log(message) {
        if (message instanceof error || message instanceof warning)
            this.logs.push(message);
        else if (typeof message !== 'object')
            this.logs.push(new error(null, message));
        else
            this.logs.push(new error(null, message.description || "unknown error", error));
    }

    /**
     * @private
     * @param {error} err
     * @returns {string}
     */
    static errorToString(err) {
        var res = "";
        if (err.type)
            res += err.type + ": ";
        if (err.message) {
            res += err.message;
            if (err.data)
                if (typeof err.data === 'object')
                    res += JSON.stringify(err.data, null, 4);
                else
                    res += '(' + err.data + ')';
        } else {
            res += err.data;
        }
        return res;
    }

    clear() {
        this.logs.removeAll();
    }
}
