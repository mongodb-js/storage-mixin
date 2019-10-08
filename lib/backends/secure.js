var inherits = require('util').inherits;
var BaseBackend = require('./base');
var _ = require('lodash');
var debug = require('debug')('mongodb-storage-mixin:backends:secure');
var warn = function(...args) {
  console.warn.apply(console, [].concat(`${debug.namespace}: `, args));
};

var keytar = require('keytar');

function SecureBackend(options) {
  if (!(this instanceof SecureBackend)) {
    return new SecureBackend(options);
  }

  options = _.defaults(options, {
    appName: 'storage-mixin'
  });

  this.namespace = options.appName + '/' + options.namespace;
}
inherits(SecureBackend, BaseBackend);

/**
 * Clear the entire namespace. Use with caution!
 *
 * @param {String} namespace
 * @param {Function} done
 */
SecureBackend.clear = function(namespace, done) {
  var serviceName = `storage-mixin/${namespace}`;
  debug('Clearing all secure values for', serviceName);
  try {
    var promise = keytar.findCredentials(serviceName);
  } catch (e) {
    console.error('Error calling findCredentials', e);
    throw e;
  }

  promise
    .then(function(accounts) {
      debug(
        'Found credentials',
        accounts.map(function(credential) {
          return credential.account;
        })
      );
      return Promise.all(
        accounts.map(function(entry) {
          var accountName = entry.account;
          return keytar
            .deletePassword(serviceName, accountName)
            .then(function() {
              debug('Deleted account %s successfully', accountName);
              return accountName;
            })
            .catch(function(err) {
              console.error('Failed to delete', accountName, err);
              throw err;
            });
        })
      );
    })
    .then(function(accountNames) {
      debug(
        'Cleared %d accounts for serviceName %s',
        accountNames.length,
        serviceName,
        accountNames
      );
      done();
    })
    .catch(function(err) {
      console.error('Failed to clear credentials!', err);
      done(err);
    });
};

/**
 * Remove the passwords properties for a model from the OS keychain.
 *
 * @param {ampersand-model} model
 * @param {Object} options
 * @param {Function} done
 *
 * @see http://ampersandjs.com/docs#ampersand-model-destroy
 */
SecureBackend.prototype.remove = function(model, options, done) {
  var accountName = this._getId(model);
  var serviceName = this.namespace;

  keytar
    .deletePassword(serviceName, accountName)
    .then(function() {
      debug('Removed password for', {
        service: serviceName,
        account: accountName
      });
      done();
    })
    .catch(done);
};

/**
 * Update the passwords properties for a model in the OS keychain.
 *
 * @param {ampersand-model} model
 * @param {Object} options
 * @param {Function} done
 *
 * @see http://ampersandjs.com/docs#ampersand-model-save
 */
SecureBackend.prototype.update = function(model, options, done) {
  var serviceName = this.namespace;
  var accountName = this._getId(model);
  var serialized = this.serialize(model);

  if (Object.keys(serialized).length === 0) {
    warn('UPDATE CALLED WITH EMPTY {}. Removing');
    return this.remove(model, options, done);
  }

  var value = JSON.stringify(serialized);
  keytar
    .setPassword(serviceName, accountName, value)
    .then(function() {
      debug('Updated password successfully for', {
        service: serviceName,
        account: accountName
      });
      done();
    })
    .catch(function(err) {
      done(err);
    });
};

/**
 * Add the passwords properties for a model in the OS keychain.
 *
 * @param {ampersand-model} model
 * @param {Object} options
 * @param {Function} done
 *
 * @see http://ampersandjs.com/docs#ampersand-model-save
 */
SecureBackend.prototype.create = function(model, options, done) {
  var serviceName = this.namespace;
  var accountName = this._getId(model);
  var serialized = this.serialize(model);
  if (Object.keys(serialized).length === 0) {
    warn('CREATER CALLED WITH EMPTY {}. Refusing to persist.');
    return done();
  }

  var value = JSON.stringify(serialized);

  keytar
    .setPassword(serviceName, accountName, value)
    .then(function() {
      debug('Successfully created password for', {
        service: serviceName,
        account: accountName
      });

      done();
    })
    .catch(function(err) {
      done(err);
    });
};

/**
 * Load the passwords properties for a model from the OS keychain.
 *
 * @param {ampersand-model} model
 * @param {Object} options
 * @param {Function} done
 * @return {None}
 *
 * @see http://ampersandjs.com/docs#ampersand-model-fetch
 */
SecureBackend.prototype.findOne = function(model, options, done) {
  var serviceName = this.namespace;
  var accountName = this._getId(model);

  keytar
    .getPassword(serviceName, accountName)
    .then(function(rawJsonString) {
      if (!rawJsonString) {
        debug('findOne failed. No value found', {
          service: serviceName,
          account: accountName
        });

        return done(null, {});
      }

      if (rawJsonString === '{}') {
        warn('FINDONE GOT EMPTY OBJECT STRING. REMOVING.');
        return this.remove(model, options, done);
      }

      debug('findOne successful', {
        service: serviceName,
        account: accountName
      });

      done(null, JSON.parse(rawJsonString));
    })
    .catch(done);
};

/**
 * Fetch all keys stored under the active namespace.
 *
 * Note: keytar does not have the ability to return all keys for a given
 * namespace (service). Thus this only works if the collection is
 * pre-populated with stub models that hold their ids already.
 *
 * For merging secure data correctly in the splice backend, we also return
 * the id value again for each object even though that information is not
 * stored as part of the secure data.
 *
 * @param {ampersand-collection} collection
 * @param {Object} options
 * @param {Function} done
 * @return {None}
 *
 * @see http://ampersandjs.com/docs#ampersand-collection-fetch
 */
SecureBackend.prototype.find = function(collection, options, done) {
  debug('Fetching data...', collection.length);
  keytar
    .findCredentials(this.namespace)
    .then(credentials => {
      debug(
        '%d credentials found in namespace %s',
        credentials.length,
        this.namespace
      );

      var attributes = collection.reduce(function(attrs, model) {
        var modelId = model.getId();
        var credential = credentials.find(function(credential) {
          return credential.account === modelId;
        });
        if (!credential) {
          warn('%s MODEL ID HAS FALSEY CREDENTIAL', modelId);
          attrs.push(attr);
          return attrs;
        }

        if (credential.password === '{}') {
          warn('FIND: %s MODEL ID GOT EMPTY OBJECT STRING.', modelId);
        }

        var attr = {};
        attr[model.idAttribute] = modelId;
        var password = JSON.parse(credential.password);
        _.assign(attr, password);
        attrs.push(attr);
        return attrs;
      }, []);
      return done(null, attributes);
    })
    .catch(done);
};

module.exports = SecureBackend;
