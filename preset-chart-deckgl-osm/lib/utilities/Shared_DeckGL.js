"use strict";

exports.__esModule = true;
exports.viewport = exports.stroked = exports.strokeColorPicker = exports.spatial = exports.reverseLongLat = exports.pointRadiusFixed = exports.osmStyle = exports.multiplier = exports.mapboxStyle = exports.lineWidth = exports.lineType = exports.lineColumn = exports.legendPosition = exports.legendFormat = exports.jsTooltip = exports.jsOnclickHref = exports.jsDataMutator = exports.jsColumns = exports.gridSize = exports.geojsonColumn = exports.filterNulls = exports.filled = exports.fillColorPicker = exports.extruded = exports.dimension = exports.autozoom = void 0;
var _core = require("@superset-ui/core");
var _chartControls = require("@superset-ui/chart-controls");
var _controls = require("./controls");
var _jsxRuntime = require("react/jsx-runtime");
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
 */ // These are control configurations that are shared ONLY within the DeckGL viz plugin repo.
var DEFAULT_VIEWPORT = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0
};
var sandboxUrl = 'https://github.com/apache/superset/' + 'blob/master/superset-frontend/plugins/legacy-preset-chart-deckgl/src/utils/sandbox.ts';
var jsFunctionInfo = /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
  children: [(0, _core.t)('For more information about objects are in context in the scope of this function, refer to the'), /*#__PURE__*/(0, _jsxRuntime.jsxs)("a", {
    href: sandboxUrl,
    children: [(0, _core.t)(" source code of Superset's sandboxed parser"), "."]
  }), "."]
});
function jsFunctionControl(label, description, extraDescr, height, defaultText) {
  if (extraDescr === void 0) {
    extraDescr = null;
  }
  if (height === void 0) {
    height = 100;
  }
  if (defaultText === void 0) {
    defaultText = '';
  }
  return {
    type: 'TextAreaControl',
    language: 'javascript',
    label,
    description,
    height,
    default: defaultText,
    aboveEditorSection: /*#__PURE__*/(0, _jsxRuntime.jsxs)("div", {
      children: [/*#__PURE__*/(0, _jsxRuntime.jsx)("p", {
        children: description
      }), /*#__PURE__*/(0, _jsxRuntime.jsx)("p", {
        children: jsFunctionInfo
      }), extraDescr]
    }),
    warning: !(0, _core.isFeatureEnabled)(_core.FeatureFlag.EnableJavascriptControls) ? (0, _core.t)('This functionality is disabled in your environment for security reasons.') : null,
    readOnly: !(0, _core.isFeatureEnabled)(_core.FeatureFlag.EnableJavascriptControls)
  };
}
var filterNulls = exports.filterNulls = {
  name: 'filter_nulls',
  config: {
    type: 'CheckboxControl',
    label: (0, _core.t)('Ignore null locations'),
    default: true,
    description: (0, _core.t)('Whether to ignore locations that are null')
  }
};
var autozoom = exports.autozoom = {
  name: 'autozoom',
  config: {
    type: 'CheckboxControl',
    label: (0, _core.t)('Auto Zoom'),
    default: true,
    renderTrigger: true,
    description: (0, _core.t)('When checked, the map will zoom to your data after each query')
  }
};
var dimension = exports.dimension = {
  name: 'dimension',
  config: _extends({}, _chartControls.sharedControls.groupby, {
    label: (0, _core.t)('Dimension'),
    description: (0, _core.t)('Select a dimension'),
    multi: false,
    default: null
  })
};
var jsColumns = exports.jsColumns = {
  name: 'js_columns',
  config: _extends({}, _chartControls.sharedControls.groupby, {
    label: (0, _core.t)('Extra data for JS'),
    default: [],
    description: (0, _core.t)('List of extra columns made available in JavaScript functions')
  })
};
var jsDataMutator = exports.jsDataMutator = {
  name: 'js_data_mutator',
  config: jsFunctionControl((0, _core.t)('JavaScript data interceptor'), (0, _core.t)('Define a javascript function that receives the data array used in the visualization ' + 'and is expected to return a modified version of that array. This can be used ' + 'to alter properties of the data, filter, or enrich the array.'))
};
var jsTooltip = exports.jsTooltip = {
  name: 'js_tooltip',
  config: jsFunctionControl((0, _core.t)('JavaScript tooltip generator'), (0, _core.t)('Define a function that receives the input and outputs the content for a tooltip'))
};
var jsOnclickHref = exports.jsOnclickHref = {
  name: 'js_onclick_href',
  config: jsFunctionControl((0, _core.t)('JavaScript onClick href'), (0, _core.t)('Define a function that returns a URL to navigate to when user clicks'))
};
var legendFormat = exports.legendFormat = {
  name: 'legend_format',
  config: {
    label: (0, _core.t)('Legend Format'),
    description: (0, _core.t)('Choose the format for legend values'),
    type: 'SelectControl',
    clearable: false,
    default: _chartControls.D3_FORMAT_OPTIONS[0][0],
    choices: _chartControls.D3_FORMAT_OPTIONS,
    renderTrigger: true,
    freeForm: true
  }
};
var legendPosition = exports.legendPosition = {
  name: 'legend_position',
  config: {
    label: (0, _core.t)('Legend Position'),
    description: (0, _core.t)('Choose the position of the legend'),
    type: 'SelectControl',
    clearable: false,
    default: 'tr',
    choices: [[null, (0, _core.t)('None')], ['tl', (0, _core.t)('Top left')], ['tr', (0, _core.t)('Top right')], ['bl', (0, _core.t)('Bottom left')], ['br', (0, _core.t)('Bottom right')]],
    renderTrigger: true
  }
};
var lineColumn = exports.lineColumn = {
  name: 'line_column',
  config: {
    type: 'SelectControl',
    label: (0, _core.t)('Lines column'),
    default: null,
    description: (0, _core.t)('The database columns that contains lines information'),
    mapStateToProps: state => ({
      choices: (0, _controls.columnChoices)(state.datasource)
    }),
    validators: [_core.validateNonEmpty]
  }
};
var lineWidth = exports.lineWidth = {
  name: 'line_width',
  config: {
    type: 'TextControl',
    label: (0, _core.t)('Line width'),
    renderTrigger: true,
    isInt: true,
    default: 1,
    description: (0, _core.t)('The width of the lines')
  }
};
var fillColorPicker = exports.fillColorPicker = {
  name: 'fill_color_picker',
  config: {
    label: (0, _core.t)('Fill Color'),
    description: (0, _core.t)(' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
    type: 'ColorPickerControl',
    default: _controls.PRIMARY_COLOR,
    renderTrigger: true
  }
};
var strokeColorPicker = exports.strokeColorPicker = {
  name: 'stroke_color_picker',
  config: {
    label: (0, _core.t)('Stroke Color'),
    description: (0, _core.t)(' Set the opacity to 0 if you do not want to override the color specified in the GeoJSON'),
    type: 'ColorPickerControl',
    default: _controls.PRIMARY_COLOR,
    renderTrigger: true
  }
};
var filled = exports.filled = {
  name: 'filled',
  config: {
    type: 'CheckboxControl',
    label: (0, _core.t)('Filled'),
    renderTrigger: true,
    description: (0, _core.t)('Whether to fill the objects'),
    default: true
  }
};
var stroked = exports.stroked = {
  name: 'stroked',
  config: {
    type: 'CheckboxControl',
    label: (0, _core.t)('Stroked'),
    renderTrigger: true,
    description: (0, _core.t)('Whether to display the stroke'),
    default: false
  }
};
var extruded = exports.extruded = {
  name: 'extruded',
  config: {
    type: 'CheckboxControl',
    label: (0, _core.t)('Extruded'),
    renderTrigger: true,
    default: true,
    description: (0, _core.t)('Whether to make the grid 3D')
  }
};
var gridSize = exports.gridSize = {
  name: 'grid_size',
  config: {
    type: 'TextControl',
    label: (0, _core.t)('Grid Size'),
    renderTrigger: true,
    default: 20,
    isInt: true,
    description: (0, _core.t)('Defines the grid size in pixels')
  }
};
var viewport = exports.viewport = {
  name: 'viewport',
  config: {
    type: 'ViewportControl',
    label: (0, _core.t)('Viewport'),
    renderTrigger: false,
    description: (0, _core.t)('Parameters related to the view and perspective on the map'),
    // default is whole world mostly centered
    default: DEFAULT_VIEWPORT,
    // Viewport changes shouldn't prompt user to re-run query
    dontRefreshOnChange: true
  }
};
var spatial = exports.spatial = {
  name: 'spatial',
  config: {
    type: 'SpatialControl',
    label: (0, _core.t)('Longitude & Latitude'),
    validators: [_core.validateNonEmpty],
    description: (0, _core.t)('Point to your spatial columns'),
    mapStateToProps: state => ({
      choices: (0, _controls.columnChoices)(state.datasource)
    })
  }
};
var pointRadiusFixed = exports.pointRadiusFixed = {
  name: 'point_radius_fixed',
  config: {
    type: 'FixedOrMetricControl',
    label: (0, _core.t)('Point Size'),
    default: {
      type: 'fix',
      value: 1000
    },
    description: (0, _core.t)('Fixed point radius'),
    mapStateToProps: state => ({
      datasource: state.datasource
    })
  }
};
var multiplier = exports.multiplier = {
  name: 'multiplier',
  config: {
    type: 'TextControl',
    label: (0, _core.t)('Multiplier'),
    isFloat: true,
    renderTrigger: true,
    default: 1,
    description: (0, _core.t)('Factor to multiply the metric by')
  }
};
var lineType = exports.lineType = {
  name: 'line_type',
  config: {
    type: 'SelectControl',
    label: (0, _core.t)('Lines encoding'),
    clearable: false,
    default: 'json',
    description: (0, _core.t)('The encoding format of the lines'),
    choices: [['polyline', (0, _core.t)('Polyline')], ['json', (0, _core.t)('JSON')], ['geohash', (0, _core.t)('geohash (square)')]]
  }
};
var reverseLongLat = exports.reverseLongLat = {
  name: 'reverse_long_lat',
  config: {
    type: 'CheckboxControl',
    label: (0, _core.t)('Reverse Lat & Long'),
    default: false
  }
};
var osmStyle = exports.osmStyle = {
  name: 'mapbox_style',
  config: {
    type: 'SelectControl',
    label: (0, _core.t)('Map Style'),
    clearable: false,
    renderTrigger: true,
    freeForm: true,
    validators: [],
    // No need for Mapbox validation here
    choices: [['https://tile.openstreetmap.org/{z}/{x}/{y}.png', (0, _core.t)('OpenStreetMap')], ['https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}.png', (0, _core.t)('Smooth')], ['https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png', (0, _core.t)('Stamen Toner')], ['https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', (0, _core.t)('Stamen Watercolor')], ['https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png', (0, _core.t)('CartoDB Voyager')], ['https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png', (0, _core.t)('Dark')]],
    default: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    description: (0, _core.t)('Base layer map style. These are OpenStreetMap and other freely available map tile sources.')
  }
};
var mapboxStyle = exports.mapboxStyle = {
  name: 'mapbox_style',
  config: {
    type: 'SelectControl',
    label: (0, _core.t)('Map Style'),
    clearable: false,
    renderTrigger: true,
    freeForm: true,
    validators: [_core.validateMapboxStylesUrl],
    choices: [['mapbox://styles/mapbox/streets-v9', (0, _core.t)('Streets')], ['mapbox://styles/mapbox/dark-v9', (0, _core.t)('Dark')], ['mapbox://styles/mapbox/light-v9', (0, _core.t)('Light')], ['mapbox://styles/mapbox/satellite-streets-v9', (0, _core.t)('Satellite Streets')], ['mapbox://styles/mapbox/satellite-v9', (0, _core.t)('Satellite')], ['mapbox://styles/mapbox/outdoors-v9', (0, _core.t)('Outdoors')]],
    default: 'mapbox://styles/mapbox/light-v9',
    description: (0, _core.t)('Base layer map style. See Mapbox documentation: %s', 'https://docs.mapbox.com/help/glossary/style-url/')
  }
};
var geojsonColumn = exports.geojsonColumn = {
  name: 'geojson',
  config: {
    type: 'SelectControl',
    label: (0, _core.t)('GeoJson Column'),
    validators: [_core.validateNonEmpty],
    description: (0, _core.t)('Select the geojson column'),
    mapStateToProps: state => ({
      choices: (0, _controls.columnChoices)(state.datasource)
    })
  }
};