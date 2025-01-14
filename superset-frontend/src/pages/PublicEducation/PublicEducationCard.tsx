import React from 'react';
import { styled, t } from '@superset-ui/core';
import { Card, Row, Col, Typography, Space } from 'antd';
import { PublicEducationPost } from './types';

const { Text, Title } = Typography;

interface PublicEducationCardProps {
  post: PublicEducationPost;
  hasPerm: (perm: string) => boolean;
  bulkSelectEnabled: boolean;
}

const StyledCard = styled(Card)`
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

const AttachmentPreview = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.gridUnit * 2}px;

  .attachment-item {
    position: relative;
    width: 100px;
    height: 100px;
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.borderRadius}px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary.base};
      transform: scale(1.05);
    }

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
    }

    .pdf-icon {
      font-size: 40px;
      color: ${({ theme }) => theme.colors.grayscale.base};
    }

    .file-name {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 2px 4px;
      font-size: 10px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

const PublicEducationCard: React.FC<PublicEducationCardProps> = ({ 
  post,
  hasPerm,
  bulkSelectEnabled,
}) => {
  const handleAttachmentClick = (attachmentId: number) => {
    window.open(`/api/v1/public_education/attachment/${attachmentId}/download`, '_blank');
  };

  if (!post) {
    return null;
  }

  return (
    <StyledCard>
      <Title level={4}>{post.title}</Title>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Text>{post.message}</Text>
        <Text type="secondary">{post.hashtags}</Text>
        
        {post.attachments?.length > 0 && (
          <AttachmentPreview>
            {post.attachments.map(attachment => (
              <div 
                key={attachment.id}
                className="attachment-item"
                onClick={() => handleAttachmentClick(attachment.id)}
                title={attachment.file_name}
              >
                {attachment.file_type === 'image' ? (
                  <img 
                    src={`/api/v1/public_education/attachment/${attachment.id}`}
                    alt={attachment.file_name}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/static/assets/images/chart-card-fallback.svg';
                    }}
                  />
                ) : (
                  <i className="fa fa-file-pdf-o pdf-icon" />
                )}
                <div className="file-name">{attachment.file_name}</div>
              </div>
            ))}
          </AttachmentPreview>
        )}

        <Row justify="space-between">
          <Col>
            <Text type="secondary">
              {t('By')} {post.created_by?.first_name} {post.created_by?.last_name}
            </Text>
          </Col>
          <Col>
            <Text type="secondary">
              {new Date(post.created_on).toLocaleDateString()}
            </Text>
          </Col>
        </Row>
      </Space>
    </StyledCard>
  );
};

export default PublicEducationCard; 