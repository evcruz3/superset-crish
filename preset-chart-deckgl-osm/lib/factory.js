"use strict";

exports.__esModule = true;
exports.createCategoricalDeckGLComponent = createCategoricalDeckGLComponent;
exports.createDeckGLComponent = createDeckGLComponent;
var _react = require("react");
var _lodash = require("lodash");
var _core = require("@superset-ui/core");
var _DeckGLContainer = require("./DeckGLContainer");
var _CategoricalDeckGLContainer = _interopRequireDefault(require("./CategoricalDeckGLContainer"));
var _fitViewport = _interopRequireDefault(require("./utils/fitViewport"));
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
function createDeckGLComponent(getLayer, getPoints) {
  // Higher order component
  return /*#__PURE__*/(0, _react.memo)(props => {
    var containerRef = (0, _react.useRef)();
    var prevFormData = (0, _core.usePrevious)(props.formData);
    var prevPayload = (0, _core.usePrevious)(props.payload);
    var getAdjustedViewport = () => {
      var {
        width,
        height,
        formData
      } = props;
      if (formData.autozoom) {
        return (0, _fitViewport.default)(props.viewport, {
          width,
          height,
          points: getPoints(props.payload.data.features)
        });
      }
      return props.viewport;
    };
    var [viewport, setViewport] = (0, _react.useState)(getAdjustedViewport());
    var setTooltip = (0, _react.useCallback)(tooltip => {
      var {
        current
      } = containerRef;
      if (current) {
        current == null || current.setTooltip(tooltip);
      }
    }, []);
    var computeLayer = (0, _react.useCallback)(props => {
      var {
        formData,
        payload,
        onAddFilter
      } = props;
      return getLayer(formData, payload, onAddFilter, setTooltip);
    }, [setTooltip]);
    var [layer, setLayer] = (0, _react.useState)(computeLayer(props));
    (0, _react.useEffect)(() => {
      // Only recompute the layer if anything BUT the viewport has changed
      var prevFdNoVP = _extends({}, prevFormData, {
        viewport: null
      });
      var currFdNoVP = _extends({}, props.formData, {
        viewport: null
      });
      if (!(0, _lodash.isEqual)(prevFdNoVP, currFdNoVP) || prevPayload !== props.payload) {
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
    return /*#__PURE__*/(0, _jsxRuntime.jsx)(_DeckGLContainer.DeckGLContainerStyledWrapper, {
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
function createCategoricalDeckGLComponent(getLayer, getPoints) {
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
    return /*#__PURE__*/(0, _jsxRuntime.jsx)(_CategoricalDeckGLContainer.default, {
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