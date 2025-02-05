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
import { ControlPanelConfig, getStandardizedControls, sharedControls } from '@superset-ui/chart-controls';
import {
  t,
  validateNonEmpty,
  getCategoricalSchemeRegistry,
  getSequentialSchemeRegistry,
  SequentialScheme,
} from '@superset-ui/core';
import { countryOptions } from './countries';
import {
  filterNulls,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  osmStyle,
  autozoom,
  lineWidth,
} from '../../utilities/Shared_DeckGL';

interface MetricValue {
  column_name?: string;
  [key: string]: any;
}

const isMetricValue = (value: any): value is MetricValue => {
  return typeof value === 'object' && value !== null && 'column_name' in value;
};

// Initialize color scheme registries
const categoricalSchemeRegistry = getCategoricalSchemeRegistry();
const sequentialSchemeRegistry = getSequentialSchemeRegistry();

// Get the scheme maps as functions
const getCategoricalSchemeMap = () => categoricalSchemeRegistry.getMap();
const getSequentialSchemeMap = () => sequentialSchemeRegistry.getMap();

// Get the scheme keys as functions
const getCategoricalSchemeKeys = () => categoricalSchemeRegistry.keys();
const getSequentialSchemeKeys = () => sequentialSchemeRegistry.keys();

// Debug helper
const debugLog = (context: string, value: any) => {
  console.log(`[Country Chart Debug] ${context}:`, value);
};

