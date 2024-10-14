"use strict";

exports.__esModule = true;
exports.default = void 0;
var _core = require("@superset-ui/core");
var _controls = _interopRequireWildcard(require("../../utilities/controls"));
var _utils = require("../../utilities/utils");
var _Shared_DeckGL = require("../../utilities/Shared_DeckGL");
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && {}.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
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
    controlSetRows: [[{
      name: 'start_spatial',
      config: {
        type: 'SpatialControl',
        label: (0, _core.t)('Start Longitude & Latitude'),
        validators: [_core.validateNonEmpty],
        description: (0, _core.t)('Point to your spatial columns'),
        mapStateToProps: state => ({
          choices: (0, _controls.columnChoices)(state.datasource)
        })
      }
    }, {
      name: 'end_spatial',
      config: {
        type: 'SpatialControl',
        label: (0, _core.t)('End Longitude & Latitude'),
        validators: [_core.validateNonEmpty],
        description: (0, _core.t)('Point to your spatial columns'),
        mapStateToProps: state => ({
          choices: (0, _controls.columnChoices)(state.datasource)
        })
      }
    }], ['row_limit', _Shared_DeckGL.filterNulls], ['adhoc_filters']]
  }, {
    label: (0, _core.t)('Map'),
    controlSetRows: [[_Shared_DeckGL.osmStyle], [_Shared_DeckGL.autozoom, _Shared_DeckGL.viewport]]
  }, {
    label: (0, _core.t)('Arc'),
    controlSetRows: [['color_picker', {
      name: 'target_color_picker',
      config: {
        label: (0, _core.t)('Target Color'),
        description: (0, _core.t)('Color of the target location'),
        type: 'ColorPickerControl',
        default: _controls.PRIMARY_COLOR,
        renderTrigger: true
      }
    }], [{
      name: _Shared_DeckGL.dimension.name,
      config: _extends({}, _Shared_DeckGL.dimension.config, {
        label: (0, _core.t)('Categorical Color'),
        description: (0, _core.t)('Pick a dimension from which categorical colors are defined')
      })
    }, 'color_scheme'], [{
      name: 'stroke_width',
      config: {
        type: 'SelectControl',
        freeForm: true,
        label: (0, _core.t)('Stroke Width'),
        validators: [_core.legacyValidateInteger],
        default: null,
        renderTrigger: true,
        choices: (0, _utils.formatSelectOptions)([1, 2, 3, 4, 5])
      }
    }, _Shared_DeckGL.legendPosition], [_Shared_DeckGL.legendFormat, null]]
  }, {
    label: (0, _core.t)('Advanced'),
    controlSetRows: [[_Shared_DeckGL.jsColumns], [_Shared_DeckGL.jsDataMutator], [_Shared_DeckGL.jsTooltip], [_Shared_DeckGL.jsOnclickHref]]
  }],
  controlOverrides: {
    size: {
      validators: []
    },
    time_grain_sqla: _controls.default
  }
};
var _default = exports.default = config;