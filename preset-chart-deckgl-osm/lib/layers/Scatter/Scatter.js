"use strict";

exports.__esModule = true;
exports.default = void 0;
exports.getLayer = getLayer;
var _layers = require("@deck.gl/layers");
var _core = require("@superset-ui/core");
var _common = require("../common");
var _factory = require("../../factory");
var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));
var _geo = require("../../utils/geo");
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
function getPoints(data) {
  return data.map(d => d.position);
}
function setTooltipContent(formData, verboseMap) {
  return o => {
    var _formData$point_radiu, _o$object, _o$object2, _o$object3, _o$object4, _o$object5, _o$object6;
    var label = (verboseMap == null ? void 0 : verboseMap[formData.point_radius_fixed.value]) || (0, _core.getMetricLabel)((_formData$point_radiu = formData.point_radius_fixed) == null ? void 0 : _formData$point_radiu.value);
    return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: "deckgl-tooltip",
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default
      // eslint-disable-next-line prefer-template
      , {
        label: (0, _core.t)('Longitude and Latitude') + ': ',
        value: ((_o$object = o.object) == null || (_o$object = _o$object.position) == null ? void 0 : _o$object[0]) + ", " + ((_o$object2 = o.object) == null || (_o$object2 = _o$object2.position) == null ? void 0 : _o$object2[1])
      }), ((_o$object3 = o.object) == null ? void 0 : _o$object3.cat_color) && /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default
      // eslint-disable-next-line prefer-template
      , {
        label: (0, _core.t)('Category') + ': ',
        value: "" + ((_o$object4 = o.object) == null ? void 0 : _o$object4.cat_color)
      }), ((_o$object5 = o.object) == null ? void 0 : _o$object5.metric) && /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default, {
        label: label + ": ",
        value: "" + ((_o$object6 = o.object) == null ? void 0 : _o$object6.metric)
      })]
    });
  };
}
function getLayer(formData, payload, onAddFilter, setTooltip, datasource) {
  var fd = formData;
  var dataWithRadius = payload.data.features.map(d => {
    var radius = (0, _geo.unitToRadius)(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    if (d.color) {
      return _extends({}, d, {
        radius
      });
    }
    var c = fd.color_picker || {
      r: 0,
      g: 0,
      b: 0,
      a: 1
    };
    var color = [c.r, c.g, c.b, c.a * 255];
    return _extends({}, d, {
      radius,
      color
    });
  });
  return new _layers.ScatterplotLayer(_extends({
    id: "scatter-layer-" + fd.slice_id,
    data: dataWithRadius,
    fp64: true,
    getFillColor: d => d.color,
    getRadius: d => d.radius,
    radiusMinPixels: Number(fd.min_radius) || undefined,
    radiusMaxPixels: Number(fd.max_radius) || undefined,
    stroked: false
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent(fd, datasource == null ? void 0 : datasource.verboseMap))));
}
var _default = exports.default = (0, _factory.createCategoricalDeckGLComponent)(getLayer, getPoints);