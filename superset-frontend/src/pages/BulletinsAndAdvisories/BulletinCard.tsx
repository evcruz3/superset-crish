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
  height: 600px;
  display: flex;
  flex-direction: column;
  
  .ant-card-body {
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
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
    flex-shrink: 0;
  }
  
  .bulletin-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    flex-shrink: 0;
  }

  .bulletin-content {
    flex: 1;
    overflow-y: auto;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    
    /* Hide scrollbar by default */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none;  /* IE and Edge */
    &::-webkit-scrollbar {
      width: 0;
      background: transparent;
    }
  }

  /* Show scrollbar only when hovering over the card */
  &:hover .bulletin-content {
    scrollbar-width: thin; /* Firefox */
    -ms-overflow-style: auto;  /* IE and Edge */
    
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.grayscale.light2};
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-track {
      background: ${({ theme }) => theme.colors.grayscale.light4};
      border-radius: 3px;
    }
  }
  
  .bulletin-section {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;

    .section-title {
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
      color: ${({ theme }) => theme.colors.grayscale.dark1};
      padding: ${({ theme }) => theme.gridUnit * 2}px;
      border-radius: ${({ theme }) => theme.gridUnit}px;
    }

    .section-content {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4em;
      min-height: 4.2em;
      color: ${({ theme }) => theme.colors.grayscale.dark2};
      padding: ${({ theme }) => theme.gridUnit * 2}px ${({ theme }) => theme.gridUnit * 2}px 0;
    }

    &.advisory-section .section-title {
      background-color: ${({ theme }) => theme.colors.primary.light1}15;
    }

    &.risks-section .section-title {
      background-color: ${({ theme }) => theme.colors.warning.light1}15;
    }

    &.safety-tips-section .section-title {
      background-color: ${({ theme }) => theme.colors.success.light1}15;
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

  .bulletin-hashtags {
    margin-top: auto;
    padding-top: ${({ theme }) => theme.gridUnit * 2}px;
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light3};
    flex-shrink: 0;
    
    .ant-tag {
      margin-right: ${({ theme }) => theme.gridUnit * 1}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
      background-color: ${({ theme }) => theme.colors.primary.light1}15;
      border: 1px solid ${({ theme }) => theme.colors.primary.light1};
      border-radius: ${({ theme }) => theme.gridUnit}px;
      color: ${({ theme }) => theme.colors.primary.dark1};
      font-weight: ${({ theme }) => theme.typography.weights.normal};
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
          {bulletin.created_by ? (
            <>
              {t('Posted by')} {`${bulletin.created_by.first_name} ${bulletin.created_by.last_name}`}{' • '}
            </>
          ) : null}
          {bulletin.created_on && (
            <>
              {moment(bulletin.created_on).fromNow()}
            </>
          )}
        </div>
        <div className="bulletin-content">
          <div className="bulletin-section advisory-section">
            <div className="section-title">{t('Advisory')}</div>
            <div className="section-content">{bulletin.advisory}</div>
          </div>
          <div className="bulletin-section risks-section">
            <div className="section-title">{t('Risks')}</div>
            <div className="section-content">{bulletin.risks}</div>
          </div>
          <div className="bulletin-section safety-tips-section">
            <div className="section-title">{t('Safety Tips')}</div>
            <div className="section-content">{bulletin.safety_tips}</div>
          </div>
          <div className="bulletin-chart">
            {!isFeatureEnabled(FeatureFlag.Thumbnails) ? (
              bulletin.chart_id ? (
                <BulletinChart chartId={bulletin.chart_id} />
              ) : (
                <div style={{ height: '200px' }}></div>
              )
            ) : bulletin.chart_id ? (
              <ImageLoader
                src={thumbnailUrl || ''}
                fallback={FALLBACK_THUMBNAIL_URL}
                isLoading={!!bulletin.chart_id && !thumbnailUrl}
                position="top"
              />
            ) : (
              <div style={{ height: '200px' }}></div>
            )}
          </div>
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