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
} from '@superset-ui/core';
import { scaleLinear, ScaleLinear } from 'd3-scale';
import { Slider } from 'antd';

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
  colorScale: ScaleLinear<string, string>;
  extent: [number, number];
  format: (value: number) => string;
  metricPrefix?: string;
  metricUnit?: string;
  values: number[];
  metricName?: string;
}

const ColorLegend = ({ 
  colorScale, 
  extent, 
  format, 
  metricPrefix = '', 
  metricUnit = '', 
  values,
  metricName = 'Metric Range' 
}: ColorLegendProps) => {
  // Get unique values and sort them in descending order
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  
  // If we have more than 5 values, we need to select a subset
  let displayValues = uniqueValues;
  if (uniqueValues.length > 5) {
    // Always include min and max
    const min = uniqueValues[uniqueValues.length - 1];
    const max = uniqueValues[0];
    
    // For the middle values, take evenly spaced indices
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
            <span className="label">{`${metricPrefix}${format(value)}${metricUnit}`}</span>
          </div>
        ))}
      </div>
    </StyledLegend>
  );
};

// Add custom properties to GeoJsonLayer
interface ExtendedGeoJsonLayer extends GeoJsonLayer {
  colorScale?: ScaleLinear<string, string>;
  extent?: [number, number];
  metricValues?: number[];
}

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
    justify-content: space-between;
    gap: 8px;
  }

  .day-label {
    font-size: 12px;
    color: #666;
    text-align: center;
    padding: 4px 8px;
    min-width: 40px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;

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

  const currentTime = temporalOptions?.currentTime;
  const temporalData = temporalOptions?.allData || [];

  const fd = formData;
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const data = payload.data?.data || [];
  const records = Array.isArray(data) ? data : (data?.records || []);

  // Use temporalData for color scale calculation if provided, otherwise use current records
  const dataForColorScale = temporalData.length > 0 ? temporalData : records;
  const allMetricValues = dataForColorScale
    .map((d: JsonObject) => d.metric)
    .filter((v: number) => v !== undefined && v !== null);

  // Ensure we have valid metric values for the color scale
  const extent: [number, number] = allMetricValues.length > 0 
    ? [Math.min(...allMetricValues), Math.max(...allMetricValues)]
    : [0, 100]; // Default range if no metrics available

  // Get color scheme from registry or use default
  const scheme = getSequentialSchemeRegistry().get(fd.linear_color_scheme || 'blue_white_yellow');
  const colorScale = scheme 
    ? scheme.createLinearScale(extent) 
    : scaleLinear<string>()
        .domain(extent)
        .range(['#ccc', '#343434']);

  // Filter records based on current time for display
  const valueMap: { [key: string]: number } = {};
  records.forEach((d: JsonObject) => {
    if (d.metric !== undefined && d.metric !== null) {
      // If we have temporal data, only include values up to the current time
      if (currentTime && fd.temporal_column) {
        const recordTime = new Date(d[fd.temporal_column]);
        if (recordTime <= currentTime) {
          valueMap[d.country_id] = d.metric;
        }
      } else {
        valueMap[d.country_id] = d.metric;
      }
    }
  });

  // Ensure geoJson has features array
  const features = (geoJson.features || []).map((feature: JsonObject) => {
    const value = valueMap[feature.properties?.ISO];
    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        fillColor: value !== undefined ? hexToRGB(colorScale(value)) : [200, 200, 200, 100], // Light gray for undefined
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
          value={o.object.properties.metric !== undefined ? `${prefix}${formatter(o.object.properties.metric)}${unit}` : 'No data'}
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
      const formattedValue = `${prefix}${formatter(info.object.metric)}${unit}`;
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
  geoJsonLayer.metricValues = allMetricValues;

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
    const text = value !== undefined ? `${prefix}${formatter(value)}${unit}` : '';

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
        setCurrentTime(minTime);
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
      return geoJson ? getLayer({
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
      }) : [];
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
              {currentTime?.toLocaleDateString()} ({currentTime?.toLocaleDateString('en-US', { weekday: 'long' })})
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
              {['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, index) => (
                <div 
                  key={index} 
                  className={`day-label ${
                    currentTime && 
                    new Date(timeRange[0].getTime() + index * 24 * 60 * 60 * 1000).toDateString() === currentTime.toDateString() 
                      ? 'active' 
                      : ''
                  }`}
                  onClick={() => {
                    const date = new Date(timeRange[0].getTime());
                    date.setDate(date.getDate() + index);
                    setCurrentTime(date);
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
          </StyledTimelineSlider>
        )}
        {colorScale && extent && (
          <ColorLegend 
            colorScale={colorScale} 
            extent={extent} 
            format={formatter}
            metricPrefix={formData.metric_prefix ? `${formData.metric_prefix} ` : ''}
            metricUnit={formData.metric_unit ? ` ${formData.metric_unit}` : ''}
            values={metricValues}
            metricName={
              typeof formData.metric === 'object' 
                ? (formData.metric.label || formData.metric_label || 'Metric Range')
                : (formData.metric || formData.metric_label || 'Metric Range')
            }
          />
        )}
      </DeckGLContainerStyledWrapper>
    </div>
  );
});

export default DeckGLCountry;
