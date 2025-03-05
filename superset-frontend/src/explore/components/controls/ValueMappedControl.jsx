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
import React from 'react';
import PropTypes from 'prop-types';
import { SketchPicker } from 'react-color';
import { debounce } from 'lodash';
import { styled, t } from '@superset-ui/core';
import { Button, Input } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  value: PropTypes.object,
  valueLabel: PropTypes.string,
  colorLabel: PropTypes.string,
  scheme: PropTypes.object,
  addValuePlaceholder: PropTypes.string,
  addValueLabel: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};

const defaultProps = {
  value: {},
  valueLabel: t('Value'),
  colorLabel: t('Color'),
  scheme: null,
  addValuePlaceholder: t('Enter a value'),
  addValueLabel: t('+ Add Value'),
};

const StyledContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 1.5}px 0;
`;

const StyledValueItem = styled.div`
  display: flex;
  align-items: center;
  padding: ${({ theme }) => theme.gridUnit}px 0;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;

  .value-input {
    flex: 2;
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
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
`;

const Backdrop = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 5;
`;

export default class ValueMappedControl extends React.PureComponent {
  constructor(props) {
    super(props);
    
    this.state = {
      mappings: [],
      showColorPicker: null,
      newValue: '',
    };
    
    this.debouncedOnChange = debounce(this.onChange, 300);
  }
  
  componentDidMount() {
    this.updateMappingsFromProps();
  }
  
  componentDidUpdate(prevProps) {
    if (prevProps.value !== this.props.value) {
      this.updateMappingsFromProps();
    }
  }
  
  updateMappingsFromProps() {
    const { value } = this.props;
    if (!value) return;
    
    const mappings = Object.entries(value).map(([mappingValue, mappingColor]) => ({
      value: mappingValue,
      color: mappingColor,
    }));
    
    this.setState({ mappings });
  }
  
  onChange = () => {
    const valueMap = this.state.mappings.reduce((acc, { value, color }) => {
      if (value) {
        acc[value] = color;
      }
      return acc;
    }, {});
    
    this.props.onChange(valueMap);
  };
  
  handleValueChange = (index, newMappingValue) => {
    const { mappings } = this.state;
    const updatedMappings = [...mappings];
    updatedMappings[index] = {
      ...updatedMappings[index],
      value: newMappingValue,
    };
    
    this.setState({ mappings: updatedMappings }, () => {
      this.debouncedOnChange();
    });
  };
  
  handleColorChange = (index, color) => {
    const { mappings } = this.state;
    const updatedMappings = [...mappings];
    updatedMappings[index] = {
      ...updatedMappings[index],
      color: color.hex,
    };
    
    this.setState({ mappings: updatedMappings }, () => {
      this.debouncedOnChange();
    });
  };
  
  handleRemoveMapping = index => {
    const { mappings } = this.state;
    const updatedMappings = mappings.filter((_, i) => i !== index);
    
    this.setState({ mappings: updatedMappings }, this.onChange);
  };
  
  handleAddMapping = () => {
    const { newValue, mappings } = this.state;
    const { scheme } = this.props;
    
    if (!newValue.trim()) return;
    
    // Don't add duplicate values
    if (mappings.some(m => m.value === newValue.trim())) {
      return;
    }
    
    // Get next color from scheme or use default
    const nextColor = 
      scheme?.colors?.[mappings.length % (scheme.colors.length || 1)] || 
      `#${Math.floor(Math.random() * 16777215).toString(16)}`;
    
    const updatedMappings = [
      ...mappings,
      { value: newValue.trim(), color: nextColor },
    ];
    
    this.setState(
      { 
        mappings: updatedMappings,
        newValue: '',
      }, 
      this.onChange
    );
  };
  
  render() {
    const { 
      valueLabel, 
      colorLabel,
      addValuePlaceholder,
      addValueLabel,
    } = this.props;
    const { mappings, showColorPicker, newValue } = this.state;
    
    return (
      <div>
        <ControlHeader {...this.props} />
        <StyledContainer>
          <div>
            {mappings.map((mapping, index) => (
              <StyledValueItem key={index}>
                <Input
                  className="value-input"
                  value={mapping.value}
                  onChange={e => this.handleValueChange(index, e.target.value)}
                  placeholder={valueLabel}
                />
                <div
                  className="color-preview"
                  style={{ backgroundColor: mapping.color }}
                  onClick={() => this.setState({ showColorPicker: index })}
                />
                <Button
                  className="remove-btn"
                  icon={<CloseOutlined />}
                  onClick={() => this.handleRemoveMapping(index)}
                  size="small"
                />
                {showColorPicker === index && (
                  <>
                    <Backdrop onClick={() => this.setState({ showColorPicker: null })} />
                    <StyledColorPickerPopover>
                      <SketchPicker
                        color={mapping.color}
                        onChange={color => this.handleColorChange(index, color)}
                      />
                    </StyledColorPickerPopover>
                  </>
                )}
              </StyledValueItem>
            ))}
          </div>
          
          <StyledFooter>
            <Input
              value={newValue}
              onChange={e => this.setState({ newValue: e.target.value })}
              placeholder={addValuePlaceholder}
              onPressEnter={this.handleAddMapping}
              style={{ marginRight: 8 }}
            />
            <Button 
              icon={<PlusOutlined />} 
              onClick={this.handleAddMapping}
              disabled={!newValue.trim()}
            >
              {addValueLabel}
            </Button>
          </StyledFooter>
        </StyledContainer>
      </div>
    );
  }
} 