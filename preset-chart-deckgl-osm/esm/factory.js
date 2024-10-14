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
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { usePrevious } from '@superset-ui/core';
import { DeckGLContainerStyledWrapper } from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import fitViewport from './utils/fitViewport';
import { jsx as _jsx } from "react/jsx-runtime";
export function createDeckGLComponent(getLayer, getPoints) {
  // Higher order component
  return /*#__PURE__*/memo(props => {
    var containerRef = useRef();
    var prevFormData = usePrevious(props.formData);
    var prevPayload = usePrevious(props.payload);
    var getAdjustedViewport = () => {
      var {
        width,
        height,
        formData
      } = props;
      if (formData.autozoom) {
        return fitViewport(props.viewport, {
          width,
          height,
          points: getPoints(props.payload.data.features)
        });
      }
      return props.viewport;
    };
    var [viewport, setViewport] = useState(getAdjustedViewport());
    var setTooltip = useCallback(tooltip => {
      var {
        current
      } = containerRef;
      if (current) {
        current == null || current.setTooltip(tooltip);
      }
    }, []);
    var computeLayer = useCallback(props => {
      var {
        formData,
        payload,
        onAddFilter
      } = props;
      return getLayer(formData, payload, onAddFilter, setTooltip);
    }, [setTooltip]);
    var [layer, setLayer] = useState(computeLayer(props));
    useEffect(() => {
      // Only recompute the layer if anything BUT the viewport has changed
      var prevFdNoVP = _extends({}, prevFormData, {
        viewport: null
      });
      var currFdNoVP = _extends({}, props.formData, {
        viewport: null
      });
      if (!isEqual(prevFdNoVP, currFdNoVP) || prevPayload !== props.payload) {
        setLayer(computeLayer(props));
      }
    }, [computeLayer, prevFormData, prevPayload, props]);
    var {
      formData,
      payload,
      setControlValue,
      height,
      width
    } = props;
    return /*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
      ref: containerRef,
      mapboxApiAccessToken: payload.data.mapboxApiKey,
      viewport: viewport,
      layers: [layer],
      mapStyle: formData.mapbox_style,
      setControlValue: setControlValue,
      width: width,
      height: height,
      onViewportChange: setViewport
    });
  });
}
export function createCategoricalDeckGLComponent(getLayer, getPoints) {
  return function Component(props) {
    var {
      datasource,
      formData,
      height,
      payload,
      setControlValue,
      viewport,
      width
    } = props;
    return /*#__PURE__*/_jsx(CategoricalDeckGLContainer, {
      datasource: datasource,
      formData: formData,
      mapboxApiKey: payload.data.mapboxApiKey,
      setControlValue: setControlValue,
      viewport: viewport,
      getLayer: getLayer,
      payload: payload,
      getPoints: getPoints,
      width: width,
      height: height
    });
  };
}