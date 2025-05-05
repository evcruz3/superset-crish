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
import { t } from '@superset-ui/core';

import Chart from './Chart';
import ErrorBoundary from '../ErrorBoundary';
import * as actions from './chartAction';
import { logEvent } from '../../logger/actions';
import { updateDataMask } from '../../dataMask/actions';

/**
 * ChartSlugContainer receives chart data props (id, formData, queriesResponse, etc.)
 * and renders the core Chart component.
 */
const propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  actions: PropTypes.object.isRequired,
  height: PropTypes.number,
  width: PropTypes.number,
  setControlValue: PropTypes.func,
  triggerRender: PropTypes.bool,
  formData: PropTypes.object.isRequired,
  queriesResponse: PropTypes.array,
  chartStatus: PropTypes.string,
  chartAlert: PropTypes.string,
  filterState: PropTypes.object,
  onChartLoad: PropTypes.func,
};

export function ChartSlugComponent({
  id,
  actions,
  height,
  width,
  setControlValue,
  triggerRender,
  formData,
  queriesResponse,
  chartStatus,
  chartAlert,
  filterState,
  onChartLoad,
  ...restProps
}) {
  if (chartStatus === 'failed') {
    return (
      <div style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorBoundary>
          <div className="alert alert-warning">
            {chartAlert || t('Failed to load chart')}
          </div>
        </ErrorBoundary>
      </div>
    );
  }

  return (
    <Chart
      id={id.toString()}
      height={height}
      width={width}
      setControlValue={setControlValue}
      vizType={formData?.viz_type}
      triggerRender={triggerRender}
      formData={formData}
      queriesResponse={queriesResponse}
      chartStatus={chartStatus}
      chartAlert={chartAlert}
      filterState={filterState}
      actions={actions}
      onQuery={onChartLoad}
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