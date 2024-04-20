/*
 * Demo Plugin
 * 
 * */

module.exports = {

    initialize: function() {
        console.log("Demo Plugin Initialization");
    },

    execute: function(params, callback) {
        console.log("Running Demo Task", params);
        callback(params);
    }
}