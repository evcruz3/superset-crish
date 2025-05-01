import React, { useState, useCallback, useMemo } from 'react';
import { styled, t} from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView, { ListViewProps, Filter, FilterOperator } from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import { Bulletin } from './types';
import BulletinCard from './BulletinCard';
import CreateBulletinModal from './CreateBulletinModal';
import EditBulletinModal from './EditBulletinModal';
import moment from 'moment';
import { createErrorHandler } from 'src/views/CRUD/utils';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import { SupersetClient } from '@superset-ui/core';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import rison from 'rison';
import FacePile from 'src/components/FacePile';
import { Tooltip } from 'src/components/Tooltip';

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

  // Hide actions by default, show on row hover
  .actions {
    visibility: hidden;
  }

  tr:hover .actions {
    visibility: visible;
  }
`;

function BulletinsAndAdvisories({ 
  addDangerToast, 
  addSuccessToast,
  user 
}: BulletinsAndAdvisoriesProps) {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [bulletinToEdit, setBulletinToEdit] = useState<Bulletin | null>(null);
  const [bulletinToDelete, setBulletinToDelete] = useState<Bulletin | null>(null);
  const [bulletinsToDelete, setBulletinsToDelete] = useState<Bulletin[]>([]);

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
    true,
    [],
    undefined,
    true,
    BULLETIN_COLUMNS_TO_FETCH,
  );

  const handleBulletinDelete = async (bulletin: Bulletin) => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/bulletins_and_advisories/${bulletin.id}`,
      });
      refreshData();
      setBulletinToDelete(null);
      addSuccessToast(t('Deleted: %s', bulletin.title));
    } catch (err) {
      console.error('Failed to delete bulletin:', err);
      addDangerToast(t('There was an issue deleting this bulletin'));
    }
  };

  const handleBulkBulletinDelete = async (bulletinsToDelete: Bulletin[]) => {
    const bulletinIds = bulletinsToDelete.map(({ id }) => id);
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/bulletins_and_advisories/?q=${rison.encode(bulletinIds)}`,
      });
      refreshData();
      addSuccessToast(t(`Deleted ${bulletinsToDelete.length} bulletins`));
    } catch (err) {
      console.error('Failed to delete bulletins:', err);
      addDangerToast(t('There was an issue deleting the selected bulletins'));
    }
  };

  const initialSort = [{ id: 'created_on', desc: true }];

  const columns = useMemo(
    () => [
      {
        Cell: ({ row: { original } }: any) => original.title,
        Header: t('Title'),
        accessor: 'title',
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
        Header: t('Created By'),
        accessor: 'created_by',
      },
      {
        Cell: ({ row: { original } }: any) => <>{moment(original.created_on).fromNow()}</>,
        Header: t('Created'),
        accessor: 'created_on',
      },
      {
        Cell: ({ row: { original } }: any) => {
          // Only show if different from created_on
          if (original.changed_on && original.changed_on !== original.created_on) {
            return <>{moment(original.changed_on).fromNow()}</>;
          }
          return null;
        },
        Header: t('Last Updated'),
        accessor: 'changed_on',
      },
      {
        Cell: ({ row: { original } }: any) => {
          const handleDelete = () => setBulletinToDelete(original);
          const handleEdit = () => {
            setBulletinToEdit(original);
            setEditModalVisible(true);
          };
          
          return (
            <Actions className="actions">
              {hasPerm('can_write') && (
                <>
                  <Tooltip
                    id="edit-action-tooltip"
                    title={t('Edit')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={handleEdit}
                      data-test="bulletin-edit-action"
                    >
                      <Icons.EditAlt data-test="bulletin-edit-icon" />
                    </span>
                  </Tooltip>
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
                      data-test="dashboard-delete-action"
                    >
                      <Icons.Trash data-test="dashboard-delete-icon" />
                    </span>
                  </Tooltip>
                </>
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
          refreshData={refreshData}
        />
      );
    },
    [bulkSelectEnabled, hasPerm, refreshData],
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];
  
  if (hasPerm('can_write')) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Bulletin')}
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

  const bulkActions: ListViewProps['bulkActions'] = [];
  
  if (hasPerm('can_write')) {
    bulkActions.push({
      key: 'delete',
      name: t('Delete'),
      type: 'danger',
      onSelect: (bulletinsToDelete: Bulletin[]) => {
        handleBulkBulletinDelete(bulletinsToDelete);
      },
    });
  }

  return (
    <>
      <SubMenu name={t('Bulletins & Advisories')} buttons={subMenuButtons} />
      
      <ConfirmStatusChange
        title={t('Delete Bulletins')}
        description={t(
          'Are you sure you want to delete the selected bulletins?',
        )}
        onConfirm={handleBulkBulletinDelete}
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
                      onSelect: (bulletinsToDelete: Bulletin[]) => {
                        showConfirm(bulletinsToDelete);
                      },
                    },
                  ]
                : []
            }
            bulkSelectEnabled={bulkSelectEnabled}
            cardSortSelectOptions={cardSortSelectOptions}
            className="bulletin-list-view"
            columns={columns}
            count={bulletinCount}
            data={bulletins}
            disableBulkSelect={toggleBulkSelect}
            fetchData={fetchData}
            refreshData={refreshData}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
            filters={filters}
            initialSort={initialSort}
            loading={loading}
            pageSize={PAGE_SIZE}
            renderCard={renderCard}
            defaultViewMode="card"
          />
        )}
      </ConfirmStatusChange>

      <CreateBulletinModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => {
          setCreateModalVisible(false);
          refreshData();
        }}
      />

      <EditBulletinModal
        visible={editModalVisible}
        onClose={() => {
          setEditModalVisible(false);
          setBulletinToEdit(null);
        }}
        onSuccess={() => {
          setEditModalVisible(false);
          setBulletinToEdit(null);
          refreshData();
        }}
        bulletin={bulletinToEdit}
      />

      {/* Delete Modal for single bulletin delete */}
      {bulletinToDelete && (
        <DeleteModal
          description={t(
            'Are you sure you want to delete this bulletin?',
          )}
          onConfirm={() => {
            if (bulletinToDelete) {
              handleBulletinDelete(bulletinToDelete);
            }
          }}
          onHide={() => setBulletinToDelete(null)}
          open
          title={t('Delete Bulletin?')}
        />
      )}
    </>
  );
}

export default withToasts(BulletinsAndAdvisories); 