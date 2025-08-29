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
import { Layer } from '@deck.gl/core';
import {
  JsonObject,
  JsonValue,
  QueryFormData,
  HandlerFunction,
  Datasource,
} from '@superset-ui/core';
import { TooltipProps } from '../components/Tooltip';
import { Viewport } from '../utils/fitViewport';

/**
 * Interface for feed entries in region data
 */
export interface FeedEntry {
  title: string;
  message: string;
  date?: string;
}

/**
 * Interface for selected region data
 */
export interface SelectedRegion {
  name: string;
  entries: FeedEntry[];
  id?: string;
}

/**
 * Base options required by all layer types
 */
interface BaseLayerOptions {
  formData: QueryFormData;
  payload: JsonObject;
  onAddFilter: HandlerFunction;
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
}

/**
 * Options for temporal (time-based) data visualization
 */
interface TemporalOptions {
  currentTime?: Date;
  allData?: JsonObject[];
}

/**
 * Options for handling region/item selection
 */
interface SelectionOptions {
  selected?: JsonObject[];
  onSelect?: (value: JsonValue) => void;
  setSelectedRegion?: (region: SelectedRegion | null) => void;
  selectedRegion?: SelectedRegion | null;
}

/**
 * Complete options interface for layer generation
 */
export interface LayerOptions extends BaseLayerOptions {
  // Optional features used by specific layer types
  datasource?: Datasource; // For Scatter layer
  geoJson?: JsonObject; // For Country and Feed layers
  temporalOptions?: TemporalOptions; // For Country layer
  viewState?: Viewport; // For Country layer
  selectionOptions?: SelectionOptions; // For Polygon and Feed layers
  opacity?: number; // For controlling layer opacity
  onClick?: (info: { object?: any }) => void;
}

/**
 * Possible return types from layer generators
 * - Single layer
 * - Array of layers
 * - Function returning a layer
 * - Array of layers or functions returning layers
 */
export type LayerReturn =
  | Layer<{}>
  | Layer<{}>[]
  | (() => Layer<{}>)
  | (Layer<{}> | (() => Layer<{}>))[];

/**
 * Standard function signature for all layer generators
 */
export type GetLayerFunction = (options: LayerOptions) => LayerReturn;

/**
 * Type guard to check if a layer has color scale functionality
 */
export interface LayerWithColorScale extends Layer<{}> {
  colorScale?: (value: number) => string;
  extent?: [number, number];
  metricValues?: number[];
}

/**
 * Type guard function to check if a layer has color scale
 */
export function hasColorScale(layer: Layer<{}>): layer is LayerWithColorScale {
  return 'colorScale' in layer && 'extent' in layer && 'metricValues' in layer;
}
