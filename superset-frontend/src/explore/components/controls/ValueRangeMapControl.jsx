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
import PropTypes from 'prop-types';
import { SketchPicker } from 'react-color';
import { debounce } from 'lodash';
import { styled, t } from '@superset-ui/core';
import { Button, Input, InputNumber, Row, Col, Tooltip } from 'antd';
import {
  PlusOutlined,
  CloseOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  value: PropTypes.object,
  minLabel: PropTypes.string,
  maxLabel: PropTypes.string,
  colorLabel: PropTypes.string,
  scheme: PropTypes.object,
  addRangePlaceholder: PropTypes.string,
  addRangeLabel: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

const defaultProps = {
  value: {},
  minLabel: t('Min Value'),
  maxLabel: t('Max Value'),
  colorLabel: t('Color'),
  scheme: null,
  addRangePlaceholder: t('Enter range values'),
  addRangeLabel: t('+ Add Range'),
};

const StyledContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 1.5}px 0;
`;

const StyledRangeItem = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit}px 0;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;

  .range-input {
    flex: 1;
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }

  .color-preview {
    flex: 1;
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    height: 24px;
    cursor: pointer;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: 2px;
  }

  .remove-btn {
    margin-left: ${({ theme }) => theme.gridUnit}px;
  }
`;

const StyledColorPickerPopover = styled.div`
  position: absolute;
  z-index: 10;
`;

const StyledFooter = styled.div`
  display: flex;
  justify-content: flex-start;
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;

  .add-btn {
    margin-top: ${({ theme }) => theme.gridUnit}px;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;

    .input-label {
      margin-bottom: ${({ theme }) => theme.gridUnit}px;
      font-size: 12px;
    }
  }
`;

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
`;

export default class ValueRangeMapControl extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      ranges: [],
      showColorPicker: null,
      newMinValue: null,
      newMaxValue: null,
    };

    this.debouncedOnChange = debounce(this.onChange, 300);
  }

  componentDidMount() {
    this.updateRangesFromProps();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.updateRangesFromProps();
    }
  }

  updateRangesFromProps() {
    const { value } = this.props;
    if (!value) return;

    // Convert from stored format to component state
    const ranges = Object.entries(value).map(([rangeKey, rangeColor]) => {
      const [min, max] = rangeKey.split('-').map(Number);
      return {
        min,
        max,
        color: rangeColor,
      };
    });

    this.setState({ ranges });
  }

  onChange = () => {
    // Convert from component state to stored format
    const { ranges } = this.state;
    const valueMap = ranges.reduce((acc, { min, max, color }) => {
      if (min !== null && max !== null) {
        acc[`${min}-${max}`] = color;
      }
      return acc;
    }, {});

    this.props.onChange(valueMap);
  };

  handleMinChange = (index, min) => {
    const { ranges } = this.state;
    const updatedRanges = [...ranges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      min,
    };

    this.setState({ ranges: updatedRanges }, () => {
      this.debouncedOnChange();
    });
  };

  handleMaxChange = (index, max) => {
    const { ranges } = this.state;
    const updatedRanges = [...ranges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      max,
    };

    this.setState({ ranges: updatedRanges }, () => {
      this.debouncedOnChange();
    });
  };

  handleColorChange = (index, color) => {
    const { ranges } = this.state;
    const updatedRanges = [...ranges];
    updatedRanges[index] = {
      ...updatedRanges[index],
      color: color.hex,
    };

    this.setState({ ranges: updatedRanges }, () => {
      this.debouncedOnChange();
    });
  };

  handleRemoveRange = index => {
    const { ranges } = this.state;
    const updatedRanges = ranges.filter((_, i) => i !== index);

    this.setState({ ranges: updatedRanges }, this.onChange);
  };

  handleAddRange = () => {
    const { newMinValue, newMaxValue, ranges } = this.state;
    const { scheme } = this.props;

    if (newMinValue === null || newMaxValue === null) return;
    if (newMinValue >= newMaxValue) return;

    // Get next color from scheme or use default
    const nextColor =
      scheme?.colors?.[ranges.length % (scheme.colors.length || 1)] ||
      `#${Math.floor(Math.random() * 16777215).toString(16)}`;

    const updatedRanges = [
      ...ranges,
      { min: newMinValue, max: newMaxValue, color: nextColor },
    ];

    this.setState(
      {
        ranges: updatedRanges,
        newMinValue: null,
        newMaxValue: null,
      },
      this.onChange,
    );
  };

  isRangeValid = (min, max) => min !== null && max !== null && min < max;

  render() {
    const {
      minLabel,
      maxLabel,
      colorLabel,
      addRangePlaceholder,
      addRangeLabel,
    } = this.props;
    const { ranges, showColorPicker, newMinValue, newMaxValue } = this.state;

    return (
      <div>
        <ControlHeader {...this.props} />
        <StyledContainer>
          <div>
            {ranges.map((range, index) => (
              <StyledRangeItem key={index}>
                <InputNumber
                  className="range-input"
                  value={range.min}
                  onChange={value => this.handleMinChange(index, value)}
                  placeholder={minLabel}
                />
                <span style={{ margin: '0 8px' }}>-</span>
                <InputNumber
                  className="range-input"
                  value={range.max}
                  onChange={value => this.handleMaxChange(index, value)}
                  placeholder={maxLabel}
                />
                <div
                  className="color-preview"
                  style={{ backgroundColor: range.color }}
                  onClick={() => this.setState({ showColorPicker: index })}
                />
                <Button
                  className="remove-btn"
                  icon={<CloseOutlined />}
                  onClick={() => this.handleRemoveRange(index)}
                  size="small"
                />
                {showColorPicker === index && (
                  <>
                    <Backdrop
                      onClick={() => this.setState({ showColorPicker: null })}
                    />
                    <StyledColorPickerPopover>
                      <SketchPicker
                        color={range.color}
                        onChange={color => this.handleColorChange(index, color)}
                      />
                    </StyledColorPickerPopover>
                  </>
                )}
              </StyledRangeItem>
            ))}
          </div>

          <StyledFooter>
            <div className="input-group">
              <div className="input-label">{minLabel}</div>
              <InputNumber
                value={newMinValue}
                onChange={value => this.setState({ newMinValue: value })}
                placeholder={minLabel}
              />
            </div>

            <div className="input-group">
              <div className="input-label">{maxLabel}</div>
              <InputNumber
                value={newMaxValue}
                onChange={value => this.setState({ newMaxValue: value })}
                placeholder={maxLabel}
              />
            </div>

            <Button
              className="add-btn"
              onClick={this.handleAddRange}
              disabled={!this.isRangeValid(newMinValue, newMaxValue)}
              icon={<PlusOutlined />}
            >
              {addRangeLabel}
            </Button>

            <Tooltip
              title={t('Min value must be less than max value')}
              visible={
                newMinValue !== null &&
                newMaxValue !== null &&
                newMinValue >= newMaxValue
              }
            >
              <InfoCircleOutlined
                style={{
                  visibility:
                    newMinValue !== null &&
                    newMaxValue !== null &&
                    newMinValue >= newMaxValue
                      ? 'visible'
                      : 'hidden',
                  marginLeft: 8,
                  marginTop: 16,
                  color: 'red',
                }}
              />
            </Tooltip>
          </StyledFooter>
        </StyledContainer>
      </div>
    );
  }
}
