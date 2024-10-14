"use strict";

exports.__esModule = true;
exports.default = void 0;
exports.getLayer = getLayer;
var _react = require("react");
var _layers = require("@deck.gl/layers");
var _geojsonExtent = _interopRequireDefault(require("@mapbox/geojson-extent"));
var _DeckGLContainer = require("../../DeckGLContainer");
var _colors = require("../../utils/colors");
var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));
var _common = require("../common");
var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));
var _fitViewport = _interopRequireDefault(require("../../utils/fitViewport"));
var _jsxRuntime = require("react/jsx-runtime");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); } /**
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
var propertyMap = {
  fillColor: 'fillColor',
  color: 'fillColor',
  fill: 'fillColor',
  'fill-color': 'fillColor',
  strokeColor: 'strokeColor',
  'stroke-color': 'strokeColor',
  'stroke-width': 'strokeWidth'
};
var alterProps = (props, propOverrides) => {
  var newProps = {};
  Object.keys(props).forEach(k => {
    if (k in propertyMap) {
      newProps[propertyMap[k]] = props[k];
    } else {
      newProps[k] = props[k];
    }
  });
  if (typeof props.fillColor === 'string') {
    newProps.fillColor = (0, _colors.hexToRGB)(props.fillColor);
  }
  if (typeof props.strokeColor === 'string') {
    newProps.strokeColor = (0, _colors.hexToRGB)(props.strokeColor);
  }
  return _extends({}, newProps, propOverrides);
};
var features;
var recurseGeoJson = (node, propOverrides, extraProps) => {
  if (node != null && node.features) {
    node.features.forEach(obj => {
      recurseGeoJson(obj, propOverrides, node.extraProps || extraProps);
    });
  }
  if (node != null && node.geometry) {
    var newNode = _extends({}, node, {
      properties: alterProps(node.properties, propOverrides)
    });
    if (!newNode.extraProps) {
      newNode.extraProps = extraProps;
    }
    features.push(newNode);
  }
};
function setTooltipContent(o) {
  var _o$object;
  return ((_o$object = o.object) == null ? void 0 : _o$object.extraProps) && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    className: "deckgl-tooltip",
    children: Object.keys(o.object.extraProps).map((prop, index) => {
      var _o$object$extraProps;
      return /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default, {
        label: prop + ": ",
        value: "" + ((_o$object$extraProps = o.object.extraProps) == null ? void 0 : _o$object$extraProps[prop])
      }, "prop-" + index);
    })
  });
}
var getFillColor = feature => {
  var _feature$properties;
  return feature == null || (_feature$properties = feature.properties) == null ? void 0 : _feature$properties.fillColor;
};
var getLineColor = feature => {
  var _feature$properties2;
  return feature == null || (_feature$properties2 = feature.properties) == null ? void 0 : _feature$properties2.strokeColor;
};
function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var fc = fd.fill_color_picker;
  var sc = fd.stroke_color_picker;
  var fillColor = [fc.r, fc.g, fc.b, 255 * fc.a];
  var strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  var propOverrides = {};
  if (fillColor[3] > 0) {
    propOverrides.fillColor = fillColor;
  }
  if (strokeColor[3] > 0) {
    propOverrides.strokeColor = strokeColor;
  }
  features = [];
  recurseGeoJson(payload.data, propOverrides);
  var jsFnMutator;
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    features = jsFnMutator(features);
  }
  return new _layers.GeoJsonLayer(_extends({
    id: "geojson-layer-" + fd.slice_id,
    data: features,
    extruded: fd.extruded,
    filled: fd.filled,
    stroked: fd.stroked,
    getFillColor,
    getLineColor,
    getLineWidth: fd.line_width || 1,
    pointRadiusScale: fd.point_radius_scale,
    lineWidthUnits: fd.line_width_unit
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent)));
}
var DeckGLGeoJson = props => {
  var _payload$data2;
  var containerRef = (0, _react.useRef)();
  var setTooltip = (0, _react.useCallback)(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var {
    formData,
    payload,
    setControlValue,
    onAddFilter,
    height,
    width
  } = props;
  var viewport = (0, _react.useMemo)(() => {
    if (formData.autozoom) {
      var _payload$data;
      var points = (payload == null || (_payload$data = payload.data) == null || (_payload$data = _payload$data.features) == null || _payload$data.reduce == null ? void 0 : _payload$data.reduce((acc, feature) => {
        var bounds = (0, _geojsonExtent.default)(feature);
        if (bounds) {
          return [...acc, [bounds[0], bounds[1]], [bounds[2], bounds[3]]];
        }
        return acc;
      }, [])) || [];
      if (points.length) {
        return (0, _fitViewport.default)(props.viewport, {
          width,
          height,
          points
        });
      }
    }
    return props.viewport;
  }, [formData.autozoom, height, payload == null || (_payload$data2 = payload.data) == null ? void 0 : _payload$data2.features, props.viewport, width]);
  var layer = getLayer(formData, payload, onAddFilter, setTooltip);
  console.log("formData: " + formData);
  console.log("Payload: " + payload);
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_DeckGLContainer.DeckGLContainerStyledWrapper, {
    ref: containerRef,
    mapboxApiAccessToken: payload.data.mapboxApiKey,
    viewport: viewport,
    layers: [layer],
    mapStyle: formData.mapbox_style,
    setControlValue: setControlValue,
    height: height,
    width: width
  });
};
var _default = exports.default = /*#__PURE__*/(0, _react.memo)(DeckGLGeoJson);