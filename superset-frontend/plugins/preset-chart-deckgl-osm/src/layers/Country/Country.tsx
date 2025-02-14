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
import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { GeoJsonLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { CompositeLayer, Layer } from '@deck.gl/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { geoCentroid } from 'd3-geo';
import geojsonExtent from '@mapbox/geojson-extent';
import {
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  getNumberFormatter,
  getSequentialSchemeRegistry,
  styled,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import { scaleLinear, ScaleLinear } from 'd3-scale';
import { Slider, DatePicker } from 'antd';
import moment from 'moment';
import { Moment } from 'moment';
import locale from 'antd/es/date-picker/locale/en_US';

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
import { countries } from './countries';
import { ICON_MAPPING, createSVGIcon, cleanupIconUrl } from './markers';
import { LayerOptions, LayerReturn } from '../../types/layers';

// Configure moment to use Monday as first day of week
moment.updateLocale('en', {
  week: {
    dow: 1, // Monday is the first day of the week
    doy: 4  // The week that contains Jan 4th is the first week of the year
  }
});

// Cache for loaded GeoJSON data
const geoJsonCache: { [key: string]: JsonObject } = {};

interface IconData {
  coordinates: [number, number];
  url: string;
  size: number;
  metric: number;
}

interface PolygonRing {
  area: number;
  ring: [number, number][];
}

interface IconInfo {
  object: IconData;
  x: number;
  y: number;
}

interface TextData {
  coordinates: [number, number];
  text: string;
  value: number;
}

interface ViewState extends Viewport {
  zoom: number;
  bearing: number;
  pitch: number;
  latitude: number;
  longitude: number;
}

// Update the DataRecord interface to include temporal_column
interface DataRecord {
  metric?: number;
  categorical_value?: string;
  country_id: string;
  [key: string]: any; // Allow for dynamic temporal column access
}

// Helper function to process conditional icons
function processConditionalIcons(features: JsonObject[], formData: QueryFormData): IconData[] {
  const {
    show_icons,
    icon_threshold,
    icon_threshold_operator,
    icon_type,
    icon_color,
    icon_size,
  } = formData;

  if (!show_icons || icon_threshold === '') {
    return [];
  }

  const icons: IconData[] = [];
  const threshold = Number(icon_threshold);

  features.forEach(feature => {
    const metricValue = feature.properties?.metric ?? undefined;
    
    if (metricValue === undefined) return;

    let matches = false;
    switch (icon_threshold_operator) {
      case '==':
        matches = Number(metricValue) === threshold;
        break;
      case '!=':
        matches = Number(metricValue) !== threshold;
        break;
      case '>':
        matches = Number(metricValue) > threshold;
        break;
      case '<':
        matches = Number(metricValue) < threshold;
        break;
      case '>=':
        matches = Number(metricValue) >= threshold;
        break;
      case '<=':
        matches = Number(metricValue) <= threshold;
        break;
    }

    if (matches) {
      let coordinates: [number, number] | undefined;
      if (feature.geometry.type === 'Polygon') {
        const ring = feature.geometry.coordinates[0];
        const center = ring.reduce(
          (acc: [number, number], point: [number, number]) => [acc[0] + point[0], acc[1] + point[1]],
          [0, 0]
        ).map((sum: number) => sum / ring.length) as [number, number];
        coordinates = center;
      } else if (feature.geometry.type === 'MultiPolygon') {
        const areas = feature.geometry.coordinates.map((poly: [number, number][][]) => {
          const ring = poly[0];
          return {
            area: Math.abs(ring.reduce((area: number, point: [number, number], i: number) => {
              const next = ring[(i + 1) % ring.length];
              return area + (point[0] * next[1] - next[0] * point[1]);
            }, 0)) / 2,
            ring
          } as PolygonRing;
        });
        const largestRing = areas.sort((a: PolygonRing, b: PolygonRing) => b.area - a.area)[0].ring;
        const center = largestRing.reduce(
          (acc: [number, number], point: [number, number]) => [acc[0] + point[0], acc[1] + point[1]],
          [0, 0]
        ).map((sum: number) => sum / largestRing.length) as [number, number];
        coordinates = center;
      }

      if (coordinates) {
        const color = `rgba(${icon_color.r},${icon_color.g},${icon_color.b},${icon_color.a})`;
        const iconKey = icon_type as keyof typeof ICON_MAPPING;
        const url = createSVGIcon(ICON_MAPPING[iconKey], color, icon_size);
        
        icons.push({
          coordinates,
          url,
          size: icon_size,
          metric: metricValue,
        });
      }
    }
  });

  return icons;
}

const StyledLegend = styled.div`
  ${({ theme }) => `
    position: absolute;
    bottom: 20px;
    right: 20px;
    padding: ${theme.gridUnit * 3}px;
    background: ${theme.colors.grayscale.light5};
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    min-width: 150px;
    
    .legend-title {
      font-size: ${theme.typography.sizes.s}px;
      font-weight: ${theme.typography.weights.bold};
      margin-bottom: ${theme.gridUnit * 2}px;
      color: ${theme.colors.grayscale.dark2};
    }
    
    .legend-items {
      display: flex;
      flex-direction: column;
      gap: ${theme.gridUnit}px;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: ${theme.gridUnit * 2}px;
      
      .color-box {
        width: ${theme.gridUnit * 3}px;
        height: ${theme.gridUnit * 3}px;
        border: 1px solid ${theme.colors.grayscale.light2};
      }
      
      .label {
        font-size: ${theme.typography.sizes.s}px;
        color: ${theme.colors.grayscale.dark1};
        font-weight: ${theme.typography.weights.normal};
      }
    }
  `}
`;

interface ColorLegendProps {
  colorScale: (value: any) => string;
  extent?: [number, number];
  format?: (value: number) => string;
  metricPrefix?: string;
  metricUnit?: string;
  values: (number | string)[];
  metricName?: string;
  isCategorical?: boolean;
}

const ColorLegend = ({ 
  colorScale, 
  extent, 
  format, 
  metricPrefix = '', 
  metricUnit = '', 
  values,
  metricName = 'Values',
  isCategorical = false
}: ColorLegendProps) => {
  // Get unique values and sort them
  const uniqueValues = [...new Set(values)];
  
  // If we have more than 5 values and not categorical, select a subset
  let displayValues = uniqueValues;
  if (!isCategorical && uniqueValues.length > 5) {
    const min = Math.min(...uniqueValues.map(v => Number(v)));
    const max = Math.max(...uniqueValues.map(v => Number(v)));
    const middleIndices = [
      Math.floor(uniqueValues.length * 0.25),
      Math.floor(uniqueValues.length * 0.5),
      Math.floor(uniqueValues.length * 0.75),
    ];
    const middleValues = middleIndices.map(i => uniqueValues[i]);
    displayValues = [max, ...middleValues, min];
  }

  return (
    <StyledLegend>
      <div className="legend-title">{metricName}</div>
      <div className="legend-items">
        {displayValues.map((value, i) => (
          <div key={i} className="legend-item">
            <div 
              className="color-box" 
              style={{ backgroundColor: colorScale(value) || '#fff' }}
            />
            <span className="label">
              {isCategorical 
                ? String(value)
                : `${metricPrefix}${format?.(value as number) || value}${metricUnit}`
              }
            </span>
          </div>
        ))}
      </div>
    </StyledLegend>
  );
};

// Add custom properties to GeoJsonLayer
interface ExtendedGeoJsonLayer extends GeoJsonLayer {
  colorScale?: (value: any) => string;
  extent?: [number, number];
  metricValues?: number[];
  categoricalValues?: string[];
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

interface DeckGLContainerHandleExtended extends DeckGLContainerHandle {
  setViewState: (viewState: any) => void;
}

export type DeckGLCountryProps = {
  formData: QueryFormData;
  payload: JsonObject;
  setControlValue: (control: string, value: JsonValue) => void;
  viewport: Viewport;
  onAddFilter: HandlerFunction;
  height: number;
  width: number;
};

export function getLayer(options: LayerOptions): (Layer<{}> | (() => Layer<{}>))[] {
  const { 
    formData, 
    payload, 
    onAddFilter, 
    setTooltip = () => {},
    geoJson = {},
    temporalOptions,
    viewState,
    opacity = 1.0
  } = options;

  console.log('options', options);

  const currentTime = temporalOptions?.currentTime;
  const temporalData = temporalOptions?.allData || [];

  const fd = formData;
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const data = payload.data?.data || [];
  const records = Array.isArray(data) ? data : (data?.records || []);

  // Use temporalData for color scale calculation if provided, otherwise use current records
  const dataForColorScale = temporalData.length > 0 ? temporalData : records;
  
  // Handle color scale based on whether we have categorical or metric values
  let colorScale: (value: any) => string;
  let extent: [number, number] | undefined;
  let metricValues: number[] = [];
  let categoricalValues: string[] = [];

  if (fd.categorical_column) {
    // For categorical values, first create a mapping of categorical values to their metrics
    const valueToMetricMap = new Map<string, number>();
    const uniqueValues = new Set<string>();
    
    dataForColorScale.forEach((d: DataRecord) => {
      if (d.categorical_value !== undefined && d.metric !== undefined) {
        // If we have multiple metrics for the same categorical value, use the highest one
        const currentMetric = valueToMetricMap.get(d.categorical_value);
        if (currentMetric === undefined || d.metric > currentMetric) {
          valueToMetricMap.set(d.categorical_value, d.metric);
        }
        uniqueValues.add(d.categorical_value);
      }
    });

    // Sort categorical values based on their corresponding metric values
    categoricalValues = Array.from(uniqueValues).sort((a, b) => {
      const metricA = valueToMetricMap.get(a) ?? 0;
      const metricB = valueToMetricMap.get(b) ?? 0;
      return metricA - metricB; // Sort in ascending order (lowest metric gets first color)
    });

    // Get the color scheme and create the color scale
    const scheme = getCategoricalSchemeRegistry().get(fd.categorical_color_scheme || 'supersetColors');
    const colors = scheme?.colors || ['#ccc'];
    colorScale = (value: any) => {
      const index = categoricalValues.indexOf(String(value));
      return index >= 0 ? colors[index % colors.length] : '#ccc';
    };
  } else {
    // For metric values, use the linear color scheme
    const allMetricValues = dataForColorScale
      .map((d: DataRecord) => d.metric)
      .filter((v: number) => v !== undefined && v !== null);
    metricValues = allMetricValues;
    extent = allMetricValues.length > 0 
      ? [Math.min(...allMetricValues), Math.max(...allMetricValues)]
      : [0, 100]; // Default range if no metrics available

    const scheme = getSequentialSchemeRegistry().get(fd.linear_color_scheme || 'blue_white_yellow');
    const linearScale = scheme 
      ? scheme.createLinearScale(extent) 
      : scaleLinear<string>()
          .domain(extent)
          .range(['#ccc', '#343434']);
    colorScale = (value: any) => linearScale(Number(value)) || '#ccc';
  }

  // Filter records based on current time for display
  const valueMap: { [key: string]: number | string } = {};
  records.forEach((d: DataRecord) => {
    const value = fd.categorical_column ? d.categorical_value : d.metric;
    if (value !== undefined && value !== null) {
      // If we have temporal data, only include values up to the current time
      if (currentTime && fd.temporal_column) {
        const recordTime = new Date(d[fd.temporal_column]);
        if (recordTime <= currentTime) {
          valueMap[d.country_id] = value;
        }
      } else {
        valueMap[d.country_id] = value;
      }
    }
  });

  // Ensure geoJson has features array
  const features = (geoJson.features || []).map((feature: JsonObject) => {
    const value = valueMap[feature.properties?.ISO];
    let fillColor: [number, number, number, number];
    
    if (fd.categorical_column) {
      // For categorical values, convert hex color to RGB
      const hexColor = value !== undefined ? colorScale(value) : '#ccc';
      const rgbColor = hexToRGB(hexColor);
      fillColor = [rgbColor[0], rgbColor[1], rgbColor[2], 220];
    } else {
      // For metric values, use the existing fillColor logic
      const hexColor = value !== undefined ? colorScale(value) : '#ccc';
      const rgbColor = hexToRGB(hexColor);
      fillColor = [rgbColor[0], rgbColor[1], rgbColor[2], 220];
    }

    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        categorical_value: fd.categorical_column ? value : undefined,
        fillColor,
        strokeColor,
      },
    };
  });

  let processedFeatures = features.filter((feature: JsonObject) => feature.properties.metric !== undefined);
  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    processedFeatures = jsFnMutator(processedFeatures);
  }

 
  
  function setTooltipContent(o: JsonObject) {
    if (!o.object?.extraProps) {
      const areaName = o.object.properties.ADM1 || o.object.properties.name || o.object.properties.NAME || o.object.properties.ISO;
      const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
      const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
      const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';

      const tooltipRows = [
        <TooltipRow
          key="area"
          label={`${areaName} `}
          value={
            fd.categorical_column && o.object.properties.categorical_value !== undefined
              ? o.object.properties.categorical_value
              : o.object.properties.metric !== undefined
              ? `${prefix}${formatter(o.object.properties.metric)}${unit}`
              : 'No data'
          }
        />
      ];

      // Add temporal information if available
      if (fd.temporal_column && currentTime) {
        tooltipRows.push(
          <TooltipRow
            key="date"
            label="Date "
            value={currentTime.toLocaleDateString()}
          />
        );
      }

      return (
        <div className="deckgl-tooltip">
          {tooltipRows}
        </div>
      );
    }
    return (
      o.object?.extraProps && (
        <div className="deckgl-tooltip">
          {Object.keys(o.object.extraProps).map((prop, index) => (
            <TooltipRow
              key={`prop-${index}`}
              label={`${prop}: `}
              value={`${o.object.extraProps?.[prop]}`}
            />
          ))}
        </div>
      )
    );
  }

  function setIconTooltipContent(info: any) {
    if (info.object) {
      const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
      const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
      const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';
      const formattedValue = fd.categorical_column && info.object.categorical_value !== undefined
        ? info.object.categorical_value
        : `${prefix}${formatter(info.object.metric)}${unit}`;
      const message = (fd.icon_hover_message || 'Value: {metric}')
        .replace('{metric}', formattedValue);
      
      return (
        <div className="deckgl-tooltip">
          <TooltipRow
            label=""
            value={message}
          />
        </div>
      );
    }
    return null;
  }

  const geoJsonLayer = new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}`,
    data: processedFeatures,
    extruded: fd.extruded,
    filled: fd.filled,
    stroked: fd.stroked,
    opacity: opacity,
    getFillColor: (f: JsonObject) => f.properties.fillColor,
    getLineColor: (f: JsonObject) => f.properties.strokeColor,
    getLineWidth: fd.line_width || 1,
    lineWidthUnits: fd.line_width_unit,
    autoHighlight: true,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  }) as ExtendedGeoJsonLayer;

  // Attach metadata to the layer instance
  geoJsonLayer.colorScale = colorScale;
  geoJsonLayer.extent = extent;
  geoJsonLayer.metricValues = metricValues;
  geoJsonLayer.categoricalValues = categoricalValues;

  let iconLayer = null;

  if (fd.show_icons && fd.icon_threshold !== '') {
    const iconData = processConditionalIcons(processedFeatures, fd);
    iconLayer = new IconLayer({
      id: `icon-layer-${fd.slice_id}`,
      data: iconData,
      getIcon: (d: IconData) => ({
        url: d.url,
        width: d.size,
        height: d.size,
      }),
      getPosition: (d: IconData) => d.coordinates,
      getSize: (d: IconData) => d.size,
      sizeScale: 1,
      billboard: true,
      alphaCutoff: 0.05,
      opacity: opacity,
      parameters: {
        depthTest: false,
      },
      pickable: true,
      onHover: (info: any) => {
        if (info.object) {
          setTooltip({
            x: info.x,
            y: info.y,
            content: setIconTooltipContent(info)
          });
        } else {
          setTooltip(null);
        }
      },
    });
  }

  // Calculate text data for labels
  // console.log('Processing features for text labels:', processedFeatures);
  
  // First, create a map of icon positions for quick lookup
  const iconPositions = new Map<string, boolean>();
  if (fd.show_icons && fd.icon_threshold !== '') {
    const iconData = processConditionalIcons(processedFeatures, fd);
    iconData.forEach(icon => {
      const key = `${icon.coordinates[0]},${icon.coordinates[1]}`;
      iconPositions.set(key, true);
    });
  }

  const textData = processedFeatures.map((feature: JsonObject) => {
    let coordinates: [number, number] | undefined;
    
    // Calculate center point for the text
    if (feature.geometry.type === 'Polygon') {
      const ring = feature.geometry.coordinates[0];
      coordinates = ring.reduce(
        (acc: [number, number], point: [number, number]) => [acc[0] + point[0], acc[1] + point[1]],
        [0, 0]
      ).map((sum: number) => sum / ring.length) as [number, number];
    } else if (feature.geometry.type === 'MultiPolygon') {
      const areas = feature.geometry.coordinates.map((poly: [number, number][][]) => {
        const ring = poly[0];
        return {
          area: Math.abs(ring.reduce((area: number, point: [number, number], i: number) => {
            const next = ring[(i + 1) % ring.length];
            return area + (point[0] * next[1] - next[0] * point[1]);
          }, 0)) / 2,
          ring
        } as PolygonRing;
      });
      const largestRing = areas.sort((a: PolygonRing, b: PolygonRing) => b.area - a.area)[0].ring;
      coordinates = largestRing.reduce(
        (acc: [number, number], point: [number, number]) => [acc[0] + point[0], acc[1] + point[1]],
        [0, 0]
      ).map((sum: number) => sum / largestRing.length) as [number, number];
    }

    if (!coordinates) {
      // console.log('No coordinates found for feature:', feature);
      return null;
    }

    // Check if there's an icon at these coordinates
    const key = `${coordinates[0]},${coordinates[1]}`;
    const hasIcon = iconPositions.get(key);
    
    // If there's an icon, offset the text position upward with a smaller offset
    if (hasIcon) {
      coordinates = [coordinates[0], coordinates[1] + 0.02];
    }

    const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
    const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
    const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';
    const value = feature.properties.metric;
    const text = fd.categorical_column && feature.properties.categorical_value !== undefined
      ? feature.properties.categorical_value
      : value !== undefined
      ? `${prefix}${formatter(value)}${unit}`
      : '';

    // Include region properties in the text data
    return {
      coordinates,
      text,
      value,
      hasIcon,
      object: {
        properties: {
          ...feature.properties,
          // Ensure we have all possible region identifiers
          ADM1: feature.properties.ADM1,
          name: feature.properties.name,
          NAME: feature.properties.NAME,
          ISO: feature.properties.ISO
        }
      }
    };
  }).filter((d: TextData | null): d is TextData => d !== null);

  // console.log('Generated text data with region properties:', textData);

  // Create text layer with adjusted positioning
  const textLayer = new TextLayer({
    id: `text-layer-${fd.slice_id}`,
    data: textData,
    getPosition: (d: any) => d.coordinates,
    getText: (d: any) => d.text,
    getSize: 14,
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: d => d.hasIcon ? 'bottom' : 'center',
    getPixelOffset: d => d.hasIcon ? [0, -10] : [0, 0],
    pickable: false,
    billboard: true,
    background: true,
    backgroundPadding: [2, 2],
    getBackgroundColor: [255, 255, 255, 196],
    fontFamily: 'Arial',
    characterSet: 'auto',
    sizeScale: 1,
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    sizeMaxPixels: 24,
    opacity: opacity,
  });

  // console.log('Created text layer:', textLayer);

  return iconLayer ? [geoJsonLayer, iconLayer, textLayer] : [geoJsonLayer, textLayer];
}

export const DeckGLCountry = memo((props: DeckGLCountryProps) => {
  const containerRef = useRef<DeckGLContainerHandleExtended>();
  const [geoJson, setGeoJson] = useState<JsonObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iconUrls, setIconUrls] = useState<string[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<[Date, Date] | undefined>();
  const [viewState, setViewState] = useState<ViewState>({
    ...props.viewport,
    zoom: props.viewport.zoom || 0,
    bearing: props.viewport.bearing || 0,
    pitch: props.viewport.pitch || 0,
    latitude: props.viewport.latitude,
    longitude: props.viewport.longitude,
  });
  
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

  // Get time range from data
  useEffect(() => {
    if (formData.temporal_column && payload.data.data?.length > 0) {
      const times = payload.data.data
        .map((d: JsonObject) => new Date(d[formData.temporal_column]))
        .filter((d: Date) => !isNaN(d.getTime()));
      
      if (times.length > 0) {
        const minTime = new Date(Math.min(...times.map((d: Date) => d.getTime())));
        const maxTime = new Date(Math.max(...times.map((d: Date) => d.getTime())));
        setTimeRange([minTime, maxTime]);

        // Find the nearest date to current system time
        const currentSystemTime = new Date().getTime();
        const nearestDate = times.reduce((prev: Date, curr: Date) => {
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
  }, [formData.temporal_column, payload.data.data]);

  // Calculate viewport
  const viewport = useMemo(() => {
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

  // Cleanup icon URLs
  useEffect(() => {
    return () => {
      iconUrls.forEach(url => cleanupIconUrl(url));
    };
  }, [iconUrls]);

  // Update viewState when viewport changes
  useEffect(() => {
    // console.log('Viewport prop changed:', props.viewport);
    setViewState(currentViewState => ({
      ...currentViewState,
      ...props.viewport,
      zoom: props.viewport.zoom || currentViewState.zoom || 0,
      bearing: props.viewport.bearing || currentViewState.bearing || 0,
      pitch: props.viewport.pitch || currentViewState.pitch || 0,
    }));
  }, [props.viewport]);

  // Handle viewport changes from user interaction
  const onViewportChange = useCallback((viewport: Viewport) => {
    // console.log('Viewport changed:', viewport);
    const newViewState = {
      ...viewport,
      zoom: viewport.zoom || viewState.zoom || 0,
      bearing: viewport.bearing || viewState.bearing || 0,
      pitch: viewport.pitch || viewState.pitch || 0,
    };
    setViewState(newViewState);
    if (props.setControlValue) {
      props.setControlValue('viewport', newViewState);
    }
  }, [props.setControlValue, viewState.zoom]);

  // Calculate layers with viewState
  const layers = useMemo(
    () => {
      // console.log('Recalculating layers with viewState:', viewState);
      if (!geoJson) return [];

      const baseLayers = getLayer({
        formData,
        payload,
        onAddFilter,
        setTooltip,
        geoJson,
        temporalOptions: {
          currentTime,
          allData: [],
        },
        viewState,
        opacity: 1.0
      });

      // Filter out text layer if show_text_labels is false
      if (!formData.show_text_labels) {
        return baseLayers.filter(layer => !(layer instanceof TextLayer));
      }

      return baseLayers;
    },
    [formData, payload, onAddFilter, setTooltip, geoJson, currentTime, viewState],
  );

  // Get formatter and layer metadata
  const formatter = useMemo(
    () => getNumberFormatter(formData.number_format || 'SMART_NUMBER'),
    [formData.number_format]
  );

  const geoJsonLayer = layers[0] as ExtendedGeoJsonLayer;
  const colorScale = geoJsonLayer?.colorScale;
  const extent = geoJsonLayer?.extent;
  const metricValues = geoJsonLayer?.metricValues || [];
  const categoricalValues = geoJsonLayer?.categoricalValues || [];

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!geoJson) {
    return <div>Loading...</div>;
  }

  return (
    <div style={{ position: 'relative' }}>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewState}
        layers={layers}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
        width={width}
        height={height}
        onViewportChange={onViewportChange}
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
        {colorScale && (
          <ColorLegend 
            colorScale={colorScale} 
            extent={extent}
            format={formatter}
            metricPrefix={formData.metric_prefix ? `${formData.metric_prefix} ` : ''}
            metricUnit={formData.metric_unit ? ` ${formData.metric_unit}` : ''}
            values={formData.categorical_column ? (geoJsonLayer?.categoricalValues || []) : metricValues}
            metricName={
              formData.categorical_column
                ? (formData.categorical_column || 'Categories')
                : (typeof formData.metric === 'object' 
                  ? (formData.metric.label || formData.metric_label || 'Metric Range')
                  : (formData.metric || formData.metric_label || 'Metric Range'))
            }
            isCategorical={!!formData.categorical_column}
          />
        )}
      </DeckGLContainerStyledWrapper>
    </div>
  );
});

export default DeckGLCountry;
