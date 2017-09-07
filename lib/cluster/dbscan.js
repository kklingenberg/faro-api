const _          = require('lodash');
const geolib     = require('geolib');
const config     = require('../config');


const findNeighbours = (nodes, node) => {
  const from = {
    latitude: node.lat,
    longitude: node.lng
  };
  const antimeridianFilter = Math.abs(node.lng) > 170 ?
        (n => n.lng * node.lng > 0) :
        (() => true);
  return _(nodes)
  // remove the node whose neighbours are being looked for
    .filter(n => n !== node)
  // filter out those further than roughly 2 [km] away
    .filter(n => node.triangulationDelta(n) > 2000)
  // filter out those on the other side of the antimeridian
    .filter(antimeridianFilter)
  // perform the expensive distance calculation
    .filter(n => {
      const to = {
        latitude: n.lat,
        longitude: n.lng
      };
      return geolib.getDistance(from, to, 1, 1) <=
        config.CLUSTERING.MAXIMUM_DISTANCE;
    })
    .value();
};

// Ported from https://en.wikipedia.org/wiki/DBSCAN
module.exports = nodes => {
  const labels = new Map(); // map nodeId to label
  // the -1 label marks nodes as noise
  let currentCluster = 0;
  const labelSeed = set => {
    const next = new Set();
    _.forEach(set, node => {
      if (labels.get(node.id) === -1) labels.set(node.id, currentCluster);
      if (labels.get(node.id)) return null;
      labels.set(node.id, currentCluster);
      const neighbours = findNeighbours(nodes, node);
      if (neighbours.length >= config.CLUSTERING.MINIMUM_POINTS) {
        _(neighbours)
          .filter(n => (labels.get(n.id) || 0) < 1)
          .forEach(n => next.add(n));
      }
    });
    return Array.from(next);
  };
  _.forEach(nodes, node => {
    if (labels.get(node.id)) return null;
    const neighbours = findNeighbours(nodes, node);
    if (neighbours.length < config.CLUSTERING.MINIMUM_POINTS) {
      labels.set(node.id, -1);
      return null;
    }
    currentCluster = currentCluster + 1;
    labels.set(node.id, currentCluster);
    let seed = neighbours.slice(0);
    while (seed.length > 0) seed = labelSeed(seed);
  });
  return {
    labels: new Map(_.filter(Array.from(labels), pair => pair[1] !== -1)),
    clusterCount: currentCluster
  };
};
