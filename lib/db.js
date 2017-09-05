const crypto    = require('crypto');
const _         = require('lodash');
const Sequelize = require('sequelize');
const config    = require('./config');
const enums     = require('./enums');


const sequelize = new Sequelize(config.DB_URL, {
  logging: (...args) => config.log.debug(_.first(args)),
  pool: _.assign({}, config.DB_CONNECTION_POOL)
});

const defaultAttributes = {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV4,
    primaryKey: true
  }
};

const defaultOptions = {
  timestamps: false,
  paranoid: false,
  underscored: true,
  freezeTableName: true,
  instanceMethods: {
    serialize: function() {
      return this.get({ plain: true });
    }
  },
  classMethods: {
    subquery: function(attribute, where, opts) {
      const sql = sequelize.dialect.QueryGenerator.selectQuery(
        this.tableName,
        _.assign(
          {},
          opts || {},
          { attributes: [attribute || 'id'],
            where: where || {} })).slice(0, -1);
      return sequelize.literal(`(${sql})`);
    }
  }
};

const models = {};

const define = (name, attributes, options) => {
  const opts = _(_.merge({}, defaultOptions, options || {}))
        .toPairs()
        .filter(pair => pair[1] != null)
        .fromPairs()
        .value();
  const attrs = _(_.assign({}, defaultAttributes, attributes || {}))
        .toPairs()
        .filter(pair => pair[1] != null)
        .fromPairs()
        .value();
  const model = sequelize.define(
    _.snakeCase(name),
    attrs,
    _.omit(opts, ['instanceMethods', 'classMethods']));
  _.forEach(opts.classMethods || {}, (method, mName) => {
    if (model[mName]) {
      model[`_super_${mName}`] = model[mName];
    }
    model[mName] = method;
  });
  _.forEach(opts.instanceMethods || {}, (method, mName) => {
    if (model.prototype[mName]) {
      model.prototype[`_super_${mName}`] = model.prototype[mName];
    }
    model.prototype[mName] = method;
  });
  models[name] = model;
  return model;
};

// models list

define('Device', {
  true_secret: {
    type: Sequelize.VIRTUAL(Sequelize.STRING),
    set: function(v) {
      this.trueSecret = v;
      return this.setDataValue(
        'secret',
        models.Device.hashSecret(this.trueSecret));
    },
    get: function() {
      return this.trueSecret;
    }
  },
  secret: {
    type: Sequelize.STRING(100),
    allowNull: false
  },
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: function() {
      return new Date();
    }
  },
  last_notification: Sequelize.DATE,
  preferred_locations: Sequelize.JSON,
  token: Sequelize.STRING(1020),
  os: {
    type: Sequelize.STRING(20),
    validate: {
      isIn: [
        _(enums.os_types)
          .map()
          .concat(null)
          .value()
      ]
    }
  },
  nickname: Sequelize.STRING(255),
  avatar: Sequelize.STRING(255)
}, {
  indexes: [{
    fields: ['token', 'os']
  }],
  classMethods: {
    hashSecret: v => crypto
      .createHash('sha512')
      .update(v)
      .update(config.SALT)
      .digest()
      .toString('base64'),
    create: function(data, ...args) {
      return this._super_create(
        _.assign(
          {},
          data,
          { true_secret: crypto.randomBytes(64).toString('base64') }),
        ...args);
    }
  },
  instanceMethods: {
    serialize: function() {
      return _.assign(
        _.omit(
          this.get({ plain: true }),
          ['secret', 'true_secret', 'token', 'os']),
        _.isUndefined(this.trueSecret) ? {} : { secret: this.trueSecret });
    }
  }
});

