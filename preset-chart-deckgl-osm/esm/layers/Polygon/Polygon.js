function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
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
/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@superset-ui/core';
import { PolygonLayer } from '@deck.gl/layers';
import Legend from '../../components/Legend';
import TooltipRow from '../../TooltipRow';
import { getBuckets, getBreakPointColorScaler } from '../../utils';
import { commonLayerProps } from '../common';
import sandboxedEval from '../../utils/sandbox';
import getPointsFromPolygon from '../../utils/getPointsFromPolygon';
import fitViewport from '../../utils/fitViewport';
import { DeckGLContainerStyledWrapper } from '../../DeckGLContainer';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
var DOUBLE_CLICK_THRESHOLD = 250; // milliseconds

function _getElevation(d, colorScaler) {
  /* in deck.gl 5.3.4 (used in Superset as of 2018-10-24), if a polygon has
   * opacity zero it will make everything behind it have opacity zero,
   * effectively showing the map layer no matter what other polygons are
   * behind it.
   */
  return colorScaler(d)[3] === 0 ? 0 : d.elevation;
}
function setTooltipContent(formData) {
  return o => {
    var _formData$metric, _o$object, _o$object2, _o$object3;
    var metricLabel = (formData == null || (_formData$metric = formData.metric) == null ? void 0 : _formData$metric.label) || (formData == null ? void 0 : formData.metric);
    return /*#__PURE__*/_jsxs("div", {
      className: "deckgl-tooltip",
      children: [((_o$object = o.object) == null ? void 0 : _o$object.name) && /*#__PURE__*/_jsx(TooltipRow
      // eslint-disable-next-line prefer-template
      , {
        label: t('name') + ': ',
        value: "" + o.object.name
      }), ((_o$object2 = o.object) == null ? void 0 : _o$object2[formData == null ? void 0 : formData.line_column]) && /*#__PURE__*/_jsx(TooltipRow, {
        label: formData.line_column + ": ",
        value: "" + o.object[formData.line_column]
      }), (formData == null ? void 0 : formData.metric) && /*#__PURE__*/_jsx(TooltipRow, {
        label: metricLabel + ": ",
        value: "" + ((_o$object3 = o.object) == null ? void 0 : _o$object3[metricLabel])
      })]
    });
  };
}
export function getLayer(formData, payload, onAddFilter, setTooltip, selected, onSelect) {
  var fd = formData;
  var fc = fd.fill_color_picker;
  var sc = fd.stroke_color_picker;
  var data = [...payload.data.features];
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    var jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }
  var metricLabel = fd.metric ? fd.metric.label || fd.metric : null;
  var accessor = d => d[metricLabel];
  // base color for the polygons
  var baseColorScaler = fd.metric === null ? () => [fc.r, fc.g, fc.b, 255 * fc.a] : getBreakPointColorScaler(fd, data, accessor);

  // when polygons are selected, reduce the opacity of non-selected polygons
  var colorScaler = d => {
    var baseColor = (baseColorScaler == null ? void 0 : baseColorScaler(d)) || [0, 0, 0, 0];
    if (selected.length > 0 && !selected.includes(d[fd.line_column])) {
      baseColor[3] /= 2;
    }
    return baseColor;
  };
  var tooltipContentGenerator = fd.line_column && fd.metric && ['json', 'geohash', 'zipcode'].includes(fd.line_type) ? setTooltipContent(fd) : () => null;
  return new PolygonLayer(_extends({
    id: "path-layer-" + fd.slice_id,
    data,
    filled: fd.filled,
    stroked: fd.stroked,
    getPolygon: getPointsFromPolygon,
    getFillColor: colorScaler,
    getLineColor: [sc.r, sc.g, sc.b, 255 * sc.a],
    getLineWidth: fd.line_width,
    extruded: fd.extruded,
    lineWidthUnits: fd.line_width_unit,
    getElevation: d => _getElevation(d, colorScaler),
    elevationScale: fd.multiplier,
    fp64: true
  }, commonLayerProps(fd, setTooltip, tooltipContentGenerator, onSelect)));
}
var DeckGLPolygon = props => {
  var containerRef = useRef();
  var getAdjustedViewport = useCallback(() => {
    var viewport = _extends({}, props.viewport);
    if (props.formData.autozoom) {
      var features = props.payload.data.features || [];
      viewport = fitViewport(viewport, {
        width: props.width,
        height: props.height,
        points: features.flatMap(getPointsFromPolygon)
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props]);
  var [lastClick, setLastClick] = useState(0);
  var [viewport, setViewport] = useState(getAdjustedViewport());
  var [stateFormData, setStateFormData] = useState(props.payload.form_data);
  var [selected, setSelected] = useState([]);
  useEffect(() => {
    var {
      payload
    } = props;
    if (payload.form_data !== stateFormData) {
      setViewport(getAdjustedViewport());
      setSelected([]);
      setLastClick(0);
      setStateFormData(payload.form_data);
    }
  }, [getAdjustedViewport, props, stateFormData, viewport]);
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var onSelect = useCallback(polygon => {
    var {
      formData,
      onAddFilter
    } = props;
    var now = new Date().getDate();
    var doubleClick = now - lastClick <= DOUBLE_CLICK_THRESHOLD;

    // toggle selected polygons
    var selectedCopy = [...selected];
    if (doubleClick) {
      selectedCopy.splice(0, selectedCopy.length, polygon);
    } else if (formData.toggle_polygons) {
      var i = selectedCopy.indexOf(polygon);
      if (i === -1) {
        selectedCopy.push(polygon);
      } else {
        selectedCopy.splice(i, 1);
      }
    } else {
      selectedCopy.splice(0, 1, polygon);
    }
    setSelected(selectedCopy);
    setLastClick(now);
    if (formData.table_filter) {
      onAddFilter(formData.line_column, selected, false, true);
    }
  }, [lastClick, props, selected]);
  var getLayers = useCallback(() => {
    if (props.payload.data.features === undefined) {
      return [];
    }
    var layer = getLayer(props.formData, props.payload, props.onAddFilter, setTooltip, selected, onSelect);
    return [layer];
  }, [onSelect, props.formData, props.onAddFilter, props.payload, selected, setTooltip]);
  var {
    payload,
    formData,
    setControlValue
  } = props;
  var metricLabel = formData.metric ? formData.metric.label || formData.metric : null;
  var accessor = d => d[metricLabel];
  var buckets = getBuckets(formData, payload.data.features, accessor);
  return /*#__PURE__*/_jsxs("div", {
    style: {
      position: 'relative'
    },
    children: [/*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
      ref: containerRef,
      viewport: viewport,
      layers: getLayers(),
      setControlValue: setControlValue,
      mapStyle: formData.mapbox_style,
      mapboxApiAccessToken: payload.data.mapboxApiKey,
      width: props.width,
      height: props.height
    }), formData.metric !== null && /*#__PURE__*/_jsx(Legend, {
      categories: buckets,
      position: formData.legend_position,
      format: formData.legend_format
    })]
  });
};
export default /*#__PURE__*/memo(DeckGLPolygon);