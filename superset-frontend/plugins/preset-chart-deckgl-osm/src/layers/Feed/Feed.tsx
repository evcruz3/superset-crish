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
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { CompositeLayer, Layer } from '@deck.gl/core';
import {
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  getNumberFormatter,
  styled,
  css,
  keyframes,
  t,
  TimeGranularity,
} from '@superset-ui/core';
import { scaleLinear } from 'd3-scale';
import geojsonExtent from '@mapbox/geojson-extent';
import { isEqual } from 'lodash';
import DeckGL from '@deck.gl/react';
import { LinearInterpolator } from '@deck.gl/core';
import {
  formatDistanceToNow,
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  addDays,
  addWeeks,
  addMonths,
  addYears,
} from 'date-fns';
import { DatePicker } from 'antd';
import moment from 'moment';
import { Moment } from 'moment';
import locale from 'antd/es/date-picker/locale/en_US';
import { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';

import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from '../../DeckGLContainer';
import { hexToRGB } from '../../utils/colors';
import sandboxedEval from '../../utils/sandbox';
import { commonLayerProps } from '../common';
import TooltipRow from '../../TooltipRow';
import fitViewport, { Viewport } from '../../utils/fitViewport';
import { TooltipProps } from '../../components/Tooltip';
import { countries } from '../Country/countries';
import { LayerOptions, LayerReturn } from '../../types/layers';
import {
  FeedGeoJSON,
  FeedGeoJSONFeature,
  FeedCentroid,
  ProcessedFeedData,
  FeedFormData,
  FeedLayerReturn,
  FeedLayerProps
} from '../../types/feed';

// Cache for loaded GeoJSON data
const geoJsonCache: { [key: string]: JsonObject } = {};

// Helper function to check if two dates match based on granularity (moved outside getLayer)
const datesMatch = (date1: Date, date2: Date, gran: TimeGranularity | null | undefined): boolean => {
  if (!date1 || !date2 || !gran) return false;
  if (gran === TimeGranularity.WEEK) return isSameWeek(date1, date2, { weekStartsOn: 1 });
  if (gran === TimeGranularity.MONTH) return isSameMonth(date1, date2);
  if (gran === TimeGranularity.YEAR) return isSameYear(date1, date2);
  return isSameDay(date1, date2); // Default to Day
};

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const ParameterPanel = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  width: 250px; /* Adjust width as needed */
  max-height: calc(60vh);
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
`;

const ParameterCard = styled.div<{isSelected: boolean}>`
  background: ${({isSelected}) => isSelected ? '#e0e0e0' : '#f9f9f9' }; // Darker if selected
  border: 1px solid ${({isSelected}) => isSelected ? '#cccccc' : '#f0f0f0' };
  border-radius: 6px;
  padding: 10px 15px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  cursor: pointer; // Make it clear it's clickable
  transition: background-color 0.2s ease, border-color 0.2s ease;

  &:hover {
    background-color: ${({isSelected}) => isSelected ? '#d5d5d5' : '#efefef' };
  }
`;

const ParameterPanelTitle = styled.h4`
  margin: 0 0 10px 0;
  font-size: 16px;
  color: ${({ theme }) => theme.colors.grayscale.dark2};
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  padding-bottom: 8px;
`;

const FeedPanel = styled.div<{ isExiting?: boolean }>`
  position: absolute;
  top: 120px;
  right: 10px;
  width: 500px;
  max-height: calc(60vh);
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1;
  animation: ${({ isExiting }) => isExiting ? slideOut : slideIn} 0.3s ease-in-out;
  display: flex;
  flex-direction: column;
`;

const FeedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  background: white;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
`;

const FeedTitle = styled.h3`
  margin: 0;
  font-size: 18px;
  color: ${({ theme }) => theme.colors.grayscale.dark2};
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.grayscale.base};
  padding: 4px;
  
  &:hover {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

const FeedList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
  overflow-y: auto;
  max-height: calc(100vh - 120px); /* Account for header height and margins */
`;

const FeedItemDate = styled.div`
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 15px;
  padding: 10px;
  border-bottom: 2px solid #f0f0f0;
`;

const FeedItem = styled.div`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  overflow: hidden;
  opacity: 0;
  animation: ${fadeIn} 0.3s ease-out forwards;
  animation-delay: ${({ index }: { index: number }) => `${index * 0.1}s`};
`;

const FeedItemHeader = styled.div`
  padding: 12px 20px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
`;

const FeedItemTitle = styled.div`
  font-size: 18px;
  font-weight: 500;
`;

const StatusBadge = styled.div<{ statusColor: string }>`
  background: ${props => props.statusColor};
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
`;

const FeedItemBody = styled.div`
  padding: 15px 20px;
`;

const FeedItemGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 15px;
`;

const FeedItemGridCell = styled.div`
  margin-bottom: 5px;
`;

const FeedItemLabel = styled.div`
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
`;

const FeedItemValue = styled.div`
  font-size: 15px;
`;

const FeedItemMessage = styled.div`
  margin-top: 15px;
`;

const FeedItemMessageContent = styled.div`
  font-size: 15px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 6px;
  line-height: 1.5;
`;

const StyledTimelineSlider = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 10;
  width: 500px;

  .date-indicator {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
    text-align: center;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .progress-bar {
    height: 4px;
    background: #f0f0f0;
    border-radius: 2px;
    margin-bottom: 12px;
    position: relative;
    overflow: hidden;
  }

  .progress-indicator {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: #ffc107;
    transition: width 0.3s ease;
  }

  .timeline-container {
    display: flex;
    align-items: center;
    overflow-x: auto;  // Allow horizontal scrolling if many dates
    gap: 4px;
    padding-bottom: 4px; // Space for the scrollbar
    
    /* Hide scrollbar for Chrome, Safari and Opera */
    &::-webkit-scrollbar {
      display: none;
    }
    
    /* Hide scrollbar for IE, Edge and Firefox */
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .day-label {
    flex: 0 0 auto; // Prevent shrinking
    font-size: 12px;
    color: #666;
    text-align: center;
    padding: 4px 8px;
    min-width: 40px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap; // Prevent text wrapping

    &:hover {
      background: #f0f0f0;
    }

    &.active {
      background: #ffc107;
      color: #000;
      font-weight: 500;
    }
  }
`;

interface FeedEntry {
  title: string;
  message: string;
  country_id: string;
  metric: number;
  parameter?: string;
  status?: string;
  value?: number;
  forecast_date?: string;
  [key: string]: any; // Allow for dynamic temporal column
}

interface SelectedRegion {
  name: string;
  entries: FeedEntry[];
  id?: string;
}

interface ProcessedData {
  regionCounts: { [key: string]: number };
  regionMetrics: { [key: string]: number };
  data: FeedEntry[];
  temporal_column?: string; // Add temporal_column name reference
}

interface FeedPanelProps {
  entries: FeedEntry[];
  onClose: () => void;
  regionName: string;
  isExiting?: boolean;
  temporal_column: string;
  granularity: TimeGranularity | null;
  formData: any; // Add formData to access value_label and metric_unit
}

interface ParameterDisplayProps {
  parameters: string[];
  title: string;
  selectedParameters: string[];
  onToggleParameter: (parameter: string) => void;
}

const ParameterDisplay: React.FC<ParameterDisplayProps> = ({ parameters, title, selectedParameters, onToggleParameter }) => {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  return (
    <ParameterPanel>
      <ParameterPanelTitle>{title}</ParameterPanelTitle>
      {parameters.map((param, index) => (
        <ParameterCard 
          key={index} 
          isSelected={selectedParameters.includes(param)}
          onClick={() => onToggleParameter(param)}
        >
          {param}
        </ParameterCard>
      ))}
    </ParameterPanel>
  );
};

export const FeedSidePanel: React.FC<FeedPanelProps> = ({
  entries,
  onClose,
  regionName,
  isExiting,
  temporal_column,
  granularity,
  formData: propsFormData,
}) => {

  console.log("entries", entries);
  // Group entries by date, considering granularity
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, FeedEntry[]> = {};
    
    [...entries].forEach(entry => {
      if (entry[temporal_column]) {
        try {
          const date = new Date(entry[temporal_column]);
          let groupDate: Date;
          let dateFormat: string;
          
          // Determine the grouping date and format based on granularity
          switch (granularity) {
            case TimeGranularity.WEEK:
              groupDate = startOfWeek(date, { weekStartsOn: 1 }); // Start week on Monday
              dateFormat = 'yyyy-\'W\'II'; // ISO week format
              break;
            case TimeGranularity.MONTH:
              groupDate = startOfMonth(date);
              dateFormat = 'MMM yyyy';
              break;
            case TimeGranularity.YEAR:
              groupDate = startOfYear(date);
              dateFormat = 'yyyy';
              break;
            case TimeGranularity.DAY: // Default to Day
            default:
              groupDate = startOfDay(date);
              dateFormat = 'd MMM yyyy';
              break;
          }
          
          const dateKey = format(groupDate, dateFormat);
          
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(entry);
        } catch (e) {
          console.warn(
            'Could not format/group date for FeedSidePanel:',
            entry[temporal_column],
            granularity,
          );
        }
      }
    });
    
    return grouped;
  }, [entries, temporal_column, granularity]);
  
  // Sort dates (newest first based on actual date, not string key)
  const sortedDates = useMemo(() => {
    return Object.keys(entriesByDate).sort((a, b) => {
      try {
        // Get the actual date from the first entry of each group for sorting
        const firstEntryA = entriesByDate[a]?.[0];
        const firstEntryB = entriesByDate[b]?.[0];

        const timeA = firstEntryA?.[temporal_column] ? new Date(firstEntryA[temporal_column]).getTime() : 0;
        const timeB = firstEntryB?.[temporal_column] ? new Date(firstEntryB[temporal_column]).getTime() : 0;

        return timeB - timeA;
      } catch (e) {
        console.error('Error sorting dates in FeedSidePanel:', e);
        return 0;
      }
    });
  }, [entriesByDate, temporal_column]);

  // Helper to determine status color based on status value
  const getStatusColor = useCallback((status: string) => {
    let statusColor = '#888888';
    if (status.includes('Extreme Danger') || status === 'Severe') {
      statusColor = '#F44336'; // Red for extreme/severe
    } else if (status === 'Danger' || status === 'Heavy' || status === 'Strong') {
      statusColor = '#FF9800'; // Orange for danger
    } else if (status.includes('Extreme Caution') || status === 'Moderate' || status === 'Caution') {
      statusColor = '#FFEB3B'; // Yellow for caution
    } else if (status === 'Light' || status === 'Normal') {
      statusColor = '#4CAF50'; // Green for light/normal
    }
    return statusColor;
  }, []);

  // Format numeric value for display
  const formatValue = useCallback((value: any) => {
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value : value.toFixed(2);
    }
    return value;
  }, []);

  // Get form data from the payload (if available)
  const formData = useMemo(() => {
    // Parse parameter mappings from simple string format
    const parameterMappings: Array<{parameter: string, label: string, unit: string}> = [];
    
    if (propsFormData?.parameter_mappings && typeof propsFormData.parameter_mappings === 'string') {
      // Format: "Parameter1:Label1:Unit1;Parameter2:Label2:Unit2"
      const mappingPairs = propsFormData.parameter_mappings.split(';').filter((pair: string) => pair.trim());
      
      mappingPairs.forEach((pair: string) => {
        const parts = pair.split(':').map((p: string) => p.trim());
        if (parts.length >= 2) {
          parameterMappings.push({
            parameter: parts[0],
            label: parts[1] || parts[0],
            unit: parts[2] || ''
          });
        }
      });
    }
    
    // Return default column names if not defined in form data
    return {
      title_column: propsFormData?.title_column || 'title',
      message_column: propsFormData?.message_column || 'message',
      parameter_column: propsFormData?.parameter_column || 'parameter',
      status_column: propsFormData?.status_column || 'status',
      value_column: propsFormData?.value_column || 'value',
      value_label: propsFormData?.value_label || 'Value',
      metric_unit: propsFormData?.metric_unit || '',
      parameter_mappings: parameterMappings,
    };
  }, [propsFormData]);

  // Helper function to get parameter-specific label and unit
  const getParameterConfig = useCallback((parameterValue: string) => {
    const mapping = formData.parameter_mappings.find(
      (m: any) => m.parameter === parameterValue
    );
    return {
      label: mapping?.label || formData.value_label,
      unit: mapping?.unit || formData.metric_unit,
    };
  }, [formData.parameter_mappings, formData.value_label, formData.metric_unit]);

  console.log("sortedDates", sortedDates);
  console.log("formData in FeedSidePanel:", formData);
  console.log("Sample entry:", entries[0]);

  return (
    <FeedPanel isExiting={isExiting}>
      <FeedHeader>
        <FeedTitle>{regionName}</FeedTitle>
        <CloseButton onClick={onClose}>&times;</CloseButton>
      </FeedHeader>
      <FeedList>
        {sortedDates.map(dateKey => {
          // Sort entries alphabetically by title
          const sortedEntries = [...entriesByDate[dateKey]].sort((a, b) => 
            ((a.title || '') as string).localeCompare((b.title || '') as string)
          );
          
          console.log("sortedEntries", sortedEntries);
          return (
            <div key={dateKey}>
              <FeedItemDate>
                {dateKey}
              </FeedItemDate>
              
              {sortedEntries.map((entry, index) => (
                <FeedItem key={`${dateKey}-${index}`} index={index}>
                  <FeedItemHeader>
                    <FeedItemTitle>{entry.title}</FeedItemTitle>
                    {entry.status && (
                      <StatusBadge statusColor={getStatusColor(entry.status as string)}>
                        {entry.status}
                      </StatusBadge>
                    )}
                  </FeedItemHeader>
                  
                  <FeedItemBody>
                    <FeedItemGrid>
                      {entry.parameter && (
                        <FeedItemGridCell>
                          <FeedItemLabel>Parameter</FeedItemLabel>
                          <FeedItemValue>{entry.parameter}</FeedItemValue>
                        </FeedItemGridCell>
                      )}
                      
                      {entry.value !== undefined && (
                        <FeedItemGridCell>
                          <FeedItemLabel>{getParameterConfig(entry.parameter || '').label}</FeedItemLabel>
                          <FeedItemValue>
                            {formatValue(entry.value)}
                            {getParameterConfig(entry.parameter || '').unit ? ` ${getParameterConfig(entry.parameter || '').unit}` : ''}
                          </FeedItemValue>
                        </FeedItemGridCell>
                      )}
                    </FeedItemGrid>
                    
                    {entry.message && (
                      <FeedItemMessage>
                        <FeedItemLabel>Advisory Message</FeedItemLabel>
                        <FeedItemMessageContent>
                          {entry.message}
                        </FeedItemMessageContent>
                      </FeedItemMessage>
                    )}
                  </FeedItemBody>
                </FeedItem>
              ))}
            </div>
          );
        })}
        
        {sortedDates.length === 0 && (
          <div>No entries available for this region.</div>
        )}
      </FeedList>
    </FeedPanel>
  );
};


