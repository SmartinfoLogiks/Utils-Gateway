/*
 * Demo Plugin
 * 
 * */

module.exports = {

    initialize: function() {
        console.log("Demo Plugin Initialized");
    },

    request: async function(params, type = "params", method = "GET") {
        console.log("Running Demo Task", params);
        callback(params);
    },

    response: async function(params, type = "params", method = "GET") {
        console.log("Running Demo Task", params);
        callback(params);
    }
}