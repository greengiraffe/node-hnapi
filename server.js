require('dotenv').config()

const express = require('express')
const morgan = require('morgan')
const compress = require('compression')
const onHeaders = require('on-headers')
const cors = require('cors')
const stringify = require('json-stringify-safe')

const hndom = require('./lib/hndom')
const hnapi = require('./lib/hnapi')
const Cache = require('./lib/cache')
const request = require('./lib/request')

const CACHE_TTL = parseInt(process.env.CACHE_TTL, 10)

const {
  PORT,
  LOG_REFERER,
  LOG_USERAGENT,
  REDIS_SERVER,
  RATELIMIT_BLACKLIST
} = process.env

const redisOptions = REDIS_SERVER ? {
  server: REDIS_SERVER,
  onConnect: () => {
    console.info('Connected to cache server.')
  },
  onError: (e) => {
    if (e) console.error(e.toString ? e.toString() : e)
  }
} : undefined

// Cache
const cache = new Cache({
  ttl: CACHE_TTL,
  redisOptions
})

const app = express()
app.set('json spaces', 0)
app.enable('trust proxy')

const reqIP = function (req) {
  var ips = req.ips
  return ips.length ? ips.join(',') : req.ip
}
morgan.token('ip', (req, res) => {
  return reqIP(req)
})
const logFormat = ':method :url :status :ip :response-time[0]ms' +
  (LOG_REFERER ? ' referer=:referrer' : '') +
  (LOG_USERAGENT ? ' ua=:user-agent' : '')
app.use(morgan(logFormat, {
  stream: {
    write: (message) => {
      console.info(message.trim())
    }
  }
}))

if (RATELIMIT_BLACKLIST) {
  const limiter = require('connect-ratelimit')
  const blacklist = RATELIMIT_BLACKLIST.split(' ')
  app.use(limiter({
    blacklist,
    end: true,
    catagories: {
      blacklist: {
        // 1 req every hr
        totalRequests: 1,
        every: 60 * 60 * 1000
      }
    }
  }))
}

app.use(function (req, res, next) {
  res.setHeader('Cache-Control', 'public, max-age=' + CACHE_TTL + ', s-maxage=' + Math.round(CACHE_TTL / 2))
  next()
})
app.use(cors())
app.use(compress())
app.use(function (req, res, next) {
  ['send', 'set'].forEach(function (method) {
    var fn = res[method]
    res[method] = function () {
      if (res.headersSent) return
      fn.apply(res, arguments)
    }
  })
  var timeout = setTimeout(function () {
    console.error('Server timeout: ' + req.url)
    res.status(504).end()
  }, 29000)
  onHeaders(res, function () {
    clearTimeout(timeout)
  })
  next()
})

app.get('/', function (req, res) {
  const memoryUsage = process.memoryUsage()
  for (const key in memoryUsage) {
    memoryUsage[key] = `${Math.round(memoryUsage[key] / 1024 / 1024 * 100) / 100} MB`
  }
  res.type('application/json')
  res.send(JSON.stringify({
    name: 'greengiraffe/node-hnapi',
    desc: 'Unofficial Hacker News API',
    version: '1.0.0',
    project_url: 'https://github.com/greengiraffe/node-hnapi',
    process: {
      versions: process.versions,
      memoryUsage
    },
    nodeCacheStats: {
      ...cache.stats
    }
  }, null, 4))
})

app.get('/favicon.ico', function (req, res) {
  res.status(204).end()
})

app.get('/robots.txt', function (req, res) {
  res.type('txt/plain')
  res.send('User-agent: *\nDisallow: /')
})

var errorRespond = function (res, error) {
  console.error(error)
  if (!res.headersSent) {
    res.jsonp({
      error: error.message || JSON.parse(stringify(error))
    })
  }
  if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED' || error.statusCode === 503) {
    process.nextTick(function () {
      process.exit(1)
    })
  }
}

app.get(/^\/(news|news2|newest|ask|show|jobs|best)$/, function (req, res) {
  var base = req.params[0]
  var page = Math.min(10, Math.max(1, parseInt(req.query.page, 10) || 1))
  if (base === 'news2') { // Totally ignore `page` if `news2`
    base = 'news'
    page = 2
  }
  var cacheKey = base + (page > 1 ? page : '')
  cache.get(cacheKey)
    .then(value => res.jsonp(value))
    .catch(e => {
      hnapi[base]({
        page: page
      }, function (err, data) {
        if (err) {
          errorRespond(res, err)
          return
        }
        cache.set(cacheKey, data) // TODO handle promise
        res.jsonp(data)
      })

      // If 'news' expired, 'news2' should expire too
      if (cacheKey === 'news' || cacheKey === 'news1') cache.del('news2')
    })
})

app.get(/^\/(shownew|active|noobstories)$/, function (req, res) {
  var cacheKey = req.params[0]
  cache.get(cacheKey)
    .then(value => res.jsonp(value)) // TODO handle error case
    .catch(e => {
      const path = '/' + cacheKey
      request.push(path, { ip: reqIP(req) }, function (err, body) {
        if (err) {
          errorRespond(res, err)
          return
        }
        hndom.stories(body, function (e, data) {
          if (e) {
            errorRespond(res, e)
            return
          }
          cache.set(cacheKey, data) // TODO handle promise
          res.jsonp(data)
        })
      })
    })
})

app.get(/^\/item\/(\d+)$/, function (req, res) {
  var postID = req.params[0]
  var cacheKey = 'post' + postID
  cache.get(cacheKey)
    .then(value => res.jsonp(value))
    .catch(e => {
      const start = Date.now()
      hnapi.item(postID, function (err, data) {
        if (err) {
          errorRespond(res, err)
          return
        }
        const time = Date.now() - start
        if (time > 25000) console.info('Fetch duration for #' + postID + ': ' + time + 'ms')
        cache.set(cacheKey, data) // TODO handle promise
        res.jsonp(data)
      })
    })
})

app.get('/newcomments', function (req, res) {
  var cacheKey = 'newcomments'
  cache.get(cacheKey)
    .then(value => res.jsonp(value))
    .catch(e => {
      const path = '/' + cacheKey
      request.push(path, { ip: reqIP(req) }, function (err, body) {
        if (err) {
          errorRespond(res, err)
          return
        }
        hndom.newComments(body, function (e, data) {
          if (e) {
            errorRespond(res, e)
            return
          }
          cache.set(cacheKey, data) // TODO handle promise
          res.jsonp(data)
        })
      })
    })
})

app.get(/^\/user\/([\w-]+)$/, function (req, res) {
  var userID = req.params[0]
  var cacheKey = 'user' + userID
  cache.get(cacheKey)
    .then(value => res.jsonp(value))
    .catch(e => {
      hnapi.user(userID, function (err, data) {
        if (err) {
          errorRespond(res, err)
          return
        }
        cache.set(cacheKey, data) // TODO handle promise
        res.jsonp(data)
      })
    })
})

app.listen(PORT)
console.log('Listening on port ' + PORT)
