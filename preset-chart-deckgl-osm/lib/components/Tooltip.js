"use strict";

exports.__esModule = true;
exports.default = Tooltip;
var _core = require("@superset-ui/core");
var _jsxRuntime = require("react/jsx-runtime");
var _templateObject;
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
var StyledDiv = _core.styled.div(_templateObject || (_templateObject = _taggedTemplateLiteralLoose(["\n  ", "\n"])), _ref => {
  var {
    theme,
    top,
    left
  } = _ref;
  return "\n    position: absolute;\n    top: " + top + "px;\n    left: " + left + "px;\n    padding: " + theme.gridUnit * 2 + "px;\n    margin: " + theme.gridUnit * 2 + "px;\n    background: " + theme.colors.grayscale.dark2 + ";\n    color: " + theme.colors.grayscale.light5 + ";\n    maxWidth: 300px;\n    fontSize: " + theme.typography.sizes.s + "px;\n    zIndex: 9;\n    pointerEvents: none;\n  ";
});
function Tooltip(props) {
  var {
    tooltip
  } = props;
  if (typeof tooltip === 'undefined' || tooltip === null) {
    return null;
  }
  var {
    x,
    y,
    content
  } = tooltip;
  var safeContent = typeof content === 'string' ? (0, _core.safeHtmlSpan)(content) : content;
  return /*#__PURE__*/(0, _jsxRuntime.jsx)(StyledDiv, {
    top: y,
    left: x,
    children: safeContent
  });
}