define('Notification', {
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: function() {
      return new Date();
    }
  },
  relevant_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: function() {
      return new Date();
    }
  },
  lat: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  lng: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  kind: {
    type: Sequelize.STRING(3),
    allowNull: false,
    validate: {
      isIn: [_.map(enums.notification_types)]
    }
  },
  comment: Sequelize.TEXT,
  likes: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  dislikes: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  score: Sequelize.DECIMAL(6, 5)
}, {
  indexes: [{
    fields: ['created_at']
  }, {
    fields: ['relevant_at']
  }, {
    fields: ['lat']
  }, {
    fields: ['lng']
  }, {
    fields: ['kind']
  }, {
    fields: ['score']
  }],
  classMethods: {
    computeScore: function(likes, total) {
      const min = config.SCORING.MINIMUM_VOTES;
      if (total < min) return null;
      const relative = likes / total;
      const shifted = (total / (total + min)) * relative +
            (min / (total + min)) * config.SCORING.MEAN;
      return (shifted * 2) - 1;
    },
    recomputeProperties: function(opts) {
      return models.Notification.findAll(opts || {})
        .then(ns => {
          config.log.info(
            "Recomputing properties for",
            ns.length,
            "notification(s)");
          return Promise.all([
            // likes
            models.Reaction.findAll(_.assign({
              attributes: [
                'notification_id',
                [sequelize.fn('COUNT', sequelize.col('notification_id')), 'count'],
                [sequelize.fn('MAX', sequelize.col('date')), 'date']
              ],
              where: {
                notification_id: { $in: _.map(ns, 'id') },
                positive: true
              },
              group: ['notification_id']
            }, _.pick(opts || {}, 'transaction')))
              .then(likes => _.map(likes, like => like.get({ plain: true }))),

            // total amount, then dislikes = total - likes
            models.Reaction.findAll(_.assign({
              attributes: [
                'notification_id',
                [sequelize.fn('COUNT', sequelize.col('notification_id')), 'count']
              ],
              where: { notification_id: { $in: _.map(ns, 'id') } },
              group: ['notification_id']
            }, _.pick(opts || {}, 'transaction')))
              .then(totals => _.map(totals, total => total.get({ plain: true })))
          ])
            .then(([likes, total]) => _.map(ns, notification => ({
              notification,
              likes: _.find(likes, { notification_id: notification.id }) ||
                { notification_id: notification.id, count: 0, date: null },
              total: _.find(total, { notification_id: notification.id }) ||
                { notification_id: notification.id, count: 0 }
            })));
        })
        .then(ns => _.reduce(
          ns,
          (promise, not) => promise.then(() => {
            const { notification, likes, total } = not;
            const likesCount = likes.count;
            const totalCount = total.count;
            const relevance = _([likes.date, notification.created_at])
                  .compact()
                  .map(d => d.toJSON())
                  .max();
            const score = models.Notification.computeScore(likesCount, totalCount);
            return notification.update({
              likes: likesCount,
              dislikes: totalCount - likesCount,
              relevant_at: relevance,
              score
            }, _.pick(opts, 'transaction'));
          }),
          Promise.resolve(null)));
    }
  }
});

define('Reaction', {
  id: null,
  date: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: function() {
      return new Date();
    }
  },
  device_id: {
    type: Sequelize.UUID,
    primaryKey: true
  },
  notification_id: {
    type: Sequelize.UUID,
    primaryKey: true
  },
  positive: {
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
});

models.Device.hasMany(models.Notification);
models.Notification.belongsTo(models.Device);
models.Device.hasMany(models.Reaction);
models.Notification.hasMany(models.Reaction);

define('Snapshot', {
  date: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: function() {
      return new Date();
    }
  }
}, {
  indexes: [{
    fields: ['date']
  }]
});

define('Cluster', {
  north: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  south: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  west: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  east: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  polygon: Sequelize.JSON,
  score: {
    type: Sequelize.INTEGER,
    allowNull: false
  },
  kinds: Sequelize.JSON
}, {
  indexes: [{
    fields: ['north']
  }, {
    fields: ['south']
  }, {
    fields: ['west']
  }, {
    fields: ['east']
  }, {
    fields: ['score']
  }]
});

models.Snapshot.hasMany(models.Cluster);
models.Cluster.belongsTo(models.Snapshot);

define('ClusterNotification', { id: null });

models.Cluster.belongsToMany(
  models.Notification, { through: models.ClusterNotification });
models.Notification.belongsToMany(
  models.Cluster, { through: models.ClusterNotification });


module.exports = {
  sequelize,
  models
};
