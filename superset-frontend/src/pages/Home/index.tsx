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
import React, { useState, useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import DashboardTabs from '../WeatherForecasts/DashboardTabs';

const FloatingToggle = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  padding: 10px 20px;
  border-radius: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  cursor: pointer;
  z-index: 1000;
  &:hover {
    background: #f0f0f0;
  }
`;

const ChartContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`;

interface WelcomeProps {
  user: {
    userId: number;
  };
  addDangerToast: (message: string) => void;
  chartSlug?: string;
}

function Welcome({ user, addDangerToast, chartSlug = 'overview-map' }: WelcomeProps) {
  const [showFullChart, setShowFullChart] = useState(true);

  const handleError = useCallback((error: Error) => {
    addDangerToast(t('Failed to load chart: %s', error.message));
  }, [addDangerToast]);

  const toggleView = useCallback(() => {
    setShowFullChart(prev => !prev);
  }, []);

  return (
    <ChartContainer>
      <FloatingToggle onClick={toggleView}>
        {showFullChart ? 'Show Alerts' : 'Show Overview'}
      </FloatingToggle>
      
      <div style={{ 
        flex: 1,
        display: showFullChart ? 'block' : 'none',
        overflow: 'hidden'
      }}>
        <ResponsiveChartSlug
          slug={chartSlug}
          fillHeight
          onError={handleError}
        />
      </div>
      
      <div style={{ 
        flex: 1,
        display: showFullChart ? 'none' : 'block',
        overflow: 'hidden'
      }}>
        <DashboardTabs idOrSlug="overview" />
      </div>
    </ChartContainer>
  );
}

export default withToasts(Welcome);
