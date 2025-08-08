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

import { JsonObject, QueryFormData } from '@superset-ui/core';
import { LayerOptions } from './layers';
import { TooltipProps } from 'antd-v5';

/**
 * Feed entry representing a single data point in the feed
 */
export interface FeedEntry {
  title: string;
  message: string;
  date?: string;
  country_id?: string;
  metric?: number;
  [key: string]: any; // Allow additional properties
}

/**
 * Selected region information
 */
export interface SelectedRegion {
  name: string;
  entries: FeedEntry[];
  id?: string;
}

/**
 * Selection options for managing region selection state
 */
export interface FeedSelectionOptions {
  setSelectedRegion: (region: SelectedRegion | null) => void;
  selectedRegion: SelectedRegion | null;
}

/**
 * Processed data structure for Feed layer
 */
export interface ProcessedFeedData {
  regionCounts: Record<string, number>;
  regionMetrics: Record<string, number>;
  regionEntries: Record<string, FeedEntry[]>;
}

/**
 * GeoJSON feature properties specific to Feed layer
 */
export interface FeedGeoJSONProperties {
  ISO: string;
  ADM1?: string;
  name?: string;
  NAME?: string;
  id?: string;
  metric?: number;
  metricValue?: number;
  fillColor?: [number, number, number, number];
  strokeColor?: [number, number, number, number];
  entries?: FeedEntry[];
}

/**
 * GeoJSON feature specific to Feed layer
 */
export interface FeedGeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: FeedGeoJSONProperties;
}

/**
 * GeoJSON structure specific to Feed layer
 */
export interface FeedGeoJSON {
  type: 'FeatureCollection';
  features: FeedGeoJSONFeature[];
}

/**
 * Form data specific to Feed layer
 */
export interface FeedFormData {
  viz_type: 'deck_feed';
  metric: string | { label: string };
  metric_label?: string;
  metric_prefix?: string;
  metric_unit?: string;
  number_format?: string;
  stroke_color_picker: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
  filled?: boolean;
  stroked?: boolean;
  extruded?: boolean;
  line_width?: number;
  line_width_unit?: string;
  select_country?: string;
  temporal_column?: string;
  time_grain_sqla?: string;
  categorical_column?: string;
  [key: string]: any; // Allow additional form data properties
}

/**
 * Props specific to Feed layer
 */
export interface FeedLayerProps {
  formData: QueryFormData | FeedGeoJSON;
  payload: JsonObject;
  setTooltip: (tooltip: TooltipProps) => void;
  geoJson: FeedGeoJSON;
  selectionOptions: FeedSelectionOptions | LayerOptions['selectionOptions'];
  opacity?: number;
  currentTime?: Date;
  colorSettings?: {
    getFeatureColor?: (feature: GeoJSON.Feature) => {
      fillColor?: [number, number, number, number];
      strokeColor?: [number, number, number, number];
    };
  };
  selectedParameters?: [string]
}

/**
 * Centroid data structure for circle overlays
 */
export interface FeedCentroid {
  position: [number, number];
  count: number;
  metricValue: number;
  name: string;
  ISO: string;
  entries: FeedEntry[];
}

/**
 * Return type for Feed layer
 */
export interface FeedLayerReturn {
  geoJsonLayer: any; // Replace with proper deck.gl layer type
  circleLayer: any; // Replace with proper deck.gl layer type
  textLayer: any; // Replace with proper deck.gl layer type
} 