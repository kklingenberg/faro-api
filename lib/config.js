const _ = require('lodash');


/* eslint-disable no-console */

const log = (level, ...args) => console.log(
  `[${(new Date()).toJSON()}][${level}] -`,
  ...args);

/* eslint-enable no-console */

let externalConfig = {};
let inlineConfig = {};

try {
  const path = process.env.CONFIG || "../config.json";
  externalConfig = module.require(path);
  log("INFO ", `Using '${path}' as configuration file`);
} catch (e) {
  log("INFO ", "No external configuration file given");
}

try {
  inlineConfig = JSON.parse(process.env.CONFIG_INLINE);
  if (!_.isPlainObject(inlineConfig)) {
    log("WARN ", "Inline configuration given was invalid");
    inlineConfig = {};
  } else {
    log("INFO ", "Using given inline configuration");
  }
} catch (e) {
  log("INFO ", "No valid inline configuration was given");
}

module.exports = _.assign(
  {
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
  },
  externalConfig,
  inlineConfig,
  {
    log: {
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
    }
  });
