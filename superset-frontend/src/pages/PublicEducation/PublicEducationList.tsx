import React, { useState, useCallback, useMemo } from 'react';
import { styled, t } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView, { ListViewProps, Filter, Filters } from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import { PublicEducationPost } from './types';
import PublicEducationCard from './PublicEducationCard';
import CreatePublicEducationModal from './CreatePublicEducationModal';
import PublicEducationDetailModal from './PublicEducationDetailModal';
import moment from 'moment';
import { SupersetClient } from '@superset-ui/core';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import rison from 'rison';
import FacePile from 'src/components/FacePile';
import { Tooltip } from 'src/components/Tooltip';
import { FilterOperator } from 'src/components/ListView';

const PAGE_SIZE = 25;

interface PublicEducationListProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
  };
}

const POST_COLUMNS_TO_FETCH = [
  'id',
  'title',
  'message',
  'hashtags',
  'attachments',
  'created_by.first_name',
  'created_by.last_name',
  'created_by.id',
  'created_on',
  'changed_on',
];

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
  
  .action-button {
    height: 100%;
    display: inline-block;
    padding: ${({ theme }) => theme.gridUnit}px;
    cursor: pointer;

    &:hover {
      color: ${({ theme }) => theme.colors.primary.base};
    }
  }
`;

const StyledListView = styled(ListView)`
  .card-container {
    .ant-col {
      width: 100% !important;
      max-width: 100% !important;
      flex: 0 0 100% !important;
    }
  }

  .ant-card {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }

  .ant-row.card-container {
    margin: 0;
    padding: ${({ theme }) => theme.gridUnit * 4}px;
    
    .ant-col {
      padding: 0;
      margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }

  // Hide actions by default, show on row hover
  .actions {
    visibility: hidden;
  }

  tr:hover .actions {
    visibility: visible;
  }
`;

function PublicEducationList({ 
  addDangerToast, 
  addSuccessToast,
  user 
}: PublicEducationListProps) {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PublicEducationPost | null>(null);
  const [postToDelete, setPostToDelete] = useState<PublicEducationPost | null>(null);

  const {
    state: {
      loading,
      resourceCount: postCount,
      resourceCollection: posts,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<PublicEducationPost>(
    'public_education',
    t('public education post'),
    addDangerToast,
    true,
    POST_COLUMNS_TO_FETCH,
  );

  const handlePostDelete = async (post: PublicEducationPost) => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/public_education/${post.id}`,
      });
      refreshData();
      setPostToDelete(null);
      addSuccessToast(t('Deleted: %s', post.title));
    } catch (err) {
      console.error('Failed to delete post:', err);
      addDangerToast(t('There was an issue deleting this post'));
    }
  };

  const handleBulkPostDelete = async (postsToDelete: PublicEducationPost[]) => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/public_education/?q=${rison.encode(
          postsToDelete.map(({ id }) => id)
        )}`,
      });
      refreshData();
      addSuccessToast(t(`Deleted ${postsToDelete.length} posts`));
    } catch (err) {
      console.error('Failed to delete posts:', err);
      addDangerToast(t('There was an issue deleting the selected posts'));
    }
  };

  const initialSort = [{ id: 'changed_on', desc: true }];

  const columns = useMemo(
    () => [
      {
        Cell: ({ row: { original } }: any) => original.title,
        Header: t('Title'),
        accessor: 'title',
      },
      {
        Cell: ({ row: { original } }: any) => original.message,
        Header: t('Message'),
        accessor: 'message',
      },
      {
        Cell: ({ row: { original } }: any) => original.hashtags,
        Header: t('Hashtags'),
        accessor: 'hashtags',
      },
      {
        Cell: ({ row: { original } }: any) => (
          <FacePile 
            users={[{
              first_name: original.created_by.first_name,
              last_name: original.created_by.last_name,
              id: original.created_by.id,
            }]} 
          />
        ),
        Header: t('Created by'),
        accessor: 'created_by',
      },
      {
        Cell: ({ row: { original } }: any) => <>{moment(original.created_on).fromNow()}</>,
        Header: t('Created'),
        accessor: 'created_on',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () => setPostToDelete(original);
          
          return (
            <Actions className="actions">
              {hasPerm('can_write') && (
                <Tooltip
                  id="delete-action-tooltip"
                  title={t('Delete')}
                  placement="bottom"
                >
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDelete}
                    data-test="post-delete-action"
                  >
                    <Icons.Trash data-test="post-delete-icon" />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
      },
    ],
    [hasPerm],
  );

  const filters: Filter[] = useMemo(
    () => [
      {
        Header: t('Title'),
        id: 'title',
        key: 'title',
        input: 'search',
        operator: FilterOperator.Contains,
        debounceTime: 300,
      },
      {
        Header: t('Hashtags'),
        id: 'hashtags',
        key: 'hashtags',
        input: 'search',
        operator: FilterOperator.Contains,
        debounceTime: 300,
      },
    ],
    [],
  );

  const renderCard = useCallback(
    (post: PublicEducationPost) => {
      if (!post) {
        console.warn('Received undefined post in renderCard');
        return null;
      }
      return (
        <PublicEducationCard
          post={post}
          hasPerm={hasPerm}
          bulkSelectEnabled={bulkSelectEnabled}
          onClick={() => setSelectedPost(post)}
        />
      );
    },
    [bulkSelectEnabled, hasPerm],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];

  if (hasPerm('can_create')) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Post')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => setCreateModalVisible(true),
    });
  }

  if (hasPerm('can_write')) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      onClick: toggleBulkSelect,
    });
  }

  const cardSortSelectOptions = [
    {
      desc: true,
      id: 'changed_on',
      label: t('Recently modified'),
      value: 'recently_modified',
    },
    {
      desc: true,
      id: 'created_on',
      label: t('Recently created'),
      value: 'recently_created',
    },
    {
      desc: false,
      id: 'title',
      label: t('Alphabetical'),
      value: 'alphabetical',
    },
  ];

  return (
    <>
      <SubMenu name={t('Public Education')} buttons={subMenuButtons} />
      
      <ConfirmStatusChange
        title={t('Delete Posts')}
        description={t(
          'Are you sure you want to delete the selected posts?',
        )}
        onConfirm={handleBulkPostDelete}
      >
        {(showConfirm: Function) => (
          <StyledListView
            bulkActions={
              hasPerm('can_write')
                ? [
                    {
                      key: 'delete',
                      name: t('Delete'),
                      type: 'danger',
                      onSelect: (postsToDelete: PublicEducationPost[]) => {
                        showConfirm(postsToDelete);
                      },
                    },
                  ]
                : []
            }
            bulkSelectEnabled={bulkSelectEnabled}
            cardSortSelectOptions={cardSortSelectOptions}
            className="public-education-list-view"
            columns={columns}
            count={postCount}
            data={posts}
            disableBulkSelect={toggleBulkSelect}
            fetchData={fetchData}
            filters={filters}
            initialSort={initialSort}
            loading={loading}
            pageSize={PAGE_SIZE}
            renderCard={renderCard}
            defaultViewMode="card"
          />
        )}
      </ConfirmStatusChange>

      <CreatePublicEducationModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          refreshData();
        }}
      />

      <PublicEducationDetailModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
      />

      {/* Delete Modal for single post delete */}
      {postToDelete && (
        <DeleteModal
          description={t(
            'Are you sure you want to delete this post?',
          )}
          onConfirm={() => {
            if (postToDelete) {
              handlePostDelete(postToDelete);
            }
          }}
          onHide={() => setPostToDelete(null)}
          open
          title={t('Delete Post?')}
        />
      )}
    </>
  );
}

export default withToasts(PublicEducationList); 