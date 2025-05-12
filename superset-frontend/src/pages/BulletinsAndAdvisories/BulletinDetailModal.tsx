import React, { useState, useEffect } from 'react';
import { Modal, Tag, Button } from 'antd';
import { styled, t, isFeatureEnabled, FeatureFlag, SupersetClient } from '@superset-ui/core';
import moment from 'moment';
import { Bulletin } from './types';
import BulletinChart from './BulletinChart';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';
import EditBulletinModal from './EditBulletinModal';
import Icons from 'src/components/Icons';
import rison from 'rison';

// Include all fields we want to fetch for a bulletin
const BULLETIN_COLUMNS = [
  'id',
  'title',
  'advisory',
  'risks',
  'safety_tips',
  'hashtags',
  'chart_id',
  'created_by.first_name',
  'created_by.last_name',
  'created_on',
  'changed_on',
];

const FALLBACK_THUMBNAIL_URL = '/static/assets/images/chart-card-fallback.svg';

const StyledModal = styled(Modal)`
  .bulletin-title-container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    padding-right: ${({ theme }) => theme.gridUnit * 6}px;
  }

  .bulletin-title {
    font-size: ${({ theme }) => theme.typography.sizes.xl}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    flex: 1;
    margin-right: ${({ theme }) => theme.gridUnit * 4}px;
  }
  
  .bulletin-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
  
  .bulletin-section {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    white-space: pre-wrap;

    .section-title {
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    }

    .section-content {
      margin-left: ${({ theme }) => theme.gridUnit * 4}px;
      white-space: pre-wrap;
    }
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

  .edit-button {
    display: flex;
    align-items: center;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    
    .anticon {
      margin-right: ${({ theme }) => theme.gridUnit}px;
    }
  }
`;

interface BulletinDetailModalProps {
  bulletin: Bulletin | null;
  onClose: () => void;
  hasPerm?: (perm: string) => boolean;
  refreshData?: () => void;
}

export default function BulletinDetailModal({ 
  bulletin, 
  onClose,
  hasPerm = () => false,
  refreshData = () => {},
}: BulletinDetailModalProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updatedBulletin, setUpdatedBulletin] = useState<Bulletin | null>(bulletin);

  // Update state when bulletin prop changes
  useEffect(() => {
    setUpdatedBulletin(bulletin);
  }, [bulletin]);

  useEffect(() => {
    const fetchThumbnailUrl = async () => {
      if (updatedBulletin?.chart_id) {
        try {
          const response = await SupersetClient.get({
            endpoint: `/api/v1/chart/${updatedBulletin.chart_id}`,
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
  }, [updatedBulletin?.chart_id]);

  const handleEditSuccess = async () => {
    try {
      // First fetch the updated bulletin
      if (bulletin?.id) {
        // Using a list query with filters to ensure we get all fields including changed_on
        const filters = { id: bulletin.id };
        const encodedFilters = rison.encode({
          filters: [{ col: 'id', opr: 'eq', value: bulletin.id }],
          columns: BULLETIN_COLUMNS,
        });
        
        const response = await SupersetClient.get({
          endpoint: `/api/v1/bulletins_and_advisories/?q=${encodedFilters}`,
        });
        
        if (response.json && response.json.result && response.json.result.length > 0) {
          // Update the local state immediately with the first (and only) result
          setUpdatedBulletin(response.json.result[0]);
        }
      }
      
      // Close the edit modal
      setEditModalVisible(false);
      
      // Refresh data in the parent component to update the card view
      refreshData();
    } catch (error) {
      console.error('Failed to get updated bulletin', error);
      // Still close the edit modal
      setEditModalVisible(false);
      // Try to refresh parent
      refreshData();
    }
  };

  if (!updatedBulletin) return null;

  const hashtags = updatedBulletin.hashtags?.split(',').map(tag => tag.trim()) || [];

  return (
    <>
      <StyledModal
        visible={!!updatedBulletin}
        onCancel={onClose}
        width={800}
        footer={null}
        title={null}
      >
        <div className="bulletin-title-container">
          <div className="bulletin-title">{updatedBulletin.title}</div>
          {hasPerm('can_write') && (
            <Button
              className="edit-button"
              onClick={() => setEditModalVisible(true)}
              type="primary"
              icon={<Icons.EditAlt />}
            >
              {t('Edit')}
            </Button>
          )}
        </div>
        <div className="bulletin-meta">
          {updatedBulletin.created_by && (
            <>
              {t('Posted by')} {`${updatedBulletin.created_by.first_name} ${updatedBulletin.created_by.last_name}`}{' '}
            </>
          )}
          {updatedBulletin.created_on && (
            <>
              {t('Created')} {moment(updatedBulletin.created_on).fromNow()}{' '}
            </>
          )}
          {updatedBulletin.changed_on && updatedBulletin.changed_on !== updatedBulletin.created_on && (
            <>
              • {t('Last updated')} {moment(updatedBulletin.changed_on).fromNow()}
            </>
          )}
        </div>
        <div className="bulletin-section">
          <div className="section-title">{t('Advisory')}</div>
          <div className="section-content">
            {updatedBulletin.advisory?.split('\\n').map((line, index, arr) => (
              <React.Fragment key={index}>
                {line}
                {index < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="bulletin-section">
          <div className="section-title">{t('Risks')}</div>
          <div className="section-content">
            {updatedBulletin.risks?.split('\\n').map((line, index, arr) => (
              <React.Fragment key={index}>
                {line}
                {index < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="bulletin-section">
          <div className="section-title">{t('Safety Tips')}</div>
          <div className="section-content">
            {updatedBulletin.safety_tips?.split('\\n').map((line, index, arr) => (
              <React.Fragment key={index}>
                {line}
                {index < arr.length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="bulletin-chart">
          {!isFeatureEnabled(FeatureFlag.Thumbnails) ? (
            updatedBulletin.chart_id ? (
              <BulletinChart chartId={updatedBulletin.chart_id} />
            ) : (
              <div style={{ height: '400px' }}></div>
            )
          ) : updatedBulletin.chart_id ? (
            <ImageLoader
              src={thumbnailUrl || ''}
              fallback={FALLBACK_THUMBNAIL_URL}
              isLoading={!!updatedBulletin.chart_id && !thumbnailUrl}
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

      {updatedBulletin && (
        <EditBulletinModal
          visible={editModalVisible}
          onClose={() => setEditModalVisible(false)}
          onSuccess={handleEditSuccess}
          bulletin={updatedBulletin}
        />
      )}
    </>
  );
} 