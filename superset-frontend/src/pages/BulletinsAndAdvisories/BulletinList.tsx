import React, { useState } from 'react';
import { Card, List, Tag, Tooltip } from 'antd';
import moment from 'moment';
import { t, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { DownloadOutlined, MailOutlined } from '@ant-design/icons';
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

  const handleDownloadPdf = async (bulletinId: number, bulletinTitle: string) => {
    try {
      const response = await fetch(`/api/v1/bulletins_and_advisories/${bulletinId}/pdf/`);
      if (!response.ok) {
        // TODO: Add user-friendly error notification (e.g., Antd message.error)
        console.error('Failed to download PDF', response.statusText);
        throw new Error('Failed to download PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitizedTitle = (bulletinTitle || 'bulletin').replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
      a.download = `bulletin_${sanitizedTitle}_${bulletinId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      // TODO: Add user-friendly error notification
    }
  };

  const renderBulletin = (bulletin: Bulletin) => (
    <List.Item>
      <StyledCard
        title={bulletin.title}
      >
        <div 
          className="bulletin-content" 
          onClick={() => handleBulletinClick(bulletin)} 
          style={{ cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBulletinClick(bulletin);}}
        >
          {bulletin.advisory || ''}
        </div>
        <p>
          <small>
            {(bulletin.hashtags || '').split(',').map(tag => (
              <Tag key={tag}>{tag.trim()}</Tag>
            ))}
          </small>
        </p>
        <div className="bulletin-chart">
          {!isFeatureEnabled(FeatureFlag.Thumbnails) ? (
            bulletin.chart_id !== null ? <BulletinChart chartId={bulletin.chart_id} /> : null
          ) : (
            <div className="gradient-container" style={{ height: '100%', position: 'relative' }}>
              <ImageLoader
                src={bulletin.thumbnail_url || ''}
                fallback={bulletin.chart_id ? '/static/assets/images/chart-card-fallback.svg' : '/static/assets/images/placeholder-chart.png'}
                isLoading={!!(bulletin.chart_id && !bulletin.thumbnail_url)}
                position="top"
              />
            </div>
          )}
        </div>
        <div className="bulletin-meta">
          <small>
            {t('Created by')} {bulletin.created_by.first_name} {bulletin.created_by.last_name} {' '}
            {moment(bulletin.created_on).fromNow()}
          </small>
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '16px', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Tooltip title={t('Disseminate Bulletin')}>
            <MailOutlined
              onClick={(e) => {
                e.stopPropagation();
                handleBulletinClick(bulletin);
              }}
              style={{ fontSize: '18px', cursor: 'pointer', color: '#555' }}
              aria-label={t('Disseminate Bulletin')}
            />
          </Tooltip>
          <Tooltip title={t('Download PDF')}>
            <DownloadOutlined
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPdf(bulletin.id, bulletin.title);
              }}
              style={{ fontSize: '18px', cursor: 'pointer', color: '#555' }}
              aria-label={t('Download PDF')}
            />
          </Tooltip>
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