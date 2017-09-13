const _ = require('lodash');


module.exports = _.assign({
  APPLICATION_KEYS: {
    "TODO mobile key number 1": "mobile",
    "TODO browser key number 1": "browser",
    "TODO cron key number 1": "cron"
  },
  SALT: "TODO salt",
  DB_URL: "sqlite://./database.sqlite",
  DB_CONNECTION_POOL: {
    min: 1,
    max: 2,
    idle: 500
  },
  RELEVANCE_WINDOW: 90, // minutes
  WAITING_INTERVAL: 5, // minutes
  SCORING: {
    MINIMUM_VOTES: 4,
    MEAN: 0.56 // 5 likes for every 4 dislikes
  },
  CLUSTERING: {
    MINIMUM_POINTS: 4,
    MAXIMUM_DISTANCE: 120,
    ALPHA: 12
  },
  QUERY_LIMIT: 1000,
  LOG_LEVEL: "debug"
}, module.require(process.env.CONFIG || "../config.json"));

/* eslint-disable no-console */

const log = (level, ...args) => console.log(
  `[${(new Date()).toJSON()}][${level}] -`,
  ...args);

/* eslint-enable no-console */

module.exports.log = {
  debug: module.exports.LOG_LEVEL === "debug" ?
    ((...args) => log("DEBUG", ...args)) :
    (() => null),
  info: ["debug", "info"].indexOf(module.exports.LOG_LEVEL) !== -1 ?
    ((...args) => log("INFO ", ...args)) :
    (() => null),
  warn: ["debug", "info", "warn"].indexOf(module.exports.LOG_LEVEL) !== -1 ?
    ((...args) => log("WARN ", ...args)) :
    (() => null),
  error: (...args) => log("ERROR", ...args)
};


