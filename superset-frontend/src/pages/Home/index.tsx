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
import React, { useEffect, useState, useCallback } from 'react';
import {
  styled,
  t,
  SupersetClient,
} from '@superset-ui/core';
import { useDispatch } from 'react-redux';
import withToasts from 'src/components/MessageToasts/withToasts';
import ChartContainer from 'src/components/Chart/ChartContainer';
import DashboardPageWrapper from 'src/components/DashboardPageWrapper';

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

// Replace logging with console for now
const logInfo = (message: string, ...args: any[]) => {
  console.info(`[Welcome] ${message}`, ...args);
};

const logError = (message: string, ...args: any[]) => {
  console.error(`[Welcome] ${message}`, ...args);
};

const logWarn = (message: string, ...args: any[]) => {
  console.warn(`[Welcome] ${message}`, ...args);
};

interface WelcomeProps {
  user: {
    userId: number;
  };
  addDangerToast: (message: string) => void;
}

function Welcome({ user, addDangerToast }: WelcomeProps) {
  const dispatch = useDispatch();
  const [formData, setFormData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartStatus, setChartStatus] = useState<'loading' | 'rendered' | 'failed'>('loading');
  const [queriesResponse, setQueriesResponse] = useState<any[]>([]);
  const [showFullChart, setShowFullChart] = useState(true);
  
  // Get slice_id from environment variable with fallback
  const SLICE_ID = Number(process.env.REACT_APP_SLICE_ID || '8');
  
  // Log the slice ID for debugging
  useEffect(() => {
    console.debug('Using SLICE_ID:', SLICE_ID);
  }, [SLICE_ID]);

  const resetChartState = useCallback(() => {
    setFormData(null);
    setQueriesResponse([]);
    setChartStatus('loading');
    setIsLoading(true);
  }, []);

  const fetchChartData = useCallback(async (formDataResponse: any) => {
    try {
      let chartDataResponse;
      const vizType = formDataResponse.viz_type;

      if (vizType === 'deck_multi') {
        // For deck_multi visualizations, use explore_json endpoint
        chartDataResponse = await SupersetClient.post({
          endpoint: `/superset/explore_json/?form_data=${JSON.stringify({"slice_id": SLICE_ID})}`,
          jsonPayload: formDataResponse,
        });
      } else {
        // For other visualizations, use the chart/data endpoint
        chartDataResponse = await SupersetClient.post({
          endpoint: `/api/v1/chart/data?form_data=${JSON.stringify({"slice_id": SLICE_ID})}`,
          jsonPayload: {
            datasource: formDataResponse.datasource,
            force: false,
            queries: [
              {
                filters: [],
                extras: {
                  having: '',
                  where: '',
                },
                applied_time_extras: {},
                columns: [],
                metrics: formDataResponse.metrics || [],
                annotation_layers: [],
                series_limit: 0,
                order_desc: true,
                url_params: {
                  slice_id: SLICE_ID.toString(),
                },
                custom_params: {},
                custom_form_data: {},
              },
            ],
            form_data: formDataResponse,
            result_format: 'json',
            result_type: 'results',
          },
        });
      }

      logInfo('Received chart data:', chartDataResponse.json);
      setQueriesResponse([chartDataResponse.json]);
      setChartStatus('rendered');
    } catch (error) {
      logError('Failed to fetch chart data:', error);
      setChartStatus('failed');
      addDangerToast(t('Failed to fetch chart data'));
    }
  }, [SLICE_ID, addDangerToast]);

  const fetchFormData = useCallback(async () => {
    logInfo('Fetching form data for slice:', SLICE_ID);
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/form_data/?slice_id=${SLICE_ID}`,
      });

      // Format the form data with proper datasource structure
      const [datasourceId, datasourceType] = (response.json.datasource as string).split('__');
      const formattedFormData = {
        ...response.json,
        datasource: {
          id: parseInt(datasourceId, 10),
          type: datasourceType,
        },
      };
      
      logInfo('Received form data:', formattedFormData);
      setFormData(formattedFormData);
      
      // After getting form data, fetch the chart data
      await fetchChartData(formattedFormData);
      setIsLoading(false);
    } catch (error) {
      logError('Failed to fetch form data:', error);
      setChartStatus('failed');
      addDangerToast(t('Failed to fetch form data'));
      setIsLoading(false);
    }
  }, [SLICE_ID, addDangerToast, fetchChartData]);

  useEffect(() => {
    if (showFullChart) {
      fetchFormData();
    }

    return () => {
      logInfo('Cleaning up chart component');
    };
  }, [showFullChart, fetchFormData]);

  const handleQuery = () => {
    logInfo('Chart query triggered');
    setChartStatus('loading');
    if (formData) {
      fetchChartData(formData);
    }
  };

  const toggleView = useCallback(() => {
    // First update the state
    setShowFullChart(prevState => !prevState);
    
    // Then handle the state reset if needed
    if (showFullChart) {
      // Switching to dashboard
      resetChartState();
    } else {
      // Switching to chart, set loading state
      setIsLoading(true);
    }
  }, [showFullChart, resetChartState]);

  // Get the height of the window
  const windowHeight = window.innerHeight - 50;

  return (
    <>
      <FloatingToggle onClick={toggleView}>
        {showFullChart ? 'Show Dashboard' : 'Show Full Chart'}
      </FloatingToggle>
      
      <div style={{ width: '100%', height: '100%', display: showFullChart ? 'block' : 'none' }}>
        {isLoading ? (
          <div>Loading...</div>
        ) : !formData ? (
          <div>No chart data found</div>
        ) : (
          <ChartContainer
            key={`chart-${SLICE_ID}`}
            chartId={SLICE_ID}
            formData={formData}
            width="100%"
            height={windowHeight}
            chartType={formData.viz_type}
            datasource={formData.datasource}
            ownState={null}
            filterState={null}
            behaviors={[]}
            queriesResponse={queriesResponse}
            chartStatus={chartStatus}
            onQuery={handleQuery}
            chartIsStale={false}
            onChartRender={() => {
              logInfo('Chart rendered successfully');
              setChartStatus('rendered');
            }}
            onChartError={(error) => {
              logError('Chart render error:', error);
              setChartStatus('failed');
            }}
          />
        )}
      </div>
      
      <div style={{ width: '100%', height: '100%', display: showFullChart ? 'none' : 'block' }}>
        <DashboardPageWrapper idOrSlug="overview" />
      </div>
    </>
  );
}

export default withToasts(Welcome);
