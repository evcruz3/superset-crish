"use strict";

exports.__esModule = true;
exports.default = void 0;
exports.getLayer = getLayer;
var _layers = require("@deck.gl/layers");
var _common = require("../common");
var _sandbox = _interopRequireDefault(require("../../utils/sandbox"));
var _factory = require("../../factory");
var _TooltipRow = _interopRequireDefault(require("../../TooltipRow"));
var _jsxRuntime = require("react/jsx-runtime");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); } /* eslint-disable react/no-array-index-key */ /**
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
function setTooltipContent(o) {
  var _o$object;
  return ((_o$object = o.object) == null ? void 0 : _o$object.extraProps) && /*#__PURE__*/(0, _jsxRuntime.jsx)("div", {
    className: "deckgl-tooltip",
    children: Object.keys(o.object.extraProps).map((prop, index) => /*#__PURE__*/(0, _jsxRuntime.jsx)(_TooltipRow.default, {
      label: prop + ": ",
      value: "" + o.object.extraProps[prop]
    }, "prop-" + index))
  });
}
function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var c = fd.color_picker;
  var fixedColor = [c.r, c.g, c.b, 255 * c.a];
  var data = payload.data.features.map(feature => _extends({}, feature, {
    path: feature.path,
    width: fd.line_width,
    color: fixedColor
  }));
  if (fd.js_data_mutator) {
    var jsFnMutator = (0, _sandbox.default)(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  return new _layers.PathLayer(_extends({
    id: "path-layer-" + fd.slice_id,
    getColor: d => d.color,
    getPath: d => d.path,
    getWidth: d => d.width,
    data,
    rounded: true,
    widthScale: 1,
    widthUnits: fd.line_width_unit
  }, (0, _common.commonLayerProps)(fd, setTooltip, setTooltipContent)));
}
function getPoints(data) {
  var points = [];
  data.forEach(d => {
    points = points.concat(d.path);
  });
  return points;
}
var _default = exports.default = (0, _factory.createDeckGLComponent)(getLayer, getPoints);