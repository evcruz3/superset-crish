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
import { useState, useCallback, useEffect } from 'react';
import { LineEditableTabs } from 'src/components/Tabs';
import { styled, t, useTheme, SupersetClient } from '@superset-ui/core';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import Trendlines from './Trendlines';
import DashboardTabs, {
  ChartContainer,
  TabContentContainer,
  StyledTabsContainer,
} from '../WeatherForecasts/DashboardTabs';

const DataSourceAttribution = styled.div`
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  z-index: 900;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
`;

const DataUpdateInfo = styled.span`
  margin-top: 3px;
  font-size: 11px;
  color: #888;
`;

// Type for Disease Pipeline Run History
interface PipelineRunHistoryType {
  id: number;
  ran_at: string; // ISO format datetime string
  pipeline_name: string;
  status: string;
  details?: string;
  municipalities_processed_count?: number;
  alerts_generated_count?: number;
  bulletins_created_count?: number;
}

export default function DiseaseForecasts() {
  // return <DashboardTabs idOrSlug="disease_forecasts" selectedTabIndex={0} />;

  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('1');
  const [lastDiseaseRunInfo, setLastDiseaseRunInfo] =
    useState<PipelineRunHistoryType | null>(null);
  const [lastDiseaseRunLoading, setLastDiseaseRunLoading] = useState(false);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  // Fetch last disease pipeline run information
  const fetchLastDiseaseRun = useCallback(async () => {
    setLastDiseaseRunLoading(true);
    try {
      console.log('[Disease Pipeline Run] Fetching last successful run info');
      const response = await SupersetClient.get({
        endpoint: '/api/v1/disease_pipeline_run_history/last_successful_run',
        headers: { Accept: 'application/json' },
      });

      console.log('[Disease Pipeline Run] Response:', response.json);

      if (response.json?.result) {
        setLastDiseaseRunInfo(response.json.result);
        console.log(
          '[Disease Pipeline Run] Last successful run:',
          response.json.result.ran_at,
        );
      } else {
        console.log('[Disease Pipeline Run] No successful run info available');
        setLastDiseaseRunInfo(null);
      }
    } catch (error) {
      if (error.status === 404) {
        console.log('[Disease Pipeline Run] No successful run history found');
      } else {
        console.error('Error fetching last disease run info:', error);
      }
      setLastDiseaseRunInfo(null);
    } finally {
      setLastDiseaseRunLoading(false);
    }
  }, []);

  // Format date for display
  const formatDisplayDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      // Format: "May 15, 2023 at 10:30 AM"
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return dateString;
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchLastDiseaseRun();
  }, [fetchLastDiseaseRun]);

  return (
    <StyledTabsContainer>
      <LineEditableTabs
        activeKey={activeTab}
        onChange={handleTabChange}
        type="card"
      >
        <LineEditableTabs.TabPane tab={t('Forecasts')} key="1">
          <TabContentContainer>
            <ChartContainer>
              <ResponsiveChartSlug
                slug="multi-disease-forecast"
                fillHeight
                onError={error => console.error('Chart error:', error)}
              />
            </ChartContainer>

            {/* Data source attribution */}
            <DataSourceAttribution>
              <span>{t('Disease forecast data generated internally')}</span>
              {lastDiseaseRunLoading ? (
                <DataUpdateInfo>
                  Loading last disease forecast time...
                </DataUpdateInfo>
              ) : lastDiseaseRunInfo ? (
                <DataUpdateInfo>
                  {t('Last successful disease forecast:')}{' '}
                  {formatDisplayDate(lastDiseaseRunInfo.ran_at)}
                </DataUpdateInfo>
              ) : (
                <DataUpdateInfo>
                  {t('Disease forecast history unavailable')}
                </DataUpdateInfo>
              )}
            </DataSourceAttribution>
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab={t('Alerts')} key="2">
          <TabContentContainer>
            <ChartContainer>
              <ResponsiveChartSlug
                slug="disease_forecast_alerts"
                fillHeight
                onError={error => console.error('Chart error:', error)}
              />
            </ChartContainer>
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab={t('Trendlines')} key="3">
          <TabContentContainer>
            <Trendlines />
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab={t('Table')} key="4">
          <TabContentContainer>
            {/* Alot horizontal padding */}
            <ChartContainer style={{ paddingLeft: 16, paddingRight: 16 }}>
              <ResponsiveChartSlug
                slug="disease_forecast_table"
                fillHeight
                onError={error => console.error('Chart error:', error)}
              />
            </ChartContainer>
          </TabContentContainer>
        </LineEditableTabs.TabPane>
      </LineEditableTabs>
    </StyledTabsContainer>
  );
}
