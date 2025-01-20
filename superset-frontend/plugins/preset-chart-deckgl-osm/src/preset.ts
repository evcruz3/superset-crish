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
import { Preset } from '@superset-ui/core';
import {
  ArcChartPlugin,
  CountryChartPlugin,
  GeoJsonChartPlugin,
  GridChartPlugin,
  HexChartPlugin,
  MultiChartPlugin,
  PathChartPlugin,
  PolygonChartPlugin,
  ScatterChartPlugin,
  ScreengridChartPlugin,
  ContourChartPlugin,
  HeatmapChartPlugin,
  FeedChartPlugin,
} from '.';

export default class DeckGLOSMChartPreset extends Preset {
  constructor() {
    super({
      name: 'deck.gl OSM Charts',
      presets: [],
      plugins: [
        new ArcChartPlugin().configure({ key: 'deck_arc' }),
        new CountryChartPlugin().configure({ key: 'deck_country' }),
        new GeoJsonChartPlugin().configure({ key: 'deck_geojson' }),
        new GridChartPlugin().configure({ key: 'deck_grid' }),
        new HexChartPlugin().configure({ key: 'deck_hex' }),
        new HeatmapChartPlugin().configure({ key: 'deck_heatmap' }),
        new MultiChartPlugin().configure({ key: 'deck_multi' }),
        new PathChartPlugin().configure({ key: 'deck_path' }),
        new PolygonChartPlugin().configure({ key: 'deck_polygon' }),
        new ScatterChartPlugin().configure({ key: 'deck_scatter' }),
        new ScreengridChartPlugin().configure({ key: 'deck_screengrid' }),
        new ContourChartPlugin().configure({ key: 'deck_contour' }),
        new FeedChartPlugin().configure({ key: 'deck_feed' }),
      ],
    });
  }
}
