const _      = require('lodash');
const moment = require('moment');
const geolib = require('geolib');
const trace  = require('./trace');
const dbscan = require('./dbscan');
const config = require('../config');
const {
  sequelize,
  models
} = require('../db');


module.exports = date => sequelize.transaction(
  transaction => models.Notification.findAll({
    where: {
      created_at: { $lte: date },
      relevant_at: { $gte: moment(date)
                     .subtract(config.RELEVANCE_WINDOW, 'minutes')
                     .toDate() }
    },
    transaction
  })
    .then(nodes => {
      config.log.info("Found", nodes.length, "relevant nodes for clustering");
      const { labels, clusterCount } = dbscan(nodes);
      const clusters = _(nodes)
            .filter(node => labels.has(node.id))
            .groupBy(node => labels.get(node.id))
            .map()
            .value();
      config.log.info("Built", clusterCount, "clusters");
      if (clusters.length === 0) return Promise.resolve(null);
      return models.Snapshot.create({ date }, { transaction })
        .then(snapshot => _.reduce(
          clusters,
          (promise, cluster) => promise.then(() => {
            const polygon = trace(cluster);
            const bounds = geolib.getBounds(_.map(cluster, node => ({
              latitude: node.lat,
              longitude: node.lng
            })));
            return models.Cluster.create({
              north: bounds.maxLat,
              south: bounds.minLat,
              east: bounds.maxLng,
              west: bounds.minLng,
              snapshot_id: snapshot.id,
              count: cluster.length,
              kinds: _(cluster).map('kind').uniq().value(),
              polygon
            }, { transaction })
              .then(clusterObject => _.reduce(
                cluster,
                (promise, node) => promise
                  .then(() => models.ClusterNotification({
                    notification_id: node.id,
                    cluster_id: clusterObject.id
                  }, { transaction })),
                Promise.resolve(null)));
          }), Promise.resolve(null)));
    }))
  .then(() => config.log.info("Finished clustering"));