// Helper to safely get a color scheme
const getColorScheme = (schemeMap: Record<string, any>, schemeName: string | undefined, defaultSchemeName: string) => {
  if (!schemeName || !schemeMap[schemeName]) {
    return schemeMap[defaultSchemeName];
  }
  return schemeMap[schemeName];
};

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'select_country',
            config: {
              type: 'SelectControl',
              label: t('Country'),
              default: null,
              choices: countryOptions,
              description: t('Which country to plot the map for?'),
              validators: [validateNonEmpty],
            },
          },
        ],
        ['entity'],
        ['metric'],
        [
          {
            name: 'categorical_column',
            config: {
              type: 'SelectControl',
              label: t('Categorical Column'),
              description: t('Column to display in the text layer and tooltip instead of metric value'),
              mapStateToProps: state => ({
                choices: (state.datasource?.columns || [])
                  .map(c => [c.column_name, c.column_name]) ?? [],
              }),
              default: null,
            },
          },
        ],
        [
          {
            name: 'temporal_column',
            config: {
              type: 'SelectControl',
              label: t('Time Column'),
              description: t('Column containing datetime information for temporal filtering'),
              mapStateToProps: state => ({
                choices: (state.datasource?.columns || [])
                  .filter(c => c.is_dttm)
                  .map(c => [c.column_name, c.column_name]) ?? [],
              }),
              default: null,
            },
          },
        ],
        ['adhoc_filters'],
        [filterNulls],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      tabOverride: 'customize',
      controlSetRows: [
        [
          {
            name: 'number_format',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Number format'),
              renderTrigger: true,
              default: 'SMART_NUMBER',
              choices: [
                ['SMART_NUMBER', t('Smart Number')],
                [',.1f', ',.1f (12,345.1)'],
                [',.2f', ',.2f (12,345.12)'],
                ['.1%', '.1% (12.3%)'],
                ['.2%', '.2% (12.34%)'],
                [',.2r', ',.2r (12,300)'],
              ],
              description: t('D3 format syntax: https://github.com/d3/d3-format'),
              visibility: ({ controls }) => !controls?.categorical_column?.value,
            },
          },
        ],
        [
          {
            name: 'metric_prefix',
            config: {
              type: 'TextControl',
              label: t('Metric Prefix'),
              description: t('Text to be displayed before the metric value'),
              default: '',
              renderTrigger: true,
              visibility: ({ controls }) => !controls?.categorical_column?.value,
            },
          },
        ],
        [
          {
            name: 'metric_unit',
            config: {
              type: 'TextControl',
              label: t('Metric Unit'),
              description: t('Unit to be displayed after the metric value'),
              default: '',
              renderTrigger: true,
              visibility: ({ controls }) => !controls?.categorical_column?.value,
            },
          },
        ],
      ],
    },
    {
      label: t('Color Scheme'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'linear_color_scheme',
            config: {
              type: 'ColorSchemeControl',
              label: t('Linear Color Scheme'),
              description: t('Color scheme for continuous values'),
              renderTrigger: true,
              visibility: ({ controls }) => !controls?.categorical_column?.value,
              default: 'blue_white_yellow',
              schemes: getSequentialSchemeMap,
              choices: () => {
                const choices = getSequentialSchemeKeys().map(s => [s, s]);
                debugLog('Linear Color Scheme Choices', choices);
                return choices;
              },
              isLinear: true,
              
            },
          },
        ],
        [
          {
            name: 'categorical_color_scheme',
            config: {
              type: 'ColorSchemeControl',
              label: t('Categorical Color Scheme'),
              description: t('Color scheme for categorical values'),
              renderTrigger: true,
              visibility: ({ controls }) => !!controls?.categorical_column?.value,
              default: 'supersetColors',
              schemes: getCategoricalSchemeMap,
              choices: () => {
                const choices = getCategoricalSchemeKeys().map(s => [s, s]);
                debugLog('Categorical Color Scheme Choices', choices);
                return choices;
              },
              isLinear: false,
              mapStateToProps: (state) => {
                debugLog('Categorical Color Scheme State', state);
                return {};
              },
            },
          }
        ],
        [
          {
            name: 'value_map',
            config: {
              type: 'ValueMappedControl',
              label: t('Value to Color Mapping'),
              description: t('Map specific values to colors. Click "+ Add Value" to add a new mapping.'),
              default: {},
              renderTrigger: true,
              mapStateToProps: (state) => {
                const metricValue = state.controls?.metric?.value;
                const metricColumn = isMetricValue(metricValue) ? metricValue.column_name : undefined;
                const metricLabel = state.form_data?.metric?.label;
                const currentColorScheme = state.controls?.categorical_color_scheme?.value as string | undefined;
                
                debugLog('Value Map State', {
                  metricValue,
                  metricColumn,
                  metricLabel,
                  currentColorScheme,
                  state
                });

                const schemeMap = getCategoricalSchemeMap();
                const currentScheme = getColorScheme(schemeMap, currentColorScheme, 'supersetColors');
                
                return {
                  valueLabel: t('Value'),
                  colorLabel: t('Color'),
                  scheme: currentScheme,
                  addValuePlaceholder: t('Enter a value'),
                  addValueLabel: t('+ Add Value'),
                };
              },
            },
          },
        ],
        // [
        //   {
        //     name: 'categorical_fallback_color',
        //     config: {
        //       type: 'ColorPickerControl',
        //       label: t('Default Color'),
        //       description: t('Color for values not specified in the color mapping'),
        //       default: { r: 88, g: 88, b: 88, a: 1 },
        //       renderTrigger: true,
        //     },
        //   },
        // ],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [osmStyle, viewport],
        [autozoom],
      ],
    },
    {
      label: t('Map Settings'),
      expanded: true,
      controlSetRows: [
        [fillColorPicker, strokeColorPicker],
        [filled, stroked],
        // [extruded],
        [lineWidth],
        [
          {
            name: 'line_width_unit',
            config: {
              type: 'SelectControl',
              label: t('Line width unit'),
              default: 'pixels',
              choices: [
                ['meters', t('meters')],
                ['pixels', t('pixels')],
              ],
              renderTrigger: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
  controlOverrides: {
    entity: {
      label: t('ISO 3166-2 Codes'),
      description: t(
        'Column containing ISO 3166-2 codes of region/province/department in your table.',
      ),
    },
    metric: {
      label: t('Metric'),
      description: t('Metric to display in the map'),
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
