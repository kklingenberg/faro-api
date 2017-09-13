const moment     = require('moment');
const config     = require('../config');
const { models } = require('../db');
const cluster    = require('../cluster');
const errors     = require('../errors');
const {
  expect,
  accept,
  optionally,
  ensureExists,
  validUUID
} = require('../utils');


module.exports = {
  read: args => expect(args, ['since'])
    .then(optionally(args, ['until']))
    .then(data => {
      const since = data.since;
      if (!moment(since).isValid()) return Promise.reject(
        errors.badParameters("invalid 'since' date given"));
      let until = data.until;
      if (!until || !moment(until).isValid()) until = new Date();
      return models.Snapshot.findAll({
        where: {
          $and: [
            { date: { $gte: since } },
            { date: { $lte: until } }
          ]
        },
        limit: config.QUERY_LIMIT,
        order: [['date', 'desc']]
      });
    }),

  readSingle: args => expect(
    args,
    [
      'id',
      'lat_gte',
      'lat_lte',
      'lng_gte',
      'lng_lte'
    ])
        .then(validUUID('id'))
        .then(data => models.Snapshot.findById(data.id)
              .then(ensureExists('snapshot'))
              .then(snapshot => models.Cluster.findAll({
                where: {
                  snapshot_id: snapshot.id,
                  $not: {
                    $or: [
                      { south: { $gte: data.lat_lte } },
                      { north: { $lte: data.lat_gte } },
                      { west: { $gte: data.lng_lte } },
                      { east: { $lte: data.lng_gte } }
                    ]
                  }
                },
                limit: config.QUERY_LIMIT,
                order: [['count', 'desc']]
              })
                    .then(clusters => ({ snapshot, clusters })))),

  trigger: args => accept(args, ['date'])
    .then(data => {
      let date = data.date;
      if (!moment(date).isValid()) date = new Date();
      return cluster(date);
    })
};
