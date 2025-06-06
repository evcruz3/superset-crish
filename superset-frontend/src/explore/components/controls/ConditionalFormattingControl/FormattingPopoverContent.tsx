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
import { useState } from 'react';
import { styled, SupersetTheme, t, useTheme } from '@superset-ui/core';
import { ColorSchemeEnum } from '@superset-ui/plugin-chart-table';
import {
  Comparator,
  MultipleValueComparators,
} from '@superset-ui/chart-controls';
import { Form, FormItem, FormProps } from 'src/components/Form';
import Select from 'src/components/Select/Select';
import { Col, Row } from 'src/components';
import { InputNumber, Input } from 'src/components/Input';
import Button from 'src/components/Button';
import { ConditionalFormattingConfig, StringComparator, StringConditionalFormattingConfig } from './types';

const FullWidthInputNumber = styled(InputNumber)`
  width: 100%;
`;

const FullWidthInput = styled(Input)`
  width: 100%;
`;

const JustifyEnd = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const colorSchemeOptions = (theme: SupersetTheme) => [
  { value: theme.colors.success.light1, label: t('success') },
  { value: theme.colors.alert.light1, label: t('alert') },
  { value: theme.colors.error.light1, label: t('error') },
  { value: theme.colors.success.dark1, label: t('success dark') },
  { value: theme.colors.alert.dark1, label: t('alert dark') },
  { value: theme.colors.error.dark1, label: t('error dark') },
];

const operatorOptions = [
  { value: Comparator.None, label: t('None') },
  { value: Comparator.GreaterThan, label: '>' },
  { value: Comparator.LessThan, label: '<' },
  { value: Comparator.GreaterOrEqual, label: '≥' },
  { value: Comparator.LessOrEqual, label: '≤' },
  { value: Comparator.Equal, label: '=' },
  { value: Comparator.NotEqual, label: '≠' },
  { value: Comparator.Between, label: '< x <' },
  { value: Comparator.BetweenOrEqual, label: '≤ x ≤' },
  { value: Comparator.BetweenOrLeftEqual, label: '≤ x <' },
  { value: Comparator.BetweenOrRightEqual, label: '< x ≤' },
];

// String-specific operator options
const stringOperatorOptions = [
  { value: StringComparator.None, label: t('None') },
  { value: StringComparator.Equal, label: t('equals') },
  { value: StringComparator.NotEqual, label: t('not equals') },
  { value: StringComparator.Contains, label: t('contains') },
  { value: StringComparator.StartsWith, label: t('starts with') },
  { value: StringComparator.EndsWith, label: t('ends with') },
];

const targetValueValidator =
  (
    compare: (targetValue: number, compareValue: number) => boolean,
    rejectMessage: string,
  ) =>
  (targetValue: number | string) =>
  (_: any, compareValue: number | string) => {
    if (
      !targetValue ||
      !compareValue ||
      compare(Number(targetValue), Number(compareValue))
    ) {
      return Promise.resolve();
    }
    return Promise.reject(new Error(rejectMessage));
  };

const targetValueLeftValidator = targetValueValidator(
  (target: number, val: number) => target > val,
  t('This value should be smaller than the right target value'),
);

const targetValueRightValidator = targetValueValidator(
  (target: number, val: number) => target < val,
  t('This value should be greater than the left target value'),
);

const isOperatorMultiValue = (operator?: Comparator) =>
  operator && MultipleValueComparators.includes(operator);

const isOperatorNone = (operator?: Comparator) =>
  !operator || operator === Comparator.None;

const isStringOperatorNone = (operator?: StringComparator) =>
  !operator || operator === StringComparator.None;

const rulesRequired = [{ required: true, message: t('Required') }];

type GetFieldValue = Pick<Required<FormProps>['form'], 'getFieldValue'>;
const rulesTargetValueLeft = [
  { required: true, message: t('Required') },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: targetValueLeftValidator(getFieldValue('targetValueRight')),
  }),
];

const rulesTargetValueRight = [
  { required: true, message: t('Required') },
  ({ getFieldValue }: GetFieldValue) => ({
    validator: targetValueRightValidator(getFieldValue('targetValueLeft')),
  }),
];

const targetValueLeftDeps = ['targetValueRight'];
const targetValueRightDeps = ['targetValueLeft'];

const shouldFormItemUpdate = (
  prevValues: ConditionalFormattingConfig | StringConditionalFormattingConfig,
  currentValues: ConditionalFormattingConfig | StringConditionalFormattingConfig,
) => {
  if ('isString' in prevValues || 'isString' in currentValues) {
    // Handle string conditional formatting
    return isStringOperatorNone(prevValues.operator as StringComparator) !==
      isStringOperatorNone(currentValues.operator as StringComparator);
  }
  
  // Handle numeric conditional formatting
  return isOperatorNone(prevValues.operator as Comparator) !==
    isOperatorNone(currentValues.operator as Comparator) ||
  isOperatorMultiValue(prevValues.operator as Comparator) !==
    isOperatorMultiValue(currentValues.operator as Comparator);
};

