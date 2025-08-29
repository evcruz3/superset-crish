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

import { ReactNode } from 'react';
import { PopoverProps } from 'antd/lib/popover';
import { Comparator, ControlComponentProps } from '@superset-ui/chart-controls';

export type ConditionalFormattingConfig = {
  operator?: Comparator;
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  column?: string;
  colorScheme?: string;
};

// Add string-specific comparator enum
export enum StringComparator {
  None = 'None',
  Equal = '=',
  NotEqual = '≠',
  Contains = 'contains',
  StartsWith = 'starts with',
  EndsWith = 'ends with',
}

// Add string-specific conditional formatting config
export type StringConditionalFormattingConfig = {
  operator?: StringComparator;
  targetStringValue?: string; // Using string value instead of numeric value
  column?: string;
  colorScheme?: string;
  isString?: boolean; // Flag to identify this as a string formatter
};

export type ConditionalFormattingControlProps = ControlComponentProps<
  (ConditionalFormattingConfig | StringConditionalFormattingConfig)[]
> & {
  columnOptions: { label: string; value: string }[];
  removeIrrelevantConditions: boolean;
  verboseMap: Record<string, string>;
  label: string;
  description: string;
  extraColorChoices?: { label: string; value: string }[];
  isStringFormatting?: boolean; // Flag to enable string-specific UI
};

export type FormattingPopoverProps = PopoverProps & {
  columns: { label: string; value: string }[];
  onChange: (
    value: ConditionalFormattingConfig | StringConditionalFormattingConfig,
  ) => void;
  config?: ConditionalFormattingConfig | StringConditionalFormattingConfig;
  title: string;
  children: ReactNode;
  extraColorChoices?: { label: string; value: string }[];
  isStringFormatting?: boolean; // Flag to enable string-specific UI
};
