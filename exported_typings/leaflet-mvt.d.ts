declare module LeafletMVT {
    // Tag interface
    export interface Style {}
    interface PointBaseStyle {
        color: string;
        radius: number;
        iconUrl?: string;
    }

    export interface PointStyle extends PointBaseStyle, Style {
        selected?: PointBaseStyle
    }

    interface LineBaseStyle {
        color: string;
        size: number;
    }

    export interface LineStyle extends LineBaseStyle, Style {
        selected?: LineBaseStyle
    }

    interface PolygonBaseStyle {
        color: string;
        outline?: LineBaseStyle;
    }

    export interface PolygonStyle extends PolygonBaseStyle, Style {
        selected?: PolygonBaseStyle
    }

    export interface VectorTileFeature {
        type: number; // 1 for Point, 2 for LineString, 3 for Polygon
        properties: {[k: string]: any};
    }

    export interface StyleFunction {
        (feature: VectorTileFeature): Style
    }

    export interface Feature extends VectorTileFeature {
        id: string;
        select(): void;
        deselect(): void;
        toggle(): void;
        redraw(): void;
        style: Style;
    }

    export interface Layer {
        features: {[id: string]: Feature};
    }

    export interface Options {
        url: string;
        debug?: boolean;
        clickableLayers?: string[];
        mutexToggle?: boolean;
        getIDForLayerFeature: (feature: LeafletMVT.VectorTileFeature) => string;
        filter: (feature: LeafletMVT.VectorTileFeature) => boolean;
        style?: LeafletMVT.StyleFunction | {[name: string]: LeafletMVT.StyleFunction};
        visibleLayers?: string[] | {[name: string]: string};
        onClick?: (e: L.LeafletMouseEvent) => any;
        buffer?: number;
        xhrHeaders?: {[key: string]: string};
        zIndex?: number;
    }

    export interface MVTLayersOptions extends L.LayersOptions {
         layerNames: { [layerName: string]: string; };
    }
}

declare module L {
    module TileLayer {
        export interface MVTSource extends L.TileLayer {
            layers: {[name: string]: LeafletMVT.Layer};
            setStyle(styleFn: LeafletMVT.StyleFunction, name?: string): void;
            featureAtLatLng(latlng: LatLng): LeafletMVT.Feature;
            featureAtContainerPoint(containerPoint: Point): LeafletMVT.Feature;
        }
    }
    interface TileLayerStatic {
        MVTSource: {
            /**
              * Instantiates a MapboxVectorTile layer object given a base URL of the tile server.
              */
            new(options: LeafletMVT.Options): TileLayer.MVTSource;
        };
    }
    module Control {
        export interface MVTLayers extends L.Control.Layers {
        }
    }
    interface ControlStatic {
        MVTLayers: {
            new(baseLayers?: any, overlayLayers?: any, options?: LeafletMVT.MVTLayersOptions): Control.MVTLayers;
        }
    }
}
