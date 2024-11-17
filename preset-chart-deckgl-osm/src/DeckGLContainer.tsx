import {
  forwardRef,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
} from 'react';
import { isEqual } from 'lodash';
import { Layer } from '@deck.gl/core';
import DeckGL from 'deck.gl';
import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
import Tooltip, { TooltipProps } from './components/Tooltip';
import { Viewport } from './utils/fitViewport';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

const TICK = 250; // milliseconds

export type LayerWithVisibility = {
  layer: Layer | (() => Layer);
  visible: boolean;
  id: string;
};

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
  children?: ReactNode;
  width: number;
  height: number;
  layers: LayerWithVisibility[];
  onViewportChange?: (viewport: Viewport) => void;
  onLayerVisibilityChange?: (layerId: string, visible: boolean) => void;
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [viewState, setViewState] = useState(props.viewport);
    const prevViewport = usePrevious(props.viewport);

    useImperativeHandle(ref, () => ({ 
      setTooltip,
      toggleLayerVisibility: (layerId: string) => {
        const updatedLayers = props.layers.map(l => 
          l.id === layerId ? { ...l, visible: !l.visible } : l
        );
        if (props.onLayerVisibilityChange) {
          const layer = updatedLayers.find(l => l.id === layerId);
          if (layer) {
            props.onLayerVisibilityChange(layerId, layer.visible);
          }
        }
      }
    }), [props.layers, props.onLayerVisibilityChange]);

    const tick = useCallback(() => {
      if (lastUpdate && Date.now() - lastUpdate > TICK) {
        const setCV = props.setControlValue;
        if (setCV) {
          setCV('viewport', viewState);
        }
        setLastUpdate(null);
      }
    }, [lastUpdate, props.setControlValue, viewState]);

    useEffect(() => {
      const timer = setInterval(tick, TICK);
      return () => clearInterval(timer);
    }, [tick]);

    useEffect(() => {
      if (!isEqual(props.viewport, prevViewport)) {
        setViewState(props.viewport);
      }
    }, [props.viewport, prevViewport]);

    const onViewStateChange = useCallback(
      ({ viewState }: { viewState: JsonObject }) => {
        setViewState(viewState as Viewport);
        setLastUpdate(Date.now());
        if (props.setControlValue) {
          props.setControlValue('viewport', viewState);
        }
      },
      [props.setControlValue]
    );

    const osmTileLayer = useMemo(() => new TileLayer({
      id: 'osm-tile-layer',
      data: props.mapStyle,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 256,
      renderSubLayers: props => {
        const [[west, south], [east, north]] = props.tile.boundingBox;
        const {data, ...otherProps} = props;
  
        return [
          new BitmapLayer(otherProps, {
            image: data,
            bounds: [west, south, east, north]
          })
        ];
      }
    }), [props.mapStyle]);

    const layers = useMemo(() => {
      const visibleLayers = props.layers.filter(l => l.visible);
      return [
        osmTileLayer,
        ...visibleLayers.map(l => (typeof l.layer === 'function' ? l.layer() : l.layer)),
      ] as Layer[];
    }, [osmTileLayer, props.layers]);

    const { children = null, height, width } = props;

    return (
      <>
        <div style={{ position: 'relative', width, height }}>
          <DeckGL
            controller
            width={width}
            height={height}
            layers={layers}
            viewState={viewState}
            glOptions={{ preserveDrawingBuffer: true }}
            onViewStateChange={onViewStateChange}
          >
          </DeckGL>
          {children}
        </div>
        <Tooltip tooltip={tooltip} />
      </>
    );
  }),
);

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export type DeckGLContainerHandle = typeof DeckGLContainer & {
  setTooltip: (tooltip: ReactNode) => void;
  toggleLayerVisibility: (layerId: string) => void;
};