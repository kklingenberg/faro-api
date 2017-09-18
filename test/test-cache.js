const assert           = require('assert');
const { describe, it } = require('mocha');

const { DecayingCache } = require('../lib/cache');


describe('DecayingCache', () => {
  const cache = new DecayingCache(5, 1 / 24 / 60 / 60 / 10); // 100 ms expiration
  const value = {};
  describe('#get', () => {
    it('should empty its store after reaching the fetch limit', () => {
      cache.set("a", value);
      for (let i = 0; i < 4; i++) cache.get("a");
      assert.strictEqual(cache.get("a"), value);
      assert(!cache.store.get("a"));
    });
    it('should expire a value according to the time limit', done => {
      cache.set("a", value);
      setTimeout(() => {
        assert.strictEqual(cache.get("a"), null);
        done();
      }, 101);
    });
  });
});
