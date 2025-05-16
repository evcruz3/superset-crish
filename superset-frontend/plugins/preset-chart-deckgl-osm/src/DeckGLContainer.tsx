/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/forbid-prop-types */
/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  forwardRef,
  memo,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  useMemo,
  useRef,
} from 'react';
import { isEqual } from 'lodash';
import { Layer } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import type { ViewStateChangeParameters } from '@deck.gl/core';
import { LinearInterpolator, WebMercatorViewport } from '@deck.gl/core';
import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
import Tooltip, { TooltipProps } from './components/Tooltip';
// import 'mapbox-gl/dist/mapbox-gl.css';
// import { StaticMap } from 'react-map-gl';
import { Viewport } from './utils/fitViewport';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import React from 'react';
import { PlusOutlined, MinusOutlined, CompassOutlined, ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, ArrowDownOutlined, CopyOutlined, UndoOutlined, RedoOutlined } from '@ant-design/icons';

const TICK = 250; // milliseconds
const ZOOM_STEP = 0.5;
const PITCH_RESET = 0;
const BEARING_RESET = 0;
const BEARING_STEP = 15; // Degrees
const PITCH_STEP = 10;   // Degrees
const MAX_PITCH = 45;    // Max pitch allowed
const TRANSITION_DURATION = 200; // ms for smooth transition

// Styles for the control buttons container
const ControlsContainer = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  flex-direction: column; // Main direction is column
  background-color: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  z-index: 10;

  // Styling for button groups (rows or columns)
  .control-group {
    display: flex;
    &:not(:last-child) {
      border-bottom: 1px solid #ccc; // Separator between groups
    }
  }

  .control-row {
    flex-direction: row; // Buttons within a row are horizontal
  }

  .control-column {
    flex-direction: column; // Buttons within a column are vertical
  }

  // Styling for individual buttons
  button {
    background-color: transparent;
    border: none;
    color: #333;
    padding: 8px;
    cursor: pointer;
    font-size: 16px; // Keep consistent font size
    line-height: 1;
    outline: none;
    display: flex; // Center icon
    align-items: center;
    justify-content: center;
    min-width: 32px; // Ensure buttons have a minimum size

    &:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }

    // Add vertical separator for horizontal buttons
    .control-row &:not(:last-child) {
      border-right: 1px solid #ccc;
    }

    // Add horizontal separator for vertical buttons
    .control-column &:not(:last-child) {
       border-bottom: 1px solid #ccc;
    }
  }
