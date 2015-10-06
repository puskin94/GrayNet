var fs = require('fs');
var request = require('request');
var crypto = require('crypto');
var NodeRSA = require('node-rsa');
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
    var data = text.toString();
    var re = new RegExp("<title>(.*?)</title>", "i");
    return ((re.test(data) && data.match(re)[1] != 'GrayNet ~ Index') ? data.match(re)[1] : '');
}

function getSum(text) {
    return crypto.createHash('sha1').update(text, 'utf8').digest('hex');
}

function encRSA(text) {
    var key = new NodeRSA(fs.readFileSync(config.rsaKeysFolders + 'private.key'));
    return(key.encryptPrivate(text)); // use private key for encryption
}

function decRSA(key, text) {
    return(key.decryptPublic(text)); // use public key for decryption
}

function getPublicKeyFromIp(ip, callback) {
    fs.readFile(config.mlFilename, function(error, data) {
        var readable = JSON.parse(data);
        var key = new NodeRSA(readable[ip]['pubKey']);
        callback(key);
    });
}

module.exports.formatIp = formatIp;
module.exports.savePage = savePage;
module.exports.externalIp = externalIp;
module.exports.getTitle = getTitle;
module.exports.getSum = getSum;
module.exports.encRSA = encRSA;
module.exports.decRSA = decRSA;
module.exports.getPublicKeyFromIp = getPublicKeyFromIp;
