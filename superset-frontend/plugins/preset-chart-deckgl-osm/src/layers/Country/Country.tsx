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
import React, { memo, useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';
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

// Cache for loaded GeoJSON data
const geoJsonCache: { [key: string]: JsonObject } = {};

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: HandlerFunction,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  geoJson: JsonObject,
) {
  const fd = formData;
  // console.log("Country - Creating layer with formData:", fd);
  
  const sc = fd.stroke_color_picker;
  const strokeColor = [sc.r, sc.g, sc.b, 255 * sc.a];
  // console.log("Country - Stroke color:", strokeColor);
  
  const data = payload.data.data;
  const records = Array.isArray(data) ? data : (data?.records || []);
  // console.log("Country - Records:", records);

  // console.log("payload: ", payload);
  // Get metric values for color scale
  const metricValues = records.map((d: JsonObject) => d.metric);
  const extent = [Math.min(...metricValues), Math.max(...metricValues)];
  // console.log("Country - Metric extent:", extent);

  // Create color scale
  const colorScale = getSequentialSchemeRegistry()
    .get(fd.linear_color_scheme)
    .createLinearScale(extent);

  // Map values
  const valueMap: { [key: string]: number } = {};
  records.forEach((d: JsonObject) => {
    valueMap[d.country_id] = d.metric;
  });
  // console.log("Country - Value map:", valueMap);

  // Create features
  const features = geoJson.features.map((feature: JsonObject) => {
    const value = valueMap[feature.properties.ISO];
    const color = value ? hexToRGB(colorScale(value)) : [0, 0, 0, 0];
    // console.log("Country - Feature:", feature.properties.ISO, "Value:", value, "Color:", color);
    return {
      ...feature,
      properties: {
        ...feature.properties,
        metric: value,
        fillColor: color,
        strokeColor,
      },
    };
  });

  let jsFnMutator;
  if (fd.js_data_mutator) {
    jsFnMutator = sandboxedEval(fd.js_data_mutator);
    features = jsFnMutator(features);
  }

  const getFillColor = (f: JsonObject) => f.properties.fillColor;
  const getLineColor = (f: JsonObject) => f.properties.strokeColor;

  function setTooltipContent(o: JsonObject) {

    // if no extraProps, get from properties.metric
    if (!o.object?.extraProps) {

      const formatter = getNumberFormatter(fd.number_format || 'SMART_NUMBER');

      return (
        <div className="deckgl-tooltip">
          <TooltipRow
            label={o.object.properties.name || o.object.properties.NAME || o.object.
            properties.ISO + " "}
            value={formatter(o.object.properties.metric)}
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

  const layer = new GeoJsonLayer({
    id: `geojson-layer-${fd.slice_id}` as const,
    data: features,
    extruded: fd.extruded,
    filled: fd.filled,
    stroked: fd.stroked,
    opacity: 0.8,
    getFillColor,
    getLineColor,
    getLineWidth: fd.line_width || 1,
    lineWidthUnits: fd.line_width_unit,
    pickable: true,
    autoHighlight: true,
    ...commonLayerProps(fd, setTooltip, setTooltipContent),
  });

  // console.log("Country - Created layer:", layer);
  return layer;
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

const DeckGLCountry = (props: DeckGLCountryProps) => {
  const containerRef = useRef<DeckGLContainerHandle>();
  const [geoJson, setGeoJson] = useState<JsonObject | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const { formData, payload, setControlValue, onAddFilter, height, width } = props;

  // Load GeoJSON data
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
