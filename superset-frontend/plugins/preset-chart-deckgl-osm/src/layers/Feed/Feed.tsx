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
  top: 20px;
  right: 20px;
  width: 350px;
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
  gap: 12px;
  padding: 20px;
  overflow-y: auto;
  max-height: calc(100vh - 120px); /* Account for header height and margins */
`;

const FeedItemDate = styled.span`
  display: block;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.grayscale.base};
  margin: 4px 0;
  font-style: italic;
`;

const FeedItem = styled.div`
  padding: 12px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.grayscale.light4};
  opacity: 0;
  animation: ${fadeIn} 0.3s ease-out forwards;
  animation-delay: ${({ index }: { index: number }) => `${index * 0.1}s`};
  
  h4 {
    margin: 0 0 4px 0;
    font-size: 16px;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
  
  p {
    margin: 0;
    font-size: 14px;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

interface FeedEntry {
  title: string;
  message: string;
  date?: string;
}

interface SelectedRegion {
  name: string;
  entries: FeedEntry[];
  id?: string;
}

interface ProcessedData {
  regionCounts: { [key: string]: number };
  regionMetrics: { [key: string]: number };
  regionEntries: { [key: string]: FeedEntry[] };
}

interface FeedPanelProps {
  entries: FeedEntry[];
  onClose: () => void;
  regionName: string;
  isExiting?: boolean;
}

const FeedSidePanel: React.FC<FeedPanelProps> = ({ entries, onClose, regionName, isExiting }) => {
  // Sort entries by date in descending order (newest first)
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateA - dateB;
    });
  }, [entries]);

  return (
    <FeedPanel isExiting={isExiting}>
      <FeedHeader>
        <FeedTitle>{regionName}</FeedTitle>
        <CloseButton onClick={onClose}>&times;</CloseButton>
      </FeedHeader>
      <FeedList>
        {sortedEntries.map((entry, index) => (
          <FeedItem key={index} index={index}>
            <h4>{entry.title}</h4>
            {entry.date && (
              <FeedItemDate>
                {format(new Date(entry.date), 'MMM d, yyyy h:mm a')}
                {' '}
                ({formatDistanceToNow(new Date(entry.date), { addSuffix: true })})
              </FeedItemDate>
            )}
            <p>{entry.message}</p>
          </FeedItem>
        ))}
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

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  geoJson: JsonObject,
  setSelectedRegion: (region: SelectedRegion | null) => void,
  selectedRegion: SelectedRegion | null,
): any[] {
  console.log('getLayer called with formData:', formData);
  console.log('payload:', payload);

  const fd = formData;
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const data = payload.data as ProcessedData;

  console.log('Processing data:', data);

  // Calculate extent and color scale
  const allMetricValues = Object.values(data.regionMetrics);
  const extent: [number, number] = [Math.min(...allMetricValues), Math.max(...allMetricValues)];
  const colorScale = scaleLinear<string>()
    .domain(extent)
    .range(['#ccc', '#343434']);

  const features = geoJson.features.map((feature: JsonObject) => {
    const regionId = feature.properties.ISO;
    const value = data.regionCounts[regionId];
    const metricValue = data.regionMetrics[regionId];
    // Check if region is selected by either ISO or name
    const isSelected = selectedRegion?.id === regionId || 
                      selectedRegion?.name === feature.properties.ADM1 ||
                      selectedRegion?.name === feature.properties.name ||
                      selectedRegion?.name === feature.properties.NAME;
    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        metricValue,
        fillColor: value !== undefined 
          ? isSelected 
            ? [255, 165, 0, 180] // Orange color for selected region
            : hexToRGB(colorScale(value)) 
          : [0, 0, 0, 0],
        strokeColor: isSelected ? [255, 165, 0, 255] : strokeColor,
        entries: data.regionEntries[regionId] || [],
      },
    };
  });

  let processedFeatures = features.filter((feature: JsonObject) => feature.properties.metric !== undefined);
  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    processedFeatures = jsFnMutator(processedFeatures);
  }

  function setTooltipContent(o: JsonObject) {
    console.log('setTooltipContent called with:', o);
    
    if (!o.object) {
      console.log('No object in tooltip data');
      setTooltip(null);
      return;
    }
    
    const areaName = o.object.properties?.ADM1 || o.object.properties?.name || o.object.properties?.NAME || o.object.properties?.ISO;
    const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
    const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
    const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';

    const content = (
      <div className="deckgl-tooltip">
        <TooltipRow
          key="area"
          label={`${areaName} `}
          value={o.object.properties?.metric !== undefined ? `${prefix}${formatter(o.object.properties.metric)}${unit} entries` : 'No entries'}
        />
      </div>
    );

    console.log('Setting tooltip content:', content);
    setTooltip({
      x: o.x,
      y: o.y,
      content,
    });
  }

  const geoJsonLayer = new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}`,
    data: processedFeatures,
    filled: fd.filled,
    stroked: fd.stroked,
    extruded: fd.extruded,
    pointRadiusScale: 100,
    lineWidthScale: 1,
    getFillColor: (f: JsonObject) => f.properties.fillColor,
    getLineColor: (f: JsonObject) => f.properties.strokeColor,
    getLineWidth: fd.line_width || 1,
    lineWidthUnits: fd.line_width_unit,
    opacity: 0.8,
    autoHighlight: true,
    pickable: true,
    onHover: setTooltipContent,
    onClick: (info: { object?: { properties?: { ADM1?: string; name?: string; NAME?: string; ISO?: string; entries?: FeedEntry[] } } } | null) => {
      console.log('Layer clicked:', info);
      if (info?.object?.properties) {
        const name = info.object.properties.ADM1 || 
                    info.object.properties.name || 
                    info.object.properties.NAME || 
                    info.object.properties.ISO;
        if (name && info.object.properties.entries) {
          const newSelectedRegion: SelectedRegion = {
            name,
            entries: info.object.properties.entries,
            id: info.object.properties.ISO,
          };
          console.log('Setting selected region:', newSelectedRegion);
          setSelectedRegion(newSelectedRegion);
        }
      }
    },
  });

  // Create centroids for circle overlays
  const centroids = processedFeatures.map((feature: JsonObject) => {
    const coordinates = feature.geometry.type === 'Polygon' 
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0];
    
    const center = coordinates.reduce(
      (acc: number[], coord: number[]) => [acc[0] + coord[0], acc[1] + coord[1]],
      [0, 0]
    ).map((sum: number) => sum / coordinates.length);

    return {
      position: center,
      count: feature.properties.metric || 0,
      metricValue: feature.properties.metricValue,
      name: feature.properties.ADM1 || feature.properties.name || feature.properties.NAME || feature.properties.ISO,
      ISO: feature.properties.ISO,
      entries: feature.properties.entries,
    };
  });

  const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
  const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
  const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';

  const circleLayer = new ScatterplotLayer({
    id: `circle-layer-${fd.slice_id}`,
    data: centroids,
    opacity: 0.8,
    stroked: true,
    filled: true,
    radiusScale: 6,
    radiusMinPixels: 5,
    radiusMaxPixels: 30,
    lineWidthMinPixels: 1,
    getPosition: (d: any) => d.position,
    getRadius: (d: any) => Math.sqrt(d.count) * 1000,
    getFillColor: (d: any) => {
      // Check if this specific circle's region is selected using ISO
      const isSelected = selectedRegion?.id === d.ISO;
      return isSelected ? [255, 69, 0, 180] : [255, 140, 0, 180];
    },
    getLineColor: (d: any) => {
      const isSelected = selectedRegion?.id === d.ISO;
      return isSelected ? [255, 69, 0, 255] : [255, 140, 0];
    },
    pickable: true,
    onHover: (o: JsonObject) => {
      console.log('Circle hover:', o);
      if (!o.object) {
        setTooltip(null);
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
    },
    onClick: (info: { object?: { name?: string; entries?: FeedEntry[]; ISO?: string } } | null) => {
      console.log('Circle clicked:', info);
      if (info?.object?.name && info.object.entries) {
        const newSelectedRegion: SelectedRegion = {
          name: info.object.name,
          entries: info.object.entries,
          id: info.object.ISO, // Use ISO for consistent identification
        };
        console.log('Setting selected region from circle:', newSelectedRegion);
        setSelectedRegion(newSelectedRegion);
      }
    },
  });

  const textLayer = new TextLayer({
    id: `text-layer-${fd.slice_id}`,
    data: centroids,
    getPosition: d => d.position,
    getText: d => String(d.count || ''),
    getSize: d => 10 + d.count,
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getPixelOffset: [0, 0],
    fontFamily: 'Arial',
    fontWeight: 'bold',
    getColor: [255, 255, 255, 255], // White text color
  });

  return [geoJsonLayer, circleLayer, textLayer];
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
  const containerRef = useRef<DeckGLContainerHandleExtended>();
  
  const { formData, payload, setControlValue, viewport: initialViewport, onAddFilter, height, width } = props;

  console.log("payload", payload);

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

  // Update getLayer to include panToFeature
  const layers = useMemo(
    () => geoJson ? getLayer(
      formData,
      payload,
      onAddFilter,
      setTooltip,
      geoJson,
      (region: SelectedRegion | null) => {
        if (region) {
          // Find the feature for the selected region
          const feature = geoJson.features.find(
            (f: any) => f.properties.ISO === region.id || 
                       f.properties.ADM1 === region.name ||
                       f.properties.name === region.name ||
                       f.properties.NAME === region.name
          );
          if (feature) {
            panToFeature(feature);
          }
        }
        setSelectedRegion(region);
      },
      selectedRegion
    ) : [],
    [formData, payload, onAddFilter, setTooltip, geoJson, selectedRegion, panToFeature],
  );

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!geoJson) {
    return <div>Loading...</div>;
  }

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
        {selectedRegion && (
          <FeedSidePanel
            entries={selectedRegion.entries}
            onClose={handleCloseFeed}
            regionName={selectedRegion.name}
            isExiting={isExiting}
          />
        )}
      </DeckGLContainerStyledWrapper>
    </>
  );
});

export default DeckGLFeed; 