export function getLayer(options: FeedLayerProps): (Layer<{}> | (() => Layer<{}>))[] {
  const { 
    formData, 
    payload, 
    setTooltip,
    geoJson,
    selectionOptions,
    opacity = 1,
    currentTime,
    selectedParameters
  } = options;

  // Type guard to ensure selectionOptions is present and has required properties
  if (!selectionOptions || !geoJson) {
    console.warn('Feed layer requires selectionOptions and geoJson to be provided');
    return [];
  }

  const { setSelectedRegion, selectedRegion } = selectionOptions;

  if (!setSelectedRegion) {
    console.warn('Feed layer requires setSelectedRegion to be provided');
    return [];
  }

  const fd = formData as unknown as FeedFormData;
  const sc = fd.stroke_color_picker;
  const strokeColor = sc ? [sc.r, sc.g, sc.b, 255 * sc.a] : [0, 0, 0, 255];
  const data = payload.data as ProcessedData;
  const temporalColumn = data.temporal_column || formData.temporal_column;
  const granularity = fd.time_granularity as TimeGranularity | undefined ?? TimeGranularity.DAY;

  // Calculate extent and color scale
  const allMetricValues = Object.values(data.regionMetrics);
  const extent: [number, number] = [Math.min(...allMetricValues), Math.max(...allMetricValues)];
  const colorScale = scaleLinear<string>()
    .domain(extent)
    .range(['#ccc', '#343434']);

  // Group entries by country_id
  const entriesByRegion: Record<string, FeedEntry[]> = {};
  data.data.forEach((entry: FeedEntry) => {
    if (!entriesByRegion[entry.country_id]) {
      entriesByRegion[entry.country_id] = [];
    }
    entriesByRegion[entry.country_id].push(entry);
  });
  
  const features = (geoJson as FeedGeoJSON).features.map((feature: FeedGeoJSONFeature) => {
    const regionId = feature.properties.ISO;
    const entries = entriesByRegion[regionId] || [];
    
    // Filter entries by date and granularity
    const filteredEntries = currentTime && temporalColumn
      ? entries.filter(entry => {
          if (!entry[temporalColumn]) return false; // Don't include entries without dates
          try {
            const entryDate = new Date(entry[temporalColumn]);
            console.log("entry: ", entry)
            if(entry.parameter && !selectedParameters?.includes(entry.parameter)) return false;
            return datesMatch(entryDate, currentTime, granularity);
          } catch (e) {
            console.warn('Invalid date encountered during filtering:', entry[temporalColumn]);
            return false;
          }
        })
      : entries;

    // Calculate metrics based on filtered entries
    const value = filteredEntries.length;
    const metricValue = value;

    const isSelected = selectedRegion?.id === regionId || 
                      selectedRegion?.name === feature.properties.ADM1 ||
                      selectedRegion?.name === feature.properties.name ||
                      selectedRegion?.name === feature.properties.NAME;

    const fillColorArray = value !== undefined 
      ? isSelected 
        ? [255, 165, 0, 180 * opacity] 
        : [...hexToRGB(colorScale(value)), 255 * opacity]
      : [0, 0, 0, 0];

    const strokeColorArray = isSelected 
      ? [255, 165, 0, 255 * opacity] 
      : strokeColor.map((v, i) => i === 3 ? v * opacity : v);

    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        metricValue,
        fillColor: fillColorArray as [number, number, number, number],
        strokeColor: strokeColorArray as [number, number, number, number],
        entries: filteredEntries,
      },
    } as FeedGeoJSONFeature;
  });

  let processedFeatures: FeedGeoJSONFeature[] = features.filter((feature: FeedGeoJSONFeature) => 
    feature.properties.metric !== undefined
  );

  // Create centroids for circle overlays - filter out regions with 0 alerts
  const centroids: FeedCentroid[] = processedFeatures
    .filter((feature: FeedGeoJSONFeature) => {
      const metric = feature.properties?.metric;
      return typeof metric === 'number' && metric > 0;
    })
    .map((feature: FeedGeoJSONFeature) => {
      // Simplified centroid calculation: Use bounding box center
      let center: [number, number] = [0, 0];
      const bounds = geojsonExtent(feature.geometry as any);

      if (bounds && bounds.length === 4) { // Check for valid BBox
        center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
      } else {
        console.warn(
          'Could not calculate centroid due to missing or invalid bounds for feature:',
          feature.properties.ISO,
        );
      }

      return {
        position: center as [number, number],
        count: feature.properties.metric || 0,
        metricValue: feature.properties.metricValue || 0,
        name:
          feature.properties.ADM1 ||
          feature.properties.name ||
          feature.properties.NAME ||
          feature.properties.ISO,
        ISO: feature.properties.ISO,
        entries: feature.properties.entries || [],
      };
    });

  const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
  const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
  const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';

  function handleClick(info: { object?: FeedGeoJSONFeature }) {
    if (!info.object || !setSelectedRegion) return;

    const regionName = info.object.properties?.ADM1 || 
                      info.object.properties?.name || 
                      info.object.properties?.NAME;

    if (!regionName || !info.object.properties?.entries) return;

    // If clicking the same region, deselect it
    if (selectedRegion?.id === info.object.properties.ISO) {
      setSelectedRegion(null);
      return;
    }

    setSelectedRegion({
      name: regionName,
      entries: info.object.properties.entries,
      id: info.object.properties.ISO,
    });
  }

  function handleCircleClick(info: { object?: FeedCentroid }) {
    if (!info.object || !setSelectedRegion) return;

    // If clicking the same region, deselect it
    if (selectedRegion?.id === info.object.ISO) {
      setSelectedRegion(null);
      return;
    }

    setSelectedRegion({
      name: info.object.name,
      entries: info.object.entries,
      id: info.object.ISO,
    });
  }

  const geoJsonLayer = new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}`,
    data: {
      type: 'FeatureCollection',
      features: processedFeatures,
    } as FeatureCollection<Geometry, GeoJsonProperties>,
    filled: fd.filled,
    stroked: fd.stroked,
    extruded: fd.extruded,
    pointRadiusScale: 100,
    lineWidthScale: 1,
    getFillColor: (feature: GeoJSON.Feature) => {
      const customColors = options.colorSettings?.getFeatureColor?.(feature);
      if (customColors?.fillColor) {
        return customColors.fillColor;
      }
      return [0, 0, 0, 0] as [number, number, number, number];
    },
    getLineColor: (feature: GeoJSON.Feature) => {
      const customColors = options.colorSettings?.getFeatureColor?.(feature);
      if (customColors?.strokeColor) {
        return customColors.strokeColor;
      }
      return strokeColor as [number, number, number, number];
    },
    getLineWidth: 1,
    lineWidthUnits: fd.line_width_unit as "meters" | "common" | "pixels" | undefined,
    opacity,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 40],
    onHover: setTooltipContent,
    onClick: handleClick,
    updateTriggers: {
      getFillColor: [selectedRegion?.id, options.colorSettings],
      getLineColor: [selectedRegion?.id, options.colorSettings],
      getLineWidth: [selectedRegion?.id],
    }
  });

  // Create the circle layer
  const circleLayer = new ScatterplotLayer({
    id: `circle-layer-${fd.slice_id}`,
    data: centroids,
    opacity: 0.8 * opacity,
    stroked: true,
    filled: true,
    radiusScale: 6,
    radiusMinPixels: 5,
    radiusMaxPixels: 30,
    lineWidthMinPixels: 1,
    getPosition: d => d.position,
    getRadius: d => {
      const isSelected = selectedRegion?.id === d.ISO;
      const baseRadius = Math.sqrt(d.count) * 1000;
      return isSelected ? baseRadius * 1.2 : baseRadius;
    },
    getFillColor: d => {
      const isSelected = selectedRegion?.id === d.ISO;
      return isSelected ? [255, 69, 0, 180 * opacity] : [255, 140, 0, 180 * opacity];
    },
    getLineColor: d => {
      const isSelected = selectedRegion?.id === d.ISO;
      return isSelected ? [255, 69, 0, 255 * opacity] : [255, 140, 0, 255 * opacity];
    },
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 40],
    onHover: handleCircleHover,
    onClick: handleCircleClick,
    updateTriggers: {
      getRadius: [selectedRegion?.id],
      getFillColor: [selectedRegion?.id],
      getLineColor: [selectedRegion?.id],
    },
  });


  const textLayer = new TextLayer({
    id: `text-layer-${fd.slice_id}`,
    data: centroids,
    getPosition: d => d.position,
    getText: d => String(d.count || '0'),
    getSize: d => 10 + d.count,
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getPixelOffset: [0, 0],
    fontFamily: 'Arial',
    fontWeight: 'bold',
    getColor: [255, 255, 255, 255 * opacity],
  });

  function setTooltipContent(o: { object?: FeedGeoJSONFeature; x?: number; y?: number }) {
    if (!o.object || !setTooltip) {
      setTooltip?.(null);
      return;
    }

    const x = o.x ?? 0;
    const y = o.y ?? 0;

    const areaName = o.object.properties?.ADM1 || 
                    o.object.properties?.name || 
                    o.object.properties?.NAME || 
                    o.object.properties?.ISO;

    setTooltip({
      x,
      y,
      content: (
        <div className="deckgl-tooltip">
          <TooltipRow
            key="area"
            label={`${areaName} `}
            value={o.object.properties?.metric !== undefined 
              ? `${prefix}${formatter(o.object.properties.metric)}${unit} entries` 
              : 'No entries'}
          />
        </div>
      ),
    });
  }

  function handleCircleHover(o: { object?: FeedCentroid; x?: number; y?: number }) {
    if (!o.object || !setTooltip) {
      setTooltip?.(null);
      return;
    }

    const x = o.x ?? 0;
    const y = o.y ?? 0;

    setTooltip({
      x,
      y,
      content: (
        <div className="deckgl-tooltip">
          <TooltipRow
            key="metric"
            label={`${o.object.name} `}
            value={`${prefix}${formatter(o.object.metricValue)}${unit}`}
          />
        </div>
      ),
    });
  }

  // Only return layers with data - always include geoJsonLayer but include circleLayer and textLayer only when there are centroids with alerts
  if (centroids.length > 0) {
    return [geoJsonLayer, circleLayer, textLayer];
  }
  
  // Return just the geoJsonLayer if there are no centroids with alerts
  return [geoJsonLayer];
}

// Definition for DeckGLFeed component's own props
export type DeckGLFeedProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
  datasource: Datasource;
};

// Restored DeckGLContainerHandleExtended interface
interface DeckGLContainerHandleExtended extends DeckGLContainerHandle {
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
}

export const DeckGLFeed = memo((props: DeckGLFeedProps) => {
  const [geoJson, setGeoJson] = useState<JsonObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegion | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [currentViewport, setCurrentViewport] = useState(props.viewport);
  const [currentTime, setCurrentTime] = useState<Date | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<[Date, Date] | undefined>();
  const containerRef = useRef<DeckGLContainerHandleExtended>();
  const [selectedParameters, setSelectedParameters] = useState<string[]>([]);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const activeDateRef = useRef<HTMLDivElement>(null);
  
  const { formData, payload, setControlValue, viewport: initialViewport, height, width, onAddFilter } = props;

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const panToFeature = useCallback((feature: any) => {
    if (!feature) return;

    const bounds = geojsonExtent(feature);
    if (!bounds) return;

    const [minLng, minLat, maxLng, maxLat] = bounds;
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    const latDiff = Math.abs(maxLat - minLat);
    const lngDiff = Math.abs(maxLng - minLng);
    const maxDiff = Math.max(latDiff, lngDiff);
    const zoom = Math.floor(8 - Math.log2(maxDiff));

    const lngOffset = (lngDiff * 0.5);

    const newViewport = {
      ...currentViewport,
      longitude: centerLng + lngOffset, 
      latitude: centerLat,
      zoom: Math.min(Math.max(zoom, 4), 12), 
      bearing: 0,
      pitch: 0,
      transitionDuration: 1000,
      transitionInterpolator: new LinearInterpolator(),
    };

    setCurrentViewport(newViewport);
    setControlValue('viewport', newViewport);
  }, [currentViewport, setControlValue]);

  const parameterColumn = useMemo(() => {
    return formData.parameter_column as string || 'parameter';
  }, [formData.parameter_column]);

  const uniqueParameters = useMemo(() => {
    const colNameForUniqueDiscovery = parameterColumn; 
    if (payload.data?.data && colNameForUniqueDiscovery) {
      const allParameters = payload.data.data.reduce((acc: string[], entry: FeedEntry) => {
        const paramValue = entry.parameter; 
        if (paramValue && typeof paramValue === 'string' && !acc.includes(paramValue)) {
          acc.push(paramValue);
        }
        return acc;
      }, []);
      return allParameters.sort();
    }
    return [];
  }, [payload.data?.data, parameterColumn]);

  // Effect to initialize selectedParameters with all uniqueParameters by default
  useEffect(() => {
    if (uniqueParameters.length > 0) {
      setSelectedParameters(uniqueParameters);
    }
  }, [uniqueParameters]);

  const onToggleParameter = useCallback((parameter: string) => {
    setSelectedParameters(prevSelected => 
      prevSelected.includes(parameter) 
        ? prevSelected.filter(p => p !== parameter) 
        : [...prevSelected, parameter]
    );
  }, []);

  const layers = useMemo(
    () => {
      const currentParameterColumn = formData.parameter_column as string || 'parameter'; 
      const currentOpacity = typeof formData.opacity === 'number' ? formData.opacity / 100 : 1; // Default to 1 if undefined

      const handleRegionSelection = (region: SelectedRegion | null) => {
        if (region) {
          const feature = (geoJson as FeedGeoJSON)?.features.find(
            (f: any) => f.properties.ISO === region.id || 
                       f.properties.ADM1 === region.name ||
                       f.properties.name === region.name ||
                       f.properties.NAME === region.name
          );
          if (feature && panToFeature) {
            panToFeature(feature);
          }
        }
        if (setSelectedRegion) {
          setSelectedRegion(region);
        }
      };

      return getLayer({
        formData,
        payload,
        onAddFilter: props.onAddFilter,
        setTooltip,
        geoJson: geoJson as FeedGeoJSON,
        selectionOptions: {
          setSelectedRegion: handleRegionSelection,
          selectedRegion,
        },
        opacity: currentOpacity,
        currentTime,
        selectedParameters,
        parameterColumn: currentParameterColumn,
      });
    },
    [formData, payload, props.onAddFilter, setTooltip, geoJson, selectedRegion, panToFeature, currentTime, setSelectedRegion, selectedParameters, parameterColumn]
  );

  // Load GeoJSON data
  useEffect(() => {
    const country = formData.select_country;
    if (!country) {
      setError('No country selected');
      return;
    }

    const countryKey = country as keyof typeof countries;
    const url = countries[countryKey];
    if (!url) {
      setError(`No GeoJSON data available for ${country}`);
      return;
    }

    if (geoJsonCache[country]) {
      setGeoJson(geoJsonCache[country]);
      return;
    }

    fetch(url)
      .then(response => response.json())
      .then(data => {
        geoJsonCache[country] = data;
        setGeoJson(data);
        setError(null);
      })
      .catch(err => {
        setError(`Failed to load GeoJSON data for ${country}: ${err.message}`);
      });
  }, [formData.select_country]);

  // Handle viewport changes
  const onViewportChange = useCallback((nextViewport: Viewport) => {
    setCurrentViewport(nextViewport);
    setControlValue('viewport', nextViewport);
  }, [setControlValue]);

  // Update viewport when props.viewport changes
  useEffect(() => {
    if (!isEqual(props.viewport, currentViewport)) {
      setCurrentViewport(props.viewport);
    }
  }, [props.viewport]);

  // Handle closing the feed panel with animation
  const handleCloseFeed = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setSelectedRegion(null);
      setIsExiting(false);
    }, 300); // Match animation duration
  }, []);

  // Get time range from data
  useEffect(() => {
    if (formData.temporal_column && payload.data?.data) {
      const allDates: Date[] = [];
      const date_key = formData.temporal_column;
      
      // Collect all dates from all region entries
      payload.data.data.forEach((entry: FeedEntry) => {
        if (entry[date_key]) {
          const date = new Date(entry[date_key]);
          if (!isNaN(date.getTime())) {
            allDates.push(date);
          }
        }
      });
      
      if (allDates.length > 0) {
        const minTime = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxTime = new Date(Math.max(...allDates.map(d => d.getTime())));
        setTimeRange([minTime, maxTime]);

        // Find the nearest date to current system time
        const currentSystemTime = new Date().getTime();
        const nearestDate = allDates.reduce((prev: Date, curr: Date) => {
          return Math.abs(curr.getTime() - currentSystemTime) < Math.abs(prev.getTime() - currentSystemTime) 
            ? curr 
            : prev;
        });

        // Set the nearest date as current time, but ensure it's within the time range
        const boundedTime = new Date(
          Math.min(
            Math.max(nearestDate.getTime(), minTime.getTime()),
            maxTime.getTime()
          )
        );
        setCurrentTime(boundedTime);
      }
    }
  }, [formData.temporal_column, payload.data?.data]);

  // Add auto-scroll effect when currentTime changes
  useEffect(() => {
    if (currentTime && timelineContainerRef.current && activeDateRef.current) {
      const container = timelineContainerRef.current;
      const activeElement = activeDateRef.current;
      
      // Calculate if the active element is outside the visible area
      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();
      
      if (activeRect.left < containerRect.left || activeRect.right > containerRect.right) {
        // Scroll the active element into view with smooth behavior
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [currentTime]);

    // Update selected region entries when current time changes
  useEffect(() => {
    // Added more detailed initial log
    console.log('[useEffect selectedRegion.entries] Triggered. selectedParameters:', JSON.stringify(selectedParameters), 'uniqueParameters.length:', uniqueParameters.length, 'currentTime:', currentTime, 'has geoJson:', !!geoJson, 'has payload.data:', !!payload.data?.data, 'selectedRegion ID:', selectedRegion?.id);

    if (selectedRegion && currentTime && geoJson && payload.data?.data) {
      const feature = (geoJson as FeedGeoJSON).features.find(
        f => f.properties.ISO === selectedRegion.id || 
             f.properties.ADM1 === selectedRegion.name ||
             f.properties.name === selectedRegion.name ||
             f.properties.NAME === selectedRegion.name
      );

      if (feature) {
        console.log('[useEffect selectedRegion.entries] Found feature for region:', selectedRegion.name);
        const regionId = feature.properties.ISO;
        const date_key = formData.temporal_column;
        const currentParameterColumn = formData.parameter_column as string || 'parameter';

        const dateAndParamFilteredEntries = payload.data.data.filter((entry: FeedEntry) => {
          // Date filtering
          if (!entry[date_key]) return false;
          try {
            const entryDate = new Date(entry[date_key]);
            const granularity = formData.time_granularity as TimeGranularity | undefined ?? TimeGranularity.DAY;
            const dateMatches = datesMatch(entryDate, currentTime, granularity);
            if (!dateMatches) return false;
          } catch (e) {
            console.warn('[useEffect] Error processing date for entry:', entry, e);
            return false;
          }
          
          // Parameter matching
          if (selectedParameters.length > 0 && selectedParameters.length !== uniqueParameters.length) {
            const paramValue = entry.parameter;
            const isIncluded = paramValue && selectedParameters.includes(paramValue as string);
            console.log(`[useEffect] paramValue from entry.parameter:`, paramValue, `Included in [${selectedParameters.join(',')}]?:`, isIncluded);
            if (!isIncluded) {
              return false;
            }
          }
          return true;
        });
        
        console.log('[useEffect selectedRegion.entries] Entries after date & param filter (before region filter):', JSON.parse(JSON.stringify(dateAndParamFilteredEntries)));

        const finalEntriesForRegion = dateAndParamFilteredEntries.filter((e: FeedEntry) => e.country_id === regionId);
        console.log('[useEffect selectedRegion.entries] Final entries for region after region filter:', JSON.parse(JSON.stringify(finalEntriesForRegion)));

        setSelectedRegion((prevRegion) => {
          if (prevRegion && prevRegion.id === selectedRegion.id) { // Ensure we're updating the correct region
            // console.log('[useEffect selectedRegion.entries] Updating selectedRegion with new entries.');
            return {
              // Keep name and id from prevRegion to ensure we're not using a stale selectedRegion from the outer scope
              name: prevRegion.name, 
              id: prevRegion.id,     
              entries: finalEntriesForRegion, 
            };
          }
          // If prevRegion is null or ID doesn't match, it means selectedRegion might have changed
          // This case should ideally be handled by other effects or logic that sets selectedRegion initially.
          // For now, if it doesn't match, we don't update to avoid potential inconsistencies.
          return prevRegion; 
        });
      } else {
        console.log('[useEffect selectedRegion.entries] No feature found for region based on current selectedRegion:', selectedRegion.name, selectedRegion.id);
        // If no feature, it implies the selected region is no longer valid in the geoJson,
        // or the selectedRegion state itself is out of sync.
        // Clear its entries.
        setSelectedRegion(prev => prev ? {...prev, entries: []} : null);
      }
    } else {
      console.log('[useEffect selectedRegion.entries] Skipped due to missing selectedRegion, currentTime, geoJson, or payload.data.');
    }
  }, [
    currentTime, 
    selectedRegion?.id, 
    selectedRegion?.name, 
    geoJson, 
    payload.data, 
    formData.temporal_column, 
    formData.time_granularity, 
    selectedParameters, 
    uniqueParameters, 
    formData.parameter_column,
    setSelectedRegion 
  ]);
  // Filter entries based on current time AND selected parameters for the side panel
  // const getFilteredEntries = useCallback((entries: FeedEntry[]) => {
  //   console.log('[getFilteredEntries] Received entries:', JSON.parse(JSON.stringify(entries)));
  //   console.log('[getFilteredEntries] selectedParameters:', selectedParameters);
  //   console.log('[getFilteredEntries] uniqueParameters.length:', uniqueParameters.length);

  //   if (selectedParameters.length === 0) {
  //     return [];
  //   }
  //   else if (selectedParameters.length === uniqueParameters.length) {
  //     console.log('[getFilteredEntries] Bypassing parameter filter (all/none selected).');
  //     return entries; 
  //   }

  //   const filteredByParam = entries.filter((entry: FeedEntry) => {
  //     const paramValue = entry.parameter;
  //     const isIncluded = paramValue && selectedParameters.includes(paramValue as string);
  //     console.log(`[getFilteredEntries] Entry: ${entry.title}, ParamValue (from entry.parameter): ${paramValue}, selectedParameters: [${selectedParameters.join(',')}], Included: ${isIncluded}`);
  //     return isIncluded;
  //   });
  //   console.log('[getFilteredEntries] Entries after param filter:', JSON.parse(JSON.stringify(filteredByParam)));
  //   return filteredByParam;
  // }, [selectedParameters, uniqueParameters.length]);

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!geoJson) {
    return <div>Loading...</div>;
  }

  const getDatesInRange = (startDate: Date, endDate: Date, granularity?: TimeGranularity | null) => {
    const dates: Date[] = [];
    if (!granularity) return dates;

    const currentDate = new Date(startDate);
    if (granularity === TimeGranularity.WEEK) currentDate.setDate(currentDate.getDate() - (currentDate.getDay() + 6) % 7);
    if (granularity === TimeGranularity.MONTH) currentDate.setDate(1);
    if (granularity === TimeGranularity.YEAR) currentDate.setMonth(0, 1);

    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      
      switch (granularity) {
        case TimeGranularity.YEAR:
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        case TimeGranularity.MONTH:
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case TimeGranularity.WEEK:
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case TimeGranularity.DAY:
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case TimeGranularity.HOUR:
          currentDate.setHours(currentDate.getHours() + 1);
          break;
        default:
          if (granularity === null || String(granularity) === String(TimeGranularity.DAY)) {
            currentDate.setDate(currentDate.getDate() + 1);
          } else {
            break;
          }
      }
    }
    return dates;
  };

  return (
    <>
      <DeckGLContainerStyledWrapper
        ref={containerRef as React.RefObject<DeckGLContainerHandle>}
        mapboxApiAccessToken={payload.data?.mapboxApiKey}
        viewport={currentViewport}
        onViewportChange={onViewportChange}
        layers={layers}
        mapStyle={formData.mapbox_style}
        width={width}
        height={height}
        setControlValue={setControlValue}
      >
        {uniqueParameters.length > 0 && (
          <ParameterDisplay 
            parameters={uniqueParameters} 
            title={parameterColumn.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
            selectedParameters={selectedParameters} 
            onToggleParameter={onToggleParameter} 
          />
        )}
        {timeRange && formData.temporal_column && (
          <StyledTimelineSlider>
            <div className="date-indicator">
              <DatePicker
                value={currentTime ? moment(currentTime) : undefined}
                onChange={(date: Moment | null) => {
                  if (date) {
                    // Ensure the selected date is within the time range
                    const selectedTime = date.toDate();
                    const boundedTime = new Date(
                      Math.min(
                        Math.max(selectedTime.getTime(), timeRange[0].getTime()),
                        timeRange[1].getTime()
                      )
                    );
                    setCurrentTime(boundedTime);
                  }
                }}
                picker={
                  formData.time_granularity === TimeGranularity.YEAR
                    ? 'year'
                    : formData.time_granularity === TimeGranularity.MONTH
                    ? 'month'
                    : formData.time_granularity === TimeGranularity.WEEK
                    ? 'week'
                    : undefined
                }
                format={
                  formData.time_granularity === TimeGranularity.YEAR
                    ? 'YYYY'
                    : formData.time_granularity === TimeGranularity.MONTH
                    ? 'MMM YYYY'
                    : formData.time_granularity === TimeGranularity.WEEK
                    ? 'MMM YYYY [Week] w'
                    : 'DD MMM YYYY'
                }
                allowClear={false}
                disabledDate={current => {
                  if (!timeRange) return false;
                  const currentDate = current?.toDate();
                  return currentDate ? (
                    currentDate < timeRange[0] || currentDate > timeRange[1]
                  ) : false;
                }}
                style={{ border: 'none', width: 'auto' }}
                locale={locale}
                onPanelChange={(value, mode) => {
                  if (mode === 'week' && value) {
                    // Ensure the selected date is aligned to Monday using ISO week
                    const monday = value.clone().startOf('isoWeek');
                    if (!value.isSame(monday, 'day')) {
                      setCurrentTime(monday.toDate());
                    }
                  }
                }}
              />
            </div>
            <div className="progress-bar">
              <div 
                className="progress-indicator"
                style={{ 
                  width: `${((currentTime?.getTime() ?? timeRange[0].getTime()) - timeRange[0].getTime()) / 
                    (timeRange[1].getTime() - timeRange[0].getTime()) * 100}%`
                }}
              />
            </div>
            <div className="timeline-container" ref={timelineContainerRef}>
              {getDatesInRange(timeRange[0], timeRange[1], formData.time_granularity as TimeGranularity | null).map((date, index) => {
                // Format date based on time grain
                let dateFormat: Intl.DateTimeFormatOptions = {};
                switch (formData.time_granularity) {
                  case TimeGranularity.YEAR:
                    dateFormat = { year: 'numeric' };
                    break;
                  case TimeGranularity.MONTH:
                    dateFormat = { month: 'short', year: 'numeric' };
                    break;
                  case TimeGranularity.WEEK:
                    dateFormat = { month: 'short', day: 'numeric' };
                    break;
                  default:
                    dateFormat = { weekday: 'short' };
                }
                
                const isActive = currentTime && datesMatch(date, currentTime, formData.time_granularity as TimeGranularity);
                return (
                  <div 
                    key={index} 
                    className={`day-label ${isActive ? 'active' : ''}`}
                    onClick={() => setCurrentTime(date)}
                    ref={isActive ? activeDateRef : null}
                  >
                    {date.toLocaleDateString('en-US', dateFormat)}
                  </div>
                );
              })}
            </div>
          </StyledTimelineSlider>
        )}
        {selectedRegion && (
          <FeedSidePanel
            entries={selectedRegion.entries}
            onClose={handleCloseFeed}
            regionName={selectedRegion.name}
            isExiting={isExiting}
            temporal_column={formData.temporal_column}
            granularity={formData.time_granularity as TimeGranularity | null}
            formData={formData}
          />
        )}
      </DeckGLContainerStyledWrapper>
    </>
  );
});

export default DeckGLFeed; 