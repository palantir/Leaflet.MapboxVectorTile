
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
    this.tileHandlerFn(this.xhr.response, this.xhr);
  };
  this.xhr.onload = onloadHandler.bind(this);
  this.xhr.open('GET', this.url, true); //async is true
  for (var header in headers) {
    this.xhr.setRequestHeader(header, headers[header]);
  }
  this.xhr.responseType = 'arraybuffer';
  this.xhr.send();
};
