"use strict";

exports.__esModule = true;
exports.dndLineColumn = exports.dndGeojsonColumn = void 0;
var _core = require("@superset-ui/core");
var _chartControls = require("@superset-ui/chart-controls");
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
var dndLineColumn = exports.dndLineColumn = {
  name: 'line_column',
  config: _extends({}, _chartControls.sharedControls.entity, {
    label: (0, _core.t)('Lines column'),
    description: (0, _core.t)('The database columns that contains lines information')
  })
};
var dndGeojsonColumn = exports.dndGeojsonColumn = {
  name: 'geojson',
  config: _extends({}, _chartControls.sharedControls.entity, {
    label: (0, _core.t)('GeoJson Column'),
    description: (0, _core.t)('Select the geojson column')
  })
};