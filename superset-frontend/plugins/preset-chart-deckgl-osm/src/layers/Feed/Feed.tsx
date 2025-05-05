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
} from '@superset-ui/core';
import { scaleLinear } from 'd3-scale';
import geojsonExtent from '@mapbox/geojson-extent';
import { isEqual } from 'lodash';
import DeckGL from '@deck.gl/react';
import { LinearInterpolator } from '@deck.gl/core';
import { formatDistanceToNow, format } from 'date-fns';
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
  FeedLayerProps,
  FeedGeoJSON,
  FeedGeoJSONFeature,
  FeedCentroid,
  ProcessedFeedData,
  FeedFormData,
  FeedLayerReturn
} from '../../types/feed';

// Cache for loaded GeoJSON data
const geoJsonCache: { [key: string]: JsonObject } = {};

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
}

export const FeedSidePanel: React.FC<FeedPanelProps> = ({ entries, onClose, regionName, isExiting, temporal_column }) => {
  // Group entries by date
  const entriesByDate = useMemo(() => {
    const grouped: Record<string, FeedEntry[]> = {};
    
    [...entries].forEach(entry => {
      if (entry[temporal_column]) {
        try {
          const date = new Date(entry[temporal_column]);
          const day = date.getDate();
          const month = date.toLocaleString('en-US', { month: 'short' });
          const year = date.getFullYear();
          const dateKey = `${day} ${month} ${year}`;
          
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(entry);
        } catch (e) {
          console.warn('Could not format date for grouping:', entry[temporal_column]);
        }
      }
    });
    
    return grouped;
  }, [entries, temporal_column]);
  
  // Sort dates (newest first)
  const sortedDates = useMemo(() => {
    return Object.keys(entriesByDate).sort((a, b) => {
      try {
        return new Date(b).getTime() - new Date(a).getTime();
      } catch (e) {
        return 0;
      }
    });
  }, [entriesByDate]);

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
    // Return default column names if not defined in form data
    return {
      title_column: 'title',
      message_column: 'message',
      parameter_column: 'parameter',
      status_column: 'status',
      value_column: 'value',
    };
  }, []);

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
            ((a[formData.title_column] || '') as string).localeCompare((b[formData.title_column] || '') as string)
          );
          
          return (
            <div key={dateKey}>
              <FeedItemDate>
                {dateKey}
              </FeedItemDate>
              
              {sortedEntries.map((entry, index) => (
                <FeedItem key={`${dateKey}-${index}`} index={index}>
                  <FeedItemHeader>
                    <FeedItemTitle>{entry[formData.title_column]}</FeedItemTitle>
                    {entry[formData.status_column] && (
                      <StatusBadge statusColor={getStatusColor(entry[formData.status_column] as string)}>
                        {entry[formData.status_column]}
                      </StatusBadge>
                    )}
                  </FeedItemHeader>
                  
                  <FeedItemBody>
                    <FeedItemGrid>
                      {entry[formData.parameter_column] && (
                        <FeedItemGridCell>
                          <FeedItemLabel>Parameter</FeedItemLabel>
                          <FeedItemValue>{entry[formData.parameter_column]}</FeedItemValue>
                        </FeedItemGridCell>
                      )}
                      
                      {entry[formData.value_column] !== undefined && (
                        <FeedItemGridCell>
                          <FeedItemLabel>Value</FeedItemLabel>
                          <FeedItemValue>{formatValue(entry[formData.value_column])}</FeedItemValue>
                        </FeedItemGridCell>
                      )}
                    </FeedItemGrid>
                    
                    {entry[formData.message_column] && (
                      <FeedItemMessage>
                        <FeedItemLabel>Advisory Message</FeedItemLabel>
                        <FeedItemMessageContent>
                          {entry[formData.message_column]}
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

export function getLayer(options: FeedLayerProps): (Layer<{}> | (() => Layer<{}>))[] {
  const { 
    formData, 
    payload, 
    onAddFilter, 
    setTooltip,
    geoJson,
    selectionOptions,
    opacity = 1,
    currentTime
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

  const fd = formData as FeedFormData;
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const data = payload.data as ProcessedData;
  const temporalColumn = data.temporal_column || formData.temporal_column;

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
    
    // Filter entries by date first
    const filteredEntries = currentTime && formData.temporal_column
      ? entries.filter(entry => {
          if (!entry[temporalColumn]) return false; // Don't include entries without dates
          const entryDate = new Date(entry[temporalColumn]);
          const entryDateString = entryDate.toDateString();
          const currentTimeString = currentTime.toDateString();
          
          // Only include entries that match the exact date (ignoring time)
          return entryDateString === currentTimeString;
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
    const coordinates = feature.geometry.type === 'Polygon' 
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0];
    
    const center = coordinates.reduce(
      (acc: [number, number], coord: [number, number]) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0] as [number, number]
    ).map((sum: number) => sum / coordinates.length);

    return {
      position: center as [number, number],
      count: feature.properties.metric || 0,
      metricValue: feature.properties.metricValue || 0,
      name: feature.properties.ADM1 || feature.properties.name || feature.properties.NAME || feature.properties.ISO,
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

    const areaName = o.object.properties?.ADM1 || 
                    o.object.properties?.name || 
                    o.object.properties?.NAME || 
                    o.object.properties?.ISO;

    setTooltip({
      x: o.x,
      y: o.y,
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

    setTooltip({
      x: o.x,
      y: o.y,
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
  
  const { formData, payload, setControlValue, viewport: initialViewport, onAddFilter, height, width } = props;

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

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

  // Function to pan to a feature
  const panToFeature = useCallback((feature: any) => {
    if (!feature) return;

    const bounds = geojsonExtent(feature);
    if (!bounds) return;

    const [minLng, minLat, maxLng, maxLat] = bounds;
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    // Calculate appropriate zoom level based on feature size
    const latDiff = Math.abs(maxLat - minLat);
    const lngDiff = Math.abs(maxLng - minLng);
    const maxDiff = Math.max(latDiff, lngDiff);
    const zoom = Math.floor(8 - Math.log2(maxDiff));

    // Calculate offset based on the feature size and viewport width
    // Offset by 15% of the viewport width to the left
    const lngOffset = (lngDiff * 0.5);

    const newViewport = {
      ...currentViewport,
      longitude: centerLng + lngOffset, // Offset to the left
      latitude: centerLat,
      zoom: Math.min(Math.max(zoom, 4), 12), // Clamp zoom between 4 and 12
      bearing: 0,
      pitch: 0,
      transitionDuration: 1000,
      transitionInterpolator: new LinearInterpolator(),
    };

    setCurrentViewport(newViewport);
    setControlValue('viewport', newViewport);
  }, [currentViewport, setControlValue]);

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

  // Calculate initial viewport
  const computedViewport = useMemo(() => {
    if (!geoJson || !formData.autozoom) return initialViewport;

    const points = geoJson.features.reduce(
      (acc: [number, number, number, number][], feature: any) => {
        const bounds = geojsonExtent(feature);
        if (bounds) {
          return [...acc, [bounds[0], bounds[1]], [bounds[2], bounds[3]]];
        }
        return acc;
      },
      [],
    );

    if (points.length) {
      return fitViewport(initialViewport, {
        width,
        height,
        points,
      });
    }
    return initialViewport;
  }, [formData.autozoom, height, geoJson, initialViewport, width]);

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

  // Update selected region entries when current time changes
  useEffect(() => {
    if (selectedRegion && currentTime && geoJson && payload.data?.data) {
      // Find the feature for the selected region
      const feature = (geoJson as FeedGeoJSON).features.find(
        f => f.properties.ISO === selectedRegion.id || 
             f.properties.ADM1 === selectedRegion.name ||
             f.properties.name === selectedRegion.name ||
             f.properties.NAME === selectedRegion.name
      );

      if (feature) {
        const regionId = feature.properties.ISO;
      const date_key = formData.temporal_column;

        const entries = payload.data.data.filter((entry: FeedEntry) => {
          if (!entry[date_key]) return false;
          const entryDate = new Date(entry[date_key]);
          return entryDate.toDateString() === currentTime.toDateString();
        });

        // Update the selected region with filtered entries
        setSelectedRegion({
          ...selectedRegion,
          entries: entries,
        });
      }
    }
  }, [currentTime, selectedRegion?.id, selectedRegion?.name, geoJson, payload.data?.data]);

  // Filter entries based on current time
  const getFilteredEntries = useCallback((entries: FeedEntry[]) => {
    // filter entries based on selected region
    return entries.filter((entry: FeedEntry) => {
      return entry.country_id === selectedRegion?.id;
    });
  }, [selectedRegion?.id]);

  // Update getLayer to include panToFeature
  const layers = useMemo(
    () => {
      if (!geoJson) return [];
      
      const handleRegionSelection = (region: SelectedRegion | null) => {
        if (region) {
          const feature = (geoJson as FeedGeoJSON).features.find(
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
        onAddFilter,
        setTooltip,
        geoJson: geoJson as FeedGeoJSON,
        selectionOptions: {
          setSelectedRegion: handleRegionSelection,
          selectedRegion,
        },
        currentTime,
      });
    },
    [formData, payload, onAddFilter, setTooltip, geoJson, selectedRegion, panToFeature, setSelectedRegion, currentTime],
  );

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!geoJson) {
    return <div>Loading...</div>;
  }

  const getDatesInRange = (startDate: Date, endDate: Date, timeGrain?: string) => {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);






    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      
      // Increment based on time grain
      switch (timeGrain) {
        case 'P1Y':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        case 'P1M':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'P1W':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'P1D':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'PT1H':
          currentDate.setHours(currentDate.getHours() + 1);
          break;
        default:
          // Default to daily if no time grain specified
          currentDate.setDate(currentDate.getDate() + 1);
      }
    }
    return dates;
  };

  return (
    <>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={payload.data?.mapboxApiKey}
        viewport={currentViewport}
        onViewportChange={onViewportChange}
        layers={layers}
        mapStyle={formData.mapbox_style}
        width={width}
        height={height}
        setControlValue={setControlValue}
      >
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
                showTime={formData.time_grain_sqla === 'PT1H'}
                picker={
                  formData.time_grain_sqla === 'P1Y' 
                    ? 'year'
                    : formData.time_grain_sqla === 'P1M'
                    ? 'month'
                    : formData.time_grain_sqla === 'P1W'
                    ? 'week'
                    : undefined
                }
                format={
                  formData.time_grain_sqla === 'P1Y'
                    ? 'YYYY'
                    : formData.time_grain_sqla === 'P1M'
                    ? 'YYYY-MM'
                    : formData.time_grain_sqla === 'P1W'
                    ? 'YYYY-[W]ww'
                    : formData.time_grain_sqla === 'PT1H'
                    ? 'YYYY-MM-DD HH:mm:ss'
                    : 'YYYY-MM-DD'
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
            <div className="timeline-container">
              {getDatesInRange(timeRange[0], timeRange[1], formData.time_grain_sqla).map((date, index) => {
                // Format date based on time grain
                let dateFormat: Intl.DateTimeFormatOptions = {};
                switch (formData.time_grain_sqla) {
                  case 'P1Y':
                    dateFormat = { year: 'numeric' };
                    break;
                  case 'P1M':
                    dateFormat = { month: 'short', year: 'numeric' };
                    break;
                  case 'P1W':
                    dateFormat = { month: 'short', day: 'numeric' };
                    break;
                  case 'PT1H':
                    dateFormat = { hour: 'numeric', hour12: true };
                    break;
                  default:
                    dateFormat = { weekday: 'short' };
                }
                
                return (
                  <div 
                    key={index} 
                    className={`day-label ${
                      currentTime && date.toDateString() === currentTime.toDateString() 
                        ? 'active' 
                        : ''
                    }`}
                    onClick={() => setCurrentTime(date)}
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
            entries={getFilteredEntries(selectedRegion.entries)}
            onClose={handleCloseFeed}
            regionName={selectedRegion.name}
            isExiting={isExiting}
            temporal_column={formData.temporal_column}
          />
        )}
      </DeckGLContainerStyledWrapper>
    </>
  );
});

export default DeckGLFeed; 