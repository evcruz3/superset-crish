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
import { t, validateNonEmpty, GenericDataType } from '@superset-ui/core';
import { countryOptions } from '../Country/countries';
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
            name: 'title_column',
            config: {
              type: 'SelectControl',
              label: t('Title Column'),
              description: t('Column containing titles for feed entries'),
              mapStateToProps: state => ({
                choices: state.datasource?.columns
                  .map(c => [c.column_name, c.verbose_name || c.column_name]) ?? [],
              }),
              default: null,
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'message_column',
            config: {
              type: 'SelectControl',
              label: t('Message Column'),
              description: t('Column containing messages for feed entries'),
              mapStateToProps: state => ({
                choices: state.datasource?.columns
                  .map(c => [c.column_name, c.verbose_name || c.column_name]) ?? [],
              }),
              default: null,
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'date_column',
            config: {
              type: 'SelectControl',
              label: t('Date Column'),
              description: t('Column containing timestamps for feed entries'),
              mapStateToProps: state => ({
                choices: (state.datasource?.columns || [])
                  .filter(c => c.type_generic === GenericDataType.Temporal)
                  .map(c => [c.column_name, c.column_name]) ?? [],
              }),
              default: null,
              validators: [validateNonEmpty],
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