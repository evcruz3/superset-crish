import React, { useState } from 'react';
import { Card, List, Tag, Tooltip, Dropdown, Menu, Button } from 'antd';
import moment from 'moment';
import { t, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { DownloadOutlined, MailOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
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

// New styled component for the actions container
const ActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
  margin-left: ${({ theme }) => theme.gridUnit * 4}px;
`;

const ActionButton = styled(Button)`
  // Ensure buttons have consistent width if desired or let them size by content
  // Example: width: 32px; 
  // display: flex;
  // align-items: center;
  // justify-content: center;
`;

export interface BulletinListProps {
  bulletins: Bulletin[];
  total: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  onBulletinClick: (bulletin: Bulletin) => void;
  onDownloadPdf: (bulletinId: number, bulletinTitle: string) => void;
  onEditBulletin: (bulletin: Bulletin) => void; // Added for edit action
  onDeleteBulletin: (bulletin: Bulletin) => void; // Added for delete action
  // Add any other props passed from the parent, like hasPerm
  hasPerm?: (permission: string) => boolean;
}

export default function BulletinList({
  bulletins,
  total,
  loading,
  onPageChange,
  onBulletinClick,
  onDownloadPdf,
  onEditBulletin,
  onDeleteBulletin,
  hasPerm,
}: BulletinListProps) {
  // Removed local state as it's now passed via props
  // const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  // const [total, setTotal] = useState(0);
  // const [loading, setLoading] = useState(false);
  const [selectedBulletin, setSelectedBulletin] = useState<Bulletin | null>(null);

  // Renamed to avoid conflict if parent also has this
  const handleLocalBulletinClick = (bulletin: Bulletin) => {
    setSelectedBulletin(bulletin);
    onBulletinClick(bulletin); // Call prop passed from parent
  };

  // Placeholder for edit action, should be handled by parent
  const handleEdit = (bulletin: Bulletin, e: React.MouseEvent) => {
    e.stopPropagation();
    onEditBulletin(bulletin);
  };

  // Placeholder for delete action, should be handled by parent
  const handleDelete = (bulletin: Bulletin, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteBulletin(bulletin);
  };


  const renderBulletin = (bulletin: Bulletin) => {
    const menu = (
      <Menu>
        {hasPerm && hasPerm('can_write') && (
          <Menu.Item key="edit" icon={<EditOutlined />} onClick={(e) => { e.domEvent.stopPropagation(); handleEdit(bulletin, e.domEvent as any); }}>
            {t('Edit')}
          </Menu.Item>
        )}
        {hasPerm && hasPerm('can_write') && (
          <Menu.Item key="delete" icon={<DeleteOutlined />} onClick={(e) => { e.domEvent.stopPropagation(); handleDelete(bulletin, e.domEvent as any); }}>
            {t('Delete')}
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <List.Item>
        <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
          <StyledCard
            style={{ flexGrow: 1 }} // Make card take available space
            title={bulletin.title}
          >
            <div 
              className="bulletin-content" 
              onClick={() => handleLocalBulletinClick(bulletin)} 
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleLocalBulletinClick(bulletin);}}
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
                null
              ) : (
                <div className="gradient-container" style={{ height: '100%', position: 'relative' }}>
                  <ImageLoader
                    src={bulletin.thumbnail_url || ''}
                    fallback={'/static/assets/images/placeholder-chart.png'}
                    isLoading={!!(!bulletin.thumbnail_url)}
                    position="top"
                  />
                </div>
              )}
            </div>
            <div className="bulletin-meta">
              <small>
                {t('Created by')} {bulletin.created_by?.first_name} {bulletin.created_by?.last_name} {' '}
                {moment(bulletin.created_on).fromNow()}
              </small>
            </div>
            {/* Moved actions outside the card to ActionsContainer */}
          </StyledCard>
          <ActionsContainer>
            {(hasPerm && hasPerm('can_write')) && <Tooltip title={t('Disseminate Bulletin')}>
              <ActionButton // Using styled Button
                icon={<MailOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  // Assuming handleBulletinClick opens a modal or similar, 
                  // which might be relevant before disseminate
                  handleLocalBulletinClick(bulletin); 
                  // Add actual dissemination logic if different from just opening details
                  // For example, directly call a disseminate function:
                  // handleDisseminate(bulletin); 
                }}
                aria-label={t('Disseminate Bulletin')}
              />
            </Tooltip>}
            <Tooltip title={t('Download PDF')}>
              <ActionButton // Using styled Button
                icon={<DownloadOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadPdf(bulletin.id, bulletin.title);
                }}
                aria-label={t('Download PDF')}
              />
            </Tooltip>
            {(hasPerm && hasPerm('can_write')) && ( // Conditionally render "More" actions
              <Dropdown overlay={menu} trigger={['click']}>
                <ActionButton // Using styled Button
                  icon={<MoreOutlined />}
                  onClick={e => e.stopPropagation()} // Prevent card click
                  aria-label={t('More actions')}
                />
              </Dropdown>
            )}
          </ActionsContainer>
        </div>
      </List.Item>
    );
  };


  return (
    <>
      <List
        dataSource={bulletins}
        renderItem={renderBulletin}
        loading={loading} // Pass loading prop
        pagination={{
          pageSize: 10, // Consider making this a prop or constant
          total, // Pass total prop
          onChange: onPageChange, // Pass onPageChange prop
        }}
      />
      <BulletinDetailModal
        bulletin={selectedBulletin}
        onClose={() => setSelectedBulletin(null)}
      />
    </>
  );
} 