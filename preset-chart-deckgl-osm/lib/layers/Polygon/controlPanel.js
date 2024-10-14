"use strict";

exports.__esModule = true;
exports.default = void 0;
var _chartControls = require("@superset-ui/chart-controls");
var _core = require("@superset-ui/core");
var _controls = _interopRequireDefault(require("../../utilities/controls"));
var _utils = require("../../utilities/utils");
var _Shared_DeckGL = require("../../utilities/Shared_DeckGL");
var _sharedDndControls = require("../../utilities/sharedDndControls");
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
var config = {
  controlPanelSections: [{
    label: (0, _core.t)('Query'),
    expanded: true,
    controlSetRows: [[_extends({}, _sharedDndControls.dndLineColumn, {
      config: _extends({}, _sharedDndControls.dndLineColumn.config, {
        label: (0, _core.t)('Polygon Column')
      })
    })], [_extends({}, _Shared_DeckGL.lineType, {
      config: _extends({}, _Shared_DeckGL.lineType.config, {
        label: (0, _core.t)('Polygon Encoding')
      })
    })], ['adhoc_filters'], ['metric'], [_extends({}, _Shared_DeckGL.pointRadiusFixed, {
      config: _extends({}, _Shared_DeckGL.pointRadiusFixed.config, {
        label: (0, _core.t)('Elevation')
      })
    })], ['row_limit'], [_Shared_DeckGL.reverseLongLat], [_Shared_DeckGL.filterNulls]]
  }, {
    label: (0, _core.t)('Map'),
    expanded: true,
    controlSetRows: [[_Shared_DeckGL.osmStyle], [_Shared_DeckGL.viewport], [_Shared_DeckGL.autozoom]]
  }, {
    label: (0, _core.t)('Polygon Settings'),
    expanded: true,
    controlSetRows: [[_Shared_DeckGL.fillColorPicker, _Shared_DeckGL.strokeColorPicker], [_Shared_DeckGL.filled, _Shared_DeckGL.stroked], [_Shared_DeckGL.extruded], [_Shared_DeckGL.multiplier], [_Shared_DeckGL.lineWidth], [{
      name: 'line_width_unit',
      config: {
        type: 'SelectControl',
        label: (0, _core.t)('Line width unit'),
        default: 'pixels',
        choices: [['meters', (0, _core.t)('meters')], ['pixels', (0, _core.t)('pixels')]],
        renderTrigger: true
      }
    }], ['linear_color_scheme'], [{
      name: 'opacity',
      config: {
        type: 'SliderControl',
        label: (0, _core.t)('Opacity'),
        default: 80,
        step: 1,
        min: 0,
        max: 100,
        renderTrigger: true,
        description: (0, _core.t)('Opacity, expects values between 0 and 100')
      }
    }], [{
      name: 'num_buckets',
      config: {
        type: 'SelectControl',
        multi: false,
        freeForm: true,
        label: (0, _core.t)('Number of buckets to group data'),
        default: 5,
        choices: (0, _utils.formatSelectOptions)([2, 3, 5, 10]),
        description: (0, _core.t)('How many buckets should the data be grouped in.'),
        renderTrigger: true
      }
    }], [{
      name: 'break_points',
      config: {
        type: 'SelectControl',
        multi: true,
        freeForm: true,
        label: (0, _core.t)('Bucket break points'),
        choices: (0, _utils.formatSelectOptions)([]),
        description: (0, _core.t)('List of n+1 values for bucketing metric into n buckets.'),
        renderTrigger: true
      }
    }], [{
      name: 'table_filter',
      config: {
        type: 'CheckboxControl',
        label: (0, _core.t)('Emit Filter Events'),
        renderTrigger: true,
        default: false,
        description: (0, _core.t)('Whether to apply filter when items are clicked')
      }
    }], [{
      name: 'toggle_polygons',
      config: {
        type: 'CheckboxControl',
        label: (0, _core.t)('Multiple filtering'),
        renderTrigger: true,
        default: true,
        description: (0, _core.t)('Allow sending multiple polygons as a filter event')
      }
    }], [_Shared_DeckGL.legendPosition], [_Shared_DeckGL.legendFormat]]
  }, {
    label: (0, _core.t)('Advanced'),
    controlSetRows: [[_Shared_DeckGL.jsColumns], [_Shared_DeckGL.jsDataMutator], [_Shared_DeckGL.jsTooltip], [_Shared_DeckGL.jsOnclickHref]]
  }],
  controlOverrides: {
    metric: {
      validators: []
    },
    time_grain_sqla: _controls.default
  },
  formDataOverrides: formData => _extends({}, formData, {
    metric: (0, _chartControls.getStandardizedControls)().shiftMetric()
  })
};
var _default = exports.default = config;