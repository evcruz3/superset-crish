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
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { t, SupersetClient } from '@superset-ui/core';

import Loading from '../Loading';
import Chart from './Chart';
import ErrorBoundary from '../ErrorBoundary';
import * as actions from './chartAction';
import { logEvent } from '../../logger/actions';
import { updateDataMask } from '../../dataMask/actions';

/**
 * ChartSlugContainer is a component that renders a chart using its slug 
 * instead of its ID. It fetches the chart data using the slug, then
 * renders the Chart component with the fetched data.
 */
const propTypes = {
  slug: PropTypes.string.isRequired,
  actions: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  vizType: PropTypes.string,
  triggerRender: PropTypes.bool,
  chartId: PropTypes.number,
  formData: PropTypes.object,
  filterState: PropTypes.object,
};

export function ChartSlugComponent({
  slug,
  actions,
  chartId,
  height,
  width,
  setControlValue,
  vizType,
  triggerRender,
  formData,
  filterState,
  ...restProps
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    const fetchChartBySlug = async () => {
      setLoading(true);
      try {
        // First, fetch the chart metadata using the slug
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/?q=${JSON.stringify({ filters: [{ col: 'slug', opr: 'eq', value: slug }] })}`,
        });

        if (!response.json.result || response.json.result.length === 0) {
          throw new Error(t('Chart with this slug was not found'));
        }

        // Get the first matching chart
        const chartMetadata = response.json.result[0];
        
        // Set the retrieved chart data
        setChartData(chartMetadata);
        setLoading(false);
      } catch (err) {
        setError(err.message || t('Failed to load chart'));
        setLoading(false);
      }
    };

    fetchChartBySlug();
  }, [slug]);

  if (loading) {
    return (
      <div style={{ height, width, position: 'relative' }}>
        <Loading position="absolute" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorBoundary>
          <div className="alert alert-warning">
            {error}
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  // If we have formData provided as a prop, use it
  // Otherwise, use the formData from the chart metadata
  const chartFormData = formData || JSON.parse(chartData.params || '{}');
  
  // If we have a chartId provided as a prop, use it
  // Otherwise, use the id from the chart metadata
  const id = chartId || chartData.id;

  return (
    <Chart
      id={id}
      height={height}
      width={width}
      setControlValue={setControlValue}
      vizType={vizType || chartData.viz_type}
      triggerRender={triggerRender}
      formData={chartFormData}
      filterState={filterState}
      actions={actions}
      {...restProps}
    />
  );
}

ChartSlugComponent.propTypes = propTypes;

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(
      {
        ...actions,
        updateDataMask,
        logEvent,
      },
      dispatch,
    ),
  };
}

export default connect(null, mapDispatchToProps)(ChartSlugComponent); 