import React, { useState } from 'react';
import { Card, List, Tag } from 'antd';
import moment from 'moment';
import { t, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import BulletinChart from './BulletinChart';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';
import { Bulletin, BulletinApiResponse } from './types';
import { styled } from '@superset-ui/core';
import BulletinDetailModal from './BulletinDetailModal';

const StyledCard = styled(Card)`
  width: 100%;
  height: 500px;
  display: flex;
  flex-direction: column;

  .ant-card-head {
    flex-shrink: 0;
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    border-bottom: none;
    
    .ant-card-head-title {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4em;
      min-height: 2.8em;
      max-height: 2.8em;
      padding-bottom: 0;
      margin-top: 0;
      white-space: normal;
      font-size: ${({ theme }) => theme.typography.sizes.xl}px;
      font-weight: ${({ theme }) => theme.typography.weights.bold};
    }
  }

  .ant-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .bulletin-content {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4em;
    min-height: 4.2em;
    max-height: 4.2em;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    padding-bottom: 0;
    margin-top: 0;
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
  }

  .bulletin-chart {
    height: 200px;
    position: relative;
    flex-shrink: 0;
    margin: 16px 0;
  }

  .bulletin-meta {
    margin-top: auto;
    padding-top: 16px;
  }
`;

export default function BulletinList() {
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);

  const handlePageChange = async (page: number) => {
    // TODO: Implement pagination logic
  };

  const handleBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
  };

  const renderBulletin = (bulletin: Bulletin) => (
    <List.Item>
      <StyledCard
        title={bulletin.title}
        onClick={() => handleBulletinClick(bulletin)}
      >
        <div className="bulletin-content">{bulletin.message}</div>
        <p>
          <small>
            {bulletin.hashtags.split(',').map(tag => (
              <Tag key={tag}>{tag.trim()}</Tag>
            ))}
          </small>
        </p>
        <div className="bulletin-chart">
          {!isFeatureEnabled(FeatureFlag.Thumbnails) ? (
            <BulletinChart chartId={bulletin.chart_id} />
          ) : (
            <div className="gradient-container" style={{ height: '100%', position: 'relative' }}>
              <ImageLoader
                src={bulletin.thumbnail_url || ''}
                fallback={bulletin.chart_id ? '/static/assets/images/chart-card-fallback.svg' : '/static/assets/images/placeholder-chart.png'}
                isLoading={bulletin.chart_id && !bulletin.thumbnail_url}
                position="top"
              />
            </div>
          )}
        </div>
        <div className="bulletin-meta">
          <small>
            {t('Created by')} {bulletin.created_by.first_name} {bulletin.created_by.last_name} {t('on')}{' '}
            {moment(bulletin.created_on).format('MMMM D, YYYY')}
          </small>
        </div>
      </StyledCard>
    </List.Item>
  );

  return (
    <>
      <List
        dataSource={bulletins}
        renderItem={renderBulletin}
        pagination={{
          pageSize: 10,
          total: total,
          onChange: handlePageChange,
        }}
      />
      <BulletinDetailModal
        bulletin={selectedBulletin}
        onClose={() => setSelectedBulletin(null)}
      />
    </>
  );
} 