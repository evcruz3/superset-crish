"use strict";

exports.__esModule = true;
exports.default = void 0;
exports.getLayer = getLayer;
var _layers = require("@deck.gl/layers");
var _core = require("@superset-ui/core");
var _common = require("../common");
var _factory = require("../../factory");
var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));
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
  var points = [];
  data.forEach(d => {
    points.push(d.sourcePosition);
    points.push(d.targetPosition);
  });
  return points;
}
function setTooltipContent(formData) {
  return o => {
    var _o$object, _o$object2, _o$object3, _o$object4, _o$object5;
    return /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      className: "deckgl-tooltip",
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default, {
        label: (0, _core.t)('Start (Longitude, Latitude): '),
        value: ((_o$object = o.object) == null || (_o$object = _o$object.sourcePosition) == null ? void 0 : _o$object[0]) + ", " + ((_o$object2 = o.object) == null || (_o$object2 = _o$object2.sourcePosition) == null ? void 0 : _o$object2[1])
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default, {
        label: (0, _core.t)('End (Longitude, Latitude): '),
        value: ((_o$object3 = o.object) == null || (_o$object3 = _o$object3.targetPosition) == null ? void 0 : _o$object3[0]) + ", " + ((_o$object4 = o.object) == null || (_o$object4 = _o$object4.targetPosition) == null ? void 0 : _o$object4[1])
      }), formData.dimension && /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default, {
        label: (formData == null ? void 0 : formData.dimension) + ": ",
        value: "" + ((_o$object5 = o.object) == null ? void 0 : _o$object5.cat_color)
      })]
    });
  };
}
function getLayer(fd, payload, onAddFilter, setTooltip) {
  var data = payload.data.features;
  var sc = fd.color_picker;
  var tc = fd.target_color_picker;
  return new _layers.ArcLayer(_extends({
    data,
    getSourceColor: d => d.sourceColor || d.color || [sc.r, sc.g, sc.b, 255 * sc.a],
    getTargetColor: d => d.targetColor || d.color || [tc.r, tc.g, tc.b, 255 * tc.a],
    id: "path-layer-" + fd.slice_id,
    strokeWidth: fd.stroke_width ? fd.stroke_width : 3
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent(fd))));
}
var _default = exports.default = (0, _factory.createCategoricalDeckGLComponent)(getLayer, getPoints);