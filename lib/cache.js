const NodeCache = require('node-cache')

const noop = function () {}

/**
 * Cache values in memory or with Redis
 *
 * @param {Object} opts - Cache options
 * @param {string} [opts.storeType='memory'] - Specifies which cache is used, "redis" or "memory" (default, uses node-cache)
 * @param {number} [opts.ttl=600] - Cache time to live in seconds
 * @param {Object} [opts.redisOptions] - Options for Redis
 * @param {string} opts.redisOptions.server - Redis server adress
 * @param {function} [opts.redisOptions.onConnect] - Callback triggered after a connection to Redis has been established
 * @param {function} [opts.redisOptions.onError] - Callback triggered when a Redis error occured
 */
module.exports = class Cache {
  constructor ({
    storeType = 'memory',
    ttl = 600,
    redisOptions = {
      server: '',
      onConnect: noop,
      onError: noop
    }
  }) {
    this.storeType = storeType
    this.ttl = ttl
    this.redisOptions = redisOptions

    switch (this.storeType) {
      case 'redis': {
        const Redis = require('ioredis')
        this.redis = new Redis(`redis://${redisOptions.server}`)
        this.redis.on('connect', redisOptions.onConnect)
        this.redis.on('error', redisOptions.onError)
        break
      }
      default: {
        this.nodeCache = new NodeCache({
          stdTTL: this.ttl,
          useClones: true
        })
      }
    }

    if (storeType === 'redis') {
    }
  }

  set (key, value, ttl = this.ttl) {
    switch (this.storeType) {
      case 'redis': {
        return this.redis.set(key, JSON.stringify(value), 'ex', ttl)
      }
      default: {
        return new Promise((resolve, reject) => {
          if (this.nodeCache.set(key, value, ttl)) resolve()
          else reject(new Error(`NodeCache could not set ${{ key, value, ttl }})`))
        })
      }
    }
  }

  get (key) {
    switch (this.storeType) {
      case 'redis': {
        return this.redis.get(key)
      }
      default: {
        return new Promise((resolve, reject) => {
          const value = this.nodeCache.get(key)
          if (value === undefined) {
            reject(new Error(`NodeCache could not get key: ${key}`))
          } else resolve(value)
        })
      }
    }
  }

  del (key) {
    switch (this.storeType) {
      case 'redis': {
        this.redis.del(key)
        break
      }
      default: {
        this.nodeCache.del(key)
      }
    }
  }

  get stats () {
    return this.nodeCache.getStats()
  }
}
