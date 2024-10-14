"use strict";

exports.__esModule = true;
exports.default = computeBoundsFromPoints;
var _d3Array = require("d3-array");
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

var LAT_LIMIT = [-90, 90];
var LNG_LIMIT = [-180, 180];

/**
 * Expand a coordinate range by `padding` and within limits, if needed
 */
function expandIfNeeded(_ref, _ref2, padding) {
  var [curMin, curMax] = _ref;
  var [minBound, maxBound] = _ref2;
  if (padding === void 0) {
    padding = 0.25;
  }
  return curMin < curMax ? [curMin, curMax] : [Math.max(minBound, curMin - padding), Math.min(maxBound, curMax + padding)];
}
function computeBoundsFromPoints(points) {
  var latBounds = expandIfNeeded((0, _d3Array.extent)(points, x => x[1]), LAT_LIMIT);
  var lngBounds = expandIfNeeded((0, _d3Array.extent)(points, x => x[0]), LNG_LIMIT);
  return [[lngBounds[0], latBounds[0]], [lngBounds[1], latBounds[1]]];
}