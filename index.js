//Main file for starting and controlling the Gateway Utility Functions

require('dotenv').config();

global.moment = require('moment');
global._ = require('lodash');
global.axios = require('axios');//.default;
global.glob = require('glob');
global.fs = require('fs');
global.path = require('path');
global.md5 = require('md5');

const express = require('express')
const {nanoid} = import("nanoid");

global.LOADED_PLUGINS = {};

console.log("\x1b[34m%s\x1b[0m","\nGateway Initialization Started @ "+moment().format(),"\n");

process.env.START_TIME = moment().format();
process.env.ROOT_PATH  = __dirname;

const CONFIG = require('./config');
const _PROXY = _.extend({
        "router": function(req, res, next) {
            console.log("GATEWAY DEFAULT ROUTER", req, res, next);
            return next();
        }
    }, require('./proxy'));

//console.log("LOADED", CONFIG, _PROXY)

//Initialize Plugins
fs.readdirSync('./plugins/').forEach(function(file) {
    if ((file.indexOf(".js") > 0 && (file.indexOf(".js") + 3 == file.length))) {
        var className = file.toLowerCase().replace(".js", "").toUpperCase();
        var filePath = path.resolve('./plugins/' + file);

        LOADED_PLUGINS[className] = require(filePath);
        // console.log(">>>", className, filePath, LOADED_PLUGINS);

        if(LOADED_PLUGINS[className].initialize!=null) {
            LOADED_PLUGINS[className].initialize();
        }
    }
});

//Initiate Express Application
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    //res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", req.header("Access-Control-Request-Method"));
    res.header("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers"));
    return next();
});

//For Debug Purpose
if(CONFIG.DEBUG) {
    // app.use(function(req, res, next) {
    //     console.log("NEW_REQUEST", req.url, req.query, req.params, req.body, req.headers);
    //     return next();
    // });

    app.get('/_routes', (req, res, next) => {
        var routeList = [];
        _.each(app._router.stack, function(routeLayer, b) {
            if (routeLayer.route==null || routeLayer.route.path==null || routeLayer.route.path.length<=0) return;
            if (routeLayer.method == "OPTIONS" || routeLayer.path == "*") return;
            //console.log(routeLayer.route, routeLayer.route.path, routeLayer.route.stack[0].method, b);
            routeList.push({
                "path": routeLayer.route.path,
                "method": routeLayer.route.stack[0].method,
            });
        });
        res.send(routeList);
        return next();
      });

    app.get('/_timestamp', (req, res, next) => {
        res.send(moment().format("Y-MM-DD HH:mm:ss"));
        return next();
    });
}

app.get('/', (req, res, next) => {
    res.send('Welcome to SILK Gateway Server');
    return next();
  });

app.listen(process.env.PORT, () => {
    console.log("\n\x1b[34m%s\x1b[0m",`\nGateway Server Started @ `+moment().format()+` and can be accessed on http://localhost:${process.env.PORT}/`);
  })


