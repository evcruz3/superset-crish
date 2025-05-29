import React, { useState, useMemo, useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import ListView, { ListViewProps, Filter, FilterOperator } from 'src/components/ListView';
import withToasts from 'src/components/MessageToasts/withToasts';
import { EmailGroup } from './types';
import EmailGroupCard from './EmailGroupCard'; // Uncommented
import CreateEmailGroupModal from './CreateEmailGroupModal';
import EditEmailGroupModal from './EditEmailGroupModal';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import FacePile from 'src/components/FacePile';
import { Tooltip } from 'src/components/Tooltip';
import moment from 'moment';

const PAGE_SIZE = 25;

interface EmailGroupsProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  user: {
    userId: string | number; // Assuming user prop structure, adjust if different
  };
}

// Define columns to fetch from the API, matching EmailGroupsRestApi.list_columns
const EMAIL_GROUP_COLUMNS_TO_FETCH = [
  "id",
  "name",
  "description",
  "emails",
  "created_by.id",
  "created_by.first_name",
  "created_by.last_name",
  "created_on",
  "changed_by.id",
  "changed_by.first_name",
  "changed_by.last_name",
  "changed_on",
];

const Actions = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.base};
  display: flex;
  justify-content: flex-start; // Align actions to the left
  
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

const StyledListView = styled(ListView<EmailGroup>)`
  .email-group-list-view {
    // Custom styling for the list view if needed
  }
  .ant-card {
    border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
    border-radius: ${({ theme }) => theme.borderRadius}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 4}px; // Spacing for card view
  }
  // Hide actions by default, show on row hover for table view
  tr:hover .actions {
    visibility: visible;
  }
  .actions {
     visibility: hidden; // Default for table view
  }
`;

