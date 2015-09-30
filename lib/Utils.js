var fs = require('fs');
var request = require('request');
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

function externalIp(callback) {
    request('http://icanhazip.com/', function (error, response, body) {
        ((!error && response.statusCode == 200) ?
            callback(null, 'http://' + body.trim()) :
            callback('Error fetching the external Ip', null));
    });
}

function getTitle(text) {
    var re = new RegExp("<title>(.*?)</title>", "i");
    return(text.match(re)[1]);
}

module.exports.formatIp = formatIp;
module.exports.savePage = savePage;
module.exports.externalIp = externalIp;
module.exports.getTitle = getTitle;
