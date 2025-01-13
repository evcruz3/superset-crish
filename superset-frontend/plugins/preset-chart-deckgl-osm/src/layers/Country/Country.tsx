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
import * as React from 'react';
import { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { GeoJsonLayer, IconLayer } from '@deck.gl/layers';
import { CompositeLayer } from '@deck.gl/core';
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
} from '@superset-ui/core';

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

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  geoJson: JsonObject,
) {
  const fd = formData;
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  const data = payload.data.data;
  const records = Array.isArray(data) ? data : (data?.records || []);

  const metricValues = records.map((d: JsonObject) => d.metric);
  const extent = [Math.min(...metricValues), Math.max(...metricValues)];
  const colorScale = getSequentialSchemeRegistry()
    .get(fd.linear_color_scheme)
    .createLinearScale(extent);

  const valueMap: { [key: string]: number } = {};
  records.forEach((d: JsonObject) => {
    valueMap[d.country_id] = d.metric;
  });

  const features = geoJson.features.map((feature: JsonObject) => {
    const value = valueMap[feature.properties.ISO];
    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        fillColor: value ? hexToRGB(colorScale(value)) : [0, 0, 0, 0],
        strokeColor,
      },
    };
  });

  let processedFeatures = features;
  if (fd.js_data_mutator) {
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    processedFeatures = jsFnMutator(features);
  }

  function setTooltipContent(o: JsonObject) {
    if (!o.object?.extraProps) {
      const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');
      const unit = fd.metric_unit ? ` ${fd.metric_unit}` : '';
      const prefix = fd.metric_prefix ? `${fd.metric_prefix} ` : '';

      return (
        <div className="deckgl-tooltip">
          <TooltipRow
            label={(o.object.properties.ADM1 || o.object.properties.name || o.object.properties.NAME || o.object.properties.ISO) + " "}
            value={`${prefix}${formatter(o.object.properties.metric)}${unit}`}
          />
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
    opacity: 0.8,
    getFillColor: (f: JsonObject) => f.properties.fillColor,
    getLineColor: (f: JsonObject) => f.properties.strokeColor,
    getLineWidth: fd.line_width || 1,
    lineWidthUnits: fd.line_width_unit,
    autoHighlight: true,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });

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

  // Return an array of layers instead of a composite layer
  return iconLayer ? [geoJsonLayer, iconLayer] : [geoJsonLayer];
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

const DeckGLCountry: React.FC<DeckGLCountryProps> = props => {
  const containerRef = useRef<DeckGLContainerHandle>();
  const [geoJson, setGeoJson] = useState<JsonObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [iconUrls, setIconUrls] = useState<string[]>([]);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const { formData, payload, setControlValue, onAddFilter, height, width } = props;

  useEffect(() => {
    const country = formData.select_country;
    if (!country) {
      setError('No country selected');
      return;
    }

    const url = countries[country];
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

  const viewport: Viewport = useMemo(() => {
    if (!geoJson || !formData.autozoom) return props.viewport;

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
      return fitViewport(props.viewport, {
        width,
        height,
        points,
      });
    }
    return props.viewport;
  }, [formData.autozoom, height, geoJson, props.viewport, width]);

  useEffect(() => {
    return () => {
      iconUrls.forEach(url => cleanupIconUrl(url));
    };
  }, [iconUrls]);

  if (error) {
    return <div className="alert alert-danger">{error}</div>;
  }

  if (!geoJson) {
    return <div>Loading...</div>;
  }

  const layer = getLayer(formData, payload, onAddFilter, setTooltip, geoJson);

  return (
    <DeckGLContainerStyledWrapper
      ref={containerRef}
      mapboxApiAccessToken={payload.data.mapboxApiKey}
      viewport={viewport}
      layers={[layer]}
      mapStyle={formData.mapbox_style}
      setControlValue={setControlValue}
      height={height}
      width={width}
    />
  );
};

export default memo(DeckGLCountry);
