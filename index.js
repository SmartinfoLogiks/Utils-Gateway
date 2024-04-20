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

const LOADED_PLUGINS = {};
const ACTIVE_TASKS = {};

console.log("\x1b[34m%s\x1b[0m","\nGateway Initialization Started @ "+moment().format(),"\n");

process.env.START_TIME = moment().format();
process.env.ROOT_PATH  = __dirname;


const _CONFIG = require('./config');
const _PROXY = require('./proxy');

console.log("Gateway Server - Underconstruction ...");