import React from 'react';
import { styled, t } from '@superset-ui/core';
import { Card, Row, Col, Typography, Space } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { PublicEducationPost } from './types';

const { Text, Title } = Typography;

interface PublicEducationCardProps {
  post: PublicEducationPost;
  hasPerm: (perm: string) => boolean;
  bulkSelectEnabled: boolean;
  onClick?: () => void;
}

const StyledCard = styled(Card)`
  width: 100%;
  height: 500px;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  cursor: pointer;
  transition: all 0.2s;

  .ant-card-body {
    height: 100%;
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    display: flex;
    flex-direction: column;
  }

  &:hover {
    box-shadow: ${({ theme }) => theme.gridUnit}px ${({ theme }) => theme.gridUnit}px ${({ theme }) => theme.gridUnit * 4}px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

const CardTitle = styled(Title)`
  &.ant-typography {
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
    margin-top: 0;
  }
`;

const CardContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .message-container {
    flex: 1;
    overflow-y: auto;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    
    /* Hide scrollbar by default */
    scrollbar-width: none;
    -ms-overflow-style: none;
    &::-webkit-scrollbar {
      width: 0;
      background: transparent;
    }

    /* Show scrollbar only when hovering */
    &:hover {
      scrollbar-width: thin;
      -ms-overflow-style: auto;
      
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
  }

  .message {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    display: -webkit-box;
    -webkit-line-clamp: 4; /* Show minimum 4 lines */
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.5em;
    min-height: 6em; /* 4 lines * 1.5em line-height */
  }
`;

const PreviewContainer = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 2}px 0;
  display: flex;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
  overflow-x: auto;
  padding-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  
  /* Hide scrollbar by default */
  scrollbar-width: none;
  -ms-overflow-style: none;
  &::-webkit-scrollbar {
    height: 0;
    background: transparent;
  }

  /* Show scrollbar only when hovering */
  &:hover {
    scrollbar-width: thin;
    -ms-overflow-style: auto;
    
    &::-webkit-scrollbar {
      height: 6px;
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
`;

const PreviewItem = styled.div`
  position: relative;
  min-width: 120px;
  width: 120px;
  height: 120px;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${({ theme }) => theme.colors.grayscale.light4};
  flex-shrink: 0;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary.base};
    transform: scale(1.05);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .preview-icon {
    font-size: 40px;
    color: ${({ theme }) => theme.colors.grayscale.base};
    transition: all 0.2s;
  }

  &:hover .preview-icon {
    color: ${({ theme }) => theme.colors.primary.base};
    transform: scale(1.2);
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

  /* Video specific styles */
  &.video-preview {
    img {
      opacity: 0.8;
    }

    .preview-icon {
      position: absolute;
      z-index: 1;
    }
  }
`;

const CardFooter = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  padding-top: ${({ theme }) => theme.gridUnit * 2}px;
  border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light3};

  .hashtags {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
  }
`;

const PublicEducationCard: React.FC<PublicEducationCardProps> = ({ 
  post,
  hasPerm,
  bulkSelectEnabled,
  onClick,
}) => {
  const handleAttachmentClick = (e: React.MouseEvent, attachmentId: number) => {
    e.stopPropagation();
    window.open(`/api/v1/public_education/attachment/${attachmentId}/download`, '_blank');
  };

  const handleCardClick = () => {
    if (!bulkSelectEnabled && onClick) {
      onClick();
    }
  };

  // Extract video ID from YouTube URL for thumbnail
  const getYouTubeThumbnail = (embedUrl: string | undefined) => {
    if (!embedUrl) return null;
    const match = embedUrl.match(/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) {
      return `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg`;
    }
    return null;
  };

  if (!post) {
    return null;
  }

  const thumbnailUrl = getYouTubeThumbnail(post.youtube_embed_url);

  return (
    <StyledCard 
      onClick={handleCardClick}
      style={{ cursor: bulkSelectEnabled ? 'default' : 'pointer' }}
    >
      <CardTitle level={4}>{post.title}</CardTitle>
      <CardContent>
        <div className="message-container">
          <div className="message">{post.message}</div>
        </div>
      </CardContent>

      {(post.youtube_embed_url || post.attachments?.length > 0) && (
        <PreviewContainer>
          {post.youtube_embed_url && thumbnailUrl && (
            <PreviewItem className="video-preview">
              <PlayCircleOutlined className="preview-icon" />
              <img 
                src={thumbnailUrl}
                alt={t('Video thumbnail')}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </PreviewItem>
          )}
          
          {post.attachments?.map(attachment => (
            <PreviewItem 
              key={attachment.id}
              onClick={(e) => handleAttachmentClick(e, attachment.id)}
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
                <i className="fa fa-file-pdf-o preview-icon" />
              )}
              <div className="file-name">{attachment.file_name}</div>
            </PreviewItem>
          ))}
        </PreviewContainer>
      )}

      <CardFooter>
        <div className="hashtags">
          <Text type="secondary">{post.hashtags}</Text>
        </div>
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
      </CardFooter>
    </StyledCard>
  );
};

export default PublicEducationCard; 