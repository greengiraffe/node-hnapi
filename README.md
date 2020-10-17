Hacker News (unofficial) API
============================

Yet another unofficial API for [Hacker News] that was [forked from cheeaun](https://github.com/cheeaun/node-hnapi).

---

Quick Start
----------

1. `git clone` this repo.
2. `cd` to repo folder.
3. Optionally download, install and start [redis](http://redis.io/download).
4. `npm install`
5. `npm start`
6. Load `localhost:1337` in your web browser.


Example
-------------

> <http://localhost:1337/news?page=2>

Configuration
-------------

HNapi uses [dotenv](https://github.com/motdotla/dotenv) for configuration.

- `PORT` - (default: `1337`) Server port
- `CACHE_TTL` - (default: `600`) Cache time-to-live in seconds
- `LOG_REFERER` - (default: `false`) Logs referers
- `LOG_USERAGENT` - (default: `false`) Logs user-agent strings
- `REDIS_URL` - `redis://USER:PASSWORD@REDIS_SERVER:PORT` to use Redis for caching (if not defined, node in-memory caching will be used).

License
-------

Licensed under the MIT License (see LICENSE file).

Other APIs
----------

- [The official Hacker News API](https://github.com/HackerNews/API)
- <http://hn.algolia.com/api>
- <http://api.ihackernews.com/>
- <http://hndroidapi.appspot.com/>
- <http://www.hnsearch.com/api>
- <https://github.com/Boxyco/hackernews-api>
