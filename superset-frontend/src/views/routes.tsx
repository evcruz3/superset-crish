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
import React, { lazy } from 'react';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { ComponentType, ComponentProps } from 'react';
import Diseases from 'src/pages/Diseases';
import Dengue from 'src/pages/Diseases/Dengue';
import Diarrhea from 'src/pages/Diseases/Diarrhea';
import AcuteRespiratoryInfection from 'src/pages/Diseases/ARI';

// not lazy loaded since this is the home page.
import Home from 'src/pages/Home';

const ChartCreation = lazy(
  () =>
    import(/* webpackChunkName: "ChartCreation" */ 'src/pages/ChartCreation'),
);

const AnnotationLayerList = lazy(
  () =>
    import(
      /* webpackChunkName: "AnnotationLayerList" */ 'src/pages/AnnotationLayerList'
    ),
);

const AlertReportList = lazy(
  () =>
    import(
      /* webpackChunkName: "AlertReportList" */ 'src/pages/AlertReportList'
    ),
);

const AnnotationList = lazy(
  () =>
    import(/* webpackChunkName: "AnnotationList" */ 'src/pages/AnnotationList'),
);

const ChartList = lazy(
  () => import(/* webpackChunkName: "ChartList" */ 'src/pages/ChartList'),
);

const CssTemplateList = lazy(
  () =>
    import(
      /* webpackChunkName: "CssTemplateList" */ 'src/pages/CssTemplateList'
    ),
);

const DashboardList = lazy(
  () =>
    import(/* webpackChunkName: "DashboardList" */ 'src/pages/DashboardList'),
);

const Dashboard = lazy(
  () => import(/* webpackChunkName: "Dashboard" */ 'src/pages/Dashboard'),
);

const DatabaseList = lazy(
  () => import(/* webpackChunkName: "DatabaseList" */ 'src/pages/DatabaseList'),
);

const DatasetList = lazy(
  () => import(/* webpackChunkName: "DatasetList" */ 'src/pages/DatasetList'),
);

const DatasetCreation = lazy(
  () =>
    import(
      /* webpackChunkName: "DatasetCreation" */ 'src/pages/DatasetCreation'
    ),
);

const ExecutionLogList = lazy(
  () =>
    import(
      /* webpackChunkName: "ExecutionLogList" */ 'src/pages/ExecutionLogList'
    ),
);

const Chart = lazy(
  () => import(/* webpackChunkName: "Chart" */ 'src/pages/Chart'),
);

const QueryHistoryList = lazy(
  () =>
    import(
      /* webpackChunkName: "QueryHistoryList" */ 'src/pages/QueryHistoryList'
    ),
);

const SavedQueryList = lazy(
  () =>
    import(/* webpackChunkName: "SavedQueryList" */ 'src/pages/SavedQueryList'),
);

const SqlLab = lazy(
  () => import(/* webpackChunkName: "SqlLab" */ 'src/pages/SqlLab'),
);

const AllEntities = lazy(
  () => import(/* webpackChunkName: "AllEntities" */ 'src/pages/AllEntities'),
);

const Tags = lazy(
  () => import(/* webpackChunkName: "Tags" */ 'src/pages/Tags'),
);

const RowLevelSecurityList = lazy(
  () =>
    import(
      /* webpackChunkName: "RowLevelSecurityList" */ 'src/pages/RowLevelSecurityList'
    ),
);

const WeatherForecasts = lazy(
  () =>
    import(
      /* webpackChunkName: "WeatherForecasts" */ 'src/pages/WeatherForecasts'
    ),
);

const Facilities = lazy(
  () =>
    import(
      /* webpackChunkName: "Facilities" */ 'src/pages/Facilities'
    ),
);

const UpdateFacilities = lazy(
  () =>
    import(
      /* webpackChunkName: "UpdateFacilities" */ 'src/pages/UpdateFacilities'
    ),
);

