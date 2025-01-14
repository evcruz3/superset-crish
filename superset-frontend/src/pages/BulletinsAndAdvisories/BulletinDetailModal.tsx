import React, { useState, useEffect } from 'react';
import { Modal, Tag } from 'antd';
import { styled, t, isFeatureEnabled, FeatureFlag, SupersetClient } from '@superset-ui/core';
import moment from 'moment';
import { Bulletin } from './types';
import BulletinChart from './BulletinChart';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';

const FALLBACK_THUMBNAIL_URL = '/static/assets/images/chart-card-fallback.svg';

const StyledModal = styled(Modal)`
  .bulletin-title {
    font-size: ${({ theme }) => theme.typography.sizes.xl}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
  
  .bulletin-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
  
  .bulletin-content {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    white-space: pre-wrap;
  }
  
  .bulletin-chart {
    margin: ${({ theme }) => theme.gridUnit * 4}px 0;
    height: 400px;
    position: relative;
    
    .gradient-container {
      position: relative;
      height: 100%;
    }
  }
  
  .bulletin-hashtags {
    margin-top: ${({ theme }) => theme.gridUnit * 4}px;
    
    .ant-tag {
      margin-right: ${({ theme }) => theme.gridUnit * 1}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
    }
  }
`;

interface BulletinDetailModalProps {
  bulletin: Bulletin | null;
  onClose: () => void;
}

export default function BulletinDetailModal({ bulletin, onClose }: BulletinDetailModalProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');

  useEffect(() => {
    const fetchThumbnailUrl = async () => {
      if (bulletin?.chart_id) {
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
      } else {
        setThumbnailUrl('');
      }
    };

    fetchThumbnailUrl();
  }, [bulletin?.chart_id]);

  if (!bulletin) return null;

  const hashtags = bulletin.hashtags?.split(',').map(tag => tag.trim()) || [];

  return (
    <StyledModal
      visible={!!bulletin}
      onCancel={onClose}
      width={800}
      footer={null}
      title={null}
    >
      <div className="bulletin-title">{bulletin.title}</div>
      <div className="bulletin-meta">
        {bulletin.created_by && (
          <>
            {t('Posted by')} {`${bulletin.created_by.first_name} ${bulletin.created_by.last_name}`}{' '}
          </>
        )}
        {bulletin.created_on && (
          <>
            {t('on')} {moment(bulletin.created_on).format('MMMM D, YYYY')}
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
          <div style={{ height: '400px' }}></div>
        )}
      </div>
      {hashtags.length > 0 && (
        <div className="bulletin-hashtags">
          {hashtags.map(tag => (
            <Tag key={tag}>#{tag}</Tag>
          ))}
        </div>
      )}
    </StyledModal>
  );
} 