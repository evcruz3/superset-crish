function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
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
import { ScreenGridLayer } from '@deck.gl/aggregation-layers';
import { t } from '@superset-ui/core';
import { noop } from 'lodash';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
// eslint-disable-next-line import/extensions
import fitViewport from '../../utils/fitViewport';
import { DeckGLContainerStyledWrapper } from '../../DeckGLContainer';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function getPoints(data) {
  return data.map(d => d.position);
}
function setTooltipContent(o) {
  var _o$coordinate, _o$coordinate2, _o$object;
  return /*#__PURE__*/_jsxs("div", {
    className: "deckgl-tooltip",
    children: [/*#__PURE__*/_jsx(TooltipRow
    // eslint-disable-next-line prefer-template
    , {
      label: t('Longitude and Latitude') + ': ',
      value: (o == null || (_o$coordinate = o.coordinate) == null ? void 0 : _o$coordinate[0]) + ", " + (o == null || (_o$coordinate2 = o.coordinate) == null ? void 0 : _o$coordinate2[1])
    }), /*#__PURE__*/_jsx(TooltipRow
    // eslint-disable-next-line prefer-template
    , {
      label: t('Weight') + ': ',
      value: "" + ((_o$object = o.object) == null ? void 0 : _o$object.cellWeight)
    })]
  });
}
export function getLayer(formData, payload, onAddFilter, setTooltip) {
  var fd = formData;
  var c = fd.color_picker;
  var data = payload.data.features.map(d => _extends({}, d, {
    color: [c.r, c.g, c.b, 255 * c.a]
  }));
  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    var jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  // Passing a layer creator function instead of a layer since the
  // layer needs to be regenerated at each render
  return new ScreenGridLayer(_extends({
    id: "screengrid-layer-" + fd.slice_id,
    data,
    cellSizePixels: fd.grid_size,
    minColor: [c.r, c.g, c.b, 0],
    maxColor: [c.r, c.g, c.b, 255 * c.a],
    outline: false,
    getWeight: d => d.weight || 0
  }, commonLayerProps(fd, setTooltip, setTooltipContent)));
}
var DeckGLScreenGrid = props => {
  var containerRef = useRef();
  var getAdjustedViewport = useCallback(() => {
    var features = props.payload.data.features || [];
    var {
      width,
      height,
      formData
    } = props;
    if (formData.autozoom) {
      return fitViewport(props.viewport, {
        width,
        height,
        points: getPoints(features)
      });
    }
    return props.viewport;
  }, [props]);
  var [stateFormData, setStateFormData] = useState(props.payload.form_data);
  var [viewport, setViewport] = useState(getAdjustedViewport());
  useEffect(() => {
    if (props.payload.form_data !== stateFormData) {
      setViewport(getAdjustedViewport());
      setStateFormData(props.payload.form_data);
    }
  }, [getAdjustedViewport, props.payload.form_data, stateFormData]);
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var getLayers = useCallback(() => {
    var layer = getLayer(props.formData, props.payload, noop, setTooltip);
    return [layer];
  }, [props.formData, props.payload, setTooltip]);
  var {
    formData,
    payload,
    setControlValue
  } = props;
  return /*#__PURE__*/_jsx("div", {
    children: /*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
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
export default /*#__PURE__*/memo(DeckGLScreenGrid);