
var lib = module.exports;

var _config = require("./config"),
    Promise = require("bluebird"),
    logger = require('./logger')

var flowFile = "flow.json"
var settingsFile = "settings.js"

var fallback = _config.get('storage', 'file')
var current = null

var storage = null

var types = {
    "file" : require("./storage/file"),
}

var FileNotFoundError = function(message) {
    this.name = 'FileNotFoundError';
    this.message = message || 'File not found';
}
FileNotFoundError.prototype = Object.create(Error.prototype)
FileNotFoundError.prototype.constructor = FileNotFoundError;

lib.FileNotFoundError = FileNotFoundError;

lib.addType = function(type, callback) {
    types[ type ] = callback;
}

lib.setup = function(type, config) {
    return new Promise(function(ok, ko) {

        type = type || current || fallback;
        config = config || {}

        if(!storage) {

            try {

                storage = types[ type ];

                if(storage === undefined) {
                    throw new Error("Storage type " + type + " does not exists")
                }

                if(storage.setup) {
                    return storage.setup(config).catch(ko).then(function() {

                        current = type;

                        return ok(storage)
                    })
                }
                else {
                    var msg = "Storage type "+ type +" must implement a setup method";
                    logger.error(msg)
                    return ko(new Error(msg))
                }

            }
            catch(e) {

                logger.error("Error loading storage type %s", type)
                logger.error(e)

                if(type !== fallback) {

                    logger.warn("Using default fallback %s", fallback)
                    current = null;
                    return lib.setup(fallback)
                }

                logger.error("Cannot load storage!")
                ko(e)
            }

        }
        else {
            ok(storage)
        }

    })
}

lib.remove = function(key, meta) {
    return lib.setup().then(function(storage) {

        if(!storage.remove) {
            var msg = "Storage type "+current+" must implement a remove method";
            logger.error(msg)
            return Promise.reject(new Error(msg))
        }

        return storage.remove(key, meta)
    })
}

lib.write = function(key, content, meta) {
    return lib.setup().then(function(storage) {

        if(!storage.write) {
            var msg = "Storage type "+current+" must implement a write method";
            logger.error(msg)
            return Promise.reject(new Error(msg))
        }

        return storage.write(key, content, meta)
    })
}

lib.read = function(key, meta) {
    return lib.setup().then(function(storage) {

        if(!storage.read) {
            var msg = "Storage type "+current+" must implement a read method";
            logger.error(msg)
            return Promise.reject(new Error(msg))
        }

        return storage.read(key, meta)
    })
}


lib.writeCache = function(data) {
    if(typeof data !== 'string') data = JSON.stringify(data)
    return lib.write(_config.get('cacheFileName'), data)
}

lib.readCache = function() {
    return lib.read(_config.get('cacheFileName'))
}

lib.writeFlowFile = function(instanceConfig, content) {
    lib.write('/' + instanceConfig.uid + '/' + flowFile, content)
}

lib.readFlowFile = function(instanceConfig) {
    lib.write('/' + instanceConfig.uid + '/' + flowFile)
}

lib.writeSettingsFile = function(instanceConfig) {
    var content = lib.loadSettingsFile(instanceConfig.settings)
    return storage.write('/' + instanceConfig.uid + '/' + settingsFile, content)
}

lib.loadSettingsFile = function(opts) {

    var loadSettings = function(opts, asString) {

        opts = opts || {}
        var obj = {}

        var _ = require('lodash')

        var defaults = require(_config.getRedPath() + '/settings')

        obj = _.assign(obj, defaults)
        obj = _.assign(obj, opts)

        return asString ? JSON.stringify(obj, null, 2) : obj
    }

    return "module.exports = " + loadSettings(opts, true)
}
