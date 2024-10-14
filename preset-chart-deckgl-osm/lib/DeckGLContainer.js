"use strict";

exports.__esModule = true;
exports.DeckGLContainerStyledWrapper = exports.DeckGLContainer = void 0;
var _react = require("react");
var _lodash = require("lodash");
var _deck = _interopRequireDefault(require("deck.gl"));
var _core = require("@superset-ui/core");
var _Tooltip = _interopRequireDefault(require("./components/Tooltip"));
var _geoLayers = require("@deck.gl/geo-layers");
var _layers = require("@deck.gl/layers");
var _jsxRuntime = require("react/jsx-runtime");
var _templateObject;
var _excluded = ["data"];
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
// import 'mapbox-gl/dist/mapbox-gl.css';
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _taggedTemplateLiteralLoose(e, t) { return t || (t = e.slice(0)), e.raw = t, e; }
function _objectWithoutPropertiesLoose(r, e) { if (null == r) return {}; var t = {}; for (var n in r) if ({}.hasOwnProperty.call(r, n)) { if (e.includes(n)) continue; t[n] = r[n]; } return t; }
var TICK = 250; // milliseconds

var DeckGLContainer = exports.DeckGLContainer = /*#__PURE__*/(0, _react.memo)(/*#__PURE__*/(0, _react.forwardRef)((props, ref) => {
  var [tooltip, setTooltip] = (0, _react.useState)(null);
  var [lastUpdate, setLastUpdate] = (0, _react.useState)(null);
  var [viewState, setViewState] = (0, _react.useState)(props.viewport);
  var prevViewport = (0, _core.usePrevious)(props.viewport);
  (0, _react.useImperativeHandle)(ref, () => ({
    setTooltip
  }), []);
  var tick = (0, _react.useCallback)(() => {
    // Rate limiting updating viewport controls as it triggers lots of renders
    if (lastUpdate && Date.now() - lastUpdate > TICK) {
      var setCV = props.setControlValue;
      if (setCV) {
        setCV('viewport', viewState);
      }
      setLastUpdate(null);
    }
  }, [lastUpdate, props.setControlValue, viewState]);
  (0, _react.useEffect)(() => {
    var timer = setInterval(tick, TICK);
    return clearInterval(timer);
  }, [tick]);

  // Only update viewport state when necessary (on meaningful changes)
  (0, _react.useEffect)(() => {
    if (!(0, _lodash.isEqual)(props.viewport, prevViewport)) {
      setViewState(props.viewport);
    }
  }, [props.viewport, prevViewport]);

  // Handle view state change when the user interacts with the map
  var onViewStateChange = (0, _react.useCallback)(_ref => {
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
  var osmTileLayer = (0, _react.useMemo)(() => new _geoLayers.TileLayer({
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
      return [new _layers.BitmapLayer(otherProps, {
        image: data,
        bounds: [west, south, east, north]
      })];
    }
  }), []);

  // Handle layers, memoize to avoid recreating layers on each render
  var layers = (0, _react.useMemo)(() => {
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
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)(_jsxRuntime.Fragment, {
    children: [/*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      style: {
        position: 'relative',
        width,
        height
      },
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_deck.default, {
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
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_Tooltip.default, {
      tooltip: tooltip
    })]
  });
}));
var DeckGLContainerStyledWrapper = exports.DeckGLContainerStyledWrapper = (0, _core.styled)(DeckGLContainer)(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  .deckgl-tooltip > div {\n    overflow: hidden;\n    text-overflow: ellipsis;\n  }\n"])));