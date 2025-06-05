import React, { useState, useEffect } from 'react';
import { Modal, Tag, Button, Carousel, Image as AntImage } from 'antd';
import { styled, t, isFeatureEnabled, FeatureFlag, SupersetClient } from '@superset-ui/core';
import moment from 'moment';
import { Bulletin, ImageAttachment } from './types';
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
  'image_attachments',
  'created_by.first_name',
  'created_by.last_name',
  'created_on',
  'changed_on',
];

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

  .actions-container {
    display: flex;
    align-items: center;
  }

  .action-button {
    display: flex;
    align-items: center;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
    
    .anticon {
      margin-right: ${({ theme }) => theme.gridUnit}px;
    }
  }

  .bulletin-attachment-image-detail {
    width: 100%;
    max-height: 400px;
    object-fit: contain;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }

  // Custom styles for Carousel arrows
  .ant-carousel {
    .slick-prev,
    .slick-next {
      font-size: ${({ theme }) => theme.typography.sizes.xl}px; // Increase icon size
      color: ${({ theme }) => theme.colors.grayscale.light5}; // Arrow color
      background-color: rgba(0, 0, 0, 0.3); // Semi-transparent background
      border-radius: 50%;
      width: 30px; // Ensure a decent size for the background
      height: 30px;
      line-height: 30px; // Center icon if needed
      z-index: 10; // Ensure they are above images
      transition: background-color 0.3s ease, color 0.3s ease;

      &:hover {
        background-color: rgba(0, 0, 0, 0.5);
        color: ${({ theme }) => theme.colors.grayscale.light2};
      }
    }

    .slick-prev {
      left: 10px; // Adjust position from edge
    }

    .slick-next {
      right: 10px; // Adjust position from edge
    }

    .slick-dots li button {
        background: ${({ theme }) => theme.colors.primary.base}; // Make dots more visible too
    }
    .slick-dots li.slick-active button {
        background: ${({ theme }) => theme.colors.primary.dark1};
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [updatedBulletin, setUpdatedBulletin] = useState<Bulletin | null>(bulletin);

  // Update state when bulletin prop changes
  useEffect(() => {
    setUpdatedBulletin(bulletin);
  }, [bulletin]);

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

  // const hashtags = updatedBulletin.hashtags?.split(',').map(tag => tag.trim()) || [];

  const handleDisseminate = () => {
    if (updatedBulletin?.id) {
      window.location.href = `/disseminatebulletin/form/?bulletin_id=${updatedBulletin.id}`;
    }
  };

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
          <div className="actions-container">
            {hasPerm('can_write') && (
              <>
                <Button
                  className="action-button"
                  onClick={() => setEditModalVisible(true)}
                  type="primary"
                  icon={<Icons.EditAlt />}
                >
                  {t('Edit')}
                </Button>
                <Button
                  className="action-button"
                  onClick={handleDisseminate}
                  type="default"
                  icon={<Icons.Share />}
                  style={{ marginLeft: '8px' }}
                >
                  {t('Disseminate')}
                </Button>
              </>
            )}
          </div>
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

        {/* Image Attachments Section */}
        {updatedBulletin?.image_attachments && updatedBulletin.image_attachments.length > 0 && (
          <div className="bulletin-section">
            <div className="section-title">{t('Attachments')}</div>
            {updatedBulletin.image_attachments.length === 1 ? (
              <div style={{ marginBottom: '16px' }}>
                <AntImage
                  width="100%"
                  style={{ maxHeight: '400px', objectFit: 'contain', borderRadius: '4px' }}
                  src={updatedBulletin.image_attachments[0].url}
                  alt={updatedBulletin.image_attachments[0].caption || 'Attachment'}
                />
                {updatedBulletin.image_attachments[0].caption && (
                  <p style={{ textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>
                    {updatedBulletin.image_attachments[0].caption}
                  </p>
                )}
              </div>
            ) : (
              <Carousel autoplay dotPosition="top">
                {updatedBulletin.image_attachments.map((attachment: ImageAttachment) => (
                  <div key={attachment.id} style={{ textAlign: 'center' }}>
                    <AntImage
                      width="100%"
                      style={{ maxHeight: '400px', objectFit: 'contain' }}
                      src={attachment.url}
                      alt={attachment.caption || 'Attachment'}
                    />
                    {attachment.caption && (
                      <p style={{ marginTop: '8px', fontStyle: 'italic' }}>
                        {attachment.caption}
                      </p>
                    )}
                  </div>
                ))}
              </Carousel>
            )}
          </div>
        )}

        {/* Advisory Section */}
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

        {/* Risks Section */}
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

        {/* Safety Tips Section */}
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
        
        {/* Hashtags Section */}
        {/* {hashtags.length > 0 && (
          <div className="bulletin-hashtags">
            {hashtags.map(tag => (
              <Tag key={tag}>#{tag}</Tag>
            ))}
          </div>
        )} */}
      </StyledModal>

      {updatedBulletin && (
        <EditBulletinModal
          isOpen={editModalVisible}
          toggle={() => setEditModalVisible(!editModalVisible)}
          onBulletinUpdated={handleEditSuccess}
          bulletin={updatedBulletin}
        />
      )}
    </>
  );
} 