function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
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
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { SupersetClient, usePrevious } from '@superset-ui/core';
import { DeckGLContainerStyledWrapper } from '../DeckGLContainer';
import { getExploreLongUrl } from '../utils/explore';
import layerGenerators from '../layers';
import { jsx as _jsx } from "react/jsx-runtime";
var DeckMulti = props => {
  var containerRef = useRef();
  var [viewport, setViewport] = useState();
  var [subSlicesLayers, setSubSlicesLayers] = useState({});
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var loadLayers = useCallback((formData, payload, viewport) => {
    setViewport(viewport);
    setSubSlicesLayers({});
    payload.data.slices.forEach(subslice => {
      // Filters applied to multi_deck are passed down to underlying charts
      // note that dashboard contextual information (filter_immune_slices and such) aren't
      // taken into consideration here
      var filters = [...(subslice.form_data.filters || []), ...(formData.filters || []), ...(formData.extra_filters || [])];
      var subsliceCopy = _extends({}, subslice, {
        form_data: _extends({}, subslice.form_data, {
          filters
        })
      });
      var url = getExploreLongUrl(subsliceCopy.form_data, 'json');
      if (url) {
        SupersetClient.get({
          endpoint: url
        }).then(_ref => {
          var {
            json
          } = _ref;
          var layer = layerGenerators[subsliceCopy.form_data.viz_type](subsliceCopy.form_data, json, props.onAddFilter, setTooltip, props.datasource, [], props.onSelect);
          setSubSlicesLayers(subSlicesLayers => _extends({}, subSlicesLayers, {
            [subsliceCopy.slice_id]: layer
          }));
        }).catch(() => {});
      }
    });
  }, [props.datasource, props.onAddFilter, props.onSelect, setTooltip]);
  var prevDeckSlices = usePrevious(props.formData.deck_slices);
  useEffect(() => {
    var {
      formData,
      payload
    } = props;
    var hasChanges = !isEqual(prevDeckSlices, formData.deck_slices);
    if (hasChanges) {
      loadLayers(formData, payload);
    }
  }, [loadLayers, prevDeckSlices, props]);
  var {
    payload,
    formData,
    setControlValue,
    height,
    width
  } = props;
  var layers = Object.values(subSlicesLayers);
  return /*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
    ref: containerRef,
    mapboxApiAccessToken: payload.data.mapboxApiKey,
    viewport: viewport || props.viewport,
    layers: layers,
    mapStyle: formData.mapbox_style,
    setControlValue: setControlValue,
    onViewportChange: setViewport,
    height: height,
    width: width
  });
};
export default /*#__PURE__*/memo(DeckMulti);