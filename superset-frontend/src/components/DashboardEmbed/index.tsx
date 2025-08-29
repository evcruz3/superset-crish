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
 */
import { useEffect, useRef } from 'react';
import { styled, SupersetClient } from '@superset-ui/core';
import { embedDashboard } from '@superset-ui/embedded-sdk';

interface SimpleDashboardEmbedProps {
  dashboardId: string;
  showFilters?: boolean;
  hideTitle?: boolean;
  hideTab?: boolean;
  expandedFilters?: boolean;
  standalone?: number;
  height?: string;
}

const EmbedContainer = styled.div<{ height?: string }>`
  height: ${({ height }) => height || '100%'};
  min-height: ${({ height }) => height || '100vh'};
  width: 100%;
`;

export default function SimpleDashboardEmbed({
  dashboardId,
  showFilters = true,
  hideTitle = false,
  hideTab = false,
  expandedFilters = true,
  standalone = 2,
  height,
}: SimpleDashboardEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Get the CSRF token from the cookie
      const csrfToken = SupersetClient.get({
        endpoint: '/api/v1/csrf_token',
      }).then(({ json }) => json.result);

      embedDashboard({
        id: dashboardId,
        supersetDomain: window.location.origin,
        mountPoint: containerRef.current,
        // Use the existing session cookie for authentication
        fetchGuestToken: () => Promise.resolve(csrfToken),
        dashboardUiConfig: {
          hideTitle,
          hideTab,
          filters: {
            expanded: expandedFilters,
            visible: showFilters,
          },
          urlParams: {
            standalone,
          },
        },
      });
    }
  }, [
    dashboardId,
    showFilters,
    hideTitle,
    hideTab,
    expandedFilters,
    standalone,
  ]);

  return <EmbedContainer ref={containerRef} height={height} />;
}