const UpdateCaseReports = lazy(
  () =>
    import(
      /* webpackChunkName: "UpdateCaseReports" */ 'src/pages/Diseases/UpdateCaseReports'
    ),
);

import BulletinsAndAdvisories from 'src/pages/BulletinsAndAdvisories';
import PublicEducationList from 'src/pages/PublicEducation/PublicEducationList';

const DiseaseForecasts = lazy(
  () => import('src/pages/DiseaseForecasts'),
);

type Routes = {
  path: string;
  Component: ComponentType;
  Fallback?: ComponentType;
  props?: ComponentProps<any>;
}[];

export const routes: Routes = [
  {
    path: '/weather/',
    Component: WeatherForecasts
  },
  {
    path: '/disease-forecasts',
    Component: DiseaseForecasts,
  },
  {
    path: '/facilities/update/',
    Component: UpdateFacilities,
  },
  {
    path: '/facilities/',
    Component: Facilities
  },
  {
    path: '/superset/welcome/',
    Component: Home,
  },
  {
    path: '/dashboard/list/',
    Component: DashboardList,
  },
  {
    path: '/superset/dashboard/:idOrSlug/',
    Component: Dashboard,
  },
  {
    path: '/chart/add',
    Component: ChartCreation,
  },
  {
    path: '/chart/list/',
    Component: ChartList,
  },
  {
    path: '/tablemodelview/list/',
    Component: DatasetList,
  },
  {
    path: '/databaseview/list/',
    Component: DatabaseList,
  },
  {
    path: '/savedqueryview/list/',
    Component: SavedQueryList,
  },
  {
    path: '/csstemplatemodelview/list/',
    Component: CssTemplateList,
  },
  {
    path: '/annotationlayer/list/',
    Component: AnnotationLayerList,
  },
  {
    path: '/annotationlayer/:annotationLayerId/annotation/',
    Component: AnnotationList,
  },
  {
    path: '/sqllab/history/',
    Component: QueryHistoryList,
  },
  {
    path: '/alert/list/',
    Component: AlertReportList,
  },
  {
    path: '/report/list/',
    Component: AlertReportList,
    props: {
      isReportEnabled: true,
    },
  },
  {
    path: '/alert/:alertId/log/',
    Component: ExecutionLogList,
  },
  {
    path: '/report/:alertId/log/',
    Component: ExecutionLogList,
    props: {
      isReportEnabled: true,
    },
  },
  {
    path: '/explore/',
    Component: Chart,
  },
  {
    path: '/superset/explore/p',
    Component: Chart,
  },
  {
    path: '/dataset/add/',
    Component: DatasetCreation,
  },
  {
    path: '/dataset/:datasetId',
    Component: DatasetCreation,
  },
  {
    path: '/rowlevelsecurity/list',
    Component: RowLevelSecurityList,
  },
  {
    path: '/sqllab/',
    Component: SqlLab,
  },
  {
    path: '/diseases/dengue',
    Component: Dengue,
  },
  {
    path: '/diseases/diarrhea',
    Component: Diarrhea,
  },
  {
    path: '/diseases/ari',
    Component: AcuteRespiratoryInfection,
  },
  {
    path: '/diseases/update',
    Component: UpdateCaseReports,
  },
  {
    path: '/diseases',
    Component: Diseases,
  },
  {
    path: '/bulletins_and_advisories/',
    Component: BulletinsAndAdvisories,
  },
  {
    path: '/public_education/',
    Component: PublicEducationList,
  },

];

if (isFeatureEnabled(FeatureFlag.TaggingSystem)) {
  routes.push({
    path: '/superset/all_entities/',
    Component: AllEntities,
  });
  routes.push({
    path: '/superset/tags/',
    Component: Tags,
  });
}

const frontEndRoutes = routes
  .map(r => r.path)
  .reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: true,
    }),
    {},
  );

export function isFrontendRoute(path?: string) {
  if (path) {
    const basePath = path.split(/[?#]/)[0]; // strip out query params and link bookmarks
    return !!frontEndRoutes[basePath];
  }
  return false;
}
