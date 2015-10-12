var fs = require('fs');
var request = require('request');
var crypto = require('crypto');
var NodeRSA = require('node-rsa');
var HashTable = require('./HashTable.js');
var config = require('../jsonFiles/config.json');

var hashtable = new HashTable();

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

// this function updates the index file with new discovered Datas through the net
function updateIndex() {
    var link = '';

    fs.readFile(config.htFilename, function(error, dataHt) {
        if (error) throw error;
        var readable = JSON.parse(dataHt);

        for (var key in readable) {
            link += ((readable[key]['title'] != '') ? '<b><i>' + readable[key]['title'] + ': </i></b> ' : '') +
                    '<a href="/lff/' + key +'">' +
                    key.substr(0,7) +
                    '</a><br>\n';
        }

        fs.readFile(config.index, function(error, dataIx) {
            fs.readFile(config.header, function(errorHead, dataHead) {
                fs.readFile(config.notifications, function(errNoti, dataNoti) {

                    var numNoti = JSON.parse(dataNoti)['notifications'];

                    var regexURLS = new RegExp('(<div id="URLS">)((.|\n)*)(<\/div>)', 'i');
                    var regexNotifications = new RegExp('(<span id="notifications">)(/d)*(<\/span>)', 'i');

                    var resIdx = dataIx.toString().replace(regexURLS, '$1\n\n' + link + '\n\n$4');
                    var resHead = dataHead.toString().replace(regexNotifications, '$1' + numNoti + '$3');
                    //console.log(resHead)

                    fs.writeFile(config.index, resIdx, function(err1) {
                        if (err1) throw err1;
                        fs.writeFile(config.header, resHead, function(err2) {
                            if (err2) throw err2;
                        });
                    });
                });
            });
        });
    });
}

function showNotifications(url, callback) {
    fs.readFile(config.notifications, function(err, data) {
        var notifications = '';
        var nf = JSON.parse(data);
        var recQue = nf['friendshipRequests']['receivedQueue'];

        if (url == '') {
            if (err) throw err;

            notifications = '<div id="subTitle">Notifications: ' +
                nf['notifications'] +
                '</div>';

            notifications += ((Object.keys(recQue).length > 0) ?
                'Friendship Requests: <a href="rq/">' + Object.keys(recQue).length + '</a>' :
                '');

        } else if (url == 'rq') {
            for (var ip in recQue) {

                notifications += ip.substr(7, ip.length) +
                    '<a href="/accwnp/' + ip.substr(7, ip.length) +
                    '">Accept</a><br>';
            }
        }
        callback(notifications);
    });
}

function friendRequest(ip, pubKey, callback) {
    formatIp(ip, function(error, formattedIp) {
        if (error) {
            console.log(error);
        } else {
            fs.readFile(config.notifications, function(err, data) {
                var nf = JSON.parse(data);
                hashtable.getWellKnownPeers(function(error, peers) {
                    // if this ip isn't a wellKnownPeer
                    if (error || peers.indexOf(formattedIp) != -1) {
                        nf.notifications++;

                        nf['friendshipRequests']['receivedQueue'][formattedIp]= {
                            "pubKey": pubKey
                        };

                        fs.writeFile(config.notifications, JSON.stringify(nf), function(err) {
                            if(err) throw err;
                        });
                    }
                });
            });
        }
    });
}

function friendRequestAccept(ip, pubKey, callback) {
    formatIp(ip, function(error, formattedIp) {
        if (error) {
            console.log(erorr);
        } else {
            hashtable.getWellKnownPeers(function(peers) {
                if (peers.indexOf(formattedIp) == -1) {
                    fs.readFile(config.mlFilename, function(error, mirrorList) {
                        var ml = JSON.parse(mirrorList);
                        ml[formattedIp] = {
                            "pubKey": pubKey
                        };

                        fs.writeFile(config.mlFilename, JSON.stringify(ml), function(err) {
                            if (err) throw err;
                            callback(null, 'Done.');
                        });

                    });
                } else {
                    callback('This peer is already your friend!', null);
                }
            });
        }

    });
}

function deleteFromReceivedQueue(ip, callback) {
    fs.readFile(config.notifications, function(errR, noti) {

        var nf = JSON.parse(noti);
        if (ip in nf['friendshipRequests']['receivedQueue']) {
            delete nf['friendshipRequests']['receivedQueue'][ip];
            nf.notifications--;
            fs.writeFileSync(config.notifications, JSON.stringify(nf));
            callback(null);
        } else {
            callback('No friend requests from ' + ip);
        }

    });
}

function deleteFromToSendQueue(ip, callback) {
    fs.readFile(config.notifications, function(errR, noti) {

        var nf = JSON.parse(noti);
        if (nf['friendshipRequests']['toSendQueue']) {
            nf['friendshipRequests']['toSendQueue'].splice(nf['friendshipRequests']['toSendQueue'].indexOf(ip), 1);
            fs.writeFileSync(config.notifications, JSON.stringify(nf));
            callback(null);
        } else {
            callback('No friend requests to ' + ip);
        }
    });
}

module.exports.formatIp = formatIp;
module.exports.savePage = savePage;
module.exports.externalIp = externalIp;
module.exports.getTitle = getTitle;
module.exports.getSum = getSum;
module.exports.encRSA = encRSA;
module.exports.decRSA = decRSA;
module.exports.updateIndex = updateIndex;
module.exports.getPublicKeyFromIp = getPublicKeyFromIp;
module.exports.showNotifications = showNotifications;
module.exports.friendRequest = friendRequest;
module.exports.deleteFromReceivedQueue = deleteFromReceivedQueue;
