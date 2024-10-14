"use strict";

exports.__esModule = true;
exports.default = void 0;
exports.getLayer = getLayer;
var _react = require("react");
var _aggregationLayers = require("@deck.gl/aggregation-layers");
var _core = require("@superset-ui/core");
var _lodash = require("lodash");
var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));
var _common = require("../common");
var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));
var _fitViewport = _interopRequireDefault(require("../../utils/fitViewport"));
var _DeckGLContainer = require("../../DeckGLContainer");
var _jsxRuntime = require("react/jsx-runtime");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); } /* eslint-disable react/sort-prop-types */ /* eslint-disable react/jsx-handler-names */ /**
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
 */ /* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */ // eslint-disable-next-line import/extensions
function getPoints(data) {
  return data.map(d => d.position);
}
function setTooltipContent(o) {
  var _o$coordinate, _o$coordinate2, _o$object;
  return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
    className: "deckgl-tooltip",
    children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default
    // eslint-disable-next-line prefer-template
    , {
      label: (0, _core.t)('Longitude and Latitude') + ': ',
      value: (o == null || (_o$coordinate = o.coordinate) == null ? void 0 : _o$coordinate[0]) + ", " + (o == null || (_o$coordinate2 = o.coordinate) == null ? void 0 : _o$coordinate2[1])
    }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default
    // eslint-disable-next-line prefer-template
    , {
      label: (0, _core.t)('Weight') + ': ',
      value: "" + ((_o$object = o.object) == null ? void 0 : _o$object.cellWeight)
    })]
  });
}
function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var c = fd.color_picker;
  var data = payload.data.features.map(d => _extends({}, d, {
    color: [c.r, c.g, c.b, 255 * c.a]
  }));
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    var jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  return new _aggregationLayers.ScreenGridLayer(_extends({
    id: "screengrid-layer-" + fd.slice_id,
    data,
    cellSizePixels: fd.grid_size,
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: d => d.weight || 0
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent)));
}
var DeckGLScreenGrid = props => {
  var containerRef = (0, _react.useRef)();
  var getAdjustedViewport = (0, _react.useCallback)(() => {
    var features = props.payload.data.features || [];
    var {
      width,
      height,
      formData
    } = props;
    if (formData.autozoom) {
      return (0, _fitViewport.default)(props.viewport, {
        width,
        height,
        points: getPoints(features)
      });
    }
    return props.viewport;
  }, [props]);
  var [stateFormData, setStateFormData] = (0, _react.useState)(props.payload.form_data);
  var [viewport, setViewport] = (0, _react.useState)(getAdjustedViewport());
  (0, _react.useEffect)(() => {
    if (props.payload.form_data !== stateFormData) {
      setViewport(getAdjustedViewport());
      setStateFormData(props.payload.form_data);
    }
  }, [getAdjustedViewport, props.payload.form_data, stateFormData]);
  var setTooltip = (0, _react.useCallback)(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var getLayers = (0, _react.useCallback)(() => {
    var layer = getLayer(props.formData, props.payload, _lodash.noop, setTooltip);
    return [layer];
  }, [props.formData, props.payload, setTooltip]);
  var {
    formData,
    payload,
    setControlValue
  } = props;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)(_DeckGLContainer.DeckGLContainerStyledWrapper, {
      ref: containerRef,
      viewport: viewport,
      layers: getLayers(),
      setControlValue: setControlValue,
      mapStyle: formData.mapbox_style,
      mapboxApiAccessToken: payload.data.mapboxApiKey,
      width: props.width,
      height: props.height
    })
  });
};
var _default = exports.default = /*#__PURE__*/(0, _react.memo)(DeckGLScreenGrid);