const _ = require('lodash');


module.exports = _.assign({
  SALT: "TODO salt",
  DB_URL: "sqlite://./database.sqlite",
  SCORING: {
    MINIMUM_VOTES: 7
  },
  LOG_LEVEL: "debug"
}, module.require(process.env.CONFIG || "../config.json"));

/* eslint-disable no-console */

module.exports.log = {
  debug: module.exports.LOG_LEVEL === "debug" ?
    ((...args) => console.log("[DEBUG]", ...args)) :
    (() => null),
  info: ["debug", "info"].indexOf(module.exports.LOG_LEVEL) !== -1 ?
    ((...args) => console.log("[INFO ]", ...args)) :
    (() => null),
  warn: ["debug", "info", "warn"].indexOf(module.exports.LOG_LEVEL) !== -1 ?
    ((...args) => console.log("[WARN ]", ...args)) :
    (() => null),
  error: (...args) => console.log("[ERROR]", ...args)
};

/* eslint-enable no-console */
