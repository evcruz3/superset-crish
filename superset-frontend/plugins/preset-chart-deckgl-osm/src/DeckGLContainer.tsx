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
} from 'react';
import { isEqual } from 'lodash';
import { Layer } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import { JsonObject, JsonValue, styled, usePrevious } from '@superset-ui/core';
import Tooltip, { TooltipProps } from './components/Tooltip';
// import 'mapbox-gl/dist/mapbox-gl.css';
import { Viewport } from './utils/fitViewport';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import React from 'react';

const TICK = 250; // milliseconds

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
};

export const DeckGLContainer = memo(
  forwardRef((props: DeckGLContainerProps, ref) => {
    const [tooltip, setTooltip] = useState<TooltipProps['tooltip']>(null);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [viewState, setViewState] = useState(props.viewport);
    const prevViewport = usePrevious(props.viewport);

    useImperativeHandle(ref, () => ({ setTooltip }), []);

    const tick = useCallback(() => {
      // Rate limiting updating viewport controls as it triggers lots of renders
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
      return clearInterval(timer);
    }, [tick]);

    // Only update viewport state when necessary (on meaningful changes)
    useEffect(() => {
      if (!isEqual(props.viewport, prevViewport)) {
        setViewState(props.viewport);
      }
    }, [props.viewport, prevViewport]);

    // Handle view state change when the user interacts with the map
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


    // Memoize the creation of the TileLayer to avoid unnecessary re-instantiation
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
    }), []);

    // Handle layers, memoize to avoid recreating layers on each render
    const layers = useMemo(() => {
      if (props.layers.some(l => typeof l === 'function')) {
        return [
          osmTileLayer, // Insert the OSM layer as the base layer
          ...props.layers.map(l => (typeof l === 'function' ? l() : l)),
        ] as Layer[];
      }
      return [osmTileLayer, ...props.layers] as Layer[];
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
            glOptions={{ preserveDrawingBuffer: true }} // Disable buffer preservation for better performance
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
};