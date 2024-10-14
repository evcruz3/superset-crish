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
import { ContourLayer } from 'deck.gl';
import { t } from '@superset-ui/core';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import { createDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function setTooltipContent(o) {
  var _o$object;
  return /*#__PURE__*/_jsxs("div", {
    className: "deckgl-tooltip",
    children: [/*#__PURE__*/_jsx(TooltipRow, {
      label: t('Centroid (Longitude and Latitude): '),
      value: "(" + (o == null ? void 0 : o.coordinate[0]) + ", " + (o == null ? void 0 : o.coordinate[1]) + ")"
    }), /*#__PURE__*/_jsx(TooltipRow, {
      label: t('Threshold: '),
      value: "" + (o == null || (_o$object = o.object) == null || (_o$object = _o$object.contour) == null ? void 0 : _o$object.threshold)
    })]
  });
}
export var getLayer = function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var {
    aggregation = 'SUM',
    js_data_mutator: jsFnMutator,
    contours: rawContours,
    cellSize = '200'
  } = fd;
  var data = payload.data.features;
  var contours = rawContours == null ? void 0 : rawContours.map(contour => {
    var {
      lowerThreshold,
      upperThreshold,
      color,
      strokeWidth
    } = contour;
    if (upperThreshold) {
      // Isoband format
      return {
        threshold: [lowerThreshold, upperThreshold],
        color: [color.r, color.g, color.b]
      };
    }
    // Isoline format
    return {
      threshold: lowerThreshold,
      color: [color.r, color.g, color.b],
      strokeWidth
    };
  });
  if (jsFnMutator) {
    // Applying user defined data mutator if defined
    var jsFnMutatorFunction = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutatorFunction(data);
  }
  return new ContourLayer(_extends({
    id: "contourLayer-" + fd.slice_id,
    data,
    contours,
    cellSize: Number(cellSize || '200'),
    aggregation: aggregation.toUpperCase(),
    getPosition: d => d.position,
    getWeight: d => d.weight || 0
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
};
function getPoints(data) {
  return data.map(d => d.position);
}
export default createDeckGLComponent(getLayer, getPoints);