
/***************
	FILE TRANSACTIONS
	
	Copyright 2013 Samuel Erb

	This file is part of webRTCCopy.

	webRTCCopy is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.

	webRTCCopy is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with webRTCCopy.  If not, see <http://www.gnu.org/licenses/>.

	http://www.tldrlegal.com/license/gnu-general-public-license-v3-(gpl-3)
	
****************/

window.requestFileSystem = window.requestFileSystem ||
                           window.webkitRequestFileSystem;
window.URL = window.URL || window.webkitURL;

/* event delegation 
 * -we need to do this to form a chrome app - see https://developer.chrome.com/extensions/contentSecurityPolicy#H2-3
 * -huge thanks to http://stackoverflow.com/questions/13142664/are-multiple-elements-each-with-an-addeventlistener-allowed 
 */

/* sending functionality */
var currentFileDownloaded = 0;
var chunksPerACK = 16; /* 16k * 16 = 256k (buffer size in Chrome & seems to work 100% of the time) */



/*
 * Maximum chunk size is currently limited to 16k.
 *
 * For those who care:
 * - JS should not have to handle chunking passed keeping the browser responsive. 
 * - There should be no sending size limit.
 *
 *	see:
 *		https://code.google.com/p/webrtc/issues/detail?id=2270#c35
 *		https://code.google.com/p/webrtc/issues/detail?id=2279#c18
 *		http://tools.ietf.org/html/draft-ietf-rtcweb-data-channel-07#section-6.6
 */
function get_chunk_size(me, peer) {

        return 16000;
}

/* Used in Chrome to handle larger files (and firefox with idb.filesystem.js) */
window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;



///* creates an entry in our filelist for a user, if it doesn't exist already - TODO: move this to script.js? */
//function create_or_clear_container(id, username, file_id) {
//    var filelist = document.getElementById('filelist_cointainer');
//    if (!filelist) {
//        filelist = document.createElement('div');
//        filelist.id = 'filelist_cointainer';
//        document.body.appendChild(filelist);
//    }
//    var filecontainer = document.getElementById(id);
//    username = sanitize(username);

   
//    if (!filecontainer) {
//        /* if filecontainer doesn't exist, create it */
//        var fs = '<div id="' + id + '">' + username +' -> '+ id+'</div>';
//        filelist.innerHTML = filelist.innerHTML + fs;
//    } else {
//        var fileLinkBox = $('#' + id).children('#' + file_id);
//        if (fileLinkBox.length > 0) {
//            fileLinkBox.remove()
//        }
//    }

//    if (file_id) {
//        /* if the user is downloading something from this person, we should only clear the inside span to save the cancel button */
//        if (this.filesDown[id][file_id].downloading == true) {
//            var fileBox = $('#' + id + ' #' + file_id);
//            var span = fileBox.find("#cancel")[0];
//            if (!span) {
//                fileBox.children().remove();
//                span = document.createElement('span');
//                span.id = "cancel";
//                /* add cancel button */
//                var a = document.createElement('a');
//                //a.download = meta.name;
//                a.id = id + '-cancel';
//                a.href = 'javascript:void(0);';
//                a.style.cssText = 'color:red;';
//                a.textContent = '[c]';
//                a.draggable = true;
//                //append link!

//                fileBox[0].appendChild(span);
//                fileBox[0].appendChild(a);
//            } else {
//                span.innerHTML = "";
//            }
//            return;
//        }
//    }
//}

//create_or_clear_Upload_container = function (id, username, file_id) {
//    var filelist = document.getElementById('uploadFiles_cointainer');
//    if (!filelist) {
//        filelist = document.createElement('div');
//        filelist.id = 'uploadFiles_cointainer';
//        document.body.appendChild(filelist);
//    }
//    var filecontainer = document.getElementById(id);
//    username = sanitize(username);


//    if (!filecontainer) {
//        /* if filecontainer doesn't exist, create it */
//        var fs = '<div id="' + id + '">' + username + '</div>';
//        filelist.innerHTML = filelist.innerHTML + fs;
//    }
//    else {

//        var fileLinkBox = $('#' + id).children('#' + file_id);
//        if (fileLinkBox.length > 0) {
//            fileLinkBox.remove()
//        }
//    }
//}



/* -h */
function getReadableFileSizeString(fileSizeInBytes) {
    var i = -1;
    var byteUnits = [' kB', ' MB', ' GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
        fileSizeInBytes = fileSizeInBytes / 1024;
        i++;
    } while (fileSizeInBytes > 1024);
    return Math.max(fileSizeInBytes, 0.1).toFixed(1) + byteUnits[i];
};





/***** File System Errors *****/
//credit - http://www.html5rocks.com/en/tutorials/file/filesystem/
function FSerrorHandler(e) {
    var msg = '';
    console.log(e);
    switch (e.code) {
        case FileError.QUOTA_EXCEEDED_ERR:
            msg = 'QUOTA_EXCEEDED_ERR';
            break;
        case FileError.NOT_FOUND_ERR:
            msg = 'NOT_FOUND_ERR';
            break;
        case FileError.SECURITY_ERR:
            msg = 'SECURITY_ERR';
            break;
        case FileError.INVALID_MODIFICATION_ERR:
            msg = 'INVALID_MODIFICATION_ERR';
            break;
        case FileError.INVALID_STATE_ERR:
            msg = 'INVALID_STATE_ERR';
            break;
        default:
            msg = 'Unknown Error';
            break;
    };
    console.error('Error: ' + msg);
}

//used for debugging - credit - http://stackoverflow.com/questions/9267899/arraybuffer-to-base64-encoded-string
function _arrayBufferToBase64(buffer) {
    var binary = ''
    var bytes = new Uint8Array(buffer)
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    return window.btoa(binary);
}



var dataChannelChat = {
    broadcast: function (message) {
        for (var connection in rtc.dataChannels) {
            var channel = rtc.dataChannels[connection];
            if (rtc.connection_ok_to_send[connection]) {
               
                    channel.send(message);
                
            } else {
                console.log("unable to send message to " + connection);
            }
        }
    },
    send: function (connection, message) {
        var channel = rtc.dataChannels[connection];
        if (rtc.connection_ok_to_send[connection]) {
            
                channel.send(message);
            
        } else {
            console.log("unable to send message to " + connection);
        }
    },
    recv: function (channel, message) {
        return message; /* need to do post processing later */
    },
    event: 'data stream data'
};

function systemMessage(msg) { }

