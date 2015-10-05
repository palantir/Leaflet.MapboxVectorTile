/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

module.exports = L.Control.MVTLayers = L.Control.Layers.extend({

	initialize: function (baseLayers, overlays, options) {
		L.setOptions(this, options);

        // Map from vector layer name to presented name in toggle
        this._layerNames = this.options.layerNames || {};
		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this.addBaseLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this.addMVTLayer(overlays[i], i);
		}
	},

	addMVTLayer: function (layer, name) {

        var onTileLoad = function(mvtSrc){
            for (var key in mvtSrc.getLayers()){
                var name = this._layerNames[key] || key;
                this.addOverlay(mvtSrc.layers[key], name);
            }
            this._update();
        }
        layer.options.onTilesLoaded = onTileLoad.bind(this);
		return this._update();
	},

	_onInputClick: function () {
		var inputs = this._form.getElementsByTagName('input'),
		    input, layer, hasLayer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._layers[input.layerId].layer;
			hasLayer = this._map.hasLayer(layer);

			if (input.checked && !hasLayer) {
				addedLayers.push(layer);

			} else if (!input.checked && hasLayer) {
				removedLayers.push(layer);
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
            var rl = removedLayers[i];

            // If we're removing a vector layer
            if (rl.mvtSource){
                rl.mvtSource.hideLayer(rl.name);
            } else {
                this._map.removeLayer(removedLayers[i]);
            }
		}
		for (i = 0; i < addedLayers.length; i++) {
            var al = addedLayers[i];

            // If we're adding a vector layer
            if (al.mvtSource){
                al.mvtSource.showLayer(al.name);
                al.mvtSource.redraw();
            } else {
                this._map.addLayer(addedLayers[i]);
            }
		}

		this._handlingClick = false;
		this._refocusOnMap();
	},
});

L.control.mvtLayers = function (baseLayers, overlays, options) {
	return new L.Control.MVTLayers(baseLayers, overlays, options);
};

L.DomUtil.empty = function (el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
};

