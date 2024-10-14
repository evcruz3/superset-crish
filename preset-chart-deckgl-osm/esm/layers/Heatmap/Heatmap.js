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
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { t, getSequentialSchemeRegistry } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { hexToRGB } from '../../utils/colors';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { jsx as _jsx } from "react/jsx-runtime";
function setTooltipContent(o) {
  return /*#__PURE__*/_jsx("div", {
    className: "deckgl-tooltip",
    children: /*#__PURE__*/_jsx(TooltipRow, {
      label: t('Centroid (Longitude and Latitude): '),
      value: "(" + (o == null ? void 0 : o.coordinate[0]) + ", " + (o == null ? void 0 : o.coordinate[1]) + ")"
    })
  });
}
export var getLayer = (formData, payload, onAddFilter, setTooltip) => {
  var _getSequentialSchemeR, _colorScale$range;
  var fd = formData;
  var {
    intensity = 1,
    radius_pixels: radiusPixels = 30,
    aggregation = 'SUM',
    js_data_mutator: jsFnMutator,
    linear_color_scheme: colorScheme
  } = fd;
  var data = payload.data.features;
  if (jsFnMutator) {
    // Applying user defined data mutator if defined
    var jsFnMutatorFunction = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutatorFunction(data);
  }
  var colorScale = (_getSequentialSchemeR = getSequentialSchemeRegistry()) == null || (_getSequentialSchemeR = _getSequentialSchemeR.get(colorScheme)) == null ? void 0 : _getSequentialSchemeR.createLinearScale([0, 6]);
  var colorRange = colorScale == null || (_colorScale$range = colorScale.range()) == null || (_colorScale$range = _colorScale$range.map(color => hexToRGB(color))) == null ? void 0 : _colorScale$range.reverse();
  return new HeatmapLayer(_extends({
    id: "heatmap-layer-" + fd.slice_id,
    data,
    intensity,
    radiusPixels,
    colorRange,
    aggregation: aggregation.toUpperCase(),
    getPosition: d => d.position,
    getWeight: d => d.weight ? d.weight : 1
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
};
function getPoints(data) {
  return data.map(d => d.position);
}
export default createDeckGLComponent(getLayer, getPoints);