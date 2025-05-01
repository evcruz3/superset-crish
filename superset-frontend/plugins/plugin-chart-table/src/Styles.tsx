/*
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

import { css, styled } from '@superset-ui/core';

export default styled.div`
  ${({ theme }) => css`
    table {
      width: 100%;
      min-width: auto;
      max-width: none;
      margin: 0;
    }

    th,
    td {
      min-width: 4.3em;
    }

    thead > tr > th {
      padding-right: 0;
      position: relative;
      background: ${theme.colors.grayscale.light5};
      text-align: left;
    }
    th svg {
      color: ${theme.colors.grayscale.light2};
      margin: ${theme.gridUnit / 2}px;
    }
    th.is-sorted svg {
      color: ${theme.colors.grayscale.base};
    }
    .table > tbody > tr:first-of-type > td,
    .table > tbody > tr:first-of-type > th {
      border-top: 0;
    }

    .table > tbody tr td {
      font-feature-settings: 'tnum' 1;
    }

    .dt-controls {
      padding-bottom: 0.65em;
    }
    .dt-metric {
      text-align: right;
    }
    .dt-totals {
      font-weight: ${theme.typography.weights.bold};
    }
    .dt-is-null {
      color: ${theme.colors.grayscale.light1};
    }
    td.dt-is-filter {
      cursor: pointer;
    }
    td.dt-is-filter:hover {
      background-color: ${theme.colors.secondary.light4};
    }
    td.dt-is-active-filter,
    td.dt-is-active-filter:hover {
      background-color: ${theme.colors.secondary.light3};
    }

    .dt-global-filter {
      float: right;
    }

    .dt-column-filter {
      margin-top: ${theme.gridUnit}px;
      padding: ${theme.gridUnit}px;
      width: 100%;
    }

    .dt-filter-info {
      padding: ${theme.gridUnit * 3}px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background-color: ${theme.colors.grayscale.light4};
      border-radius: ${theme.borderRadius}px;
      margin-bottom: ${theme.gridUnit * 2}px;
      min-height: ${theme.gridUnit * 12}px;
    }

    .dt-filter-info > div {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      max-width: 80%;
    }

    .filter-badge {
      background-color: ${theme.colors.primary.base};
      color: ${theme.colors.grayscale.light5};
      padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
      border-radius: ${theme.borderRadius}px;
      flex-shrink: 0;
    }

    .filter-info-text {
      margin-left: ${theme.gridUnit * 2}px;
      color: ${theme.colors.grayscale.dark1};
      font-size: ${theme.typography.sizes.s}px;
      line-height: 1.4;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .clear-filters-button {
      border: 1px solid ${theme.colors.primary.base};
      color: ${theme.colors.primary.base};
      background-color: transparent;
      border-radius: ${theme.borderRadius}px;
      padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px;
      cursor: pointer;
      &:hover {
        background-color: ${theme.colors.primary.light4};
      }
    }

    .dt-truncate-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dt-truncate-cell:hover {
      overflow: visible;
      white-space: normal;
      height: auto;
    }

    .dt-pagination {
      text-align: right;
      /* use padding instead of margin so clientHeight can capture it */
      padding-top: 0.5em;
    }
    .dt-pagination .pagination {
      margin: 0;
    }

    .pagination > li > span.dt-pagination-ellipsis:focus,
    .pagination > li > span.dt-pagination-ellipsis:hover {
      background: ${theme.colors.grayscale.light5};
    }

    .dt-no-results {
      text-align: center;
      padding: 1em 0.6em;
    }

    .right-border-only {
      border-right: 2px solid ${theme.colors.grayscale.light2};
    }
    table .right-border-only:last-child {
      border-right: none;
    }
  `}
`;
