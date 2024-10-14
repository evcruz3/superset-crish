"use strict";

exports.__esModule = true;
exports.default = fitViewport;
var _webMercator = require("@math.gl/web-mercator");
var _computeBoundsFromPoints = _interopRequireDefault(require("./computeBoundsFromPoints"));
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
function fitViewport(originalViewPort, _ref) {
  var {
    points,
    width,
    height,
    minExtent,
    maxZoom,
    offset,
    padding = 20
  } = _ref;
  var {
    bearing,
    pitch
  } = originalViewPort;
  var bounds = (0, _computeBoundsFromPoints.default)(points);
  try {
    return _extends({}, (0, _webMercator.fitBounds)({
      bounds,
      width,
      height,
      minExtent,
      maxZoom,
      offset,
      padding
    }), {
      bearing,
      pitch
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not fit viewport', error);
  }
  return originalViewPort;
}