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
import { useDispatch, useSelector } from 'react-redux';
import { exploreJSON } from 'src/components/Chart/chartAction';
import { RootState } from 'src/views/store';
import * as rison from 'rison';
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
  const dispatch = useDispatch();
  const [chartId, setChartId] = useState<number | null>(null);
  const [localFormData, setLocalFormData] = useState<any | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const chartState = useSelector((state: RootState) => 
    chartId ? state.charts?.[chartId] : null
  );

  const {
    chartStatus = 'loading',
    queriesResponse = null,
    chartAlert = null,
    lastRendered = 0,
  } = chartState || {};
  
  const isLoading = initialLoading || !localFormData || !chartState || chartStatus === 'loading';

  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const prevDimensionsRef = useRef({ width: 0, height: 0 });
  const dimensionUpdateCount = useRef(0);
  const hasSignaledLoad = useRef(false);

  const calculateDimensions = useCallback(() => {
    if (!containerRef.current) return false;

    dimensionUpdateCount.current += 1;
    const updateId = dimensionUpdateCount.current;

    try {
      const containerRect = containerRef.current.getBoundingClientRect();
      const navBarHeight = containerRect.top;
      const viewportHeight = window.innerHeight;
      
      const availableHeight = fillHeight ? viewportHeight - navBarHeight : containerRect.height;
      const availableWidth = containerRect.width;
      
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
      onError?.(error as Error);
      return false;
    }
  }, [fillHeight, onError]);

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
      const currentRef = containerRef.current;
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [calculateDimensions]);

  const fetchChartBySlugAndDispatch = useCallback(async () => {
    setInitialLoading(true);
    setLocalFormData(null);
    setChartId(null);
    hasSignaledLoad.current = false;
    try {
      if (!slug || typeof slug !== 'string' || slug.trim() === '') {
        console.error(`Attempted to fetch chart with invalid slug: '${slug}'`);
        onError?.(new Error(`Invalid or missing slug provided: '${slug}'. Cannot fetch chart.`));
        setInitialLoading(false);
        return;
      }
      
      const query = rison.encode({
        filters: [{ col: 'slug', opr: 'eq', value: slug }],
      });
      console.log(`Fetching chart metadata for slug: '${slug}', RISON query: ${query}`);

      const chartResponse = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${query}`,
      });

      if (!chartResponse.json.result || chartResponse.json.result.length === 0) {
        throw new Error(t('Chart with this slug was not found'));
      }
      const chartMetadata = chartResponse.json.result[0];
      const fetchedChartId = chartMetadata.id;
      setChartId(fetchedChartId);

      const formDataResponse = await SupersetClient.get({
         endpoint: `/api/v1/form_data/?slice_id=${fetchedChartId}`,
      });

      const fetchedFormData = formDataResponse.json;
      setLocalFormData(fetchedFormData);

      if (fetchedChartId && fetchedFormData) {
         dispatch(
           exploreJSON(
             fetchedFormData,
             false,
             undefined,
             fetchedChartId,
             undefined,
             undefined
           ),
         );
      } else {
         throw new Error(t('Could not retrieve chart ID or form data.'));
      }

    } catch (error) {
      console.error('Error fetching chart by slug or dispatching exploreJSON:', error);
      onError?.(error as Error);
      setChartId(null);
    } finally {
      setInitialLoading(false);
    }
  }, [slug, dispatch, onError]);

  useEffect(() => {
    fetchChartBySlugAndDispatch();
  }, [fetchChartBySlugAndDispatch]);

  useEffect(() => {
    if (chartStatus === 'rendered' || chartStatus === 'success') {
       if (!hasSignaledLoad.current) {
          onChartLoad?.();
          hasSignaledLoad.current = true;
          setTimeout(calculateDimensions, 100); 
       }
    } else if (chartStatus === 'failed') {
       console.error('Chart rendering failed (via Redux state):', chartAlert);
    }
  }, [chartStatus, chartAlert, onChartLoad, calculateDimensions]);

  console.log('trying to render chart id', chartId);
  console.log('formData', localFormData);
  console.log('queriesResponse', queriesResponse);

  return (
    <ResponsiveContainer
      ref={containerRef}
      fillHeight={fillHeight}
      className={className}
    >
      {isLoading ? (
        <div>Loading...</div>
      ) : !localFormData || !queriesResponse ? (
        <div>{chartAlert || t('Chart form data or query data not available.')}</div>
      ) : (
        <ChartSlugContainer
          key={`chart-${chartId}-${chartDimensions.width}-${chartDimensions.height}-${lastRendered}`}
          id={chartId}
          formData={localFormData}
          queriesResponse={queriesResponse}
          chartStatus={chartStatus}
          chartAlert={chartAlert}
          width={chartDimensions.width}
          height={chartDimensions.height}
          onChartLoad={onChartLoad}
        />
      )}
    </ResponsiveContainer>
  );
}

export default ResponsiveChartSlug; 