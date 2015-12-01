var storageMixin = require('../lib');
var assert = require('assert');
var helpers = require('./helpers');

var StorableUser = helpers.User.extend(storageMixin, {
  storage: 'disk'
});

describe('.fetched property', function() {
  var user;
  beforeEach(function() {
    user = new StorableUser({
      id: 'apollo',
      name: 'Lee Adama',
      email: 'apollo@galactica.com',
      password: 'cyl0nHunt3r'
    });
  });

  it('should not be `fetched` before running .fetch()', function() {
    assert.equal(user.fetched, false);
  });

  it('should be `fetched` after `sync` event', function(done) {
    user.on('sync', function() {
      assert.ok(user.fetched);
      done();
    });
    user.fetch();
  });
});
