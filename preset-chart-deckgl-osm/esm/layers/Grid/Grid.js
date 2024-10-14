function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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

import { GridLayer } from '@deck.gl/aggregation-layers';
import { t, CategoricalColorNamespace } from '@superset-ui/core';
import { commonLayerProps, getAggFunc } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { hexToRGB } from '../../utils/colors';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function setTooltipContent(o) {
  return /*#__PURE__*/_jsxs("div", {
    className: "deckgl-tooltip",
    children: [/*#__PURE__*/_jsx(TooltipRow
    // eslint-disable-next-line prefer-template
    , {
      label: t('Longitude and Latitude') + ': ',
      value: o.coordinate[0] + ", " + o.coordinate[1]
    }), /*#__PURE__*/_jsx(TooltipRow
    // eslint-disable-next-line prefer-template
    , {
      label: t('Height') + ': ',
      value: "" + o.object.elevationValue
    })]
  });
}
export function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var colorScale = CategoricalColorNamespace.getScale(fd.color_scheme);
  var colorRange = colorScale.range().map(color => hexToRGB(color));
  var data = payload.data.features;
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    var jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  var aggFunc = getAggFunc(fd.js_agg_function, p => p.weight);
  return new GridLayer(_extends({
    id: "grid-layer-" + fd.slice_id,
    data,
    cellSize: fd.grid_size,
    extruded: fd.extruded,
    colorRange,
    outline: false,
    // @ts-ignore
    getElevationValue: aggFunc,
    // @ts-ignore
    getColorValue: aggFunc
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
}
function getPoints(data) {
  return data.map(d => d.position);
}
export default createDeckGLComponent(getLayer, getPoints);