function EmailGroups({ 
  addDangerToast, 
  addSuccessToast,
  user 
}: EmailGroupsProps) {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [emailGroupToEdit, setEmailGroupToEdit] = useState<EmailGroup | null>(null);
  const [emailGroupToDelete, setEmailGroupToDelete] = useState<EmailGroup | null>(null);

  const {
    state: {
      loading,
      resourceCount: emailGroupCount,
      resourceCollection: emailGroups,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    toggleBulkSelect,
    refreshData,
  } = useListViewResource<EmailGroup>(
    'email_groups', // Matches resource_name in EmailGroupsRestApi
    t('email group'),
    addDangerToast,
    true, // Re-enable info fetching / card view support in hook
    [], // Initial filters
    undefined, // initial sort
    true, // is_list_view_provider for ListView to control bulk select
    EMAIL_GROUP_COLUMNS_TO_FETCH,
  );

  const handleEmailGroupDelete = async (emailGroup: EmailGroup) => {
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/email_groups/${emailGroup.id}`,
      });
      refreshData();
      addSuccessToast(t('Deleted: %s', emailGroup.name));
      setEmailGroupToDelete(null);
    } catch (err) {
      const error = await (err as any).response?.json();
      addDangerToast(error?.message || t('There was an issue deleting this email group'));
    }
  };

  const handleBulkEmailGroupDelete = async (groupsToDelete: EmailGroup[]) => {
    const ids = groupsToDelete.map(({ id }) => id);
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/email_groups/?q=${rison.encode(ids)}`,
      });
      refreshData();
      addSuccessToast(t('Deleted %s email groups', String(ids.length)));
    } catch (err) {
      const error = await (err as any).response?.json(); 
      addDangerToast(error?.message || t('There was an issue deleting the selected email groups'));
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
        Cell: ({ value }: { value?: string | null }) => value || <span style={{ color: '#999' }}>{t('N/A')}</span>,
      },
      {
        Header: t('Created By'),
        accessor: 'created_by',
        Cell: ({ value }: { value: EmailGroup['created_by'] }) => (
          <FacePile users={value ? [value] : []} />
        ),
      },
      {
        Header: t('Created On'),
        accessor: 'created_on',
        Cell: ({ value }: { value: string }) => moment(value).format('DD MMMM, YYYY hh:mm A'),
      },
      {
        Header: t('Last Modified'),
        accessor: 'changed_on',
        Cell: ({ value }: { value?: string | null }) => value ? moment(value).format('DD MMMM, YYYY hh:mm A') : '-',
      },
      {
        Header: t('Actions'),
        id: 'actions',
        accessor: 'id', // Needed for actions to appear
        disableSortBy: true,
        Cell: ({ row: { original } }: { row: { original: EmailGroup } }) => {
          const handleDelete = () => setEmailGroupToDelete(original);
          const handleEdit = () => { setEmailGroupToEdit(original); setEditModalVisible(true); };
          return (
            <Actions className="actions">
              {hasPerm('can_write') && (
                <Tooltip title={t('Edit email group')} placement="bottom">
                  <span role="button" tabIndex={0} className="action-button" onClick={handleEdit}>
                    <Icons.EditAlt />
                  </span>
                </Tooltip>
              )}
              {hasPerm('can_write') && (
                <Tooltip title={t('Delete email group')} placement="bottom">
                  <span role="button" tabIndex={0} className="action-button" onClick={handleDelete}>
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
      // {
      //   Header: t('Emails'),
      //   id: 'emails',
      //   key: 'emails',
      //   input: 'search',
      //   operator: FilterOperator.Contains,
      // },
    ],
    [],
  );

  const handleEdit = (item: EmailGroup) => {
    setEmailGroupToEdit(item);
    setEditModalVisible(true);
  };

  const handleDelete = (item: EmailGroup) => {
    setEmailGroupToDelete(item);
  };

  const renderCard = useCallback(
    (item: EmailGroup) => (
      <EmailGroupCard 
        emailGroup={item} 
        hasPerm={hasPerm} 
        onEdit={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
      />
    ),
    [hasPerm, refreshData], // Ensure all dependencies for onEdit/onDelete are included if they rely on more from parent scope
  );

  const subMenuButtons: SubMenuProps['buttons'] = [];
  if (hasPerm('can_write')) {
    subMenuButtons.push({
      name: (
        <>
          <i className="fa fa-plus" /> {t('Email Group')}
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
    { id: 'changed_on', label: t('Recently modified'), value: 'changed_on_desc', desc: true },
    { id: 'changed_on', label: t('Least recently modified'), value: 'changed_on_asc', desc: false },
  ];

  return (
    <>
      <SubMenu name={t('Email Groups')} buttons={subMenuButtons} />
      <CreateEmailGroupModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onSuccess={() => { refreshData(); setCreateModalVisible(false); /* Toast now in modal */ }}
        addSuccessToast={addSuccessToast}
      />
      <EditEmailGroupModal
        emailGroup={emailGroupToEdit}
        visible={editModalVisible}
        onClose={() => { setEditModalVisible(false); setEmailGroupToEdit(null); }}
        onSuccess={() => { refreshData(); setEditModalVisible(false); setEmailGroupToEdit(null); }}
        addSuccessToast={addSuccessToast}
      /> 

      {emailGroupToDelete && (
        <DeleteModal
          description={t(
            'Are you sure you want to delete this email group? This action cannot be undone.',
          )}
          onConfirm={() => {
            if (emailGroupToDelete) {
              handleEmailGroupDelete(emailGroupToDelete);
            }
          }}
          onHide={() => setEmailGroupToDelete(null)}
          open
          title={t('Delete Email Group: %s?', emailGroupToDelete.name)}
        />
      )}

      <StyledListView
        className="email-group-list-view"
        columns={columns}
        data={emailGroups}
        count={emailGroupCount}
        pageSize={PAGE_SIZE}
        fetchData={fetchData}
        loading={loading}
        initialSort={initialSort}
        filters={filters}
        bulkActions={hasPerm('can_write') ? [
          {
            key: 'delete',
            name: t('Delete'),
            type: 'danger',
            onSelect: handleBulkEmailGroupDelete,
          }
        ] : []}
        bulkSelectEnabled={bulkSelectEnabled}
        disableBulkSelect={toggleBulkSelect}
        renderCard={renderCard}
        cardSortSelectOptions={cardSortSelectOptions}
        showThumbnails={false}
        refreshData={refreshData}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
        defaultViewMode="table"
      />
    </>
  );
}

export default withToasts(EmailGroups); 