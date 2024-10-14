"use strict";

exports.__esModule = true;
exports.default = void 0;
var _core = require("@superset-ui/core");
var _utils = require("../../utilities/utils");
var _Shared_DeckGL = require("../../utilities/Shared_DeckGL");
var _sharedDndControls = require("../../utilities/sharedDndControls");
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

var config = {
  controlPanelSections: [{
    label: (0, _core.t)('Query'),
    expanded: true,
    controlSetRows: [[_sharedDndControls.dndGeojsonColumn], ['row_limit'], [_Shared_DeckGL.filterNulls], ['adhoc_filters']]
  }, {
    label: (0, _core.t)('Map'),
    controlSetRows: [[_Shared_DeckGL.osmStyle, _Shared_DeckGL.viewport], [_Shared_DeckGL.autozoom]]
  }, {
    label: (0, _core.t)('GeoJson Settings'),
    controlSetRows: [[_Shared_DeckGL.fillColorPicker, _Shared_DeckGL.strokeColorPicker], [_Shared_DeckGL.filled, _Shared_DeckGL.stroked], [_Shared_DeckGL.extruded], [_Shared_DeckGL.lineWidth], [{
      name: 'line_width_unit',
      config: {
        type: 'SelectControl',
        label: (0, _core.t)('Line width unit'),
        default: 'pixels',
        choices: [['meters', (0, _core.t)('meters')], ['pixels', (0, _core.t)('pixels')]],
        renderTrigger: true
      }
    }], [{
      name: 'point_radius_scale',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: (0, _core.t)('Point Radius Scale'),
        validators: [_core.legacyValidateInteger],
        default: null,
        choices: (0, _utils.formatSelectOptions)([0, 100, 200, 300, 500])
      }
    }]]
  }, {
    label: (0, _core.t)('Advanced'),
    controlSetRows: [[_Shared_DeckGL.jsColumns], [_Shared_DeckGL.jsDataMutator], [_Shared_DeckGL.jsTooltip], [_Shared_DeckGL.jsOnclickHref]]
  }]
};
var _default = exports.default = config;