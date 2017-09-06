const _          = require('lodash');
const alphaShape = require('alpha-shape');
const geolib     = require('geolib');
const config     = require('../config');


// Map nodes to approximate coordinates in a fake plane, then
// normalize said coordinates to [0, 1]².
// Return a map of nodeId -> { euclid: [x, y], geo: [lng, lat] }.
const project = nodes => {
  const projection = new Map();
  const b = geolib.getBounds(
    _.map(nodes, n => ({ latitude: n.lat, longitude: n.lng })));
  const center = {
    latitude: b.minLat + ((b.maxLat - b.minLat) / 2),
    longitude: b.minLng + ((b.maxLng - b.minLng) / 2)
  };
  const h = Math.max(
    geolib.getDistance(
      { latitude: b.minLat,
        longitude: b.minLng },
      { latitude: b.maxLat,
        longitude: b.minLng },
      1,
      1),
    geolib.getDistance(
      { latitude: b.minLat,
        longitude: center.longitude },
      { latitude: b.maxLat,
        longitude: center.longitude },
      1,
      1),
    geolib.getDistance(
      { latitude: b.minLat,
        longitude: b.maxLng },
      { latitude: b.maxLat,
        longitude: b.maxLng },
      1,
      1));
  const w = Math.max(
    geolib.getDistance(
      { latitude: b.minLat,
        longitude: b.minLng },
      { latitude: b.minLat,
        longitude: b.maxLng },
      1,
      1),
    geolib.getDistance(
      { latitude: center.latitude,
        longitude: b.minLng },
      { latitude: center.latitude,
        longitude: b.maxLng },
      1,
      1),
    geolib.getDistance(
      { latitude: b.maxLat,
        longitude: b.minLng },
      { latitude: b.maxLat,
        longitude: b.maxLng },
      1,
      1));
  _.forEach(nodes, n => {
    const x = (n.lng > center.longitude ? 1 : -1) *
          geolib.getDistance(
            { latitude: n.lat,
              longitude: n.lng },
            { latitude: n.lat,
              longitude: center.longitude });
    const y = (n.latitude > center.latitude ? 1 : -1) *
          geolib.getDistance(
            { latitude: n.lat,
              longitude: n.lng },
            { latitude: center.latitude,
              longitude: n.lng });
    projection.set(n.id, { euclid: [x / w + 0.5, y / h + 0.5],
                           geo: [n.lng, n.lat] });
  });
  return projection;
};

const splitHullIntoRings = hull => {
  const pool = new Set(hull);
  const rings = [];
  hull.forEach(edge => {
    if (!pool.has(edge)) return null;
    const ring = edge.slice(0);
    pool.delete(edge);
    while (ring[0] !== ring[ring.length - 1]) {
      const piece = Array.from(pool).find(
        newEdge => newEdge[0] === ring[0] ||
          newEdge[0] === ring[ring.length - 1] ||
          newEdge[1] === ring[0] ||
          newEdge[1] === ring[ring.length - 1]);
      pool.delete(piece);
      if (ring[0] === piece[0]) {
        ring.unshift(piece[1]);
      } else if (ring[0] === piece[1]) {
        ring.unshift(piece[0]);
      } else if (ring[ring.length - 1] === piece[0]) {
        ring.push(piece[1]);
      } else if (ring[ring.length - 1] === piece[1]) {
        ring.push(piece[0]);
      }
    }
    rings.push(ring);
  });
  return rings;
};

// Used only for sorting purposes
const boundsSize = bounds => {
  return Math.abs(bounds.maxLat - bounds.minLat) *
    Math.abs(bounds.maxLng - bounds.minLng);
};

// Traces a cluster (array) of nodes, returning a GeoJSON Polygon
module.exports = cluster => {
  const projection = Array.from(project(cluster));
  const alphaHull = alphaShape(
    config.CLUSTERING.ALPHA,
    _.map(projection, pair => pair[1].euclid));
  // turn alphaHull into GeoJSON LineRings
  return _(splitHullIntoRings(alphaHull))
    .map(ring => _.map(ring, pointIndex => projection[pointIndex][1].geo))
  // sort them from biggest to smallest, in terms of their bounding rectangle
    .sortBy(ring => -1 * boundsSize(geolib.getBounds(ring)))
    .value();
};
