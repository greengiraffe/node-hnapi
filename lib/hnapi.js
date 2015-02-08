var Firebase = require('firebase');
var Promise = require('promise');
var moment = require('moment');
var extend = require('extend');
var url = require('url');

var hn = new Firebase('https://hacker-news.firebaseio.com/v0');
var hnTopStories = hn.child('topstories');
var hnRecentItems = hn.child('updates/items');

var typeMapping = {
  story: 'link'
};

var cleanText = function(html){
  if (!html) return;
  // yea yea regex to clean HTML is lame yada yada
  html = html.replace(/<\/p>/ig, ''); // remove trailing </p>s
  if (!html.match(/^<p>/i)) html = '<p>' + html; // prepend <p>
  return html;
}

var api = {

  news: function(options, fn){
    var opts = extend({
      page: 1
    }, options);
    var page = opts.page;
    var limit = 30;
    var startIndex = (page-1) * limit;
    var endIndex = startIndex + limit;

    var top = hnTopStories.limitToFirst(limit * page);
    top.once('value', function(snapshot){
      // Grab all items from the IDs
      var items = snapshot.val().slice(startIndex, endIndex);
      var itemFetches = items.map(function(itemID){
        return new Promise(function(resolve, reject){
          var item = hn.child('item/' + itemID);
          item.once('value', function(snap){
            resolve(snap.val());
          }, function(err){
            reject(err);
          });
        });
      });

      // Throw them all into an array
      Promise.all(itemFetches).then(function(res){
        var apiRes = res.map(function(item){

          // TODO: show the REAL comments count
          var commentsCount = item.kids ? item.kids.length : 0;

          var output = {
            id: item.id,
            title: item.title,
            points: item.score,
            user: item.by,
            time: item.time, // Unix timestamp
            time_ago: moment(item.time*1000).fromNow(),
            comments_count: commentsCount,
            type: typeMapping[item.type] || item.type
          };

          if (item.url){
            output.url = item.url;
            output.domain = url.parse(item.url).hostname.replace(/^www\./i, '');
          } else {
            output.url = 'item?id=' + item.id; // Simulate "local" links
          }

          // If it's a job, username and points are useless
          if (item.type == 'job'){
            output.user = output.points = null;
          }

          return output;
        });

        fn(null, apiRes);
      }).catch(function(err){
        fn(err);
      });
    });
  },

  news2: function(fn){
    api.news({ page: 2 }, fn);
  },

  newest: function(fn){ // Not-so-complete 'newest'
    var recent = hnRecentItems.limitToFirst(30);
    recent.once('value', function(snapshot){
      var items = snapshot.val();
      var itemFetches = items.map(function(itemID){
        return new Promise(function(resolve, reject){
          var item = hn.child('item/' + itemID);
          item.once('value', function(snap){
            resolve(snap.val());
          }, function(err){
            reject(err);
          });
        });
      });

      Promise.all(itemFetches).then(function(res){
        var stories = res.filter(function(r){
          return r.type == 'story';
        });
        fn(null, stories);
      });
    });
  },

  newComments: function(fn){ // Not-so-complete 'newComments' too
    var recent = hnRecentItems.limitToFirst(30);
    recent.once('value', function(snapshot){
      var items = snapshot.val();
      var itemFetches = items.map(function(itemID){
        return new Promise(function(resolve, reject){
          var item = hn.child('item/' + itemID);
          item.once('value', function(snap){
            resolve(snap.val());
          }, function(err){
            reject(err);
          });
        });
      });

      Promise.all(itemFetches).then(function(res){
        var stories = res.filter(function(r){
          return r.type == 'comment';
        });
        fn(null, stories);
      });
    });
  },

  _item: function(id){
    return new Promise(function(resolve, reject){
      var item = hn.child('item/' + id);
      item.once('value', function(snap){
        var val = snap.val();

        // Comments
        var kidsPromises = Promise.resolve();
        if (val.kids && val.kids.length){
          kidsPromises = Promise.all(val.kids.map(api._item));
        }

        // Poll
        var partsPromises = Promise.resolve();
        if (val.type == 'poll' && val.parts && val.parts.length){
          var partsPromises = Promise.all(val.parts.map(function(part){
            return new Promise(function(resolve, reject){
              var p = hn.child('item/' + part);
              p.once('value', function(v){
                resolve(v.val());
              }, function(err){
                reject(err);
              });
            });
          }));
        }

        Promise.all([kidsPromises, partsPromises]).then(function(response){
          var kids = response[0];
          var parts = response[1];
          if (kids && kids.length) val._kids = kids;
          if (parts && parts.length) val._parts = parts;
          resolve(val);
        });
      }, function(err){
        reject(err);
      });
    });
  },

  item: function(id, fn){
    api._item(id).then(function(item){
      var apiRes = {
        id: item.id,
        title: item.title,
        points: item.score,
        user: item.by,
        time: item.time, // Unix timestamp
        time_ago: moment(item.time*1000).fromNow(),
        type: typeMapping[item.type] || item.type,
        content: item.deleted ? '[deleted]' : cleanText(item.text),
        deleted: item.deleted,
        dead: item.dead
      };

      if (item.url){
        apiRes.url = item.url;
        apiRes.domain = url.parse(item.url).hostname.replace(/^www\./i, '')
      } else {
        apiRes.url = 'item?id=' + item.id; // Simulate "local" links
      }

      // If it's a job, username and points are useless
      if (item.type == 'job'){
        apiRes.user = apiRes.points = null;
      }

      // Poll
      if (item._parts && item._parts.length){
        apiRes.poll = item._parts.map(function(part){
          return {
            item: part.text,
            points: part.score
          };
        });
      }

      // Comments
      var commentsCount = 0;
      var formatComments = function(obj, kids, level){
        if (kids && kids.length){
          commentsCount += kids.length;
          obj.comments = kids.map(function(kid){
            var res = {
              id: kid.id,
              level: level,
              user: kid.by,
              time: kid.time,
              time_ago: moment(kid.time*1000).fromNow(),
              content: kid.deleted ? '[deleted]' : cleanText(kid.text),
              deleted: kid.deleted,
              dead: kid.dead
            }
            formatComments(res, kid._kids, level+1);
            return res;
          });
        } else {
          obj.comments = [];
        }
      };
      formatComments(apiRes, item._kids, 0);
      apiRes.comments_count = commentsCount;

      fn(null, apiRes);
    });
  },

  user: function(id, fn){
    var u = hn.child('user/' + id);
    u.once('value', function(snap){
      var val = snap.val();
      fn(null, {
        id: val.id,
        created_time: val.created,
        created: moment(val.created*1000).fromNow(),
        karma: val.karma,
        avg: null, // No average yo
        about: cleanText(val.about)
      });
    }, function(err){
      fn(err);
    });
  }
};

module.exports = api;