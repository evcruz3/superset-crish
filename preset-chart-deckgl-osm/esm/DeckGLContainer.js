var _templateObject;
var _excluded = ["data"];
function _taggedTemplateLiteralLoose(e, t) { return t || (t = e.slice(0)), e.raw = t, e; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (e.includes(n)) continue; t[n] = r[n]; } return t; }
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
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useState, useMemo } from 'react';
import { isEqual } from 'lodash';
import DeckGL from 'deck.gl';
import { styled, usePrevious } from '@superset-ui/core';
import Tooltip from './components/Tooltip';
// import 'mapbox-gl/dist/mapbox-gl.css';

import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
var TICK = 250; // milliseconds

export var DeckGLContainer = /*#__PURE__*/memo(/*#__PURE__*/forwardRef((props, ref) => {
  var [tooltip, setTooltip] = useState(null);
  var [lastUpdate, setLastUpdate] = useState(null);
  var [viewState, setViewState] = useState(props.viewport);
  var prevViewport = usePrevious(props.viewport);
  useImperativeHandle(ref, () => ({
    setTooltip
  }), []);
  var tick = useCallback(() => {
    // Rate limiting updating viewport controls as it triggers lots of renders
    if (lastUpdate && Date.now() - lastUpdate > TICK) {
      var setCV = props.setControlValue;
      if (setCV) {
        setCV('viewport', viewState);
      }
      setLastUpdate(null);
    }
  }, [lastUpdate, props.setControlValue, viewState]);
  useEffect(() => {
    var timer = setInterval(tick, TICK);
    return clearInterval(timer);
  }, [tick]);

  // Only update viewport state when necessary (on meaningful changes)
  useEffect(() => {
    if (!isEqual(props.viewport, prevViewport)) {
      setViewState(props.viewport);
    }
  }, [props.viewport, prevViewport]);

  // Handle view state change when the user interacts with the map
  var onViewStateChange = useCallback(_ref => {
    var {
      viewState
    } = _ref;
    setViewState(viewState);
    setLastUpdate(Date.now());
    if (props.setControlValue) {
      props.setControlValue('viewport', viewState);
    }
  }, [props.setControlValue]);

  // Memoize the creation of the TileLayer to avoid unnecessary re-instantiation
  var osmTileLayer = useMemo(() => new TileLayer({
    id: 'osm-tile-layer',
    data: props.mapStyle,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => {
      var [[west, south], [east, north]] = props.tile.boundingBox;
      var {
          data
        } = props,
        otherProps = _objectWithoutPropertiesLoose(props, _excluded);
      return [new BitmapLayer(otherProps, {
        image: data,
        bounds: [west, south, east, north]
      })];
    }
  }), []);

  // Handle layers, memoize to avoid recreating layers on each render
  var layers = useMemo(() => {
    if (props.layers.some(l => typeof l === 'function')) {
      return [osmTileLayer,
      // Insert the OSM layer as the base layer
      ...props.layers.map(l => typeof l === 'function' ? l() : l)];
    }
    return [osmTileLayer, ...props.layers];
  }, [osmTileLayer, props.layers]);
  var {
    children = null,
    height,
    width
  } = props;
  return /*#__PURE__*/_jsxs(_Fragment, {
    children: [/*#__PURE__*/_jsxs("div", {
      style: {
        position: 'relative',
        width,
        height
      },
      children: [/*#__PURE__*/_jsx(DeckGL, {
        controller: true,
        width: width,
        height: height,
        layers: layers,
        viewState: viewState,
        glOptions: {
          preserveDrawingBuffer: true
        } // Disable buffer preservation for better performance
        ,
        onViewStateChange: onViewStateChange
      }), children]
    }), /*#__PURE__*/_jsx(Tooltip, {
      tooltip: tooltip
    })]
  });
}));
export var DeckGLContainerStyledWrapper = styled(DeckGLContainer)(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  .deckgl-tooltip > div {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n"])));