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
import { ControlPanelConfig, getStandardizedControls } from '@superset-ui/chart-controls';
import { t, validateNonEmpty } from '@superset-ui/core';
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
            name: 'temporal_column',
            config: {
              type: 'SelectControl',
              label: t('Time Column'),
              description: t('Column containing datetime information for temporal filtering'),
              mapStateToProps: state => ({
                choices: state.datasource?.columns
                  .filter(c => c.is_dttm)
                  .map(c => [c.column_name, c.verbose_name || c.column_name]) ?? [],
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
            },
          },
        ],
        ['linear_color_scheme'],
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
        [extruded],
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
    {
      label: t('Conditional Icons'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'show_icons',
            config: {
              type: 'CheckboxControl',
              label: t('Show Icons'),
              default: false,
              description: t('Show icons on regions based on conditions'),
            },
          },
        ],
        [
          {
            name: 'icon_threshold',
            config: {
              type: 'TextControl',
              label: t('Threshold Value'),
              default: '',
              description: t('Show icon when metric value exceeds this threshold'),
              visibility: ({ controls }) => controls.show_icons.value,
            },
          },
          {
            name: 'icon_threshold_operator',
            config: {
              type: 'SelectControl',
              label: t('Threshold Operator'),
              default: '>',
              choices: [
                ['>', t('Greater than')],
                ['>=', t('Greater than or equal')],
                ['<', t('Less than')],
                ['<=', t('Less than or equal')],
                ['==', t('Equal to')],
                ['!=', t('Not equal to')],
              ],
              visibility: ({ controls }) => controls.show_icons.value,
            },
          },
        ],
        [
          {
            name: 'icon_type',
            config: {
              type: 'SelectControl',
              label: t('Icon'),
              default: 'fa-exclamation-circle',
              choices: [
                ['fa-exclamation-circle', t('Exclamation Circle')],
                ['fa-warning', t('Warning')],
                ['fa-info-circle', t('Info Circle')],
                ['fa-check-circle', t('Check Circle')],
                ['fa-times-circle', t('Times Circle')],
                ['fa-question-circle', t('Question Circle')],
                ['fa-flag', t('Flag')],
                ['fa-bell', t('Bell')],
              ],
              visibility: ({ controls }) => controls.show_icons.value,
            },
          },
        ],
        [
          {
            name: 'icon_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Icon Color'),
              default: { r: 255, g: 0, b: 0, a: 1 },
              visibility: ({ controls }) => controls.show_icons.value,
            },
          },
          {
            name: 'icon_size',
            config: {
              type: 'SliderControl',
              label: t('Icon Size'),
              default: 20,
              min: 10,
              max: 100,
              visibility: ({ controls }) => controls.show_icons.value,
            },
          },
        ],
        [
          {
            name: 'icon_hover_message',
            config: {
              type: 'TextControl',
              label: t('Icon Hover Message'),
              description: t('Message to display when hovering over the icon. Use {metric} to include the metric value.'),
              default: 'Value: {metric}',
              visibility: ({ controls }) => controls.show_icons.value,
            },
          },
        ],
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
    linear_color_scheme: {
      renderTrigger: false,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    entity: getStandardizedControls().shiftColumn(),
    metric: getStandardizedControls().shiftMetric(),
  }),
};

export default config;
