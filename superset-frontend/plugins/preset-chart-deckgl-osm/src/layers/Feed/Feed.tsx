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
import { CompositeLayer } from '@deck.gl/core';
import {
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  getNumberFormatter,
  styled,
} from '@superset-ui/core';
import { scaleLinear } from 'd3-scale';
import geojsonExtent from '@mapbox/geojson-extent';

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

const FeedPanel = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  width: 350px;
  max-height: calc(100vh - 40px);
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 20px;
  overflow-y: auto;
  z-index: 1;
`;

const FeedHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
`;

const FeedItem = styled.div`
  padding: 12px;
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.grayscale.light4};
  
  h4 {
    margin: 0 0 8px 0;
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
}

interface FeedPanelProps {
  entries: FeedEntry[];
  onClose: () => void;
  regionName: string;
}

const FeedSidePanel: React.FC<FeedPanelProps> = ({ entries, onClose, regionName }) => (
  <FeedPanel>
    <FeedHeader>
      <FeedTitle>{regionName} Feed</FeedTitle>
      <CloseButton onClick={onClose}>&times;</CloseButton>
    </FeedHeader>
    <FeedList>
      {entries.map((entry, index) => (
        <FeedItem key={index}>
          <h4>{entry.title}</h4>
          <p>{entry.message}</p>
        </FeedItem>
      ))}
    </FeedList>
  </FeedPanel>
);

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
  setSelectedRegion: (region: { name: string; entries: FeedEntry[] } | null) => void,
): any[] {
  console.log('getLayer called with formData:', formData);
  console.log('payload:', payload);

  const fd = formData;
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const data = payload.data.data;
  const records = Array.isArray(data) ? data : (data?.records || []);

  console.log('Processing records:', records);

  // Calculate counts per region
  const regionCounts: { [key: string]: number } = {};
  const regionEntries: { [key: string]: FeedEntry[] } = {};
  const regionMetrics: { [key: string]: number } = {};
  
  records.forEach((d: JsonObject) => {
    const regionId = d.country_id;
    if (regionId) {
      // Initialize region data if not exists
      if (!regionCounts[regionId]) {
        regionCounts[regionId] = 0;
        regionMetrics[regionId] = 0;
        regionEntries[regionId] = [];
      }

      // Increment counts and metrics
      regionCounts[regionId] += 1;
      regionMetrics[regionId] = (regionMetrics[regionId] || 0) + (d.metric || 0);

      // Debug logging
      console.log('Feed entry processing:', {
        regionId,
        disease: d.title,
        predictedCases: d.message,
        rawRecord: d,
      });

      // Add entry with disease and predicted cases
      regionEntries[regionId].push({
        title: String(d.title || ''),
        message: String(d.message),
      });
    }
  });

  console.log('Final processed data:', {
    regionCounts,
    regionMetrics,
    regionEntries,
  });

  // Calculate extent and color scale
  const allMetricValues = records
    .map((d: JsonObject) => d.metric)
    .filter((v: number) => v !== undefined && v !== null);
  const extent: [number, number] = [Math.min(...allMetricValues), Math.max(...allMetricValues)];
  const colorScale = scaleLinear<string>()
    .domain(extent)
    .range(['#ccc', '#343434']);

  const features = geoJson.features.map((feature: JsonObject) => {
    const value = regionCounts[feature.properties.ISO];
    const metricValue = regionMetrics[feature.properties.ISO];
    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        metricValue,
        fillColor: value !== undefined ? hexToRGB(colorScale(value)) : [0, 0, 0, 0],
        strokeColor,
        entries: regionEntries[feature.properties.ISO] || [],
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
          console.log('Setting selected region:', { name, entries: info.object.properties.entries });
          setSelectedRegion({
            name,
            entries: info.object.properties.entries,
          });
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
    getFillColor: [255, 140, 0, 180],
    getLineColor: [255, 140, 0],
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
    onClick: (info: { object?: { name?: string; entries?: FeedEntry[] } } | null) => {
      console.log('Circle clicked:', info);
      if (info?.object?.name && info.object.entries) {
        console.log('Setting selected region from circle:', { name: info.object.name, entries: info.object.entries });
        setSelectedRegion({
          name: info.object.name,
          entries: info.object.entries,
        });
      }
    },
  });

  const textLayer = new TextLayer({
    id: `text-layer-${fd.slice_id}`,
    data: centroids,
    getPosition: d => d.position,
    getText: d => String(d.count || ''),
    getSize: 14,
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'center',
    getPixelOffset: [0, 0],
    fontFamily: 'Arial',
    fontWeight: 'bold',
    background: true,
    backgroundPadding: [3, 3],
    backgroundColor: [255, 255, 255, 200],
  });

  return [geoJsonLayer, circleLayer, textLayer];
}

interface DeckGLContainerHandleExtended extends DeckGLContainerHandle {
  setViewState: (viewState: any) => void;
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
}

export const DeckGLFeed = memo((props: DeckGLFeedProps) => {
  const [geoJson, setGeoJson] = useState<JsonObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<{ name: string; entries: FeedEntry[] } | null>(null);
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

  // Calculate layers
  const layers = useMemo(
    () => geoJson ? getLayer(formData, payload, onAddFilter, setTooltip, geoJson, setSelectedRegion) : [],
    [formData, payload, onAddFilter, setTooltip, geoJson],
  );

  function setTooltipContent(o: JsonObject) {
    console.log('setTooltipContent called with:', o);
    
    if (!o.object) {
      console.log('No object in tooltip data');
      setTooltip(null);
      return;
    }
    
    const areaName = o.object.properties?.ADM1 || o.object.properties?.name || o.object.properties?.NAME || o.object.properties?.ISO;
    const formatter = getNumberFormatter(formData.number_format || 'SMART_NUMBER');
    const unit = formData.metric_unit ? ` ${formData.metric_unit}` : '';
    const prefix = formData.metric_prefix ? `${formData.metric_prefix} ` : '';

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

  const onViewStateChange = useCallback(({ viewState }) => {
    if (containerRef.current) {
      containerRef.current.setViewState(viewState);
    }
  }, []);

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
        viewport={viewport}
        layers={layers}
        mapStyle={formData.mapbox_style}
        width={width}
        height={height}
        setControlValue={setControlValue}
      >
        {selectedRegion && (
          <FeedSidePanel
            entries={selectedRegion.entries}
            onClose={() => setSelectedRegion(null)}
            regionName={selectedRegion.name}
          />
        )}
      </DeckGLContainerStyledWrapper>
    </>
  );
});

export default DeckGLFeed; 