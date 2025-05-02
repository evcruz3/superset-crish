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
import { addAlpha, DataRecord } from '@superset-ui/core';
import {
  ColorFormatters,
  Comparator,
  ConditionalFormattingConfig,
  MultipleValueComparators,
} from '../types';

// Import the StringComparator enum
// Since we can't directly modify the chart-controls package, we'll need to recreate the enum here
// to match what's in superset-frontend/src/explore/components/controls/ConditionalFormattingControl/types.ts
enum StringComparator {
  None = 'None',
  Equal = '=',
  NotEqual = '≠',
  Contains = 'contains',
  StartsWith = 'starts with',
  EndsWith = 'ends with',
}

// Define the structure to match StringConditionalFormattingConfig
interface StringConditionalFormattingConfig {
  operator?: StringComparator;
  targetStringValue?: string;
  column?: string;
  colorScheme?: string;
  isString?: boolean;
}

export const round = (num: number, precision = 0) =>
  Number(`${Math.round(Number(`${num}e+${precision}`))}e-${precision}`);

const MIN_OPACITY_BOUNDED = 0.3;
const MAX_OPACITY_BOUNDED = 1;
const MIN_OPACITY_UNBOUNDED = 0.1;
const MAX_OPACITY_UNBOUNDED = 0.9;

export const getOpacity = (minValue: number, maxValue: number, value: number) =>
  maxValue - minValue === 0
    ? 1
    : round(
        Math.max(Math.min((value - minValue) / (maxValue - minValue), 1), 0),
        2,
      );

