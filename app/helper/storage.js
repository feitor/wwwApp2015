var filesystem = null;
var folderNameList = [];
var currentFolderName = null;
var fileNameList = [];
var fileURLList = [];
var fileList = [];



// list all folders in the filesystem
function listFileSystem(defer) {
    var dirReader = filesystem.root.createReader();

    // read all directories in the system
    var entries = [];

    // Call the reader.readEntries() until no more results are returned.
    var readEntries = function () {
        dirReader.readEntries(function (results) {
            if (!results.length) {
                // create an empty folder list
                folderNameList = [];

                entries = entries.sort();
                entries.forEach(function (entry, i) {
                    if (entry.isDirectory)
                        folderNameList.push(entry.name);
                });
                defer.resolve();
            } else {
                entries = entries.concat(toArray(results));
                readEntries();
            }
        }, errorHandler);
    };

    // Start reading all subdirectories
    readEntries();
}

// add files in the default folder into the memory
function listFolder(folder, defer) {
    // create empty file list
    fileNameList = [];
    fileURLList = [];
    fileList = [];

    // read all files from the folder and update to the list
    filesystem.root.getDirectory(folder, {}, function (dirEntry) {
        var dirReader = dirEntry.createReader();
        var entries = [];

        // Call the reader.readEntries() until no more results are returned.
        var readEntries = function () {
            dirReader.readEntries(function (results) {
                if (!results.length) {
                    var size = Object.keys(entries).length;
                    entries = entries.sort();
                    _.each(entries, function (entry, i) {
                        if (entry.isFile) {
                            // store the name and the URL of the files
                            fileNameList.push(entry.name);
                            fileURLList.push(entry.toURL());
                            entry.file(function (file) {
                                fileList.push(file)
                                if (--size === 0) {
                                    defer.resolve()
                                }
                            }, errorHandler);
                        }
                    });
                    //empty folder
                    if (size === 0) {
                        defer.resolve()
                    }
                } else {
                    entries = entries.concat(toArray(results));
                    readEntries();
                }
            }, errorHandler);
        }

        // Start reading all files
        readEntries();
    }, errorHandler);
}

function delete_file(fileName, defer) {
    filesystem.root.getFile(currentFolderName + '/' + fileName, { create: false }, function (fileEntry) {
        fileEntry.remove(function () {
            defer.resolve();
        }, FSerrorHandler);
    }, FSerrorHandler);
}

function setUrl(file) {
    filesystem.root.getFile(currentFolderName + '/' + file.meta.name, { create: false }, function (fileEntry) {
        file.fileUrl = fileEntry.toURL();
    }, FSerrorHandler);
}

function getFile(fileName, defer) {
    filesystem.root.getFile(currentFolderName + '/' + fileName, { create: false }, function (fileEntry) {
        fileEntry.file(function (file) {
            defer.resolve(file)
        });
    }, FSerrorHandler);
}

// create new folder
function createFolder(folderName, defer) {
    filesystem.root.getDirectory(folderName, { create: true }, function (dirEntry) { defer.resolve() }, errorHandler);

}


// remove a folder
function removeFolder(folderName, defer) {
    filesystem.root.getDirectory(folderName, {}, function (dirEntry) {
        dirEntry.removeRecursively(function () {
            defer.resolve();
        }, errorHandler);
    }, errorHandler);
}


// save the chosen file into the local storage (called by addfileInFS)
function writeFiletoFS(fileName, content, fileType, defer) {
    filesystem.root.getFile(currentFolderName + '/' + fileName, { create: true, exclusive: true }, function (fileEntry) {
        fileEntry.createWriter(function (fileWriter) {
            var blob = new Blob([content], { type: fileType });
            fileWriter.write(blob);

            defer.resolve();
            console.log("file written");

        }, errorHandler);
    }, errorHandler);
}

// Add File event
function addfileInFS(file, defer) {

    // read the file content
    var reader = new FileReader();
    console.log("ready to read file");
    // Read in the file as binary string
    reader.readAsArrayBuffer(file);

    // onloadend event fired
    reader.onloadend = function (evt) {
        if (evt.target.readyState == FileReader.DONE) {
            writeFiletoFS(file.name, evt.target.result, file.type, defer);
        }
    };
}

// handle most of errors related to FileSystem API
function errorHandler(e) {
    var msg = '';

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

    console.log('Error: ' + msg);
}

// toArray prototype
function toArray(list) {
    return Array.prototype.slice.call(list || [], 0);
}

// webpage loaded
function initFs(defer) {
    // access to the filesystem
    window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
    navigator.webkitPersistentStorage.requestQuota(10000 * 1024 * 1024, function (grantedBytes) {
        window.requestFileSystem(PERSISTENT, grantedBytes, function (fs) {
            filesystem = fs;
            defer.resolve();
        }, errorHandler);
    }, function (e) {
        console.log('Error', e);
    });
};