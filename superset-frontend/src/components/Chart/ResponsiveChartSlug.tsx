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
import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { styled, t, SupersetClient } from '@superset-ui/core';
import { ChartSlugContainer } from './chartSlugComponents';

const ResponsiveContainer = styled.div<{ fillHeight?: boolean }>`
  width: 100%;
  height: ${({ fillHeight }) => (fillHeight ? '100%' : 'auto')};
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

interface ResponsiveChartSlugProps {
  slug: string;
  fillHeight?: boolean;
  className?: string;
  onError?: (error: Error) => void;
  onChartLoad?: () => void;
}

export function ResponsiveChartSlug({
  slug,
  fillHeight = true,
  className,
  onError,
  onChartLoad,
}: ResponsiveChartSlugProps) {
  const [formData, setFormData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartStatus, setChartStatus] = useState<'loading' | 'rendered' | 'failed'>('loading');
  const [queriesResponse, setQueriesResponse] = useState<any[]>([]);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  
  // Reference to the chart container div
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Store previous dimensions for comparison
  const prevDimensionsRef = useRef({ width: 0, height: 0 });
  
  // Use a counter to track dimension updates
  const dimensionUpdateCount = useRef(0);

  const calculateDimensions = useCallback(() => {
    if (!containerRef.current) return false;

    dimensionUpdateCount.current += 1;
    const updateId = dimensionUpdateCount.current;

    try {
      const containerRect = containerRef.current.getBoundingClientRect();
      const navBarHeight = containerRect.top;
      const viewportHeight = window.innerHeight;
      
      // Calculate the exact available space
      const availableHeight = fillHeight ? viewportHeight - navBarHeight : containerRect.height;
      const availableWidth = containerRect.width;
      
      // Only update if dimensions changed by at least 1px
      const widthDiff = Math.abs(availableWidth - prevDimensionsRef.current.width);
      const heightDiff = Math.abs(availableHeight - prevDimensionsRef.current.height);
      
      if (widthDiff >= 1 || heightDiff >= 1) {
        prevDimensionsRef.current = { width: availableWidth, height: availableHeight };
        setChartDimensions({ width: availableWidth, height: availableHeight });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error calculating dimensions:', error);
      return false;
    }
  }, [fillHeight]);

  // Set up resize observer and dimension calculation
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    calculateDimensions();
    
    const resizeObserver = new ResizeObserver(() => {
      calculateDimensions();
    });
    
    resizeObserver.observe(containerRef.current);
    
    const handleResize = () => {
      calculateDimensions();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDimensions]);

  const fetchChartData = useCallback(async (chartId: number, formDataResponse: any) => {
    try {
      let chartDataResponse;
      const vizType = formDataResponse.viz_type;

      if (vizType === 'deck_multi') {
        chartDataResponse = await SupersetClient.post({
          endpoint: `/superset/explore_json/?form_data=${JSON.stringify({"slice_id": chartId})}`,
          jsonPayload: formDataResponse,
        });
      } else {
        chartDataResponse = await SupersetClient.post({
          endpoint: `/api/v1/chart/explore_json?form_data=${JSON.stringify({"slice_id": chartId})}`,
          jsonPayload: {
            datasource: formDataResponse.datasource,
            force: false,
            queries: [
              {
                filters: [],
                extras: { having: '', where: '' },
                applied_time_extras: {},
                columns: [],
                metrics: formDataResponse.metrics || [],
                annotation_layers: [],
                series_limit: 0,
                order_desc: true,
                url_params: { slice_id: chartId.toString() },
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

      setQueriesResponse([chartDataResponse.json]);
      setChartStatus('rendered');
      onChartLoad?.();
    } catch (error) {
      setChartStatus('failed');
      onError?.(error as Error);
    }
  }, [onError, onChartLoad]);

  const fetchChartBySlug = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // First fetch the chart using the slug
      const chartResponse = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${JSON.stringify({ 
          filters: [{ col: 'slug', opr: 'eq', value: slug }] 
        })}`,
      });
      
      if (!chartResponse.json.result || chartResponse.json.result.length === 0) {
        throw new Error(t('Chart with this slug was not found'));
      }
      
      const chartMetadata = chartResponse.json.result[0];
      
      // Get form data for the chart
      const formDataResponse = await SupersetClient.get({
        endpoint: `/api/v1/form_data/?slice_id=${chartMetadata.id}`,
      });

      // Format the form data with proper datasource structure
      const [datasourceId, datasourceType] = (formDataResponse.json.datasource as string).split('__');
      const formattedFormData = {
        ...formDataResponse.json,
        datasource: {
          id: parseInt(datasourceId, 10),
          type: datasourceType,
        },
      };
      
      setFormData(formattedFormData);
      
      // After getting form data, fetch the chart data
      await fetchChartData(chartMetadata.id, formattedFormData);
    } catch (error) {
      onError?.(error as Error);
      setChartStatus('failed');
    } finally {
      setIsLoading(false);
    }
  }, [slug, fetchChartData, onError]);

  // Fetch chart data when slug changes
  useEffect(() => {
    fetchChartBySlug();
  }, [fetchChartBySlug]);

  return (
    <ResponsiveContainer 
      ref={containerRef} 
      fillHeight={fillHeight}
      className={className}
    >
      {isLoading ? (
        <div>Loading...</div>
      ) : !formData ? (
        <div>No chart data found</div>
      ) : (
        <ChartSlugContainer
          key={`chart-${slug}-${chartDimensions.width}-${chartDimensions.height}`}
          slug={slug}
          formData={formData}
          width={chartDimensions.width}
          height={chartDimensions.height}
          vizType={formData.viz_type}
          triggerRender={true}
          filterState={null}
          queriesResponse={queriesResponse}
          onChartRender={() => {
            setChartStatus('rendered');
            onChartLoad?.();
            // Recalculate dimensions after render
            setTimeout(calculateDimensions, 100);
          }}
          onChartError={(error: any) => {
            setChartStatus('failed');
            onError?.(error);
          }}
        />
      )}
    </ResponsiveContainer>
  );
}

export default ResponsiveChartSlug; 