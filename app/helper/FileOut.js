function FileUploaded(file, id) {
    this.file_to_upload = file;

    this.id = id;
    this.meta = {}
    this.meta.name = file.name;
    this.meta.size = file.size;
    this.meta.filetype = file.type;
    this.meta.browser = $.browser.name; /* need browser name to set chunk size */
    console.log(this.meta);

    this.send_meta()

    setUrl(this);
    
    
}

/* send out meta data, allow for id to be empty = broadcast */
FileUploaded.prototype.send_meta = function (id) {
    if (jQuery.isEmptyObject(this.meta)) {
        return;
    }
    console.log("sending meta data");
    console.log(this.meta);
    if (!id) {
        dataChannelChat.broadcast(JSON.stringify({
            "eventName": "data_msg",
            "data": {
                "file_id": this.id,
                "file_meta": this.meta
            }
        }));
    } else {
        dataChannelChat.send(id, JSON.stringify({
            "eventName": "data_msg",
            "data": {
                "file_id": this.id,
                "file_meta": this.meta
            }
        }));
    }
}


/* ideally we would check the SCTP queue here to see if we could send, doesn't seem to work right now though... */
FileUploaded.prototype.send_chunk_if_queue_empty = function (id, chunk_num, other_browser, rand, hash) {

    if (chunk_num >= Math.ceil(this.file_to_upload.size / get_chunk_size($.browser.name, other_browser))) {
        return;
    }


    this.sendchunk(id, chunk_num, other_browser, rand, hash);
}

/* Please note that this works by sending one chunk per ack */
FileUploaded.prototype.sendchunk = function (id, chunk_num, other_browser, rand, hash) {
    /* uncomment the following lines and set breakpoints on them to simulate an impaired connection */
    /* if (chunk_num == 30) { console.log("30 reached, breakpoint this line");}
	if (chunk_num == 50) { console.log("30 reached"); }*/

    var reader = new FileReader;
    var upper_limit = (chunk_num + 1) * get_chunk_size(other_browser, $.browser.name);
    if (upper_limit > this.meta.size) { upper_limit = this.meta.size; }

    var seek = chunk_num * get_chunk_size(other_browser, $.browser.name);
    var blob = this.file_to_upload.slice(seek, upper_limit);
    reader.onload = function (event) {
        if (reader.readyState == FileReader.DONE) {

            dataChannelChat.send(id, event.target.result);
        }



    }
    reader.readAsArrayBuffer(blob);
}

/* stop the uploading! */
FileUploaded.prototype.upload_stop = function () {
    /* remove data */
    this.chunks = {};
    this.meta = {};

    /* send a kill message */
    dataChannelChat.broadcast(JSON.stringify({
        "eventName": "kill_msg",
        "data": {
            "file_id": this.id,
            "kill": true
        }
    }));


    /* firefox and chrome specific I think, but clear the file input */
    document.getElementById('select_file').value = '';
}