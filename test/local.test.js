var storageMixin = require('../lib');
var LocalBackend = require('../lib/backends').local;
var assert = require('assert');
var helpers = require('./helpers');

// var debug = require('debug')('storage-mixin:test');

describe('storage backend `local`', function() {
  var backendOptions = {
    backend: 'local',
    driver: 'INDEXEDDB'
  };

  var StorableSpaceship;
  var StorableFleet;
  var StorablePlanet;

  StorableSpaceship = helpers.Spaceship.extend(storageMixin, {
    storage: backendOptions
  });

  StorableFleet = helpers.Fleet.extend(storageMixin, {
    model: StorableSpaceship,
    storage: backendOptions
  });

  StorablePlanet = helpers.Planet.extend(storageMixin, {
    storage: backendOptions
  });

  // clear namespaces of this backend before and after the tests
  before(function(done) {
    helpers.clearNamespaces('local', ['Spaceships', 'Planets'], done);
  });

  after(function(done) {
    helpers.clearNamespaces('local', ['Spaceships', 'Planets'], done);
  });

  after(function(done) {
    var fleet = new StorableFleet();
    fleet.once('sync', function() {
      assert.equal(fleet.length, 0);
      done();
    });
    fleet.fetch();
  });

  var spaceship;
  var fleet;
  beforeEach(function() {
    // instantiate a model of the storable class
    spaceship = new StorableSpaceship({
      name: 'Battlestar Galactica',
      enableJetpacks: true,
      warpSpeed: 1
    });
    fleet = new StorableFleet();
  });

  it('should update and read correctly', function(done) {
    if (LocalBackend.isNullBackend) {
      this.skip();
    }
    spaceship.save({warpSpeed: 3.14}, {
      success: function() {
        var otherSpaceship = new StorableSpaceship({
          name: 'Battlestar Galactica'
        });
        otherSpaceship.once('sync', function() {
          assert.equal(otherSpaceship.warpSpeed, 3.14);
          done();
        });
        otherSpaceship.fetch();
      },
      error: done
    });
  });

  it('should store a second model in the same namespace', function(done) {
    var secondSpaceship = new StorableSpaceship({
      name: 'Heart of Gold'
    });
    secondSpaceship.save(null, {
      success: done.bind(null, null),
      error: done
    });
  });

  it('should store a model in a different namespace', function(done) {
    var earth = new StorablePlanet({
      name: 'Earth',
      population: 7000000000
    });

    earth.save(null, {
      success: done.bind(null, null),
      error: done
    });
  });

  it('should create a new model in a collection', function(done) {
    fleet.once('sync', function() {
      done();
    });
    fleet.create({
      name: 'Serenity',
      enableJetpack: true
    });
  });

  it('should fetch collections', function(done) {
    if (LocalBackend.isNullBackend) {
      this.skip();
    }
    fleet.once('sync', function() {
      assert.equal(fleet.length, 3);
      done();
    });
    fleet.fetch();
  });

  it('should remove correctly', function(done) {
    if (LocalBackend.isNullBackend) {
      this.skip();
    }
    spaceship.destroy({
      success: function() {
        fleet.once('sync', function() {
          assert.equal(fleet.length, 2);
          done();
        });
        fleet.fetch();
      },
      error: done
    });
  });
});
