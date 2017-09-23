const _      = require('lodash');
const moment = require('moment');
const config = require('../config');
const {
  sequelize,
  models
} = require('../db');
const errors = require('../errors');
const {
  expect,
  optionally,
  validUUID
} = require('../utils');


module.exports = {
  read: args => expect(
    args,
    [
      'lat_gte',
      'lat_lte',
      'lng_gte',
      'lng_lte'
    ])
    .then(optionally(
      args,
      [
        'kind',
        'date',
        'device_id',
        'count',
        'order' // score, date
      ]))
    .then(validUUID('device_id'))
    .then(data => {
      const query = [
        { lat: { $gte: data.lat_gte } },
        { lat: { $lte: data.lat_lte } },
        { lng: { $gte: data.lng_gte } },
        { lng: { $lte: data.lng_lte } }
      ];
      let date = data.date;
      if (!date || !moment(date).isValid()) {
        date = new Date();
      }
      query.push({ created_at: { $lte: date } });
      query.push({ relevant_at: {
        $gte: moment(date)
          .subtract(config.RELEVANCE_WINDOW, 'minutes')
          .toDate()
      } });
      if (typeof data.kind === "string") {
        query.push({ kind: data.kind.toLowerCase() });
      }
      if (typeof data.device_id === "string") {
        query.push({ kind: data.device_id });
      }
      return models.Notification.findAll(_.assign(
        {
          where: { $and: query },
          limit: typeof data.count === "number" ?
            Math.trunc(Math.min(Math.max(data.count, 1), config.QUERY_LIMIT)) :
            config.QUERY_LIMIT
        },
        ("score" === data.order ?
         { order: [["score", "desc"], ["created_at", "desc"]] } :
         { order: [["created_at", "desc"]] })));
    }),

  create: args => expect(
    args,
    [
      'lat',
      'lng',
      'kind',
      'device_id'
    ])
    .then(validUUID('device_id'))
    .then(optionally(args, ['comment']))
    .then(data => sequelize.transaction(
      transaction => models.Device.findOne({
        where: {
          id: data.device_id,
          $or: [
            { last_notification: null },
            { last_notification: {
              $lt: moment()
                .subtract(config.WAITING_INTERVAL, 'minutes')
                .toDate()
            } }
          ]
        },
        transaction
      })
        .then(device => {
          if (!device) return Promise.reject(
            errors.badParameters("device must wait to notify again",
                                 { mustWait: true }));
          return models.Notification.create(data, { transaction })
            .then(notification => device.update(
              { last_notification: new Date() },
              { transaction })
                  .then(() => notification));
        }))),

  rate: args => expect(
    args,
    [
      'id',
      'device_id',
      'positive'
    ])
    .then(validUUID('id', 'device_id'))
    .then(data => sequelize.transaction(
      transaction => Promise.all([
        models.Notification.findOne({
          attributes: ['id', 'device_id'],
          where: {
            id: data.id,
            relevant_at: {
              $gte: moment()
                .subtract(config.RELEVANCE_WINDOW + 1, 'minutes')
                .toDate()
            }
          },
          transaction
        }),
        models.Reaction.findOne({
          where: {
            device_id: data.device_id,
            notification_id: data.id
          },
          transaction
        })
      ])
        .then(([notification, reaction]) => {
          if (!notification) return Promise.reject(
            errors.notFound("notification not found"));
          if (notification.device_id === data.device_id) return Promise.reject(
            errors.badParameters("notification is owned by device"));

          if (reaction) return reaction.update(
            { positive: data.positive, date: new Date() },
            { transaction });
          return models.Reaction.create({
            positive: data.positive,
            notification_id: data.id,
            device_id: data.device_id
          }, { transaction });
        })
        .then(() => models.Notification.recomputeProperties({
          where: { id: data.id },
          transaction
        }))))
};
