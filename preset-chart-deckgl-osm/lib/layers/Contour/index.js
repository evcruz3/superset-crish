"use strict";

exports.__esModule = true;
exports.default = void 0;
var _core = require("@superset-ui/core");
var _transformProps = _interopRequireDefault(require("../../transformProps"));
var _controlPanel = _interopRequireDefault(require("./controlPanel"));
var _thumbnail = _interopRequireDefault(require("./images/thumbnail.png"));
var _example = _interopRequireDefault(require("./images/example.png"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; } /**
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
var metadata = new _core.ChartMetadata({
  category: (0, _core.t)('Map'),
  credits: ['https://uber.github.io/deck.gl'],
  description: (0, _core.t)('Uses Gaussian Kernel Density Estimation to visualize spatial distribution of data'),
  exampleGallery: [{
    url: _example.default
  }],
  name: (0, _core.t)('deck.gl Contour'),
  thumbnail: _thumbnail.default,
  useLegacyApi: true,
  tags: [(0, _core.t)('deckGL'), (0, _core.t)('Spatial'), (0, _core.t)('Comparison')]
});
class ContourChartPlugin extends _core.ChartPlugin {
  constructor() {
    super({
      loadChart: () => Promise.resolve().then(() => _interopRequireWildcard(require('./Contour'))),
      controlPanel: _controlPanel.default,
      metadata,
      transformProps: _transformProps.default
    });
  }
}
exports.default = ContourChartPlugin;