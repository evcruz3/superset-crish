import React, { useState, useCallback, useMemo } from 'react';
import { styled, t} from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView, { ListViewProps, Filter, Filters } from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Bulletin } from './types';
import BulletinCard from './BulletinCard';
import CreateBulletinModal from './CreateBulletinModal';

const PAGE_SIZE = 25;

interface BulletinsAndAdvisoriesProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
  };
}

const BULLETIN_COLUMNS_TO_FETCH = [
  'id',
  'title',
  'message',
  'hashtags',
  'chart_id',
  'created_by',
  'created_on',
];

const StyledListView = styled(ListView<Bulletin>)`
  .card-container {
    .ant-col {
      width: 100% !important;
      max-width: 100% !important;
      flex: 0 0 100% !important;
    }
  }

  // Additional styling for better spacing
  .ant-card {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }

  // Ensure proper spacing between cards
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

function BulletinsAndAdvisories({ 
  addDangerToast, 
  addSuccessToast,
  user 
}: BulletinsAndAdvisoriesProps) {
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const {
    state: {
      loading,
      resourceCount: bulletinCount,
      resourceCollection: bulletins,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<Bulletin>(
    'bulletins_and_advisories',
    t('bulletin'),
    addDangerToast,
    false,
    BULLETIN_COLUMNS_TO_FETCH,
  );

  const initialSort = [{ id: 'created_on', desc: true }];

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
        Cell: ({ row: { original } }: any) => original.created_by,
        Header: t('Created by'),
        accessor: 'created_by',
      },
      {
        Cell: ({ row: { original } }: any) => original.created_on,
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
        Header: t('Created by'),
        id: 'created_by',
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
    (bulletin: Bulletin) => {
      if (!bulletin) {
        console.warn('Received undefined bulletin in renderCard');
        return null;
      }
      return (
        <BulletinCard
          bulletin={bulletin}
          hasPerm={hasPerm}
          bulkSelectEnabled={bulkSelectEnabled}
        />
      );
    },
    [bulkSelectEnabled, hasPerm],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];
  
//   if (hasPerm('can_write')) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Bulletin')}
        </>
      ),
      buttonStyle: 'primary',
      onClick: () => setCreateModalVisible(true),
    });
//   }

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
      id: 'created_on',
      label: t('Recently created'),
      value: 'recently_created',
    },
    {
      desc: false,
      id: 'created_on',
      label: t('Least recently created'),
      value: 'least_recently_created',
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
      <SubMenu name={t('Bulletins & Advisories')} buttons={subMenuButtons} />
      
      <StyledListView<Bulletin>
        bulkActions={[]}
        bulkSelectEnabled={bulkSelectEnabled}
        cardSortSelectOptions={cardSortSelectOptions}
        className="bulletin-list-view"
        columns={columns}
        count={bulletinCount}
        data={bulletins}
        disableBulkSelect={toggleBulkSelect}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
        renderCard={renderCard}
        defaultViewMode="card"
      />

      <CreateBulletinModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          refreshData();
        }}
      />
    </>
  );
}

export default withToasts(BulletinsAndAdvisories); 