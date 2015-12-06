'use strict';
var encryption_type = "NONE"
var username = "test";


app.controller('roomController', ['$scope', '$routeParams', '$interval', '$rootScope', '$q', function ($scope, $routeParams, $interval, $rootScope, $q) {

    var refresh;
    //var rtccopy_server = "wss:rtccopy.com:8001";
    //var rtccopy_server = "ws:localhost:8000";
    var rtccopy_server = "ws:130.233.42.102:8080";
    $rootScope.currentFolder = currentFolderName = $routeParams.roomName;

    var connectToRoom = function (room, username) {
        if (!PeerConnection) {
            return;
        }
        rtc.connect(rtccopy_server, room, username, encryption_type);
        rtc.on('ready', function (my_socket, usernames) {
            console.log("connected");
            accept_inbound_files();
            refresh = $interval(function () {
                //listUploadedFiles();
            }, 1000)
            listUploadedFiles();

        })

        rtc.on('data stream open', function (id, username) {
            /* add to usernames list */
            $scope.filesDown[id] = {}
            /* if we have a file, send it their way */
            send_metas(id);
        })

        rtc.on('disconnect stream', function (disconnecting_socket, disconnecting_username) {
            delete $scope.filesDown[disconnecting_socket];
            computeFilesDownList();
        });

        initChat();
    }
    initRTC();

    connectToRoom($routeParams.roomName, username);


    /* file IO */
    // sending 
    $scope.filesUp = {};
    $scope.chunks = {};

    //download
    $scope.filesDown = {}
    $scope.filesDownList = {}

    function computeFilesDownList() {
        var liste = {};
        _.each($scope.filesDown, function (list) {
            _.each(list, function (fileDown, name) {
                var add = true
                _.each($scope.filesUp, function (value, key) {
                    if (key === name) {
                        if (fileDown.downloading)
                        {
                            delete $scope.filesUp[key];
                        }
                        else {
                            add = false;
                        }
                    }
                })
                if (add) {
                    liste[name] = fileDown;
                }
            })
        })
        $scope.filesDownList = liste;
    }

    $scope.upload_stop = function (fileId) {
        var defer = $q.defer();
        delete_file($scope.filesUp[fileId].file_to_upload.name, defer);
        defer.promise.then(function () {
            listUploadedFiles();
        })
    }



    function listUploadedFiles() {
        var defer = $q.defer();
        listFolder($rootScope.currentFolder, defer);
        defer.promise.then(function () {
            var removedFiles = _.filter($scope.filesUp, function (fileUp) {
                for (var i = 0; i < fileList.length; i++) {
                    if (fileList[i].name === fileUp.file_to_upload.name) {
                        return false;
                    }
                }
                return true;
            })

            var addedFiles = _.filter(fileList, function (file) {
                var ret = true;
                _.each($scope.filesUp, function (fileUp) {
                    if (fileUp.file_to_upload.name === file.name) {
                        ret = false;
                    }
                })
                return ret;
            })

            _.each(removedFiles, function (value) {
                $scope.filesUp[value.id].upload_stop();
                delete $scope.filesUp[value.id];
            })

            for (var i = 0; i < addedFiles.length ; i++) {
                process_inbound_files(addedFiles[i]);
            }

            computeFilesDownList();


        })
    }

    function process_inbound_files(file) {

        $scope.filesUp[file.name] = new FileUploaded(file, file.name);

        systemMessage("file ready to send");
    }


    function send_metas(id) {
        console.log("send meta");
        console.log($scope.filesUp);

        for (var file in $scope.filesUp) {
            console.log(file);
            $scope.filesUp[file].send_meta(id);
        }
    }

    function accept_inbound_files() {

        $(document).bind('drop dragover dragenter', function (e) {
            // TODO: CSS signal?
            e.preventDefault();
        });

        /* drop a file on the page! */
        $(document).bind('drop', function (e) {
            var files = e.originalEvent.dataTransfer.files
            document.getElementById('select_file').value = '';
            console.log(files.length);
            var defer;
            for (var i = 0; i < files.length; i++) {
                defer = $q.defer();
                /* firefox and chrome specific I think, but clear the file input */
                addfileInFS(files[i], defer)
            }
            defer.promise.then(function () {
                listUploadedFiles();
            })
        });

        document.getElementById('select_file').addEventListener('change', function (e) {
            if (e.target.files.length == 1) {

                var file = e.target.files[0];
                var defer = $q.defer();
                addfileInFS(file, defer);
                defer.promise.then(function () {
                    listUploadedFiles();
                })

                //process_inbound_files(file);

            }
        }, false);
    }



    /* inbound - recieve data
     * note that data.chunk refers to the incoming chunk #
     */
    function process_data(data) {

        if (data.file_meta) {
            /* we are recieving file meta data */
            /* if it contains file_meta, must be meta data! */
            var receivedMeta = data.file_meta;
            receivedMeta.numOfChunksInFile = Math.ceil(receivedMeta.size / get_chunk_size(receivedMeta.browser, $.browser.name));
            receivedMeta.name = sanitize(receivedMeta.name);

            $scope.filesDown[data.id][data.file_id] = new FileDownload(receivedMeta, data.id, data.file_id);
            computeFilesDownList()


            /* create a download link */
            //$scope.filesDown[data.id][data.file_id].create_pre_file_link(data.id, data.username);

            console.log(receivedMeta);
        } else if (data.kill) {
            /* if it is a kill msg, then the user on the other end has stopped uploading! */
            if ($scope.filesDown[data.id][data.file_id].downloading && !$scope.filesUp[data.file_id]) {
                $scope.filesDown[data.id][data.file_id].cancel_file();
            }
            delete $scope.filesDown[data.id][data.file_id];
            computeFilesDownList()


        } else {

            /* Otherwise, we are going to assume that if we have reached here, this is a request to download our file */
            if (data.chunk % chunksPerACK == 0) {
                for (var i = 0; i < chunksPerACK; i++) {
                    $scope.filesUp[data.file_id].send_chunk_if_queue_empty(data.id, data.chunk + i, data.browser, data.rand, data.hash);
                }
            }
        }
    }



    function initChat() {
        var chat;
        chat = dataChannelChat;


        rtc.on(chat.event, function (conn, data, id, username) {
            /* decode and append to data */
            data = chat.recv.apply(this, arguments);

            packet_inbound(id, data);

        });
    }

    function packet_inbound(id, message) {

        if (message.byteLength) { /* must be an arraybuffer, aka a data packet */
            //console.log('recieved arraybuffer!');
            if (currentFileDownloaded) {
                var defer1 = $q.defer();
                var file_id = currentFileDownloaded;
                var isDownloaded = $scope.filesDown[id][file_id].process_binary(message, 0, defer1); /* no reason to hash here */
                defer1.promise.then(function () {
                    var defer2 = $q.defer();
                    getFile($scope.filesDown[id][file_id].meta.name, defer2);
                    defer2.promise.then(function (file) {
                        //add the file to the upload list when it is entierly downloaded
                        process_inbound_files(file)
                        computeFilesDownList();
                    })
                })
                
            }
        } else {
            var data = JSON.parse(message).data;

            data.id = id;
            data.username = rtc.usernames[id]; /* username lookup */


            /* metadata on file */
            process_data(data);
        }
    }

}]);

