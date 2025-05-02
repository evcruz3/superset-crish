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
import memoizeOne from 'memoize-one';
import { DataRecord } from '@superset-ui/core';
import { StringColorFormatters } from '../types';

// Define an enum to match StringComparator from ConditionalFormattingControl
enum StringComparator {
  None = 'None',
  Equal = '=',
  NotEqual = '≠',
  Contains = 'contains',
  StartsWith = 'starts with',
  EndsWith = 'ends with',
}

// Define an interface to match StringConditionalFormattingConfig
interface StringConditionalFormattingConfig {
  operator?: StringComparator;
  targetStringValue?: string;
  column?: string;
  colorScheme?: string;
  isString?: boolean;
}

// Function to create string color formatters
export const getStringColorFormatters = memoizeOne(
  (
    stringFormatting: any[] | undefined,
    data: DataRecord[],
  ): StringColorFormatters => {
    if (!stringFormatting || stringFormatting.length === 0) {
      return [];
    }

    return stringFormatting.reduce(
      (formatters: StringColorFormatters, config: any) => {
        if (!config.column || !config.isString) {
          return formatters;
        }

        formatters.push({
          column: config.column,
          getColorFromValue: (value: string): string | undefined => {
            if (!value) return undefined;

            let match = false;
            switch (config.operator) {
              case StringComparator.None:
                match = true;
                break;
              case StringComparator.Equal:
                match = value === config.targetStringValue;
                break;
              case StringComparator.NotEqual:
                match = value !== config.targetStringValue;
                break;
              case StringComparator.Contains:
                match = value.includes(config.targetStringValue || '');
                break;
              case StringComparator.StartsWith:
                match = value.startsWith(config.targetStringValue || '');
                break;
              case StringComparator.EndsWith:
                match = value.endsWith(config.targetStringValue || '');
                break;
              default:
                match = false;
            }

            return match ? config.colorScheme : undefined;
          },
        });

        return formatters;
      },
      [],
    );
  },
); 