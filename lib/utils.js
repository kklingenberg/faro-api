const _      = require('lodash');
const errors = require('./errors');


module.exports = {
  expect: (data, props) => {
    const extracted = _(props || [])
          .map(prop => [prop, data[prop]])
          .fromPairs()
          .value();
    if (_.some(extracted, _.isUndefined)) {
      return Promise.reject(
        errors.badParameters("some required parameters are missing",
                             { required: props }));
    }
    return Promise.resolve(extracted);
  },

  accept: (data, props) => {
    return Promise.resolve(
      _(props || [])
        .map(prop => [prop, data[prop]])
        .filter(pair => !_.isUndefined(pair[1]))
        .fromPairs()
        .value());
  },

  optionally: (args, props) => extracted => module.exports.accept(args, props)
    .then(optional => _.assign(extracted, optional)),

  ensureExists: entityName => entity => (
    entity ?
      entity :
      Promise.reject(errors.notFound(`${entityName} not found`))),

  validUUID: (...fields) => args => {
    const badFormed = _(fields)
          .map(f => [f, args[f]])
          .filter(pair => !_.isUndefined(pair[1]))
          .filter(pair => !(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i).test(pair[1]))
          .value();
    if (badFormed.length > 0) {
      return Promise.reject(
        errors.badParameters("invalid uuid given",
                             { fields: _.fromPairs(badFormed) }));
    }
    return args;
  }
};
