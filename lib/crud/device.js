const _          = require('lodash');
const { models } = require('../db');
const {
  expect,
  accept,
  optionally,
  ensureExists,
  validUUID
} = require('../utils');


module.exports = {
  read: args => expect(args, ['id'])
    .then(validUUID('id'))
    .then(({ id }) => models.Device.findById(id))
    .then(ensureExists("device")),

  create: args => accept(
    args,
    [
      'token',
      'os',
      'nickname',
      'avatar'
    ])
    .then(data => models.Device.create(data)),

  update: args => expect(args, ['id'])
    .then(validUUID('id'))
    .then(optionally(
      args,
      [
        'token',
        'os',
        'nickname',
        'avatar'
      ]))
    .then(data => models.Device.findById(data.id)
          .then(ensureExists("device"))
          .then(device => device.update(_.omit(data, 'id'))))
};
