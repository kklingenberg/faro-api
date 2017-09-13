const _                = require('lodash');
const config           = require('./config');
const { models }       = require('./db');
const { deviceCache }  = require('./cache');
const errors           = require('./errors');
const { serialize }    = require('./utils');
const deviceCrud       = require('./crud/device');
const notificationCrud = require('./crud/notification');
const snapshotCrud     = require('./crud/snapshot');


const requireKey = (...kinds) => crudFn => (args, context) => {
  if (!context ||
      !context.credentials ||
      !context.credentials.key) {
    return Promise.reject(errors.notAuthorized("you need an application key"));
  }
  if (kinds.indexOf(config.APPLICATION_KEYS[context.credentials.key]) === -1) {
    return Promise.reject(
      errors.forbidden("forbidden access for the given application key"));
  }
  return crudFn(args, context);
};

const requireSecret = crudFn => (args, context) => {
  if (!context ||
      !context.credentials ||
      !context.credentials.secret ||
      !context.credentials.deviceId) {
    return Promise.reject(errors.notAuthorized("you need proper credentials"));
  }
  const { secret, deviceId } = context.credentials;
  const cached = deviceCache.get(deviceId);
  if (cached !== null && cached !== secret) {
    return Promise.reject(
      errors.notAuthorized("the credentials given are invalid"));
  }
  if (cached === secret) return crudFn(args, context);
  const hashed = models.Device.hashSecret(secret);
  return models.Device.findOne({
    attributes: ['id'],
    where: {
      id: deviceId,
      secret: hashed
    }
  })
    .then(device => {
      if (!device) return Promise.reject(
        errors.notAuthorized("the credentials given are invalid"));
      deviceCache.set(deviceId, secret);
      return crudFn(args, context);
    });
};

const passTest = test => crudFn =>
      (args, context) => test(args, context)
      .then(() => crudFn(args, context));

const pipe = (...pieces) => crudFn =>
      (args, context) => _.flowRight(...pieces)(crudFn)(args, context)
      .then(serialize);


module.exports = {
  "device-fetch": pipe(
    requireKey("mobile", "browser"))(deviceCrud.read),

  "device-register": pipe(
    requireKey("mobile"))(deviceCrud.create),

  "device-update": pipe(
    requireKey("mobile"),
    requireSecret,
    passTest((args, ctx) => {
      if (ctx.credentials.deviceId !== args.id) {
        return Promise.reject(errors.forbidden("you can't update that device"));
      }
      return Promise.resolve(null);
    }))(deviceCrud.update),

  "notification-fetch": pipe(
    requireKey("mobile", "browser"))(notificationCrud.read),

  "notification-create": pipe(
    requireKey("mobile"),
    requireSecret,
    passTest((args, ctx) => {
      if (ctx.credentials.deviceId !== args.device_id) {
        return Promise.reject(
          errors.badParameters("device_id doesn't match credential"));
      }
      return Promise.resolve(null);
    }))(notificationCrud.create),

  "notification-rate": pipe(
    requireKey("mobile"),
    requireSecret,
    passTest((args, ctx) => {
      if (ctx.credentials.deviceId !== args.device_id) {
        return Promise.reject(
          errors.badParameters("device_id doesn't match credential"));
      }
      return Promise.resolve(null);
    }))(notificationCrud.rate),

  "snapshot-fetch": pipe(
    requireKey("mobile", "browser"))(snapshotCrud.read),

  "snapshot-single": pipe(
    requireKey("mobile", "browser"))(snapshotCrud.readSingle),

  "snapshot-trigger": pipe(requireKey("cron"))(snapshotCrud.trigger)
};