const renderOperator = ({ showOnlyNone, isStringFormatting }: { showOnlyNone?: boolean, isStringFormatting?: boolean } = {}) => (
  <FormItem
    name="operator"
    label={t('Operator')}
    rules={rulesRequired}
    initialValue={isStringFormatting ? stringOperatorOptions[0].value : operatorOptions[0].value}
  >
    <Select
      ariaLabel={t('Operator')}
      options={
        isStringFormatting
          ? (showOnlyNone ? [stringOperatorOptions[0]] : stringOperatorOptions)
          : (showOnlyNone ? [operatorOptions[0]] : operatorOptions)
      }
    />
  </FormItem>
);

const renderOperatorFields = ({ getFieldValue, isStringFormatting }: GetFieldValue & { isStringFormatting?: boolean }) => {
  if (isStringFormatting) {
    return isStringOperatorNone(getFieldValue('operator')) ? (
      <Row gutter={12}>
        <Col span={6}>{renderOperator({ isStringFormatting: true })}</Col>
      </Row>
    ) : (
      <Row gutter={12}>
        <Col span={6}>{renderOperator({ isStringFormatting: true })}</Col>
        <Col span={18}>
          <FormItem
            name="targetStringValue"
            label={t('Target value')}
            rules={rulesRequired}
          >
            <FullWidthInput placeholder={t('Enter string value')} />
          </FormItem>
        </Col>
      </Row>
    );
  }

  // Original numeric operator fields code
  return isOperatorNone(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={6}>{renderOperator()}</Col>
    </Row>
  ) : isOperatorMultiValue(getFieldValue('operator')) ? (
    <Row gutter={12}>
      <Col span={9}>
        <FormItem
          name="targetValueLeft"
          label={t('Left value')}
          rules={rulesTargetValueLeft}
          dependencies={targetValueLeftDeps}
          validateTrigger="onBlur"
          trigger="onBlur"
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
      <Col span={6}>{renderOperator()}</Col>
      <Col span={9}>
        <FormItem
          name="targetValueRight"
          label={t('Right value')}
          rules={rulesTargetValueRight}
          dependencies={targetValueRightDeps}
          validateTrigger="onBlur"
          trigger="onBlur"
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
  ) : (
    <Row gutter={12}>
      <Col span={6}>{renderOperator()}</Col>
      <Col span={18}>
        <FormItem
          name="targetValue"
          label={t('Target value')}
          rules={rulesRequired}
        >
          <FullWidthInputNumber />
        </FormItem>
      </Col>
    </Row>
  );
};

export const FormattingPopoverContent = ({
  config,
  onChange,
  columns = [],
  extraColorChoices = [],
  isStringFormatting = false,
}: {
  config?: ConditionalFormattingConfig | StringConditionalFormattingConfig;
  onChange: (config: ConditionalFormattingConfig | StringConditionalFormattingConfig) => void;
  columns: { label: string; value: string }[];
  extraColorChoices?: { label: string; value: string }[];
  isStringFormatting?: boolean;
}) => {
  const theme = useTheme();
  const colorScheme = colorSchemeOptions(theme);
  const [showOperatorFields, setShowOperatorFields] = useState(
    config === undefined ||
      (config?.colorScheme !== ColorSchemeEnum.Green &&
        config?.colorScheme !== ColorSchemeEnum.Red),
  );
  const handleChange = (event: any) => {
    setShowOperatorFields(
      !(event === ColorSchemeEnum.Green || event === ColorSchemeEnum.Red),
    );
  };

  const handleFinish = (values: any) => {
    if (isStringFormatting) {
      onChange({
        ...values,
        isString: true, // Mark as string formatter
      } as StringConditionalFormattingConfig);
    } else {
      onChange(values as ConditionalFormattingConfig);
    }
  };

  return (
    <Form
      onFinish={handleFinish}
      initialValues={config}
      requiredMark="optional"
      layout="vertical"
    >
      <Row gutter={12}>
        <Col span={12}>
          <FormItem
            name="column"
            label={t('Column')}
            rules={rulesRequired}
            initialValue={columns[0]?.value}
          >
            <Select ariaLabel={t('Select column')} options={columns} />
          </FormItem>
        </Col>
        <Col span={12}>
          <FormItem
            name="colorScheme"
            label={t('Color scheme')}
            rules={rulesRequired}
            initialValue={colorScheme[0].value}
          >
            <Select
              onChange={event => handleChange(event)}
              ariaLabel={t('Color scheme')}
              options={[...colorScheme, ...extraColorChoices]}
            />
          </FormItem>
        </Col>
      </Row>
      <FormItem noStyle shouldUpdate={shouldFormItemUpdate}>
        {showOperatorFields ? (
          ({ getFieldValue }) => renderOperatorFields({ getFieldValue, isStringFormatting })
        ) : (
          <Row gutter={12}>
            <Col span={6}>{renderOperator({ showOnlyNone: true, isStringFormatting })}</Col>
          </Row>
        )}
      </FormItem>
      <JustifyEnd>
        <Button
          htmlType="submit"
          buttonStyle="primary"
          data-test="formatting-popover-apply-button"
        >
          {t('Apply')}
        </Button>
      </JustifyEnd>
    </Form>
  );
};
