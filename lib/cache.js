const _      = require('lodash');
const moment = require('moment');


class DecayingCache {
  constructor (maxCount, maxDays) {
    this.maxCount = maxCount;
    this.maxDays = maxDays;
    this.store = new Map();
  }

  expireOld () {
    const oldKeys = [];
    for (let [key, entry] of this.store) {
      if (moment().diff(moment(entry.created), 'days', true) > this.maxDays) {
        oldKeys.push(key);
      }
    }
    _.forEach(oldKeys, k => this.store.delete(k));
  }

  has (key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (moment().diff(moment(entry.created), 'days', true) > this.maxDays) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  get (key) {
    this.expireOld();
    const storedValue = this.store.get(key);
    if (_.isUndefined(storedValue)) return null;
    if (storedValue.times > this.maxCount) {
      this.store.delete(key);
      return null;
    }
    if (storedValue.times === this.maxCount) {
      this.store.delete(key)
      return storedValue.value;
    }
    storedValue.times += 1;
    return storedValue.value;
  }

  set (key, value) {
    this.store.set(key, { times: 0, created: new Date(), value });
  }

  expire (key) {
    this.store.delete(key);
  }
}

module.exports = {
  DecayingCache,
  deviceCache: new DecayingCache(100, 2)
};
