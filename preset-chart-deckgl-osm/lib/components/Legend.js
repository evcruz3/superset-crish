"use strict";

exports.__esModule = true;
exports.default = void 0;
var _react = require("react");
var _core = require("@superset-ui/core");
var _jsxRuntime = require("react/jsx-runtime");
var _templateObject;
/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
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
function _taggedTemplateLiteralLoose(e, t) { return t || (t = e.slice(0)), e.raw = t, e; }
var StyledLegend = _core.styled.div(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  ", "\n"])), _ref => {
  var {
    theme
  } = _ref;
  return "\n    font-size: " + theme.typography.sizes.s + "px;\n    position: absolute;\n    background: " + theme.colors.grayscale.light5 + ";\n    box-shadow: 0 0 " + theme.gridUnit + "px " + theme.colors.grayscale.light2 + ";\n    margin: " + theme.gridUnit * 6 + "px;\n    padding: " + theme.gridUnit * 3 + "px " + theme.gridUnit * 5 + "px;\n    outline: none;\n    overflow-y: scroll;\n    max-height: 200px;\n\n    & ul {\n      list-style: none;\n      padding-left: 0;\n      margin: 0;\n\n      & li a {\n        display: flex;\n        color: " + theme.colors.grayscale.base + ";\n        text-decoration: none;\n        padding: " + theme.gridUnit + "px 0;\n\n        & span {\n          margin-right: " + theme.gridUnit + "px;\n        }\n      }\n    }\n  ";
});
var categoryDelimiter = ' - ';
var Legend = _ref2 => {
  var {
    format: d3Format = null,
    forceCategorical = false,
    position = 'tr',
    categories: categoriesObject = {},
    toggleCategory = () => {},
    showSingleCategory = () => {}
  } = _ref2;
  var format = value => {
    if (!d3Format || forceCategorical) {
      return value;
    }
    var numValue = parseFloat(value);
    return (0, _core.formatNumber)(d3Format, numValue);
  };
  var formatCategoryLabel = k => {
    if (!d3Format) {
      return k;
    }
    if (k.includes(categoryDelimiter)) {
      var values = k.split(categoryDelimiter);
      return format(values[0]) + categoryDelimiter + format(values[1]);
    }
    return format(k);
  };
  if (Object.keys(categoriesObject).length === 0 || position === null) {
    return null;
  }
  var categories = Object.entries(categoriesObject).map(_ref3 => {
    var [k, v] = _ref3;
    var style = {
      color: "rgba(" + v.color.join(', ') + ")"
    };
    var icon = v.enabled ? '\u25FC' : '\u25FB';
    return /*#__PURE__*/(0, _jsxRuntime.jsx)("li", {
      children: /*#__PURE__*/(0, _jsxRuntime.jsxs)("a", {
        href: "#",
        role: "button",
        onClick: () => toggleCategory(k),
        onDoubleClick: () => showSingleCategory(k),
        children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("span", {
          style: style,
          children: icon
        }), " ", formatCategoryLabel(k)]
      })
    }, k);
  });
  var vertical = (position == null ? void 0 : position.charAt(0)) === 't' ? 'top' : 'bottom';
  var horizontal = (position == null ? void 0 : position.charAt(1)) === 'r' ? 'right' : 'left';
  var style = {
    position: 'absolute',
    [vertical]: '0px',
    [horizontal]: '10px'
  };
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(StyledLegend, {
    className: "dupa",
    style: style,
    children: /*#__PURE__*/(0, _jsxRuntime.jsx)("ul", {
      children: categories
    })
  });
};
var _default = exports.default = /*#__PURE__*/(0, _react.memo)(Legend);