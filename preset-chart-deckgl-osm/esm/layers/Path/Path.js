function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* eslint-disable react/no-array-index-key */
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
import { PathLayer } from '@deck.gl/layers';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { jsx as _jsx } from "react/jsx-runtime";
function setTooltipContent(o) {
  var _o$object;
  return ((_o$object = o.object) == null ? void 0 : _o$object.extraProps) && /*#__PURE__*/_jsx("div", {
    className: "deckgl-tooltip",
    children: Object.keys(o.object.extraProps).map((prop, index) => /*#__PURE__*/_jsx(TooltipRow, {
      label: prop + ": ",
      value: "" + o.object.extraProps[prop]
    }, "prop-" + index))
  });
}
export function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var c = fd.color_picker;
  var fixedColor = [c.r, c.g, c.b, 255 * c.a];
  var data = payload.data.features.map(feature => _extends({}, feature, {
    path: feature.path,
    width: fd.line_width,
    color: fixedColor
  }));
  if (fd.js_data_mutator) {
    var jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  return new PathLayer(_extends({
    id: "path-layer-" + fd.slice_id,
    getColor: d => d.color,
    getPath: d => d.path,
    getWidth: d => d.width,
    data,
    rounded: true,
    widthScale: 1,
    widthUnits: fd.line_width_unit
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
}
function getPoints(data) {
  var points = [];
  data.forEach(d => {
    points = points.concat(d.path);
  });
  return points;
}
export default createDeckGLComponent(getLayer, getPoints);