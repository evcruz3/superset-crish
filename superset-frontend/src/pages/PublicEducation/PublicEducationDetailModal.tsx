import { Modal, Tag } from 'antd';
import { styled, t } from '@superset-ui/core';
import { PublicEducationPost } from './types';

const StyledModal = styled(Modal)`
  .post-title {
    font-size: ${({ theme }) => theme.typography.sizes.xl}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .post-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }

  .post-content {
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
    white-space: pre-wrap;
  }

  .video-container {
    margin: ${({ theme }) => theme.gridUnit * 4}px 0;
    position: relative;
    padding-bottom: 56.25%; /* 16:9 aspect ratio */
    height: 0;
    overflow: hidden;

    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  }

  .post-attachments {
    margin: ${({ theme }) => theme.gridUnit * 4}px 0;

    .attachment-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: ${({ theme }) => theme.gridUnit * 2}px;
      margin-top: ${({ theme }) => theme.gridUnit * 2}px;
    }

    .attachment-item {
      border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
      border-radius: ${({ theme }) => theme.borderRadius}px;
      padding: ${({ theme }) => theme.gridUnit * 2}px;
      transition: all 0.2s;

      &:hover {
        border-color: ${({ theme }) => theme.colors.primary.base};
        transform: scale(1.02);
      }

      a {
        color: ${({ theme }) => theme.colors.primary.base};
        text-decoration: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${({ theme }) => theme.gridUnit * 2}px;

        &:hover {
          text-decoration: none;
        }
      }

      img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: ${({ theme }) => theme.borderRadius}px;
      }

      .pdf-icon {
        font-size: 48px;
        color: ${({ theme }) => theme.colors.grayscale.base};
      }

      .file-name {
        text-align: center;
        word-break: break-word;
      }
    }
  }

  .post-hashtags {
    margin-top: ${({ theme }) => theme.gridUnit * 4}px;

    .ant-tag {
      margin-right: ${({ theme }) => theme.gridUnit * 1}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
    }
  }
`;

interface PublicEducationDetailModalProps {
  post: PublicEducationPost | null;
  onClose: () => void;
}

export default function PublicEducationDetailModal({
  post,
  onClose,
}: PublicEducationDetailModalProps) {
  if (!post) return null;

  const hashtags = post.hashtags?.split(',').map(tag => tag.trim()) || [];

  return (
    <StyledModal
      visible={!!post}
      onCancel={onClose}
      width={800}
      footer={null}
      title={null}
    >
      <div className="post-title">{post.title}</div>
      <div className="post-meta">
        {post.created_by && (
          <>
            {t('Posted by')}{' '}
            {`${post.created_by.first_name} ${post.created_by.last_name}`}{' '}
          </>
        )}
        {post.created_on && (
          <>{new Date(post.created_on).toLocaleDateString()}</>
        )}
      </div>
      <div className="post-content">{post.message}</div>

      {post.youtube_embed_url && (
        <div className="video-container">
          <iframe
            src={post.youtube_embed_url}
            title={post.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {post.attachments && post.attachments.length > 0 && (
        <div className="post-attachments">
          <h4>{t('Attachments')}</h4>
          <div className="attachment-grid">
            {post.attachments.map(attachment => (
              <div key={attachment.id} className="attachment-item">
                <a
                  href={`/api/v1/public_education/attachment/${attachment.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {attachment.file_type === 'image' ? (
                    <img
                      src={`/api/v1/public_education/attachment/${attachment.id}`}
                      alt={attachment.file_name}
                      onError={e => {
                        const target = e.target as HTMLImageElement;
                        target.src =
                          '/static/assets/images/chart-card-fallback.svg';
                      }}
                    />
                  ) : (
                    <i className="fa fa-file-pdf-o pdf-icon" />
                  )}
                  <span className="file-name">{attachment.file_name}</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
      {hashtags.length > 0 && (
        <div className="post-hashtags">
          {hashtags.map(tag => (
            <Tag key={tag}>#{tag}</Tag>
          ))}
        </div>
      )}
    </StyledModal>
  );
}
