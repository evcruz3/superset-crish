"use strict";

exports.__esModule = true;
exports.default = void 0;
var _react = require("react");
var _lodash = require("lodash");
var _core = require("@superset-ui/core");
var _DeckGLContainer = require("../DeckGLContainer");
var _explore = require("../utils/explore");
var _layers = _interopRequireDefault(require("../layers"));
var _jsxRuntime = require("react/jsx-runtime");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); } /* eslint-disable react/jsx-handler-names */ /* eslint-disable react/no-access-state-in-setstate */ /* eslint-disable camelcase */ /**
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
var DeckMulti = props => {
  var containerRef = (0, _react.useRef)();
  var [viewport, setViewport] = (0, _react.useState)();
  var [subSlicesLayers, setSubSlicesLayers] = (0, _react.useState)({});
  var setTooltip = (0, _react.useCallback)(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var loadLayers = (0, _react.useCallback)((formData, payload, viewport) => {
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
      var url = (0, _explore.getExploreLongUrl)(subsliceCopy.form_data, 'json');
      if (url) {
        _core.SupersetClient.get({
          endpoint: url
        }).then(_ref => {
          var {
            json
          } = _ref;
          var layer = _layers.default[subsliceCopy.form_data.viz_type](subsliceCopy.form_data, json, props.onAddFilter, setTooltip, props.datasource, [], props.onSelect);
          setSubSlicesLayers(subSlicesLayers => _extends({}, subSlicesLayers, {
            [subsliceCopy.slice_id]: layer
          }));
        }).catch(() => {});
      }
    });
  }, [props.datasource, props.onAddFilter, props.onSelect, setTooltip]);
  var prevDeckSlices = (0, _core.usePrevious)(props.formData.deck_slices);
  (0, _react.useEffect)(() => {
    var {
      formData,
      payload
    } = props;
    var hasChanges = !(0, _lodash.isEqual)(prevDeckSlices, formData.deck_slices);
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
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(_DeckGLContainer.DeckGLContainerStyledWrapper, {
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
var _default = exports.default = /*#__PURE__*/(0, _react.memo)(DeckMulti);