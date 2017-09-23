const assert = require('assert');
const {
  describe,
  it,
  before
} = require('mocha');

const { sequelize } = require('../lib/db');
const entrypoints   = require('../lib/entrypoints');


describe('entrypoints.notification-create', function() {
  const context = {
    credentials: {
      key: "testmobile",
    }
  };
  let device;
  before(function() {
    this.timeout(3000);
    return sequelize.sync()
      .then(() => entrypoints["device-create"]({ nickname: "aaa" }, context))
      .then(dev => {
        device = dev;
        context.credentials.deviceId = dev.id;
        context.credentials.secret = dev.secret;
      });
  });

  it('should reject insufficient parameters', done => {
    entrypoints["notification-create"]({ device_id: device.id }, context)
      .then(() => assert.fail("didn't reject too few parameters"),
            err => {
              if (err.status === 400) return done();
              assert.fail("didn't reject too few parameters");
            })
      .catch(done)
  });

  it('should reject two consecutive attempts from the same device', done => {
    entrypoints["notification-create"](
      {
        device_id: device.id,
        lat: 1,
        lng: 2,
        kind: "pos",
        comment: "testing"
      },
      context)
      .then(not => {
        assert(not);
        assert.equal(not.kind, "pos");
        assert.equal(not.comment, "testing");
        assert.equal(not.lat, 1);
        assert.equal(not.lng, 2);
      })
      .then(() => entrypoints["notification-create"](
        {
          device_id: device.id,
          lat: 3,
          lng: 4,
          kind: "pos",
          comment: "more testing"
        },
        context)
            .then(() => assert.fail("should have failed to notify twice"),
                  err => {
                    if (err.status === 400) return done();
                    assert.fail("should have failed to notify twice");
                  }))
      .catch(done);
  });
});

describe('entrypoints.notification-rate-single', function() {
  const context = {
    credentials: {
      key: "testmobile",
    }
  };
  let device1;
  let device2;
  let notification;
  before(function() {
    this.timeout(3000);
    return sequelize.sync()
      .then(() => Promise.all([
        entrypoints["device-create"]({ nickname: "aaa" }, context),
        entrypoints["device-create"]({ nickname: "bbb" }, context)
      ]))
      .then(([dev1, dev2]) => {
        device1 = dev1;
        device2 = dev2;
        context.credentials.deviceId = dev1.id;
        context.credentials.secret = dev1.secret;
        return entrypoints["notification-create"](
          {
            device_id: device2.id,
            lat: 1,
            lng: 2,
            kind: "pos",
            comment: "testing"
          },
          { credentials: Object.assign({}, context.credentials, {
            deviceId: device2.id,
            secret: device2.secret
          }) });
      })
      .then(not => { notification = not; });
  });

  it('should reject an attempt to rate an owned notification', done => {
    entrypoints["notification-rate-single"](
      { device_id: device2.id,
        id: notification.id,
        positive: true },
      { credentials: Object.assign({}, context.credentials, {
        deviceId: device2.id,
        secret: device2.secret }) })
      .then(() => assert.fail("allowed rating the owned notification"),
            err => {
              if (err.message === "notification is owned by device") return done();
              assert.fail("didn't fail as expected");
            })
      .catch(done);
  });

  it("should properly update a notification", done => {
    entrypoints["notification-rate-single"](
      { device_id: device1.id,
        id: notification.id,
        positive: true },
      context)
      .then(not => {
        assert(not);
        assert.notEqual(not.created_at.toJSON(), not.relevant_at.toJSON());
        done();
      })
      .catch(done);
  });
});
