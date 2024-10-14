"use strict";

exports.__esModule = true;
exports.default = void 0;
var _chartControls = require("@superset-ui/chart-controls");
var _core = require("@superset-ui/core");
var _Shared_DeckGL = require("../../utilities/Shared_DeckGL");
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
    controlSetRows: [[_Shared_DeckGL.spatial], ['row_limit'], ['size'], [_Shared_DeckGL.filterNulls], ['adhoc_filters']]
  }, {
    label: (0, _core.t)('Map'),
    expanded: true,
    controlSetRows: [[_Shared_DeckGL.osmStyle], [_Shared_DeckGL.autozoom, _Shared_DeckGL.viewport], [{
      name: 'cellSize',
      config: {
        type: 'TextControl',
        label: (0, _core.t)('Cell Size'),
        default: 300,
        isInt: true,
        description: (0, _core.t)('The size of each cell in meters'),
        renderTrigger: true,
        clearable: false
      }
    }], [{
      name: 'aggregation',
      config: {
        type: 'SelectControl',
        label: (0, _core.t)('Aggregation'),
        description: (0, _core.t)('The function to use when aggregating points into groups'),
        default: 'sum',
        clearable: false,
        renderTrigger: true,
        choices: [['sum', (0, _core.t)('sum')], ['min', (0, _core.t)('min')], ['max', (0, _core.t)('max')], ['mean', (0, _core.t)('mean')]]
      }
    }], [{
      name: 'contours',
      config: {
        type: 'ContourControl',
        label: (0, _core.t)('Contours'),
        renderTrigger: true,
        description: (0, _core.t)('Define contour layers. Isolines represent a collection of line segments that ' + 'serparate the area above and below a given threshold. Isobands represent a ' + 'collection of polygons that fill the are containing values in a given ' + 'threshold range.')
      }
    }]]
  }, {
    label: (0, _core.t)('Advanced'),
    controlSetRows: [[_Shared_DeckGL.jsColumns], [_Shared_DeckGL.jsDataMutator], [_Shared_DeckGL.jsTooltip], [_Shared_DeckGL.jsOnclickHref]]
  }],
  controlOverrides: {
    size: {
      label: (0, _core.t)('Weight'),
      description: (0, _core.t)("Metric used as a weight for the grid's coloring"),
      validators: [_core.validateNonEmpty]
    }
  },
  formDataOverrides: formData => _extends({}, formData, {
    size: (0, _chartControls.getStandardizedControls)().shiftMetric()
  })
};
var _default = exports.default = config;