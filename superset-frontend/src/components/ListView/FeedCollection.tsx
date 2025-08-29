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
import { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import { TableInstance, Row } from 'react-table';
import { styled, t } from '@superset-ui/core';
import cx from 'classnames';

// Define an interface for the items in the feed
interface FeedItem {
  id: string | number; // Assuming id is present for key and scrolling
  title?: string;
  name?: string;
  label?: string;
  [key: string]: any; // Allow other properties
}

interface FeedCollectionProps {
  bulkSelectEnabled?: boolean;
  loading: boolean;
  prepareRow: TableInstance<FeedItem>['prepareRow'];
  renderCard?: (row: any) => ReactNode;
  rows: TableInstance<FeedItem>['rows'];
  // showThumbnails is not directly used in FeedCollection's structure but kept for prop consistency if renderCard expects it
  showThumbnails?: boolean;
}

const FeedPageContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
`;

const FeedSidebar = styled.div`
  ${({ theme }) => `
    width: 300px; // Adjusted width for the sidebar
    padding: ${theme.gridUnit * 4}px;
    background-color: ${theme.colors.grayscale.light4};
    border-right: 1px solid ${theme.colors.grayscale.light2};
    max-height: calc(100vh - 200px); // Adjust max-height to be more responsive to viewport
    overflow-y: auto;
    flex-shrink: 0;

    h4 {
      margin-top: 0;
      margin-bottom: ${theme.gridUnit * 4}px;
      font-weight: ${theme.typography.weights.bold};
      font-size: ${theme.typography.sizes.m}px;
      color: ${theme.colors.grayscale.dark1};
    }

    /* Custom Scrollbar for Webkit browsers */
    &::-webkit-scrollbar {
      width: 8px;
    }
    &::-webkit-scrollbar-track {
      background: ${theme.colors.grayscale.light3};
    }
    &::-webkit-scrollbar-thumb {
      background-color: ${theme.colors.grayscale.base};
      border-radius: 4px;
      border: 2px solid ${theme.colors.grayscale.light3};
    }
  `}
`;

const SidebarItem = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 2.5}px ${theme.gridUnit * 3}px;
    margin-bottom: ${theme.gridUnit * 2}px;
    cursor: pointer;
    border-radius: ${theme.borderRadius}px;
    transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
    color: ${theme.colors.grayscale.dark1};

    &:hover {
      background-color: ${theme.colors.primary.light4};
      color: ${theme.colors.primary.dark1};
    }
    &.active {
      background-color: ${theme.colors.primary.light3};
      color: ${theme.colors.primary.dark2};
      font-weight: ${theme.typography.weights.bold};
      box-shadow: inset 3px 0 0 0 ${theme.colors.primary.base};
    }
  `}
`;

const FeedContentContainer = styled.div`
  ${({ theme }) => `
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${theme.gridUnit * 6}px; // Increased gap for better separation
    padding: ${theme.gridUnit * 6}px;
    overflow-y: auto;
    max-height: calc(100vh - 200px); // Consistent with sidebar

    /* Custom Scrollbar for Webkit browsers */
    &::-webkit-scrollbar {
      width: 8px;
    }
    &::-webkit-scrollbar-track {
      background: ${theme.colors.grayscale.light5};
    }
    &::-webkit-scrollbar-thumb {
      background-color: ${theme.colors.grayscale.light1};
      border-radius: 4px;
      border: 2px solid ${theme.colors.grayscale.light5};
    }
  `}
`;

const FeedItemWrapper = styled.div`
  ${({ theme }) => `
    border-radius: ${theme.borderRadius * 2}px;
    width: 100%;
    max-width: 750px;
    height: auto;
    &.bulk-select {
      cursor: pointer;
    }
  `}
`;

export default function FeedCollection({
  bulkSelectEnabled,
  loading,
  prepareRow,
  renderCard,
  rows,
  showThumbnails,
}: FeedCollectionProps) {
  function handleBulkSelectClick(
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    toggleRowSelected: Row['toggleRowSelected'],
  ) {
    if (bulkSelectEnabled) {
      event.preventDefault();
      event.stopPropagation();
      toggleRowSelected();
    }
  }

  const handleSidebarItemClick = (rowId: string) => {
    const element = document.getElementById(`feed-item-${rowId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!renderCard) return null;

  return (
    <FeedPageContainer>
      {rows.length > 0 && (
        <FeedSidebar>
          {rows.map(row => {
            const original = row.original as FeedItem;
            const displayLabel =
              original?.title ||
              original?.name ||
              original?.label ||
              t('Item %(itemNumber)s', { itemNumber: row.index + 1 });
            return (
              <SidebarItem
                key={`sidebar-item-${row.id}`}
                onClick={() => handleSidebarItemClick(row.id)}
              >
                {displayLabel}
              </SidebarItem>
            );
          })}
        </FeedSidebar>
      )}
      <FeedContentContainer id="feed-content-container">
        {loading &&
          rows.length === 0 &&
          [...new Array(5)].map((_, i) => {
            const placeholderItem = {
              id: `placeholder-${i}`,
              loading: true,
            } as FeedItem & { loading?: boolean; showThumbnails?: boolean };
            return (
              <FeedItemWrapper key={`placeholder-wrapper-${i}`}>
                {renderCard(placeholderItem)}
              </FeedItemWrapper>
            );
          })}
        {rows.length > 0 &&
          rows.map(row => {
            prepareRow(row);
            return (
              <FeedItemWrapper
                id={`feed-item-${row.id}`}
                className={cx({
                  'bulk-select': bulkSelectEnabled,
                })}
                key={row.id}
                onClick={e => handleBulkSelectClick(e, row.toggleRowSelected)}
                role="none"
              >
                {renderCard({
                  ...(row.original as FeedItem),
                  loading,
                  showThumbnails,
                  isSelected: row.isSelected,
                })}
              </FeedItemWrapper>
            );
          })}
      </FeedContentContainer>
    </FeedPageContainer>
  );
}
