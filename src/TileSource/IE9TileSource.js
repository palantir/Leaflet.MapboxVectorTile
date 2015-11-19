
module.exports = IE9TileSource;

function IE9TileSource(url) {
  this.url = url;
  this.xhr = new ActiveXObject("MSXML2.XMLHTTP");
  this.tileHandlerFn = null;

  return this;
}

IE9TileSource.prototype.onTileLoad = function(tileHandlerFn) {
  this.tileHandlerFn = tileHandlerFn;
}

IE9TileSource.prototype.send = function(headers) {
  var onloadHandler = function() {
    if (this.xhr.readyState === 4) {
      var responseData = null;
      if (this.xhr.responseBody != null) {
        responseData = this.xhr.responseBody.toArray()
      }
      this.tileHandlerFn(responseData, this.xhr);
    }
  }
  this.xhr.onreadystatechange = onloadHandler.bind(this);
  this.xhr.open('GET', this.url, true); //async is true
  for (var header in headers) {
    this.xhr.setRequestHeader(header, headers[header]);
  }
  this.xhr.send();
}
