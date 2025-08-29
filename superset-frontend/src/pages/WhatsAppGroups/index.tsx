import { useState, useMemo, useCallback } from 'react';
import { styled, t, SupersetClient } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView, { Filter, FilterOperator } from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import rison from 'rison';
import FacePile from 'src/components/FacePile';
import { Tooltip } from 'src/components/Tooltip';
import moment from 'moment';
import EditWhatsAppGroupModal from './EditWhatsAppGroupModal'; // Placeholder - to be created
import CreateWhatsAppGroupModal from './CreateWhatsAppGroupModal'; // Placeholder - to be created
import WhatsAppGroupCard from './WhatsAppGroupCard'; // Uncommented
import { WhatsAppGroup } from './types'; // Updated import

const PAGE_SIZE = 25;

interface WhatsAppGroupsProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number;
  };
}

// Define columns to fetch from the API, matching WhatsAppGroupsRestApi.list_columns
const WHATSAPP_GROUP_COLUMNS_TO_FETCH = [
  'id',
  'name',
  'description',
  'phone_numbers', // Changed from emails
  'created_by.id',
  'created_by.first_name',
  'created_by.last_name',
  'created_on',
  'changed_by.id',
  'changed_by.first_name',
  'changed_by.last_name',
  'changed_on',
];

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
  display: flex;
  justify-content: flex-start;

  .action-button {
    display: inline-block;
    padding: ${({ theme }) => theme.gridUnit * 2}px;
    cursor: pointer;
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;

    &:hover {
      color: ${({ theme }) => theme.colors.primary.base};
    }
  }
`;

const StyledListView = styled(ListView<WhatsAppGroup>)`
  .whatsapp-group-list-view {
    // Custom styling for the list view if needed
  }
  .ant-card {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.borderRadius}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  }
  tr:hover .actions {
    visibility: visible;
  }
  .actions {
    visibility: hidden;
  }
