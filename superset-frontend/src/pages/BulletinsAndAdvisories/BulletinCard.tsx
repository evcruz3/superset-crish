import React from 'react';
import { styled, t } from '@superset-ui/core';
import { Card, Tag } from 'antd';
import { Bulletin } from './types';
import BulletinChart from './BulletinChart';

interface BulletinCardProps {
  bulletin: Bulletin;
  hasPerm: (perm: string) => boolean;
  bulkSelectEnabled: boolean;
}

const StyledCard = styled(Card)`
  width: 100%;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  
  .ant-card-body {
    padding: ${({ theme }) => theme.gridUnit * 4}px;
  }
  
  .bulletin-title {
    font-size: ${({ theme }) => theme.typography.sizes.xl}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  
  .bulletin-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  
  .bulletin-content {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
  
  .bulletin-hashtags {
    margin-top: ${({ theme }) => theme.gridUnit * 2}px;
    
    .ant-tag {
      margin-right: ${({ theme }) => theme.gridUnit * 1}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
    }
  }

  .bulletin-chart {
    margin: ${({ theme }) => theme.gridUnit * 4}px 0;
  }
`;

export default function BulletinCard({ 
  bulletin,
  hasPerm,
  bulkSelectEnabled,
}: BulletinCardProps) {
  if (!bulletin) return null;

  const hashtags = bulletin.hashtags?.split(',').map(tag => tag.trim()) || [];
  
  return (
    <StyledCard>
      <div className="bulletin-title">{bulletin.title}</div>
      <div className="bulletin-meta">
        {bulletin.created_by && (
          <>
            {t('Posted by')} {bulletin.created_by}{' '}
          </>
        )}
        {bulletin.created_on && (
          <>
            {t('on')} {new Date(bulletin.created_on).toLocaleDateString()}
          </>
        )}
      </div>
      <div className="bulletin-content">{bulletin.message}</div>
      {bulletin.chart_id && (
        <div className="bulletin-chart">
          <BulletinChart chartId={bulletin.chart_id} />
        </div>
      )}
      {hashtags.length > 0 && (
        <div className="bulletin-hashtags">
          {hashtags.map(tag => (
            <Tag key={tag}>#{tag}</Tag>
          ))}
        </div>
      )}
    </StyledCard>
  );
} 