//Initialize all Endpoints and there connections
_.each(_PROXY.endpoints, function(conf, k) {
    console.log("MICROSERVICE_ENDPOINT", pathSlug, conf);

    var pathSlug = conf.path;
    var ENABLE_GET = true, ENABLE_POST = true, ENABLE_PUT = true, ENABLE_DELETE = true;

    var basePath = `/${pathSlug}/*`;
    if(conf.switch_type=="direct") {
        basePath = `/${pathSlug}`;
    }

    if(conf.methods!=null) {
        ENABLE_GET = conf.methods.indexOf("GET")>=0;
        ENABLE_POST = conf.methods.indexOf("POST")>=0;
        ENABLE_PUT = conf.methods.indexOf("PUT")>=0;
        ENABLE_DELETE = conf.methods.indexOf("DEL")>=0;
    }

    if(ENABLE_GET) {
        app.get(basePath, (req, res, next) => {
            // console.log("ROUTE_GET_CONFIG", req.params, req.query, req.body, req.headers);

            var switch_value = false;
            switch(conf.switch_type) {
                case "header":
                    switch_value = req.headers[conf.switch_refid];
                break;
                case "param":
                    switch_value = req.params[conf.switch_refid];
                break;
                case "query":
                    switch_value = req.query[conf.switch_refid];
                break;
                case "body":
                    switch_value = req.body[conf.switch_refid];
                break;
                case "direct":
                    switch_value = "url";
                break;
            }
            if(!switch_value) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch value"
                });
                return next();
            }
            if(conf.strategy[switch_value]==null) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch strategy"
                });
                return next();
            }

            if(conf.strategy[switch_value]['processor']!=null && typeof conf.strategy[switch_value]['processor']=="function") {
                req = conf.strategy[switch_value]['processor'](req);
            }
            
            var target_url = `${conf.strategy[switch_value]['proxy_url']}/${req.params[0]}`;
            if(req.params[0]==null) var target_url = `${conf.strategy[switch_value]['proxy_url']}`;

            // console.log("XXXXX", target_url, req.params, req.query, req.body, req.headers);
            
            delete req.params[0];

            var options = {
                method: 'GET',
                url: target_url,
                params: _.extend({}, req.params, req.query),
                headers: req.headers
            };
            //   console.log("OOOO", options, conf, switch_value);
            axios.request(options).then(function (response) {
                // console.log("OOOO", response, options);
                if(conf.strategy[switch_value]['post_processor']!=null && typeof conf.strategy[switch_value]['post_processor']=="function") {
                    conf.strategy[switch_value]['post_processor'](req.url, response.data, function(data) {
                        res.send(_.extend({
                            "status": "success",
                        }, data));
                        return next();
                    });
                } else {
                    res.send(_.extend({
                        "status": "success",
                    }, response.data));
                    return next();
                }
            }).catch(function (error) {
                // console.log("error", error, options);
                if(error.response==null) {
                    res.send({
                        "status": "error",
                        "msg": "timeout"
                    });
                    return next();
                }
                res.send({
                    "status": "error",
                    "msg": "Microservice Error",
                    "data": error.response.data
                });
                return next();
            });
        });
    }

    if(ENABLE_POST) {
        app.post(basePath, (req, res, next) => {
            // console.log("ROUTE_POST_CONFIG", req.params, req.query, req.body, req.headers);

            var switch_value = false;
            switch(conf.switch_type) {
                case "header":
                    switch_value = req.headers[conf.switch_refid];
                break;
                case "param":
                    switch_value = req.params[conf.switch_refid];
                break;
                case "query":
                    switch_value = req.query[conf.switch_refid];
                break;
                case "body":
                    switch_value = req.body[conf.switch_refid];
                break;
                case "direct":
                    switch_value = "url";
                break;
            }
            if(!switch_value) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch value"
                });
                return next();
            }
            if(conf.strategy[switch_value]==null) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch strategy"
                });
                return next();
            }

            if(conf.strategy[switch_value]['processor']!=null && typeof conf.strategy[switch_value]['processor']=="function") {
                req = conf.strategy[switch_value]['processor'](req);
            }
            
            var target_url = `${conf.strategy[switch_value]['proxy_url']}/${req.params[0]}`;
            if(req.params[0]==null) var target_url = `${conf.strategy[switch_value]['proxy_url']}`;
            // console.log("XXXXX", target_url, req.params, req.query, req.body, req.headers);
            
            delete req.params[0];
            req.headers['content-type'] = "application/json";
            
            var options = {
                method: 'POST',
                url: target_url,
                params: _.extend({}, req.params, req.query),
                data: req.body,
                headers: _.extend({
                },req.headers)
            };
            //   console.log("XXXX", options);
            axios.request(options).then(function (response) {
                //console.log("OOOO", response);
                if(conf.strategy[switch_value]['post_processor']!=null && typeof conf.strategy[switch_value]['post_processor']=="function") {
                    conf.strategy[switch_value]['post_processor'](req.url, response.data, function(data) {
                        res.send(_.extend({
                            "status": "success",
                        }, data));
                        return next();
                    });
                } else {
                    res.send(_.extend({
                        "status": "success",
                    }, response.data));
                    return next();
                }
            }).catch(function (error) {
                //console.log("OOOO", response);
                if(error.response==null) {
                    res.send({
                        "status": "error",
                        "msg": "timeout"
                    });
                    return next();
                }
                res.send({
                    "status": "error",
                    "msg": "Microservice Error",
                    "data": error.response.data
                });
                return next();
            });
        });
    }

    if(ENABLE_PUT) {
        app.put(basePath, (req, res, next) => {
            // console.log("ROUTE_POST_CONFIG", req.params, req.query, req.body, req.headers);

            var switch_value = false;
            switch(conf.switch_type) {
                case "header":
                    switch_value = req.headers[conf.switch_refid];
                break;
                case "param":
                    switch_value = req.params[conf.switch_refid];
                break;
                case "query":
                    switch_value = req.query[conf.switch_refid];
                break;
                case "body":
                    switch_value = req.body[conf.switch_refid];
                break;
                case "direct":
                    switch_value = "url";
                break;
            }
            if(!switch_value) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch value"
                });
                return next();
            }
            if(conf.strategy[switch_value]==null) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch strategy"
                });
                return next();
            }

            if(conf.strategy[switch_value]['processor']!=null && typeof conf.strategy[switch_value]['processor']=="function") {
                req = conf.strategy[switch_value]['processor'](req);
            }
            
            var target_url = `${conf.strategy[switch_value]['proxy_url']}/${req.params[0]}`;
            if(req.params[0]==null) var target_url = `${conf.strategy[switch_value]['proxy_url']}`;
            // console.log("XXXXX", target_url, req.params, req.query, req.body, req.headers);
            
            delete req.params[0];
            req.headers['content-type'] = "application/json";

            var options = {
                method: 'PUT',
                url: target_url,
                params: _.extend({}, req.params, req.query),
                body: req.body,
                headers: req.headers
            };
            
            axios.request(options).then(function (response) {
                //console.log("OOOO", response);
                if(conf.strategy[switch_value]['post_processor']!=null && typeof conf.strategy[switch_value]['post_processor']=="function") {
                    conf.strategy[switch_value]['post_processor'](req.url, response.data, function(data) {
                        res.send(_.extend({
                            "status": "success",
                        }, data));
                        return next();
                    });
                } else {
                    res.send(_.extend({
                        "status": "success",
                    }, response.data));
                    return next();
                }
            }).catch(function (error) {
                //console.log("OOOO", response);
                if(error.response==null) {
                    res.send({
                        "status": "error",
                        "msg": "timeout"
                    });
                    return next();
                }
                res.send({
                    "status": "error",
                    "msg": "Microservice Error",
                    "data": error.response.data
                });
                return next();
            });
        });
    }

    if(ENABLE_DELETE) {
        app.delete(basePath, (req, res, next) => {
            // console.log("ROUTE_POST_CONFIG", req.params, req.query, req.body, req.headers);

            var switch_value = false;
            switch(conf.switch_type) {
                case "header":
                    switch_value = req.headers[conf.switch_refid];
                break;
                case "param":
                    switch_value = req.params[conf.switch_refid];
                break;
                case "query":
                    switch_value = req.query[conf.switch_refid];
                break;
                case "body":
                    switch_value = req.body[conf.switch_refid];
                break;
                case "direct":
                    switch_value = "url";
                break;
            }
            if(!switch_value) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch value"
                });
                return next();
            }
            if(conf.strategy[switch_value]==null) {
                res.send({
                    "status": "error",
                    "msg": "Missing proxy switch strategy"
                });
                return next();
            }

            if(conf.strategy[switch_value]['processor']!=null && typeof conf.strategy[switch_value]['processor']=="function") {
                req = conf.strategy[switch_value]['processor'](req);
            }
            
            var target_url = `${conf.strategy[switch_value]['proxy_url']}/${req.params[0]}`;
            if(req.params[0]==null) var target_url = `${conf.strategy[switch_value]['proxy_url']}`;
            // console.log("XXXXX", target_url, req.params, req.query, req.body, req.headers);
            
            delete req.params[0];

            var options = {
                method: 'DEL',
                url: target_url,
                params: _.extend({}, req.params, req.query),
                body: req.body,
                headers: req.headers
            };
            
            axios.request(options).then(function (response) {
                //console.log("OOOO", response);
                if(conf.strategy[switch_value]['post_processor']!=null && typeof conf.strategy[switch_value]['post_processor']=="function") {
                    conf.strategy[switch_value]['post_processor'](req.url, response.data, function(data) {
                        res.send(_.extend({
                            "status": "success",
                        }, data));
                        return next();
                    });
                } else {
                    res.send(_.extend({
                        "status": "success",
                    }, response.data));
                    return next();
                }
            }).catch(function (error) {
                //console.log("OOOO", response);
                if(error.response==null) {
                    res.send({
                        "status": "error",
                        "msg": "timeout"
                    });
                    return next();
                }
                res.send({
                    "status": "error",
                    "msg": "Microservice Error",
                    "data": error.response.data
                });
                return next();
            });
        });
    }
})