`;

function WhatsAppGroups({
  addDangerToast,
  addSuccessToast,
  user,
}: WhatsAppGroupsProps) {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<WhatsAppGroup | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<WhatsAppGroup | null>(
    null,
  );

  const {
    state: {
      loading,
      resourceCount: groupCount,
      resourceCollection: groups,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<WhatsAppGroup>(
    'whatsapp_groups', // Matches resource_name in WhatsAppGroupsRestApi
    t('WhatsApp group'),
    addDangerToast,
    true,
    [],
    undefined,
    true,
    WHATSAPP_GROUP_COLUMNS_TO_FETCH,
  );

  const handleWhatsAppGroupDelete = async (group: WhatsAppGroup) => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/whatsapp_groups/${group.id}`,
      });
      refreshData();
      addSuccessToast(t('Deleted: %s', group.name));
      setGroupToDelete(null);
    } catch (err) {
      const error = await (err as any).response?.json();
      addDangerToast(
        error?.message || t('There was an issue deleting this WhatsApp group'),
      );
    }
  };

  const handleBulkWhatsAppGroupDelete = async (
    groupsToDelete: WhatsAppGroup[],
  ) => {
    const ids = groupsToDelete.map(({ id }) => id);
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/whatsapp_groups/?q=${rison.encode(ids)}`,
      });
      refreshData();
      addSuccessToast(t('Deleted %s WhatsApp groups', String(ids.length)));
    } catch (err) {
      const error = await (err as any).response?.json();
      addDangerToast(
        error?.message ||
          t('There was an issue deleting the selected WhatsApp groups'),
      );
    }
  };

  const initialSort = [{ id: 'name', desc: false }];

  const columns = useMemo(
    () => [
      {
        Header: t('Name'),
        accessor: 'name',
      },
      {
        Header: t('Description'),
        accessor: 'description',
        Cell: ({ value }: { value?: string | null }) =>
          value || <span style={{ color: '#999' }}>{t('N/A')}</span>,
      },
      //   {
      //     Header: t('Phone Numbers'), // Changed from Emails
      //     accessor: 'phone_numbers',
      //     Cell: ({ value }: { value?: string | null }) => value || <span style={{ color: '#999' }}>{t('N/A')}</span>,
      //   },
      {
        Header: t('Created By'),
        accessor: 'created_by',
        Cell: ({ value }: { value: WhatsAppGroup['created_by'] }) => (
          <FacePile users={value ? [value] : []} />
        ),
      },
      {
        Header: t('Created On'),
        accessor: 'created_on',
        Cell: ({ value }: { value: string }) =>
          moment(value).format('DD MMMM, YYYY hh:mm A'),
      },
      {
        Header: t('Last Modified'),
        accessor: 'changed_on',
        Cell: ({ value }: { value?: string | null }) =>
          value ? moment(value).format('DD MMMM, YYYY hh:mm A') : '-',
      },
      {
        Header: t('Actions'),
        id: 'actions',
        accessor: 'id',
        disableSortBy: true,
        Cell: ({ row: { original } }: { row: { original: WhatsAppGroup } }) => {
          const handleDeleteClick = () => setGroupToDelete(original);
          const handleEditClick = () => {
            setGroupToEdit(original);
            setEditModalVisible(true);
          };
          return (
            <Actions className="actions">
              {hasPerm('can_write') && (
                <Tooltip title={t('Edit WhatsApp group')} placement="bottom">
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleEditClick}
                  >
                    <Icons.EditAlt />
                  </span>
                </Tooltip>
              )}
              {hasPerm('can_write') && (
                <Tooltip title={t('Delete WhatsApp group')} placement="bottom">
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={handleDeleteClick}
                  >
                    <Icons.Trash />
                  </span>
                </Tooltip>
              )}
            </Actions>
          );
        },
      },
    ],
    [hasPerm, refreshData, addDangerToast],
  );

  const filters: Filter[] = useMemo(
    () => [
      {
        Header: t('Name'),
        id: 'name',
        key: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Description'),
        id: 'description',
        key: 'description',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      //   {
      //     Header: t('Phone Numbers'), // Changed from Emails
      //     id: 'phone_numbers',
      //     key: 'phone_numbers',
      //     input: 'search',
      //     operator: FilterOperator.Contains,
      //   },
    ],
    [],
  );

  const handleEditModal = (item: WhatsAppGroup) => {
    setGroupToEdit(item);
    setEditModalVisible(true);
  };

  const handleDeleteModal = (item: WhatsAppGroup) => {
    setGroupToDelete(item);
  };

  const renderCard = useCallback(
    (item: WhatsAppGroup) => (
      <WhatsAppGroupCard
        whatsAppGroup={item}
        hasPerm={hasPerm}
        onEdit={() => handleEditModal(item)}
        onDelete={() => handleDeleteModal(item)}
      />
    ),
    [hasPerm, refreshData], // Dependencies for renderCard
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (hasPerm('can_write')) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('WhatsApp Group')}
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
    { id: 'name', label: t('Name (A-Z)'), value: 'name_asc', desc: false },
    { id: 'name', label: t('Name (Z-A)'), value: 'name_desc', desc: true },
    {
      id: 'changed_on',
      label: t('Recently modified'),
      value: 'changed_on_desc',
      desc: true,
    },
    {
      id: 'changed_on',
      label: t('Least recently modified'),
      value: 'changed_on_asc',
      desc: false,
    },
  ];

  return (
    <>
      <SubMenu name={t('WhatsApp Groups')} buttons={subMenuButtons} />
      {/* Placeholder for CreateWhatsAppGroupModal */}
      {createModalVisible && (
        <CreateWhatsAppGroupModal
          visible={createModalVisible}
          onClose={() => setCreateModalVisible(false)}
          onSuccess={() => {
            refreshData();
            setCreateModalVisible(false);
          }}
          addSuccessToast={addSuccessToast} // Pass if modal shows its own toasts
        />
      )}
      {/* Placeholder for EditWhatsAppGroupModal */}
      {editModalVisible && groupToEdit && (
        <EditWhatsAppGroupModal
          whatsAppGroup={groupToEdit}
          visible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setGroupToEdit(null);
          }}
          onSuccess={() => {
            refreshData();
            setEditModalVisible(false);
            setGroupToEdit(null);
          }}
          addSuccessToast={addSuccessToast} // Pass if modal shows its own toasts
        />
      )}

      {groupToDelete && (
        <DeleteModal
          description={t(
            'Are you sure you want to delete this WhatsApp group? This action cannot be undone.',
          )}
          onConfirm={() => {
            if (groupToDelete) {
              handleWhatsAppGroupDelete(groupToDelete);
            }
          }}
          onHide={() => setGroupToDelete(null)}
          open
          title={t('Delete WhatsApp Group: %s?', groupToDelete.name)}
        />
      )}

      <StyledListView
        className="whatsapp-group-list-view"
        columns={columns}
        data={groups}
        count={groupCount}
        pageSize={PAGE_SIZE}
        fetchData={fetchData}
        loading={loading}
        initialSort={initialSort}
        filters={filters}
        bulkActions={
          hasPerm('can_write')
            ? [
                {
                  key: 'delete',
                  name: t('Delete'),
                  type: 'danger',
                  onSelect: handleBulkWhatsAppGroupDelete,
                },
              ]
            : []
        }
        bulkSelectEnabled={bulkSelectEnabled}
        disableBulkSelect={toggleBulkSelect}
        renderCard={renderCard}
        cardSortSelectOptions={cardSortSelectOptions}
        showThumbnails={false} // Assuming no thumbnails for WhatsApp groups
        refreshData={refreshData}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
        defaultViewMode="table"
      />
    </>
  );
}

export default withToasts(WhatsAppGroups);
