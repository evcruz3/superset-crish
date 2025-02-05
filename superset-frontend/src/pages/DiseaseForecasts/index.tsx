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
import React from 'react';
import { t } from '@superset-ui/core';
import { Col, Row } from 'src/components';
import { useTheme } from '@superset-ui/core';
import DashboardTabs from '../WeatherForecasts/DashboardTabs';
import DashboardPage from 'src/dashboard/containers/DashboardPage';

export default function DiseaseForecasts() {
  const theme = useTheme();

  return <DashboardPage idOrSlug="disease_forecasts" />;

//   return (
//     <div className="container">
//       <Row gutter={16}>
//         <Col xs={24} sm={24} md={24} lg={24}>
//           <h1>{t('Disease Forecasts')}</h1>
//           <div
//             style={{
//               backgroundColor: theme.colors.grayscale.light5,
//               borderRadius: theme.borderRadius,
//               padding: theme.gridUnit * 4,
//               marginTop: theme.gridUnit * 2,
//             }}
//           >
//             <p>{t('Welcome to Disease Forecasts')}</p>
//             <p>
//               {t(
//                 'This page provides forecasting insights for various diseases in Timor-Leste.',
//               )}
//             </p>
//           </div>
//         </Col>
//       </Row>
//     </div>
//   );
} 