`;

// MapControls Component
interface MapControlsProps {
  viewState: Viewport;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onTiltUp: () => void;
  onTiltDown: () => void;
  onToggleMaxPitch: () => void;
  onFullReset: () => void;
}

const MapControls: React.FC<MapControlsProps> = ({ 
  viewState, 
  onZoomIn, 
  onZoomOut, 
  onRotateLeft, 
  onRotateRight, 
  onTiltUp, 
  onTiltDown, 
  onToggleMaxPitch, 
  onFullReset
}) => {
  return (
    <ControlsContainer>
      {/* Zoom Controls */}
      <div className="control-group control-column">
        <button onClick={onZoomIn} title="Zoom In">
          <PlusOutlined />
        </button>
        <button onClick={onZoomOut} title="Zoom Out">
          <MinusOutlined />
        </button>
      </div>

      {/* Rotation Controls */}
      <div className="control-group control-row">
        <button onClick={onRotateLeft} title="Rotate Left (U-turn Counter-Clockwise)">
          <UndoOutlined />
        </button>
        <button onClick={onFullReset} title="Reset View (Position, Zoom, Bearing, Tilt)">
          <CompassOutlined style={{ transform: `rotate(${- (viewState.bearing || 0)}deg)` }} />
        </button>
        <button onClick={onRotateRight} title="Rotate Right (U-turn Clockwise)">
          <RedoOutlined />
        </button>
      </div>

      {/* Tilt & Toggle Max Pitch Controls */}
      <div className="control-group control-row">
        <button onClick={onTiltUp} title="Tilt Up (Decrease Pitch)">
          <ArrowUpOutlined />
        </button>
        <button onClick={onToggleMaxPitch} title="Toggle Max/Zero Pitch">
          <CopyOutlined />
        </button>
        <button onClick={onTiltDown} title="Tilt Down (Increase Pitch)">
            <ArrowDownOutlined />
        </button>
      </div>
    </ControlsContainer>
  );
};

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
  children?: ReactNode;
  width: number;
  height: number;
  layers: (Layer | (() => Layer))[];
  onViewportChange?: (viewport: Viewport) => void;
  rangeMap?: Record<string, string>; // Value range to color mapping
};

// Helper function to determine color based on value and range map
export const getColorFromRangeMap = (value: number, rangeMap: Record<string, string> | undefined): string | null => {
  if (!rangeMap || Object.keys(rangeMap).length === 0 || value === null || value === undefined) {
    return null;
  }

  for (const range of Object.keys(rangeMap)) {
    const [min, max] = range.split('-').map(Number);
    if (value >= min && value <= max) {
      return rangeMap[range];
    }
  }

  return null;
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [internalViewState, setInternalViewState] = useState(props.viewport);
    const prevViewport = usePrevious(props.viewport);
    const deckRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const captureImage = useCallback(() => {
      if (deckRef.current) {
        return new Promise<string>((resolve, reject) => {
          try {
            const deck = deckRef.current.deck;
            const image = deck.canvas.toDataURL('image/jpeg');
            resolve(image);
          } catch (error) {
            reject(error);
          }
        });
      }
      return Promise.reject(new Error('DeckGL ref not available'));
    }, []);

    useImperativeHandle(ref, () => ({
      setTooltip,
      captureImage,
      deckRef: deckRef.current,
      containerRef: containerRef.current,
    }), [setTooltip, captureImage]);

    const handleViewStateChange = useCallback(
      ({ viewState, interactionState }: ViewStateChangeParameters) => {
        setInternalViewState(viewState as Viewport);
        if (interactionState?.isDragging || interactionState?.isPanning || interactionState?.isRotating || interactionState?.isZooming) {
          setLastUpdate(Date.now());
        }
        if (props.onViewportChange) {
           props.onViewportChange(viewState as Viewport);
        }
      },
      [props.onViewportChange]
    );

    useEffect(() => {
      const timeSinceLastInteraction = lastUpdate ? Date.now() - lastUpdate : Infinity;
      if (
        !isEqual(props.viewport, prevViewport) &&
        !isEqual(props.viewport, internalViewState) &&
        timeSinceLastInteraction > TICK + 50
      ) {
        setInternalViewState(props.viewport);
      }
    }, [props.viewport, prevViewport, internalViewState, lastUpdate]);

    const debouncedUpdateControlPanel = useCallback(() => {
      if (props.setControlValue && lastUpdate && Date.now() - lastUpdate > TICK) {
        props.setControlValue('viewport', internalViewState);
        setLastUpdate(null);
      }
    }, [props.setControlValue, internalViewState, lastUpdate]);

    useEffect(() => {
      const timerId = setInterval(debouncedUpdateControlPanel, TICK);
      return () => clearInterval(timerId);
    }, [debouncedUpdateControlPanel]);

    const handleZoomIn = useCallback(() => {
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          zoom: internalViewState.zoom + ZOOM_STEP,
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['zoom']),
        },
        interactionState: { isZooming: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleZoomOut = useCallback(() => {
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          zoom: internalViewState.zoom - ZOOM_STEP,
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['zoom']),
        },
        interactionState: { isZooming: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleRotateLeft = useCallback(() => {
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          bearing: (internalViewState.bearing || 0) - BEARING_STEP,
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['bearing']),
        },
        interactionState: { isRotating: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleRotateRight = useCallback(() => {
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          bearing: (internalViewState.bearing || 0) + BEARING_STEP,
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['bearing']),
        },
        interactionState: { isRotating: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleTiltUp = useCallback(() => {
      const currentPitch = internalViewState.pitch || 0;
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          pitch: Math.max(currentPitch - PITCH_STEP, PITCH_RESET),
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['pitch']),
        },
        interactionState: { isRotating: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleTiltDown = useCallback(() => {
      const currentPitch = internalViewState.pitch || 0;
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          pitch: Math.min(currentPitch + PITCH_STEP, MAX_PITCH),
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['pitch']),
        },
        interactionState: { isRotating: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleToggleMaxPitch = useCallback(() => {
      const currentPitch = internalViewState.pitch || 0;
      const targetPitch = Math.abs(currentPitch - MAX_PITCH) < PITCH_STEP / 2 ? PITCH_RESET : MAX_PITCH;
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          ...internalViewState,
          pitch: targetPitch,
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator(['pitch']),
        },
        interactionState: { isRotating: true },
      });
    }, [internalViewState, handleViewStateChange]);

    const handleFullReset = useCallback(() => {
      handleViewStateChange({
        viewId: 'default-view',
        viewState: {
          longitude: props.viewport.longitude,
          latitude: props.viewport.latitude,
          zoom: props.viewport.zoom,
          pitch: PITCH_RESET,
          bearing: BEARING_RESET,
          transitionDuration: TRANSITION_DURATION,
          transitionInterpolator: new LinearInterpolator([
            'longitude', 'latitude', 'zoom', 'pitch', 'bearing'
          ]),
        },
        interactionState: { isPanning: true },
      });
    }, [props.viewport, handleViewStateChange]);

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
            bounds: [west, south, east, north],
            desaturate: 0.5
          })
        ];
      }
    }), [props.mapStyle]);

    const layers = useCallback(() => {
      const enhancedLayers = props.layers.map(layer => {
        if (typeof layer === 'function') {
          const originalLayer = layer();
          if (props.rangeMap && Object.keys(props.rangeMap).length > 0) {
            return new (originalLayer.constructor as any)({
              ...originalLayer.props,
              rangeMap: props.rangeMap,
              getColorFromRangeMap,
            });
          }
          return originalLayer;
        } else if (layer && props.rangeMap && Object.keys(props.rangeMap).length > 0) {
           return new (layer.constructor as any)({
             ...layer.props,
             rangeMap: props.rangeMap,
             getColorFromRangeMap,
           });
        }
        return layer;
      }).filter(Boolean);

      return [osmTileLayer, ...enhancedLayers] as Layer[];
    }, [osmTileLayer, props.layers, props.rangeMap]);

    const { children = null, height, width } = props;

    return (
      <>
        <div ref={containerRef} style={{ position: 'relative', width, height }} className="deck-container" data-component="DeckGLContainer">
          <DeckGL
            ref={deckRef}
            controller
            width={width}
            height={height}
            layers={layers()}
            viewState={internalViewState}
            onViewStateChange={handleViewStateChange}
            glOptions={{ preserveDrawingBuffer: true }}
          >
            {/* <StaticMap
              preserveDrawingBuffer
              mapStyle={'light'}
              mapboxApiAccessToken={'pk.eyJ1IjoiZXJpY2tzb24tcmltZXMiLCJhIjoiY201bXExbWoxMDJpMTJwc2ljeXhlZ3Y3OCJ9.mliFT8407N_TsGRiMFnpcw'}
            /> */}
          </DeckGL>
          <MapControls 
            viewState={internalViewState}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onRotateLeft={handleRotateLeft}
            onRotateRight={handleRotateRight}
            onTiltUp={handleTiltUp}
            onTiltDown={handleTiltDown}
            onToggleMaxPitch={handleToggleMaxPitch}
            onFullReset={handleFullReset}
          />
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
  captureImage: () => Promise<string>;
  deckRef: any;
  containerRef: HTMLDivElement | null;
};