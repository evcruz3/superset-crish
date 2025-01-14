import React from 'react';
import { Modal, Tag } from 'antd';
import { styled, t, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import moment from 'moment';
import { Bulletin } from './types';
import BulletinChart from './BulletinChart';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';

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
        ) : (
          <ImageLoader
            src={bulletin.thumbnail_url || ''}
            fallback={bulletin.chart_id ? '/static/assets/images/chart-card-fallback.svg' : '/static/assets/images/placeholder-chart.png'}
            isLoading={bulletin.chart_id && !bulletin.thumbnail_url}
            position="top"
          />
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