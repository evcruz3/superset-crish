function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/require-default-props */
/* eslint-disable react/no-unused-prop-types */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
/* eslint-disable no-prototype-builtins */
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
import { CategoricalColorNamespace } from '@superset-ui/core';
import Legend from './components/Legend';
import { hexToRGB } from './utils/colors';
import sandboxedEval from './utils/sandbox';
// eslint-disable-next-line import/extensions
import fitViewport from './utils/fitViewport';
import { DeckGLContainerStyledWrapper } from './DeckGLContainer';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
var {
  getScale
} = CategoricalColorNamespace;
function getCategories(fd, data) {
  var c = fd.color_picker || {
    r: 0,
    g: 0,
    b: 0,
    a: 1
  };
  var fixedColor = [c.r, c.g, c.b, 255 * c.a];
  var colorFn = getScale(fd.color_scheme);
  var categories = {};
  data.forEach(d => {
    if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
      var color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color, fd.sliceId, fd.color_scheme), c.a * 255);
      } else {
        color = fixedColor;
      }
      categories[d.cat_color] = {
        color,
        enabled: true
      };
    }
  });
  return categories;
}
var CategoricalDeckGLContainer = props => {
  var containerRef = useRef(null);
  var getAdjustedViewport = useCallback(() => {
    var viewport = _extends({}, props.viewport);
    if (props.formData.autozoom) {
      viewport = fitViewport(viewport, {
        width: props.width,
        height: props.height,
        points: props.getPoints(props.payload.data.features || [])
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props]);
  var [categories, setCategories] = useState(getCategories(props.formData, props.payload.data.features || []));
  var [stateFormData, setStateFormData] = useState(props.payload.form_data);
  var [viewport, setViewport] = useState(getAdjustedViewport());
  useEffect(() => {
    if (props.payload.form_data !== stateFormData) {
      var features = props.payload.data.features || [];
      var _categories = getCategories(props.formData, features);
      setViewport(getAdjustedViewport());
      setStateFormData(props.payload.form_data);
      setCategories(_categories);
    }
  }, [getAdjustedViewport, props, stateFormData]);
  var setTooltip = useCallback(tooltip => {
    var {
      current
    } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);
  var addColor = useCallback((data, fd) => {
    var c = fd.color_picker || {
      r: 0,
      g: 0,
      b: 0,
      a: 1
    };
    var colorFn = getScale(fd.color_scheme);
    return data.map(d => {
      var color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color, fd.sliceId, fd.color_scheme), c.a * 255);
        return _extends({}, d, {
          color
        });
      }
      return d;
    });
  }, []);
  var getLayers = useCallback(() => {
    var {
      getLayer,
      payload,
      formData: fd,
      onAddFilter
    } = props;
    var features = payload.data.features ? [...payload.data.features] : [];

    // Add colors from categories or fixed color
    features = addColor(features, fd);

    // Apply user defined data mutator if defined
    if (fd.js_data_mutator) {
      var jsFnMutator = sandboxedEval(fd.js_data_mutator);
      features = jsFnMutator(features);
    }

    // Show only categories selected in the legend
    if (fd.dimension) {
      features = features.filter(d => {
        var _categories$d$cat_col;
        return (_categories$d$cat_col = categories[d.cat_color]) == null ? void 0 : _categories$d$cat_col.enabled;
      });
    }
    var filteredPayload = _extends({}, payload, {
      data: _extends({}, payload.data, {
        features
      })
    });
    return [getLayer(fd, filteredPayload, onAddFilter, setTooltip, props.datasource)];
  }, [addColor, categories, props, setTooltip]);
  var toggleCategory = useCallback(category => {
    var categoryState = categories[category];
    var categoriesExtended = _extends({}, categories, {
      [category]: _extends({}, categoryState, {
        enabled: !categoryState.enabled
      })
    });

    // if all categories are disabled, enable all -- similar to nvd3
    if (Object.values(categoriesExtended).every(v => !v.enabled)) {
      /* eslint-disable no-param-reassign */
      Object.values(categoriesExtended).forEach(v => {
        v.enabled = true;
      });
    }
    setCategories(categoriesExtended);
  }, [categories]);
  var showSingleCategory = useCallback(category => {
    var modifiedCategories = _extends({}, categories);
    Object.values(modifiedCategories).forEach(v => {
      v.enabled = false;
    });
    modifiedCategories[category].enabled = true;
    setCategories(modifiedCategories);
  }, [categories]);
  return /*#__PURE__*/_jsxs("div", {
    style: {
      position: 'relative'
    },
    children: [/*#__PURE__*/_jsx(DeckGLContainerStyledWrapper, {
      ref: containerRef,
      viewport: viewport,
      layers: getLayers(),
      setControlValue: props.setControlValue,
      mapStyle: props.formData.mapbox_style,
      mapboxApiAccessToken: props.mapboxApiKey,
      width: props.width,
      height: props.height
    }), /*#__PURE__*/_jsx(Legend, {
      forceCategorical: true,
      categories: categories,
      format: props.formData.legend_format,
      position: props.formData.legend_position,
      showSingleCategory: showSingleCategory,
      toggleCategory: toggleCategory
    })]
  });
};
export default /*#__PURE__*/memo(CategoricalDeckGLContainer);