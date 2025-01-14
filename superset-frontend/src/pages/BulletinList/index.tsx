import { t, FilterOperator } from '@superset-ui/core';
import { createFetchRelated, createErrorHandler } from 'src/views/CRUD/utils';
import { useMemo } from 'react';
import { Filters } from 'src/views/CRUD/types';

interface BulletinListProps {
  user: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

const BulletinList: React.FC<BulletinListProps> = (props: BulletinListProps) => {
  const filters: Filters = useMemo(() => {
    const filtersList = [
      {
        Header: t('Title'),
        key: 'title',
        id: 'title',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Owner'),
        key: 'owner',
        id: 'created_by',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'bulletin',
          'created_by',
          createErrorHandler(errMsg =>
            t(
              'An error occurred while fetching bulletin owner values: %s',
              errMsg,
            ),
          ),
          props.user,
        ),
        paginate: true,
      },
    ] as Filters;
    return filtersList;
  }, [props.user]);

  return (
    // ... existing code ...
  );
};

export default BulletinList; 