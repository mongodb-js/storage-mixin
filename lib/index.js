var backends = require('./backends');

/**
 * storage-mixin
 *
 * Use this mixin with Ampersand models and collections to easily persist
 * them to a number of different storage backends.
 */
module.exports = {
  storage: 'local',
  session: {
    fetched: {
      type: 'boolean',
      required: false,
      default: false
    },
    modified: {
      type: 'boolean',
      required: false,
      default: true
    }
  },
  _initializeMixin: function() {
    var storage = (typeof this.storage === 'object') ? this.storage : {
      backend: this.storage
    };
    storage.namespace = this.namespace;

    // replace storage with object in all cases
    this.set('storage', storage, {silent: true});
    this._storageBackend = new backends[storage.backend](storage);
    this.on('change', this._setModified.bind(this));
  },
  _setModified: function() {
    this.modified = true;
  },
  sync: function(method, model, options) {
    if (!this._storageBackend) {
      this._initializeMixin();
    }
    var self = this;
    var success = options.success;
    options.success = function(resp) {
      if (success) {
        self.fetched = true;
        self.dirty = false;
        success.call(self, resp);
      }
    };
    this.fetched = false;
    this._storageBackend.exec(method, model, options);
  }
};
