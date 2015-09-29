/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

module.exports = L.Control.MVTLayers = L.Control.Layers.extend({

	initialize: function (baseLayers, overlays, options) {
        FOO = [];
        this._nameToLayer = {};
		L.setOptions(this, options);

		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i, false);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name, false);
		return this._update();
	},

	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		return this._update();
	},

	removeLayer: function (layer) {
		layer.off('add remove', this._onLayerChange, this);

		delete this._layers[L.stamp(layer)];
        for (var n in this._nameToLayer){
            if (L.stamp(this._nameToLayer[n]) === id){
                delete this._nameToLayer[n];
            }
        }

		return this._update();
	},

	_addLayer: function (layer, name, overlay) {
		layer.on('add remove', this._onLayerChange, this);

        console.log("_addLayer " + name + " " + overlay);
        console.log(layer);
        if (overlay && Object.keys(layer.getLayers()).length === 0){
            console.log("attaching callback");
            var onTileLoad = function(mvtSource){
                console.log("running callback");
                mvtSource.options.visibleLayers = Object.keys(mvtSource.getLayers());
                this._addReadyLayer(mvtSource, name, overlay);
                this._update();
            };
            layer.options.onTilesLoaded = onTileLoad.bind(this);
        } else {
            this._addReadyLayer(layer, name, overlay);
        }
        console.log('added layer');
        console.log(this._layers);
    },

    _addReadyLayer: function(layer, name, overlay) {
        console.log("loading ready layer, overlay " + overlay);
        console.log(layer);
		var id = L.stamp(layer);
        var base = {}; base[name] = layer;
        var names = layer.getLayers ? layer.getLayers() : base;
        console.log("Names are " + JSON.stringify(Object.keys(names)));

        for (var n in names){
            this._nameToLayer[n] = id;
        }

		this._layers[id] = {
			layer: layer,
			names: names,
			overlay: overlay
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	},

	_update: function () {
		if (!this._container) { return this; }

		L.DomUtil.empty(this._baseLayersList);
		L.DomUtil.empty(this._overlaysList);

		var baseLayersPresent, overlaysPresent, i, obj, baseLayersCount = 0;

		for (i in this._layers) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
			baseLayersCount += !obj.overlay ? 1 : 0;
		}

		// Hide base layers section if there's only one layer.
		if (this.options.hideSingleBase) {
			baseLayersPresent = baseLayersPresent && baseLayersCount > 1;
			this._baseLayersList.style.display = baseLayersPresent ? '' : 'none';
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';

		return this;
	},

    /*
	_onLayerChange: function (e) {
		if (!this._handlingClick) {
			this._update();
		}

		var obj = this._layers[L.stamp(e.target)];

		var type = obj.overlay ?
			(e.type === 'add' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'add' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},
    */

	_addItem: function (obj) {
        var items = [];
        console.log(obj);
        console.log(obj.names);
        FOO.push(obj);
        for (var layerName in obj.names) {
            console.log("adding sublayer " + layerName);
            var label = document.createElement('label'),
                //checked = this._map.hasLayer(obj.layer),
                checked = this.isVisible(obj.layer, layerName, obj.overlay),
                input;

            if (obj.overlay){
                    console.log('Adding overlay elt');
                    input = document.createElement('input');
                    input.type = 'checkbox';
                    input.className = 'leaflet-control-layers-selector';
                    input.defaultChecked = checked;

            } else {
                input = this._createRadioElement('leaflet-base-layers', checked);
            }

            input.layerData = {
                layerId: L.stamp(obj.layer),
                name: layerName,
                overlay: obj.overlay
            };

            L.DomEvent.on(input, 'click', this._onInputClick, this);

            var name = document.createElement('span');
            name.innerHTML = ' ' + layerName;

            // Helps from preventing layer control flicker when checkboxes are disabled
            // https://github.com/Leaflet/Leaflet/issues/2771
            var holder = document.createElement('div');

            label.appendChild(holder);
            holder.appendChild(input);
            holder.appendChild(name);

            var container = obj.overlay ? this._overlaysList : this._baseLayersList;
            container.appendChild(label);

            items.push(label);
        }
        return items;
	},

	_onInputClick: function () {
		var inputs = this._form.getElementsByTagName('input'),
		    input, layer, name, hasLayer;
		var addedLayers = [],
		    removedLayers = [];

		this._handlingClick = true;

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._layers[input.layerData.layerId].layer;
            name  = input.layerData.name;
            overlay = input.layerData.overlay;
			hasLayer = this.isVisible(layer, name, overlay);
            console.log("Layer " + name + " " + overlay + " " + hasLayer);
            console.log("Checked: " + input.checked);

			if (input.checked && !hasLayer) {
                console.log("Going to add " + name);
				addedLayers.push({l: layer, n: name, o: overlay});

			} else if (!input.checked && hasLayer) {
                console.log("Going to remove " + name);
				removedLayers.push({l: layer, n: name, o: overlay});
			}
		}

		// Bugfix issue 2318: Should remove all old layers before readding new ones
		for (i = 0; i < removedLayers.length; i++) {
			//this._map.removeLayer(removedLayers[i]);
            var remLayer = removedLayers[i];
            this.hideLayer(remLayer.l, remLayer.n, remLayer.o);
		}
		for (i = 0; i < addedLayers.length; i++) {
			//this._map.addLayer(addedLayers[i]);
            var aLayer = addedLayers[i];
            this.showLayer(aLayer.l, aLayer.n, aLayer.o);
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

    showLayer: function(layer, name, overlay) {
        console.log("showing layer " + name + " "+ overlay);
        console.log(layer);
        if (overlay){
            layer.showLayer(name);
            this._map.addLayer(layer);
        } else {
            this._map.addLayer(layer);
        }
    },

    hideLayer: function(layer, name, overlay) {
        console.log("hiding layer " + name);
        if (overlay){
            layer.hideLayer(name);
        } else {
            this._map.removeLayer(layer);
        }
    },

    isVisible: function (layer, name, overlay) {
        if (overlay) {
            var vis = layer.options.visibleLayers;
            console.log("visible");
            console.log(layer.options.visibleLayers);
            return vis && vis.indexOf(name) != -1;
        } else {
            return this._map.hasLayer(layer);
        }
    }
});

L.control.mvtLayers = function (baseLayers, overlays, options) {
	return new L.Control.MVTLayers(baseLayers, overlays, options);
};


L.DomUtil.empty = function (el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
};

