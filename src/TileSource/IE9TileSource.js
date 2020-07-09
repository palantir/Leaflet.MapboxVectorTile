var Buffer = require('buffer').Buffer;

module.exports = IE9TileSource;

function IE9TileSource(url) {
  this.url = url;
  this.xhr = new ActiveXObject("MSXML2.XMLHTTP");
  this.tileHandlerFn = null;

  return this;
}

IE9TileSource.prototype.onTileLoad = function(tileHandlerFn) {
  this.tileHandlerFn = tileHandlerFn;
};

IE9TileSource.prototype.send = function(headers) {
  var onloadHandler = function() {
    if (this.xhr.readyState === 4) {
      // IE9 sometimes processes the ajax callback out of order, meaning
      // this can happen before the tiles are created by leaflet. setTimeout(0)
      // pushes the drawing to the back of the queue.
      var self = this;
      setTimeout(function() {
        var responseData = null;
        if (self.xhr.responseBody != null) {
          responseData = new Buffer(self.xhr.responseBody.toArray());
        }
        self.tileHandlerFn(responseData, self.xhr);
      }, 0);
    }
  };
  this.xhr.onreadystatechange = onloadHandler.bind(this);
  this.xhr.open('GET', this.url, true); //async is true
  for (var header in headers) {
    this.xhr.setRequestHeader(header, headers[header]);
  }
  this.xhr.send();
};
