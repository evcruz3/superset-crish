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
import { useEffect, useState } from 'react';
import { styled, css, t, useTheme } from '@superset-ui/core';
import { Comparator } from '@superset-ui/chart-controls';
import Icons from 'src/components/Icons';
import ControlHeader from 'src/explore/components/ControlHeader';
import { FormattingPopover } from './FormattingPopover';
import {
  ConditionalFormattingConfig,
  ConditionalFormattingControlProps,
  StringComparator,
  StringConditionalFormattingConfig,
} from './types';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from '../OptionControls';

const FormattersContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.gridUnit}px;
    border: solid 1px ${theme.colors.grayscale.light2};
    border-radius: ${theme.gridUnit}px;
  `}
`;

export const FormatterContainer = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

export const CloseButton = styled.button`
  ${({ theme }) => css`
    color: ${theme.colors.grayscale.light1};
    height: 100%;
    width: ${theme.gridUnit * 6}px;
    border: none;
    border-right: solid 1px ${theme.colors.grayscale.dark2}0C;
    padding: 0;
    outline: none;
    border-bottom-left-radius: 3px;
    border-top-left-radius: 3px;
  `}
`;

const ConditionalFormattingControl = ({
  value,
  onChange,
  columnOptions,
  verboseMap,
  removeIrrelevantConditions,
  extraColorChoices,
  isStringFormatting = false,
  ...props
}: ConditionalFormattingControlProps) => {
  const theme = useTheme();
  const [conditionalFormattingConfigs, setConditionalFormattingConfigs] =
    useState<
      (ConditionalFormattingConfig | StringConditionalFormattingConfig)[]
    >(value ?? []);

  useEffect(() => {
    if (onChange) {
      onChange(conditionalFormattingConfigs);
    }
  }, [conditionalFormattingConfigs, onChange]);

  useEffect(() => {
    if (removeIrrelevantConditions) {
      // remove formatter when corresponding column is removed from controls
      const newFormattingConfigs = conditionalFormattingConfigs.filter(config =>
        columnOptions.some((option: any) => option?.value === config?.column),
      );
      if (
        newFormattingConfigs.length !== conditionalFormattingConfigs.length &&
        removeIrrelevantConditions
      ) {
        setConditionalFormattingConfigs(newFormattingConfigs);
      }
    }
  }, [conditionalFormattingConfigs, columnOptions, removeIrrelevantConditions]);

  const onDelete = (index: number) => {
    setConditionalFormattingConfigs(prevConfigs =>
      prevConfigs.filter((_, i) => i !== index),
    );
  };

  const onSave = (
    config: ConditionalFormattingConfig | StringConditionalFormattingConfig,
  ) => {
    setConditionalFormattingConfigs(prevConfigs => [...prevConfigs, config]);
  };

  const onEdit = (
    newConfig: ConditionalFormattingConfig | StringConditionalFormattingConfig,
    index: number,
  ) => {
    const newConfigs = [...conditionalFormattingConfigs];
    newConfigs.splice(index, 1, newConfig);
    setConditionalFormattingConfigs(newConfigs);
  };

  const createLabel = (
    config: ConditionalFormattingConfig | StringConditionalFormattingConfig,
  ) => {
    const columnName =
      (config.column && verboseMap?.[config.column]) ?? config.column;

    // If this is a string conditional formatting config
    if ('isString' in config && config.isString) {
      const { operator, targetStringValue } =
        config as StringConditionalFormattingConfig;

      switch (operator) {
        case StringComparator.None:
          return `${columnName}`;
        case StringComparator.Equal:
          return `${columnName} ${operator} "${targetStringValue}"`;
        case StringComparator.NotEqual:
          return `${columnName} ${operator} "${targetStringValue}"`;
        case StringComparator.Contains:
          return `${columnName} ${operator} "${targetStringValue}"`;
        case StringComparator.StartsWith:
          return `${columnName} ${operator} "${targetStringValue}"`;
        case StringComparator.EndsWith:
          return `${columnName} ${operator} "${targetStringValue}"`;
        default:
          return `${columnName} ${operator} "${targetStringValue}"`;
      }
    }

    // Otherwise, it's a numeric conditional formatting config
    const { operator, targetValue, targetValueLeft, targetValueRight } =
      config as ConditionalFormattingConfig;

    switch (operator) {
      case Comparator.None:
        return `${columnName}`;
      case Comparator.Between:
        return `${targetValueLeft} ${Comparator.LessThan} ${columnName} ${Comparator.LessThan} ${targetValueRight}`;
      case Comparator.BetweenOrEqual:
        return `${targetValueLeft} ${Comparator.LessOrEqual} ${columnName} ${Comparator.LessOrEqual} ${targetValueRight}`;
      case Comparator.BetweenOrLeftEqual:
        return `${targetValueLeft} ${Comparator.LessOrEqual} ${columnName} ${Comparator.LessThan} ${targetValueRight}`;
      case Comparator.BetweenOrRightEqual:
        return `${targetValueLeft} ${Comparator.LessThan} ${columnName} ${Comparator.LessOrEqual} ${targetValueRight}`;
      default:
        return `${columnName} ${operator} ${targetValue}`;
    }
  };

  return (
    <div>
      <ControlHeader {...props} />
      <FormattersContainer>
        {conditionalFormattingConfigs.map((config, index) => (
          <FormatterContainer key={index}>
            <CloseButton onClick={() => onDelete(index)}>
              <Icons.XSmall iconColor={theme.colors.grayscale.light1} />
            </CloseButton>
            <FormattingPopover
              title={t('Edit formatter')}
              config={config}
              columns={columnOptions}
              onChange={(
                newConfig:
                  | ConditionalFormattingConfig
                  | StringConditionalFormattingConfig,
              ) => onEdit(newConfig, index)}
              destroyTooltipOnHide
              extraColorChoices={extraColorChoices}
              isStringFormatting={isStringFormatting}
            >
              <OptionControlContainer withCaret>
                <Label>{createLabel(config)}</Label>
                <CaretContainer>
                  <Icons.CaretRight iconColor={theme.colors.grayscale.light1} />
                </CaretContainer>
              </OptionControlContainer>
            </FormattingPopover>
          </FormatterContainer>
        ))}
        <FormattingPopover
          title={t('Add new formatter')}
          columns={columnOptions}
          onChange={onSave}
          destroyTooltipOnHide
          extraColorChoices={extraColorChoices}
          isStringFormatting={isStringFormatting}
        >
          <AddControlLabel>
            <Icons.PlusSmall iconColor={theme.colors.grayscale.light1} />
            {t('Add new color formatter')}
          </AddControlLabel>
        </FormattingPopover>
      </FormattersContainer>
    </div>
  );
};

export default ConditionalFormattingControl;
