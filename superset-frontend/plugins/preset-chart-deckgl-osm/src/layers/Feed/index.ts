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
import { t, ChartMetadata, ChartPlugin } from '@superset-ui/core';
import transformProps from '../../transformProps';
import controlPanel from './controlPanel';
import thumbnail from './images/thumbnail.png';

const metadata = new ChartMetadata({
  category: t('Map'),
  credits: ['https://uber.github.io/deck.gl'],
  description: t(
    'Visualize geospatial data with feed entries for each region. Shows a count of entries as circles on the map.',
  ),
  name: t('deck.gl Feed'),
  thumbnail,
  useLegacyApi: true,
  tags: [t('deckGL'), t('Feed'), t('Geospatial')],
});

export default class FeedChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./Feed'),
      controlPanel,
      metadata,
      transformProps,
    });
  }
} 