Hacker News (unofficial) API
============================

Yet another unofficial API for [Hacker News] that was [forked from cheeaun](https://github.com/cheeaun/node-hnapi).

---

Quick Start
----------

1. `git clone` this repo.
2. `cd` to repo folder.
3. Optionally download, install and start [redis](http://redis.io/download).
4. `yarn`
5. `yarn start`
6. Load `localhost:1337` in your web browser.


Example
-------------

> <http://localhost:1337/news?page=2>

Configuration
-------------

HNapi uses [dotenv](https://github.com/motdotla/dotenv) for configuration.

- `PORT` - (default: `1337`) Server port
- `CACHE_EXP` - (default: `600`) Cache expiry in seconds
- `LOG_REFERER` - (default: `false`) Logs referers
- `LOG_USERAGENT` - (default: `false`) Logs user-agent strings
- `CACHE_MEMORY` - (default: `true`) Use in-memory caching
- `CACHE_STORE` - (`redis`, default: none) Specify the cache store
- `CACHE_SERVER` - `HOST:PORT` for Redis server

License
-------

Licensed under the [MIT License](http://cheeaun.mit-license.org/).

Other APIs
----------

- [The official Hacker News API](https://github.com/HackerNews/API)
- <http://hn.algolia.com/api>
- <http://api.ihackernews.com/>
- <http://hndroidapi.appspot.com/>
- <http://www.hnsearch.com/api>
- <https://github.com/Boxyco/hackernews-api>
