
module.exports = DefaultTileSource;

function DefaultTileSource(url) {
  this.url = url;
  this.xhr = new XMLHttpRequest();
  this.tileHandlerFn = null;

  return this;
}

DefaultTileSource.prototype.onTileLoad = function(tileHandlerFn) {
  this.tileHandlerFn = tileHandlerFn;
};

DefaultTileSource.prototype.send = function(headers) {
  var onloadHandler = function() {
    var responseData = null;
    if (this.xhr.response != null) {
      responseData = new Uint8Array(this.xhr.response);
    }
    this.tileHandlerFn(responseData, this.xhr);
  };
  this.xhr.onload = onloadHandler.bind(this);
  this.xhr.open('GET', this.url, true); //async is true
  for (var header in headers) {
    this.xhr.setRequestHeader(header, headers[header]);
  }
  this.xhr.responseType = 'arraybuffer';
  this.xhr.send();
};
