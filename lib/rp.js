'use strict';

var request = require('request'),
    Bluebird = require('bluebird'),
    _ = require('lodash');


function ownCallback(err, httpResponse, body) {

    /* jshint validthis:true */
    var self = this;

    var origCallbackThrewException = false, thrownException;

    if (_.isFunction(self._rp_callbackOrig)) {
        try {
            self._rp_callbackOrig.apply(self, arguments);
        } catch (e) {
            origCallbackThrewException = true;
            thrownException = e;
        }
    }

    if (err) {
        self._rp_reject({
            error: err,
            options: self._rp_options,
            response: httpResponse
        });
    } else if (self._rp_options.simple && !(/^2/.test('' + httpResponse.statusCode))) {
        self._rp_reject({
            error: body,
            options: self._rp_options,
            response: httpResponse,
            statusCode: httpResponse.statusCode
        });
    } else {
        if (_.isFunction(self._rp_options.transform)) {
            try {
                self._rp_resolve(self._rp_options.transform(body, httpResponse));
            } catch (e) {
                self._rp_reject(e);
            }
        } else if (self._rp_options.resolveWithFullResponse) {
            self._rp_resolve(httpResponse);
        } else {
            self._rp_resolve(body);
        }
    }

    if (origCallbackThrewException) {
        throw thrownException;
    }

    // Mimic original behavior of errors emitted by request with no error listener registered
    if (err && self._rp_then_invoked !== true && self.listeners('error').length === 1) {
        throw err;
    }

}

var originalInit = request.Request.prototype.init;

request.Request.prototype.init = function (options) {

    var self = this;

    // Init may be called again - currently in case of redirects
    if (_.isPlainObject(options) && self._callback === undefined && self._rp_promise === undefined) {

        self._rp_promise = new Bluebird(function (resolve, reject) {
            self._rp_resolve = resolve;
            self._rp_reject = reject;
        });

        self._rp_callbackOrig = self.callback;
        self.callback = ownCallback;

        if (_.isString(options.method)) {
            options.method = options.method.toUpperCase();
        }

        self._rp_options = options;
        self._rp_options.simple = options.simple === false ? false : true;
        self._rp_options.resolveWithFullResponse = options.resolveWithFullResponse === true ? true : false;

    }

    return originalInit.apply(self, arguments);

};

request.Request.prototype.then = function (onFulfilled, onRejected) {
    this._rp_then_invoked = true;
    return this._rp_promise.then(onFulfilled, onRejected);
};

module.exports = request;
