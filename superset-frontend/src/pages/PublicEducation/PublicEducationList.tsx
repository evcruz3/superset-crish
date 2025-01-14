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
  'created_by',
  'created_on',
  'changed_on',
];

const StyledListView = styled(ListView<PublicEducationPost>)`
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
`;

function PublicEducationList({ 
  addDangerToast, 
  addSuccessToast,
  user 
}: PublicEducationListProps) {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PublicEducationPost | null>(null);

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
        Cell: ({ row: { original } }: any) => original.created_by.first_name + ' ' + original.created_by.last_name,
        Header: t('Created by'),
        accessor: 'created_by',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const date = new Date(original.created_on);
          return date.toLocaleDateString();
        },
        Header: t('Created on'),
        accessor: 'created_on',
      },
    ],
    [],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Title'),
        id: 'title',
        input: 'search',
        operator: 'ct',
        debounceTime: 300,
      },
      {
        Header: t('Hashtags'),
        id: 'hashtags',
        input: 'search',
        operator: 'ct',
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

//   console.log("hasPerm('can_write'): ", hasPerm('can_write'));


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

//   if (hasPerm('can_write')) {
    subMenuButtons.push({
      name: t('Bulk select'),
      buttonStyle: 'secondary',
      onClick: toggleBulkSelect,
    });
//   }

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
      
      <StyledListView<PublicEducationPost>
        bulkActions={[]}
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
    </>
  );
}

export default withToasts(PublicEducationList); 