const assert = require('assert');
const {
  describe,
  it,
  before
} = require('mocha');

const { sequelize } = require('../lib/db');
const entrypoints   = require('../lib/entrypoints');


describe('entrypoints.device-create', function() {
  before(function() {
    this.timeout(3000);
    return sequelize.sync();
  });

  it('yield the newly created device entry', done => {
    const context = { credentials: { key: "testmobile" } };
    entrypoints["device-create"]({}, context)
      .then(device => {
        assert(device);
        assert(device.id);
        assert(device.secret);
        done();
      })
      .catch(done);
  });

  it('rejects a non-mobile application key', done => {
    const context = { credentials: { key: "testbrowser" } };
    entrypoints["device-create"]({}, context)
      .then(() => assert.fail("didn't reject invalid key"),
            () => done())
      .catch(done);
  });

  it('saves the parameters given', done => {
    const context = { credentials: { key: "testmobile" } };
    entrypoints["device-create"]({ nickname: "aaa", avatar: "bbb" }, context)
      .then(device => {
        assert(device);
        assert.equal(device.nickname, "aaa");
        assert.equal(device.avatar, "bbb");
        done();
      })
      .catch(done);
  });
});

describe('entrypoints.device-update-single', function() {
  const context = {
    credentials: {
      key: "testmobile",
      secret: "fake"
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
      });
  });

  it('should fail if the secret given is invalid', done => {
    entrypoints["device-update-single"]({ id: device.id }, context)
      .then(() => assert.fail("didn't reject fake secret"),
            err => {
              if (err.status === 401) return done();
              assert.fail("did't reject fake secret");
            })
      .catch(done);
  });

  it('should update the fields correctly', done => {
    entrypoints["device-update-single"](
      { id: device.id, nickname: "ccc", avatar: "ddd" },
      { credentials: Object.assign(
        {}, context.credentials, { secret: device.secret }) })
      .then(d => {
        assert(d);
        assert.equal(d.nickname, "ccc");
        assert.equal(d.avatar, "ddd");
        assert(!d.secret);
        done();
      })
      .catch(done);
  });

  it('should reject an attempt to update another device', done => {
    entrypoints["device-create"]({ nickname: "aaa" }, context)
      .then(another => entrypoints["device-update-single"](
        { id: another.id, nickname: "ccc", avatar: "ddd" },
        { credentials: Object.assign(
          {}, context.credentials, { secret: device.secret }) })
            .then(() => assert.fail("updated another device"),
                  () => done()))
      .catch(done);
  });
});

describe('entrypoints.device-fetch-single', function() {
  const context = { credentials: { key: "testmobile" } };
  let device;

  before(function() {
    this.timeout(3000);
    return sequelize.sync()
      .then(() => entrypoints["device-create"]({ nickname: "aaa" }, context))
      .then(dev => {
        device = dev;
      });
  });

  it('should fetch a persistent device', done => {
    entrypoints["device-fetch-single"](
      { id: device.id },
      { credentials: { key: "testbrowser" } })
      .then(dev => {
        assert(dev);
        assert.equal(device.id, dev.id);
        assert.equal(device.nickname, dev.nickname);
        assert(!dev.secret);
        done();
      })
      .catch(done)
  });

  it('should fail to fetch a non-existent device', done => {
    entrypoints["device-fetch-single"](
      { id: "e806811a-f83c-4ce2-bd59-ace57ff3a4ae" },
      { credentials: { key: "testbrowser" } })
      .then(() => assert.fail("didn't fail to find non-existent device"),
            err => {
              if (err.status === 404) return done();
              assert.fail("did't fail to find fake device");
            })
      .catch(done);
  });
});
