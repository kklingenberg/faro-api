const _         = require('lodash');
const Sequelize = require('sequelize');
const config    = require('./config');
const enums     = require('./enums');


const sequelize = new Sequelize(config.DB_URL, {
  logging: (...args) => config.log.debug(...args),
  pool: { min: 1, max: 2, idle: 500 }
});

const defaultAttributes = {
  id: {
    type: Sequelize.UUID,
    defaultValue: Sequelize.UUIDV1,
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
    subquery: function(attribute, where) {
      const sql = sequelize.dialect.QueryGenerator.selectQuery(this.tableName, {
        attributes: [attribute || 'id'],
        where: where || {}
      }).slice(0, -1);
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
  nickname: Sequelize.STRING(40),
  avatar: Sequelize.STRING(255)
}, {
  indexes: [{
    fields: ['token', 'os']
  }]
});

define('Notification', {
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: function() {
      return new Date();
    }
  },
  lat: Sequelize.DECIMAL(12, 9),
  lng: Sequelize.DECIMAL(12, 9),
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
    fields: ['lat']
  }, {
    fields: ['lng']
  }, {
    fields: ['kind']
  }, {
    fields: ['score']
  }],
  instanceMethods: {
    computeScore: function() {
      const total = this.likes + this.dislikes;
      const min = config.SCORING.MINIMUM_VOTES;
      if (total < min) return 0;
      const relative = this.likes / total;
      const shifted = (total / (total + min)) * relative +
            (min / (total + min)) * 0.5;
      return shifted - 0.5;
    }
  }
});

define('Reaction', {
  id: null,
  like: {
    type: Sequelize.BOOLEAN,
    allowNull: false
  }
}, {
  indexes: [{ fields: ['like'] }]
});

models.Device.hasMany(models.Notification);
models.Notification.belongsTo(models.Device);
models.Notification.belongsToMany(models.Device, { through: models.Reaction });
models.Device.belongsToMany(models.Notification, { through: models.Reaction });

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
  lat: {
    type: Sequelize.DECIMAL(12, 9),
    allowNull: false
  },
  lng: {
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
    fields: ['lat']
  }, {
    fields: ['lng']
  }, {
    fields: ['score']
  }]
});

models.Snapshot.hasMany(models.Cluster);
models.Cluster.belongsTo(models.Snapshot);

models.Cluster.hasMany(models.Notification);
models.Notification.belongsTo(models.Cluster);


module.exports = {
  sequelize,
  models
};
