import React, { useState, useEffect } from 'react';
import { styled, t, isFeatureEnabled, FeatureFlag, SupersetClient } from '@superset-ui/core';
import { Card, Tag } from 'antd';
import { Bulletin } from './types';
import BulletinChart from './BulletinChart';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';
import BulletinDetailModal from './BulletinDetailModal';
import moment from 'moment';

const FALLBACK_THUMBNAIL_URL = '/static/assets/images/chart-card-fallback.svg';

interface BulletinCardProps {
  bulletin: Bulletin;
  hasPerm: (perm: string) => boolean;
  bulkSelectEnabled: boolean;
}

const StyledCard = styled(Card)`
  width: 100%;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  height: 500px;
  display: flex;
  flex-direction: column;
  
  .ant-card-body {
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .bulletin-title {
    font-size: ${({ theme }) => theme.typography.sizes.xl}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
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
  }
  
  .bulletin-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    flex-shrink: 0;
  }
  
  .bulletin-content {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4em;
    min-height: 4.2em;
    max-height: 4.2em;
    padding-bottom: 0;
    margin-top: 0;
  }
  
  .bulletin-hashtags {
    margin-top: auto;
    padding-top: ${({ theme }) => theme.gridUnit * 2}px;
    
    .ant-tag {
      margin-right: ${({ theme }) => theme.gridUnit * 1}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
    }
  }

  .bulletin-chart {
    margin: ${({ theme }) => theme.gridUnit * 4}px 0;
    height: 200px;
    position: relative;
    flex-shrink: 0;
    
    .gradient-container {
      position: relative;
      height: 100%;
    }
  }
`;

export default function BulletinCard({ 
  bulletin,
  hasPerm,
  bulkSelectEnabled,
}: BulletinCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    const fetchThumbnailUrl = async () => {
      if (bulletin.chart_id) {
        try {
          const response = await SupersetClient.get({
            endpoint: `/api/v1/chart/${bulletin.chart_id}`,
          });
          const chartData = response.json.result;
          if (chartData.thumbnail_url) {
            const fullThumbnailUrl = chartData.thumbnail_url.startsWith('/')
              ? `${window.location.origin}${chartData.thumbnail_url}`
              : chartData.thumbnail_url;
            setThumbnailUrl(fullThumbnailUrl);
          }
        } catch (error) {
          // Handle error silently and fallback to BulletinChart
          setThumbnailUrl('');
        }
      }
    };

    fetchThumbnailUrl();
  }, [bulletin.chart_id]);

  if (!bulletin) return null;

  const hashtags = bulletin.hashtags?.split(',').map(tag => tag.trim()) || [];
  
  const handleClick = () => {
    if (!bulkSelectEnabled) {
      setShowModal(true);
    }
  };
  
  return (
    <>
      <StyledCard onClick={handleClick}>
        <div className="bulletin-title">{bulletin.title}</div>
        <div className="bulletin-meta">
          {bulletin.created_by && (
            <>
              {t('Posted by')} {`${bulletin.created_by.first_name} ${bulletin.created_by.last_name}`}{' '}
            </>
          )}
          {bulletin.created_on && (
            <>
              {moment(bulletin.created_on).fromNow()}
            </>
          )}
        </div>
        <div className="bulletin-content">{bulletin.message}</div>
        <div className="bulletin-chart">
          {!isFeatureEnabled(FeatureFlag.Thumbnails) ? (
            <BulletinChart chartId={bulletin.chart_id} />
          ) : bulletin.chart_id ? (
            <ImageLoader
              src={thumbnailUrl || ''}
              fallback={FALLBACK_THUMBNAIL_URL}
              isLoading={bulletin.chart_id && !thumbnailUrl}
              position="top"
            />
          ) : (
            <div style={{ height: '200px' }}></div>
          )}
        </div>
        {hashtags.length > 0 && (
          <div className="bulletin-hashtags">
            {hashtags.map(tag => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
          </div>
        )}
      </StyledCard>
      <BulletinDetailModal 
        bulletin={showModal ? bulletin : null}
        onClose={() => setShowModal(false)}
      />
    </>
  );
} 