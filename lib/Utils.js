var fs = require('fs');
var config = require('../jsonFiles/config.json');

function formatIp(ip, callback) {
    // ip check and protocol
    var validIpAddr = /(http(s)?\:\/\/)?(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}\/?/i;
    if (validIpAddr.test(ip)) {
        var ipWithProtocol = (!(/http(s)?\:\/\//i.test(ip)) ? 'http://' + ip : ip);
        callback(null, ipWithProtocol);
    } else {
        callback('Invalid Ip Address', null);
    }
}

function savePage(page, body) {
    fs.writeFile(config.cache + page, body, function(err) {
        if(err) throw err;
    });
}

module.exports.formatIp = formatIp;
module.exports.savePage = savePage;
