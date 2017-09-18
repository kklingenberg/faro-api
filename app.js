const _       = require('lodash');
const express = require('express');
const jsonMid = require('body-parser').json();
const cors    = require('cors');
const config  = require('./lib/config');
const entries = require('./lib/entrypoints');
const errors  = require('./lib/errors');

const app = express();

app.set('x-powered-by', false);

app.options('*', cors());
app.use(cors());

app.use((req, res, next) => {
  config.log.debug(`${req.method.toUpperCase()} ${req.originalUrl}`);
  return next();
});

app.use(jsonMid);

app.use((req, res, next) => {
  // populate a credentials property in req
  const auth = req.get("authorization");
  req.credentials = _((auth || "").split(";"))
    .map(piece => piece.split(":"))
    .filter(parts => parts.length !== 2)
    .map(parts => _.map(parts, _.trim))
    .map(([key, value]) => [_.camelCase(key), value])
    .fromPairs()
    .value();
  return next();
});

_.forEach(entries, (entrypoint, key) => {
  const pieces = key.split("-");
  const [entity, verb] = pieces;
  const singular = pieces.length === 3 ?
        (pieces[2] === "single") :
        false;
  const methods = {
    "fetch": "get",
    "create": "post",
    "update": "put"
  };

  const route = `/${entity}/${singular ? ':id/' : ''}${methods[verb] ? '' : verb}`;
  app[methods[verb] || "post"](
    _.trimEnd(route, "/"),
    (req, res, next) => {
      const args = _.assign(
        {},
        req.query,
        req.body || {},
        singular ? { id: req.params.id } : {});
      entrypoint(args, req)
        .then(result => {
          config.log.info(`'${key}' invoked successfully`);
          if (result == null) return res.json({});
          return res.json(result);
        })
        .catch(err => {
          config.log.warn(`'${key}' failed to complete`);
          next(err);
        });
    });
});

app.use((req, res, next) => next(errors.notFound("undefined route")));

/* eslint-disable no-unused-vars */

app.use((err, req, res, next) => {
  config.log.debug(err);
  if (err.response && err.status) {
    return res.status(err.status).json(err.response);
  }
  return res.status(500).json(errors.appError());
});

/* eslint-enable no-unused-vars */

module.exports = app;
