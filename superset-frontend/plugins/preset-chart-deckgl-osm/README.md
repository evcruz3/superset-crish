<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

## @superset-ui/legacy-preset-chart-deckgl

[![Version](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-deckgl.svg?style=flat)](https://img.shields.io/npm/v/@superset-ui/legacy-preset-chart-deckgl.svg?style=flat-square)
[![Libraries.io](https://img.shields.io/librariesio/release/npm/%40superset-ui%2Flegacy-preset-chart-deckgl?style=flat)](https://libraries.io/npm/@superset-ui%2Flegacy-preset-chart-deckgl)

This plugin provides `deck.gl` for Superset.

### Usage

Import the preset and register. This will register all the chart plugins under `deck.gl`.

```js
import { DeckGLOSMChartPreset } from '@superset-ui/legacy-preset-chart-deckgl';

new DeckGLOSMChartPreset().register();
```

or register charts one by one. Configure `key`, which can be any `string`, and register the plugin. This `key` will be used to lookup this chart throughout the app.

```js
import { ArcChartPlugin } from '@superset-ui/legacy-preset-chart-deckgl';

new ArcChartPlugin().configure({ key: 'deck_osm_arc' }).register();
```

Then use it via `SuperChart`. See [storybook](https://apache-superset.github.io/superset-ui-plugins-deckgl) for more details.

```js
<SuperChart
  chartType="deck_arc"
  width={600}
  height={600}
  formData={...}
  queriesData={[{
    data: {...},
  }]}
/>
```
