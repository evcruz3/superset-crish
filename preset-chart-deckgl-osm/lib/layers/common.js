"use strict";

exports.__esModule = true;
exports.commonLayerProps = commonLayerProps;
exports.getAggFunc = getAggFunc;
var d3array = _interopRequireWildcard(require("d3-array"));
var _sandbox = _interopRequireDefault(require("../utils/sandbox"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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

function commonLayerProps(formData, setTooltip, setTooltipContent, onSelect) {
  var fd = formData;
  var onHover;
  var tooltipContentGenerator = setTooltipContent;
  if (fd.js_tooltip) {
    tooltipContentGenerator = (0, _sandbox.default)(fd.js_tooltip);
  }
  if (tooltipContentGenerator) {
    onHover = o => {
      if (o.picked) {
        setTooltip({
          content: tooltipContentGenerator(o),
          x: o.x,
          y: o.y
        });
      } else {
        setTooltip(null);
      }
      return true;
    };
  }
  var onClick;
  if (fd.js_onclick_href) {
    onClick = o => {
      var href = (0, _sandbox.default)(fd.js_onclick_href)(o);
      window.open(href);
      return true;
    };
  } else if (fd.table_filter && onSelect !== undefined) {
    onClick = o => {
      onSelect(o.object[fd.line_column]);
      return true;
    };
  }
  return {
    onClick,
    onHover,
    pickable: Boolean(onHover)
  };
}
var percentiles = {
  p1: 0.01,
  p5: 0.05,
  p95: 0.95,
  p99: 0.99
};

/* Get a stat function that operates on arrays, aligns with control=js_agg_function  */
function getAggFunc(type, accessor) {
  if (type === void 0) {
    type = 'sum';
  }
  if (accessor === void 0) {
    accessor = null;
  }
  if (type === 'count') {
    return arr => arr.length;
  }
  var d3func;
  if (type in percentiles) {
    d3func = (arr, acc) => {
      var sortedArr;
      if (accessor) {
        sortedArr = arr.sort((o1, o2) => d3array.ascending(accessor(o1), accessor(o2)));
      } else {
        sortedArr = arr.sort(d3array.ascending);
      }
      return d3array.quantile(sortedArr, percentiles[type], acc);
    };
  } else {
    d3func = d3array[type];
  }
  if (!accessor) {
    return arr => d3func(arr);
  }
  return arr => d3func(arr.map(x => accessor(x)));
}