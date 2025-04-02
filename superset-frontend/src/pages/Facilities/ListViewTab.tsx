import React from 'react';
import { t } from '@superset-ui/core';
import ListView, { Filter } from 'src/components/ListView';
import { Facility } from './types'; // Import shared Facility type
import { Button, Tag } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';

// Define props required by ListViewTab
interface ListViewTabProps {
  loading: boolean;
  facilityCount: number;
  facilities: Facility[];
  fetchData: (loadOptions?: object) => void;
  refreshData: () => void;
  filters: Filter[];
  handleFacilityClick: (facility: Facility) => void; 
  setSelectedFacility: (facility: Facility | null) => void;
  setActiveTab: (tab: string) => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  pageSize?: number; // Optional page size
}

const ListViewTab: React.FC<ListViewTabProps> = ({
  loading,
  facilityCount,
  facilities,
  fetchData,
  refreshData,
  filters,
  handleFacilityClick,
  setSelectedFacility,
  setActiveTab,
  addSuccessToast,
  addDangerToast,
  pageSize = 25, // Default page size
}) => {

  // Define columns specifically for the list view
  const columns = [
    {
      accessor: 'name',
      Header: t('Name'),
      size: 'xl',
      Cell: ({ row: { original } }: { row: { original: Facility } }) => (
        <a onClick={() => handleFacilityClick(original)}>{original.name}</a>
      ),
    },
    {
      accessor: 'facility_type',
      Header: t('Type'),
      size: 'xl',
      Cell: ({ value }: { value: string }) => <Tag color="blue">{value}</Tag>,
    },
    {
      accessor: 'location', // Administrative Post
      Header: t('Admin Post'), 
      size: 'xl',
    },
    {
      accessor: 'municipality',
      Header: t('Municipality'),
      size: 'xl',
    },
    {
      accessor: 'services',
      Header: t('Services'),
      size: 'xl',
    },
    {
      accessor: 'id',
      Header: t('Actions'),
      size: 'xl',
      Cell: ({ row: { original } }: { row: { original: Facility } }) => (
        <Button 
          type="primary" 
          size="small" 
          icon={<EnvironmentOutlined />}
          onClick={() => {
            setSelectedFacility(original);
            setActiveTab('map'); // Switch to map tab
          }}
        >
          {t('Show on Map')}
        </Button>
      ),
    },
  ];

  return (
    <ListView<Facility>
      bulkActions={[]}
      bulkSelectEnabled={false}
      className="facilities-list-view"
      columns={columns}
      count={facilityCount}
      data={facilities} // Use facilities directly, filtering happens via ListView
      fetchData={fetchData}
      filters={filters} 
      initialSort={[{ id: 'name', desc: false }]}
      loading={loading}
      pageSize={pageSize}
      refreshData={refreshData}
      renderCard={undefined} // Ensure cards are not used if table is default
      defaultViewMode="table"
      addSuccessToast={addSuccessToast}
      addDangerToast={addDangerToast}
    />
  );
};

export default ListViewTab; 