export const getColorFunction = (
  config: ConditionalFormattingConfig | StringConditionalFormattingConfig,
  valuesArray: number[] | string[],
  alpha?: boolean,
) => {
  // Handle string conditional formatting
  if ('isString' in config && config.isString) {
    const { operator, targetStringValue, colorScheme } = config as StringConditionalFormattingConfig;
    
    if (!targetStringValue && operator !== StringComparator.None) {
      return () => undefined;
    }
    
    return (value: string): string | undefined => {
      let isMatch = false;
      
      switch (operator) {
        case StringComparator.None:
          isMatch = true;
          break;
        case StringComparator.Equal:
          isMatch = value === targetStringValue;
          break;
        case StringComparator.NotEqual:
          isMatch = value !== targetStringValue;
          break;
        case StringComparator.Contains:
          isMatch = typeof value === 'string' && value.includes(targetStringValue!);
          break;
        case StringComparator.StartsWith:
          isMatch = typeof value === 'string' && value.startsWith(targetStringValue!);
          break;
        case StringComparator.EndsWith:
          isMatch = typeof value === 'string' && value.endsWith(targetStringValue!);
          break;
        default:
          isMatch = false;
      }
      
      return isMatch ? (alpha ? addAlpha(colorScheme!, 1) : colorScheme) : undefined;
    };
  }
  
  // Original numeric conditional formatting
  const { operator, targetValue, targetValueLeft, targetValueRight, colorScheme } =
    config as ConditionalFormattingConfig;
  const numericValues = valuesArray as number[];
  
  if (!config?.column) {
    return () => undefined;
  }

  if (
    (MultipleValueComparators.includes(operator!) &&
      (targetValueLeft === undefined || targetValueRight === undefined)) ||
    (!MultipleValueComparators.includes(operator!) && targetValue === undefined)
  ) {
    return () => undefined;
  }

  let comparatorFunction: (
    value: number,
    allValues: number[],
  ) =>
    | false
    | {
        cutoffValue: number;
        extremeValue: number;
      };
  let minOpacity = MIN_OPACITY_BOUNDED;
  const maxOpacity = MAX_OPACITY_BOUNDED;

  switch (operator) {
    case Comparator.None:
      minOpacity = MIN_OPACITY_UNBOUNDED;
      comparatorFunction = (value: number, allValues: number[]) => {
        const cutoffValue = Math.min(...allValues);
        const extremeValue = Math.max(...allValues);
        return value >= cutoffValue && value <= extremeValue
          ? { cutoffValue, extremeValue }
          : false;
      };
      break;
    case Comparator.GreaterThan:
      comparatorFunction = (value: number, allValues: number[]) =>
        value > targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.max(...allValues) }
          : false;
      break;
    case Comparator.LessThan:
      comparatorFunction = (value: number, allValues: number[]) =>
        value < targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.min(...allValues) }
          : false;
      break;
    case Comparator.GreaterOrEqual:
      comparatorFunction = (value: number, allValues: number[]) =>
        value >= targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.max(...allValues) }
          : false;
      break;
    case Comparator.LessOrEqual:
      comparatorFunction = (value: number, allValues: number[]) =>
        value <= targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.min(...allValues) }
          : false;
      break;
    case Comparator.Equal:
      comparatorFunction = (value: number) =>
        value === targetValue!
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.NotEqual:
      minOpacity = MIN_OPACITY_UNBOUNDED;
      comparatorFunction = (value: number, allValues: number[]) => {
        if (value === targetValue) {
          return false;
        }
        let cutoffValue;
        let extremeValue;
        const sortedValues = [...allValues].sort((a, b) => a - b);
        const targetIndex = sortedValues.indexOf(targetValue!);
        if (targetIndex >= 0) {
          // if targetValue is not in the array, this is -1
          if (value < targetValue!) {
            cutoffValue = 0;
            extremeValue = targetValue!;
          } else {
            cutoffValue = targetValue!;
            extremeValue = Infinity;
          }
        } else if (targetValue! < sortedValues[0]) {
          cutoffValue = targetValue!;
          extremeValue = Infinity;
        } else {
          cutoffValue = 0;
          extremeValue = targetValue!;
        }
        return { cutoffValue, extremeValue };
      };
      break;
    case Comparator.Between:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrEqual:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrLeftEqual:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrRightEqual:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    default:
      comparatorFunction = () => false;
  }

  return (value: number): string | undefined => {
    const matched = comparatorFunction(value, numericValues);
    if (!matched) {
      return undefined;
    }
    const { cutoffValue, extremeValue } = matched;
    let opacity = maxOpacity;
    if (
      operator === Comparator.None ||
      operator === Comparator.NotEqual ||
      value !== extremeValue
    ) {
      if (operator === Comparator.NotEqual) {
        const distance = Math.abs(value - targetValue!);
        if (extremeValue === Infinity) {
          opacity = minOpacity;
        } else {
          const range = Math.abs(extremeValue - cutoffValue);
          opacity = getOpacity(0, range, distance);
        }
      } else {
        const range = Math.abs(extremeValue - cutoffValue);
        const distance = Math.abs(value - cutoffValue);
        opacity = getOpacity(
          minOpacity,
          maxOpacity,
          (distance / range) * (maxOpacity - minOpacity) + minOpacity,
        );
      }
    }
    return alpha ? addAlpha(colorScheme!, opacity) : colorScheme;
  };
};

export const getColorFormatters = memoizeOne(
  (
    columnConfig: (ConditionalFormattingConfig | StringConditionalFormattingConfig)[] | undefined,
    data: DataRecord[],
    alpha?: boolean,
  ) =>
    columnConfig?.reduce(
      (acc: ColorFormatters, config: ConditionalFormattingConfig | StringConditionalFormattingConfig) => {
        const targetColumn = config?.column;
        
        if (targetColumn !== undefined) {
          if ('isString' in config && config.isString) {
            // Handle string conditional formatting
            const stringValues = data.map(row => String(row[targetColumn]));
            acc.push({
              column: targetColumn,
              getColorFromValue: getColorFunction(
                config,
                stringValues,
                alpha,
              ) as (value: number) => string | undefined, // TS needs this cast
            });
          } else {
            // Handle numeric conditional formatting
            const numericValues = data.map(row => row[targetColumn] as number);
            const isValid = config?.operator === Comparator.None ||
              (config?.operator !== undefined &&
                (MultipleValueComparators.includes(config?.operator)
                  ? config?.targetValueLeft !== undefined &&
                    config?.targetValueRight !== undefined
                  : config?.targetValue !== undefined));
            
            if (isValid) {
              acc.push({
                column: targetColumn,
                getColorFromValue: getColorFunction(
                  config,
                  numericValues,
                  alpha,
                ),
              });
            }
          }
        }
        return acc;
      },
      [],
    ) ?? [],
);
