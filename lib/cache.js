const NodeCache = require('node-cache')

const noop = function () {}

/**
 * Cache values in memory or with Redis
 *
 * @param {Object} opts - Cache options
 * @param {string} [opts.cacheType='memory'] - Specifies which cache is used, "redis" or "memory" (default, uses node-cache)
 * @param {number} [opts.ttl=600] - Cache time to live in seconds
 * @param {Object} [opts.redisOptions] - Options for Redis
 * @param {string} opts.redisOptions.url - The Redis service URL (`redis://USER:PASSWORD@REDIS_SERVER:PORT`)
 * @param {function} [opts.redisOptions.onConnect] - Callback triggered after a connection to Redis has been established
 * @param {function} [opts.redisOptions.onError] - Callback triggered when a Redis error occured
 */
module.exports = class Cache {
  constructor ({
    cacheType = 'memory',
    ttl = 600,
    redisOptions = {
      server: '',
      onConnect: noop,
      onError: noop
    }
  }) {
    this.cacheType = cacheType
    this.ttl = ttl
    this.redisOptions = redisOptions

    switch (this.cacheType) {
      case 'redis': {
        const Redis = require('ioredis')
        this.redis = new Redis(this.redisOptions.url, { lazyConnect: true })
        this.redis.connect(this.redisOptions.onConnect)
        this.redis.on('error', this.redisOptions.onError)
        break
      }
      default: {
        this.nodeCache = new NodeCache({
          stdTTL: this.ttl,
          useClones: true
        })
      }
    }

    if (cacheType === 'redis') {
    }
  }

  set (key, value, ttl = this.ttl) {
    switch (this.cacheType) {
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
    switch (this.cacheType) {
      case 'redis': {
        return this.redis.get(key).then(val => {
          if (val !== null) {
            return JSON.parse(val)
          } else {
            throw new Error(`key missing: ${key}`)
          }
        })
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
    switch (this.cacheType) {
      case 'redis': {
        this.redis.del(key)
        break
      }
      default: {
        this.nodeCache.del(key)
      }
    }
  }

  async stats () {
    switch (this.cacheType) {
      case 'memory':
        return this.nodeCache.getStats()
      case 'redis':
        return this.redis.send_command('info', ['stats']).then(str => {
          const obj = {}
          str.split('\r\n').forEach(line => {
            if (line.includes(':')) {
              const splitLine = line.split(':')
              obj[splitLine[0]] = splitLine[1]
            }
          })
          return obj
        })
      default:
        return {}
    }
  }
}
