


function FileDownload(meta, user_id, file_id) {
    this.id = file_id;
    this.user_id = user_id;
    this.meta = meta;

    this.file_size = getReadableFileSizeString(this.meta.size);
    this.downloading = false;
    //this.createdChunksWritePointer;
    //this.recievedChunks;
    //this.recievedChunksWritePointer
    //this.saved_fileEntry;
}

/* cancel incoming file */
FileDownload.prototype.cancel_file = function () {
    this.downloading = false; /* deny file info from user */
    this.delete_file();
    this.meta.chunks_recieved = 0;
    /* create a new download link */
    //this.create_pre_file_link(rtc.usernames[this.user_id]);
}

/* delete a file - should be called when cancel is requested or kill is called */
FileDownload.prototype.delete_file = function () {
    currentFileDownloaded = undefined;
    filesystem.root.getFile(currentFolderName + '/' + this.meta.name, { create: false }, function (fileEntry) {
        fileEntry.remove(function () {
        }, FSerrorHandler);
    }, FSerrorHandler);
}


FileDownload.prototype.write_to_file = function (user_username, chunk_data, chunk_num, hash) {



    /* store our chunk temporarily in memory */
    this.recievedChunks[chunk_num % chunksPerACK] = chunk_data;

    /* once done recieving all chunks for this ack, start writing to memory */
    if (chunk_num % chunksPerACK == (chunksPerACK - 1) || this.meta.numOfChunksInFile == (chunk_num + 1)) {
        this.store_in_fs(user_username, hash);
    }
}

/* only called by write_to_file */
FileDownload.prototype.store_in_fs = function (user_username, hash) {

    /* massive thanks to http://stackoverflow.com/questions/10720704/filesystem-api-upload-from-local-drive-to-local-filesystem */
    if (this.createdChunksWritePointer == false) {
        options = { create: true };
        this.createdChunksWritePointer = true;
    } else {
        options = { create: false };
    }

    filesystem.root.getFile(
		currentFolderName + "/" + this.meta.name,
		options,
		$.proxy(function (fileEntry) {
		    /* create a writer that can put data in the file */
		    fileEntry.createWriter($.proxy(function (writer) {

		        /* once we have written all chunks per ack */
		        writer.onwriteend = $.proxy(function () {

		            /* request the next chunk */
		            this.recievedChunks = [];
		            this.requestedChunksWritePointer += chunksPerACK;

		            if (this.meta.numOfChunksInFile > this.recievedChunksWritePointer) {
		                this.request_chunk(this.recievedChunksWritePointer, hash);
		            }
		        }, this);

		        writer.onerror = FSerrorHandler;

		        /* build the blob based on the binary array this.recievedChunks[user_id] */
		        var builder = new Blob(this.recievedChunks, [this.meta.type]);


		        /* write the blob to the file, this can only be called once! Will fail silently if called while writing! We avoid this by only writing once per ack. */
		        var seek = this.recievedChunksWritePointer * get_chunk_size($.browser.name, this.meta.browser);
		        writer.seek(seek);
		        writer.write(builder);
		        this.recievedChunksWritePointer += chunksPerACK;

		        /* EOF condition */
		        if (this.meta.numOfChunksInFile <= (this.recievedChunksWritePointer)) {
		            console.log("creating file link!");

		            this.fileUrl = fileEntry.toURL()
		            //setUrl(this);
		            /* stop accepting file info */
		            this.downloading = false;

		            /* on encrypted completion here, send hash back to other user who verifies it, then sends the OK to finish back */

		            currentFileDownloaded = undefined;
		            

		        }
		    }, this), FSerrorHandler);
		}, this), FSerrorHandler);
}

/* request chunk # chunk_num from id, at this point just used to request the first chunk */
FileDownload.prototype.request_chunk = function (chunk_num, hash) {
   

    dataChannelChat.send(this.user_id, JSON.stringify({
        "eventName": "request_chunk",
        "data": {
            "chunk": chunk_num,
            "file_id": this.id,
            "browser": $.browser.name
        }
    }));

}


/* inbound - recieve binary data (from a file)
 * we are going to have an expectation that these packets arrive in order (requires reliable datachannel)
 */
FileDownload.prototype.process_binary = function (message, hash) {
    if (!this.downloading) {
        return;
    }

    /* We can write to a file using FileSystem! Chrome has native support, FF uses idb.filesystem.js library */
    /* Note that decrypted file packets are passed here by file_decrypt, we don't have to do any decryption here */

    this.write_to_file(rtc.usernames[this.user_id], message, this.meta.chunks_recieved, hash);
    this.meta.chunks_recieved++;

    if (this.meta.numOfChunksInFile <= this.meta.chunks_recieved) {
        console.log("done downloading file!");
        /* stop accepting file info */
        this.downloading = false;
        /* creating the download link is handled by write_to_file */
    }
}

/* request id's file by sending request for block 0 */
FileDownload.prototype.download_file = function () {

    /* event listeners or javascript can call us, if id isn't set, must have been an event listener */
    /*if (typeof id == 'object') {
		var str = id.target.id;
		id = str.replace("-download", "");
	}*/

    /* We can't request multiple filesystems or resize it at this time. Avoiding hacking around this ATM
	 * and will instead display warning that only 1 file can be downloaded at a time :(
	 */
    if (currentFileDownloaded) {
        boot_alert("Sorry, but only 1 file can be downloaded or stored in browser memory at a time, please [c]ancel or [d]elete the other download and try again.");
        return;
    }


    
        currentFileDownloaded = this.id;
        this.downloading = true; /* accept file info from user */
        this.request_chunk(0, 0);

    this.meta.chunks_recieved = 0;
    this.recievedChunksWritePointer = 0;
    this.createdChunksWritePointer = false;
    this.requestedChunksWritePointer = 0;
    this.recievedChunks = [];
}
