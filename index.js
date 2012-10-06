/*
 * Variance - a backoffice for your persistance data
 * 
 * (c) 2012 Carlos Morgado 
 *
 */

var http = require('http')
	, util = require('util')
	, socketio = require('socket.io')
	, connect = require('connect');
//	, connectRoute = require('connect-route');

var Variance;

module.exports = function (resources, options) {
	var self = {};

	function scrub(payload, schema) {
		var out = {};
		for(var k in schema) {
			if(payload[k]) {
				if(schema[k].type === 'number') {
					out[k] = parseFloat(payload[k]);
				} else {
					out[k] = payload[k];
				}
			}
		}
		return out;
	}

	var Ops = {
		create: function(resource, payload, cb) {
			if(typeof payload !== 'object') return cb({'reason': 'bad payload'}, null);
			resource.create(payload._persistname, scrub(payload, resource._persistschema)).save(cb);
		},
		get: function (resource, payload, cb) {
			var name = (payload && payload.name) || null;
			resource.get(name, cb);
		},
		update: function(resource, payload, cb) {
			if(typeof payload !== 'object') return cb({'reason': 'bad payload'}, null);

			resource.get(payload._persistname, function (err, results) {
				if(err) return cb(err, null);
				var res = results[payload._persistname];
				var scrubed = scrub(payload, resource._persistschema);
				if(!res) {
					res = resource.create(payload._persistname, scrubed, function() {});
				} else {
					for(var k in scrubed) res[k] = scrubed[k];
				}
				console.log('saving ', res);
				res.save(cb);
			});
		},
		delete: function(resource, payload, cb) {
			var name = payload && payload.name;
			resource.delete(name);
		},

		all: function(resource, payload, cb) {
			cb = cb || function () {};
			resource.get(null, function (err, results) {
				if(err) return(cb(err, null));

				cb(null, Object.keys(results).map(function (x) {return results[x]}));
			});
		},
		getschema: function(resource, payload, cb) {
			cb(null, resource._persistschema);
		},

		list: function (resource, payload, cb) {
			//if(typeof cb !== 'function ') return;
			cb(null, resources);
		},
	}

	resources = resources || [];
	if(!Array.isArray(resources)) resources = [resources];
	options = options || {};

	self.root = '/variance/';
	self.static = connect.static('lib/html');
	self.resources = {};
	resources.forEach(function(x) {self.resources[x._persisttype] = x});

	self.app = http.createServer(function (req, res) {
		self.static(req, res, function () {
			res.end('you want /variance/');
		});
	});
	self.io = socketio.listen(self.app); 
	self.app.listen(options.port || 8080);

	self.io.on('connection', function (socket) {
		console.log('--- NEW CONNECTION');
		socket.on('exec', function(type, action, obj, cb) {
			var resource = self.resources[type]
				, fn = Ops[action];
			
			if(resource || type === '_') {
				console.log('executing ',action, obj);
				if(fn) {
					fn(resource, obj, cb);
				} else {
					cb && cb({reason: 'method not found'}, null);
				}
			} else {
				cb && cb({reason: 'resource not found'}, null);
			}
		});
	});

	return self.app;	
}
