/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  CSSProperties,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  MouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import {
  ColumnInstance,
  ColumnWithLooseAccessor,
  DefaultSortTypes,
  Row,
} from 'react-table';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import { FaSort } from '@react-icons/all-files/fa/FaSort';
import { FaSortDown as FaSortDesc } from '@react-icons/all-files/fa/FaSortDown';
import { FaSortUp as FaSortAsc } from '@react-icons/all-files/fa/FaSortUp';
import cx from 'classnames';
import {
  DataRecord,
  DataRecordValue,
  DTTM_ALIAS,
  ensureIsArray,
  GenericDataType,
  getSelectedText,
  getTimeFormatterForGranularity,
  BinaryQueryObjectFilterClause,
  styled,
  css,
  t,
  tn,
  useTheme,
} from '@superset-ui/core';
import { Dropdown, Menu, Tooltip } from '@superset-ui/chart-controls';
import {
  CheckOutlined,
  InfoCircleOutlined,
  DownOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  TableOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { isEmpty, isNumber, uniq } from 'lodash';
import moment from 'moment';
import { DatePicker, Select, Badge, Tooltip as AntdTooltip, Tag } from 'antd';
import {
  ColorSchemeEnum,
  DataColumnMeta,
  TableChartTransformedProps,
} from './types';
import DataTable, {
  DataTableProps,
  SearchInputProps,
  SelectPageSizeRendererProps,
  SizeOption,
} from './DataTable';

import Styles from './Styles';
import { formatColumnValue } from './utils/formatValue';
import { PAGE_SIZE_OPTIONS } from './consts';
import { updateExternalFormData } from './DataTable/utils/externalAPIs';
import getScrollBarSize from './DataTable/utils/getScrollBarSize';

type ValueRange = [number, number];

interface TableSize {
  width: number;
  height: number;
}

const ACTION_KEYS = {
  enter: 'Enter',
  spacebar: 'Spacebar',
  space: ' ',
};

/**
 * Return sortType based on data type
 */
function getSortTypeByDataType(dataType: GenericDataType): DefaultSortTypes {
  if (dataType === GenericDataType.Temporal) {
    return 'datetime';
  }
  if (dataType === GenericDataType.String) {
    return 'alphanumeric';
  }
  return 'basic';
}

/**
 * Cell background width calculation for horizontal bar chart
 */
function cellWidth({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  const [minValue, maxValue] = valueRange;
  if (alignPositiveNegative) {
    const perc = Math.abs(Math.round((value / maxValue) * 100));
    return perc;
  }
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  const perc2 = Math.round((Math.abs(value) / tot) * 100);
  return perc2;
}

/**
 * Cell left margin (offset) calculation for horizontal bar chart elements
 * when alignPositiveNegative is not set
 */
function cellOffset({
  value,
  valueRange,
  alignPositiveNegative,
}: {
  value: number;
  valueRange: ValueRange;
  alignPositiveNegative: boolean;
}) {
  if (alignPositiveNegative) {
    return 0;
  }
  const [minValue, maxValue] = valueRange;
  const posExtent = Math.abs(Math.max(maxValue, 0));
  const negExtent = Math.abs(Math.min(minValue, 0));
  const tot = posExtent + negExtent;
  return Math.round((Math.min(negExtent + value, negExtent) / tot) * 100);
}

/**
 * Cell background color calculation for horizontal bar chart
 */
function cellBackground({
  value,
  colorPositiveNegative = false,
}: {
  value: number;
  colorPositiveNegative: boolean;
}) {
  const r = colorPositiveNegative && value < 0 ? 150 : 0;
  return `rgba(${r},0,0,0.2)`;
}

function SortIcon<D extends object>({ column }: { column: ColumnInstance<D> }) {
  const { isSorted, isSortedDesc } = column;
  let sortIcon = <FaSort />;
  if (isSorted) {
    sortIcon = isSortedDesc ? <FaSortDesc /> : <FaSortAsc />;
  }
  return sortIcon;
}

function SearchInput({ count, value, onChange }: SearchInputProps) {
  return (
    <span className="dt-global-filter">
      {t('Search')}{' '}
      <input
        aria-label={t('Search %s records', count)}
        className="form-control input-sm"
        placeholder={tn('search.num_records', count)}
        value={value}
        onChange={onChange}
      />
    </span>
  );
}

function SelectPageSize({
  options,
  current,
  onChange,
}: SelectPageSizeRendererProps) {
  return (
    <span
      className="dt-select-page-size form-inline"
      role="group"
      aria-label={t('Select page size')}
    >
      <label htmlFor="pageSizeSelect" className="sr-only">
        {t('Select page size')}
      </label>
      {t('Show')}{' '}
      <select
        id="pageSizeSelect"
        className="form-control input-sm"
        value={current}
        onChange={e => {
          onChange(Number((e.target as HTMLSelectElement).value));
        }}
        aria-label={t('Show entries per page')}
      >
        {options.map(option => {
          const [size, text] = Array.isArray(option)
            ? option
            : [option, option];
          return (
            <option key={size} value={size}>
              {text}
            </option>
          );
        })}
      </select>{' '}
      {t('entries per page')}
    </span>
  );
}

const getNoResultsMessage = (filter: string) =>
  filter ? t('No matching records found') : t('No records found');

// Add a new component for column header filter
function ColumnHeaderFilter({
  column,
  data,
  onChange,
  currentFilterValue,
  currentFilterValues,
  onRemove,
}: {
  column: DataColumnMeta;
  data: DataRecord[];
  onChange: (value: string) => void;
  currentFilterValue?: string;
  currentFilterValues?: string[];
  onRemove?: (value: string) => void;
}) {
  // Get unique values for the dropdown
  const uniqueValues = useMemo(() => {
    const values = data
      .map(row => row[column.key])
      .filter(val => val !== null && val !== undefined)
      .map(val => String(val));
    return uniq(values).sort();
  }, [data, column.key]);

  // Stop propagation to prevent sorting when clicking the filter
  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  if (column.dataType === GenericDataType.Temporal) {
    // For date columns, we need to properly parse the date strings
    const parseDate = () => {
      if (!currentFilterValue) return null;
      try {
        // Use moment.js to parse the date string
        return moment(currentFilterValue);
      } catch (e) {
        return null;
      }
    };

    return (
      <div onClick={stopPropagation}>
        <DatePicker
          size="small"
          placeholder={t('Filter by date')}
          onChange={(date, dateString) => {
            // If date is cleared or invalid, pass empty string
            if (!date) {
              if (currentFilterValue && onRemove) {
                onRemove(currentFilterValue);
              }
              return;
            }
            // Otherwise pass the ISO string of the selected date
            onChange(date.toISOString());
          }}
          style={{ width: '100%' }}
          value={parseDate()}
        />
        {currentFilterValues && currentFilterValues.length > 0 && (
          <div style={{ marginTop: '4px' }}>
            {currentFilterValues.map(dateStr => {
              try {
                const formattedDate = moment(dateStr).format('MMM D, YYYY');
                return (
                  <Tag
                    key={dateStr}
                    closable
                    onClose={() => onRemove && onRemove(dateStr)}
                    style={{ marginBottom: '2px' }}
                  >
                    {formattedDate}
                  </Tag>
                );
              } catch (e) {
                return null;
              }
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={stopPropagation}>
      <AntdTooltip title={t('You can select multiple values')} placement="top">
        <div>
          <Select
            size="small"
            placeholder={
              <span>
                <FilterOutlined /> {t('Select values...')}
              </span>
            }
            value={currentFilterValues || []}
            onChange={(values: string[]) => {
              if (values.length === 0) {
                // Clear all values for this column
                if (currentFilterValues && currentFilterValues.length > 0) {
                  currentFilterValues.forEach(val => {
                    if (onRemove) onRemove(val);
                  });
                }
              } else if (currentFilterValues) {
                // Find values that were removed
                const removed = currentFilterValues.filter(
                  v => !values.includes(v),
                );
                // Find values that were added
                const added = values.filter(
                  v => !currentFilterValues.includes(v),
                );

                // Remove old values
                removed.forEach(val => {
                  if (onRemove) onRemove(val);
                });

                // Add new values
                added.forEach(val => onChange(val));
              } else {
                // Add all values
                values.forEach(val => onChange(val));
              }
            }}
            style={{ width: '100%' }}
            allowClear
            showSearch
            mode="multiple"
            virtual
            dropdownMatchSelectWidth={false}
            optionLabelProp="children"
            maxTagCount={1}
          >
            {uniqueValues.map(value => (
              <Select.Option key={value} value={value}>
                {value}
              </Select.Option>
            ))}
          </Select>
        </div>
      </AntdTooltip>
    </div>
  );
}

export default function TableChart<D extends DataRecord = DataRecord>(
  props: TableChartTransformedProps<D> & {
    sticky?: DataTableProps<D>['sticky'];
  },
) {
  const {
    timeGrain,
    height,
    width,
    data,
    totals,
    isRawRecords,
    rowCount = 0,
    columns: columnsMeta,
    alignPositiveNegative: defaultAlignPN = false,
    colorPositiveNegative: defaultColorPN = false,
    includeSearch = false,
    pageSize = 0,
    serverPagination = false,
    serverPaginationData,
    setDataMask,
    showCellBars = true,
    sortDesc = false,
    filters,
    sticky = true, // whether to use sticky header
    columnColorFormatters,
    stringColumnColorFormatters,
    allowRearrangeColumns = false,
    allowRenderHtml = true,
    onContextMenu,
    emitCrossFilters,
    isUsingTimeComparison,
    basicColorFormatters,
    basicColorColumnFormatters,
    filterableColumns = [],
  } = props;
  const comparisonColumns = [
    { key: 'all', label: t('Display all') },
    { key: '#', label: '#' },
    { key: '△', label: '△' },
    { key: '%', label: '%' },
  ];
  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );
  const [tableSize, setTableSize] = useState<TableSize>({
    width: 0,
    height: 0,
  });
  // keep track of whether column order changed, so that column widths can too
  const [columnOrderToggle, setColumnOrderToggle] = useState(false);
  const [showComparisonDropdown, setShowComparisonDropdown] = useState(false);
  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns[0].key,
  ]);
  const [hideComparisonKeys, setHideComparisonKeys] = useState<string[]>([]);
  const theme = useTheme();
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    {},
  );
  const filterInfoRef = useRef<HTMLDivElement>(null);

  // only take relevant page size options
  const pageSizeOptions = useMemo(() => {
    const getServerPagination = (n: number) => n <= rowCount;
    return PAGE_SIZE_OPTIONS.filter(([n]) =>
      serverPagination ? getServerPagination(n) : n <= 2 * data.length,
    ) as SizeOption[];
  }, [data.length, rowCount, serverPagination]);

  const getValueRange = useCallback(
    function getValueRange(key: string, alignPositiveNegative: boolean) {
      if (typeof data?.[0]?.[key] === 'number') {
        const nums = data.map(row => row[key]) as number[];
        return (
          alignPositiveNegative
            ? [0, d3Max(nums.map(Math.abs))]
            : d3Extent(nums)
        ) as ValueRange;
      }
      return null;
    },
    [data],
  );

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  const getCrossFilterDataMask = (key: string, value: DataRecordValue) => {
    let updatedFilters = { ...(filters || {}) };
    if (filters && isActiveFilterValue(key, value)) {
      updatedFilters = {};
    } else {
      updatedFilters = {
        [key]: [value],
      };
    }
    if (
      Array.isArray(updatedFilters[key]) &&
      updatedFilters[key].length === 0
    ) {
      delete updatedFilters[key];
    }

    const groupBy = Object.keys(updatedFilters);
    const groupByValues = Object.values(updatedFilters);
    const labelElements: string[] = [];
    groupBy.forEach(col => {
      const isTimestamp = col === DTTM_ALIAS;
      const filterValues = ensureIsArray(updatedFilters?.[col]);
      if (filterValues.length) {
        const valueLabels = filterValues.map(value =>
          isTimestamp ? timestampFormatter(value) : value,
        );
        labelElements.push(`${valueLabels.join(', ')}`);
      }
    });

    return {
      dataMask: {
        extraFormData: {
          filters:
            groupBy.length === 0
              ? []
              : groupBy.map(col => {
                  const val = ensureIsArray(updatedFilters?.[col]);
                  if (!val.length)
                    return {
                      col,
                      op: 'IS NULL' as const,
                    };
                  return {
                    col,
                    op: 'IN' as const,
                    val: val.map(el =>
                      el instanceof Date ? el.getTime() : el!,
                    ),
                    grain: col === DTTM_ALIAS ? timeGrain : undefined,
                  };
                }),
        },
        filterState: {
          label: labelElements.join(', '),
          value: groupByValues.length ? groupByValues : null,
          filters:
            updatedFilters && Object.keys(updatedFilters).length
              ? updatedFilters
              : null,
        },
      },
      isCurrentValueSelected: isActiveFilterValue(key, value),
    };
  };

  const toggleFilter = useCallback(
    function toggleFilter(key: string, val: DataRecordValue) {
      if (!emitCrossFilters) {
        return;
      }
      setDataMask(getCrossFilterDataMask(key, val).dataMask);
    },
    [emitCrossFilters, getCrossFilterDataMask, setDataMask],
  );

  const getSharedStyle = (column: DataColumnMeta): CSSProperties => {
    const { isNumeric, config = {} } = column;
    const textAlign =
      config.horizontalAlign ||
      (isNumeric && !isUsingTimeComparison ? 'right' : 'left');
    return {
      textAlign,
    };
  };

  const comparisonLabels = [t('Main'), '#', '△', '%'];
  const filteredColumnsMeta = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columnsMeta;
    }
    const allColumns = comparisonColumns[0].key;
    const main = comparisonLabels[0];
    const showAllColumns = selectedComparisonColumns.includes(allColumns);

    return columnsMeta.filter(({ label, key }) => {
      // Extract the key portion after the space, assuming the format is always "label key"
      const keyPortion = key.substring(label.length);
      const isKeyHidded = hideComparisonKeys.includes(keyPortion);
      const isLableMain = label === main;

      return (
        isLableMain ||
        (!isKeyHidded &&
          (!comparisonLabels.includes(label) ||
            showAllColumns ||
            selectedComparisonColumns.includes(label)))
      );
    });
  }, [
    columnsMeta,
    comparisonColumns,
    comparisonLabels,
    isUsingTimeComparison,
    hideComparisonKeys,
    selectedComparisonColumns,
  ]);

  const handleContextMenu =
    onContextMenu && !isRawRecords
      ? (
          value: D,
          cellPoint: {
            key: string;
            value: DataRecordValue;
            isMetric?: boolean;
          },
          clientX: number,
          clientY: number,
        ) => {
          const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
          filteredColumnsMeta.forEach(col => {
            if (!col.isMetric) {
              const dataRecordValue = value[col.key];
              drillToDetailFilters.push({
                col: col.key,
                op: '==',
                val: dataRecordValue as string | number | boolean,
                formattedVal: formatColumnValue(col, dataRecordValue)[1],
              });
            }
          });
          onContextMenu(clientX, clientY, {
            drillToDetail: drillToDetailFilters,
            crossFilter: cellPoint.isMetric
              ? undefined
              : getCrossFilterDataMask(cellPoint.key, cellPoint.value),
            drillBy: cellPoint.isMetric
              ? undefined
              : {
                  filters: [
                    {
                      col: cellPoint.key,
                      op: '==',
                      val: cellPoint.value as string | number | boolean,
                    },
                  ],
                  groupbyFieldName: 'groupby',
                },
          });
        }
      : undefined;

  const getHeaderColumns = (
    columnsMeta: DataColumnMeta[],
    enableTimeComparison?: boolean,
  ) => {
    const resultMap: Record<string, number[]> = {};

    if (!enableTimeComparison) {
      return resultMap;
    }

    columnsMeta.forEach((element, index) => {
      // Check if element's label is one of the comparison labels
      if (comparisonLabels.includes(element.label)) {
        // Extract the key portion after the space, assuming the format is always "label key"
        const keyPortion = element.key.substring(element.label.length);

        // If the key portion is not in the map, initialize it with the current index
        if (!resultMap[keyPortion]) {
          resultMap[keyPortion] = [index];
        } else {
          // Add the index to the existing array
          resultMap[keyPortion].push(index);
        }
      }
    });

    return resultMap;
  };

  const renderTimeComparisonDropdown = (): JSX.Element => {
    const allKey = comparisonColumns[0].key;
    const handleOnClick = (data: any) => {
      const { key } = data;
      // Toggle 'All' key selection
      if (key === allKey) {
        setSelectedComparisonColumns([allKey]);
      } else if (selectedComparisonColumns.includes(allKey)) {
        setSelectedComparisonColumns([key]);
      } else {
        // Toggle selection for other keys
        setSelectedComparisonColumns(
          selectedComparisonColumns.includes(key)
            ? selectedComparisonColumns.filter(k => k !== key) // Deselect if already selected
            : [...selectedComparisonColumns, key],
        ); // Select if not already selected
      }
    };

    const handleOnBlur = () => {
      if (selectedComparisonColumns.length === 3) {
        setSelectedComparisonColumns([comparisonColumns[0].key]);
      }
    };

    return (
      <Dropdown
        placement="bottomRight"
        visible={showComparisonDropdown}
        onVisibleChange={(flag: boolean) => {
          setShowComparisonDropdown(flag);
        }}
        overlay={
          <Menu
            multiple
            onClick={handleOnClick}
            onBlur={handleOnBlur}
            selectedKeys={selectedComparisonColumns}
          >
            <div
              css={css`
                max-width: 242px;
                padding: 0 ${theme.gridUnit * 2}px;
                color: ${theme.colors.grayscale.base};
                font-size: ${theme.typography.sizes.s}px;
              `}
            >
              {t(
                'Select columns that will be displayed in the table. You can multiselect columns.',
              )}
            </div>
            {comparisonColumns.map(column => (
              <Menu.Item key={column.key}>
                <span
                  css={css`
                    color: ${theme.colors.grayscale.dark2};
                  `}
                >
                  {column.label}
                </span>
                <span
                  css={css`
                    float: right;
                    font-size: ${theme.typography.sizes.s}px;
                  `}
                >
                  {selectedComparisonColumns.includes(column.key) && (
                    <CheckOutlined />
                  )}
                </span>
              </Menu.Item>
            ))}
          </Menu>
        }
        trigger={['click']}
      >
        <span>
          <TableOutlined /> <DownOutlined />
        </span>
      </Dropdown>
    );
  };

  const renderGroupingHeaders = (): JSX.Element => {
    // TODO: Make use of ColumnGroup to render the aditional headers
    const headers: any = [];
    let currentColumnIndex = 0;

    Object.entries(groupHeaderColumns || {}).forEach(([key, value]) => {
      // Calculate the number of placeholder columns needed before the current header
      const startPosition = value[0];
      const colSpan = value.length;

      // Add placeholder <th> for columns before this header
      for (let i = currentColumnIndex; i < startPosition; i += 1) {
        headers.push(
          <th
            key={`placeholder-${i}`}
            style={{ borderBottom: 0 }}
            aria-label={`Header-${i}`}
          />,
        );
      }

      // Add the current header <th>
      headers.push(
        <th key={`header-${key}`} colSpan={colSpan} style={{ borderBottom: 0 }}>
          {key}
          <span
            css={css`
              float: right;
              & svg {
                color: ${theme.colors.grayscale.base} !important;
              }
            `}
          >
            {hideComparisonKeys.includes(key) ? (
              <PlusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys(
                    hideComparisonKeys.filter(k => k !== key),
                  )
                }
              />
            ) : (
              <MinusCircleOutlined
                onClick={() =>
                  setHideComparisonKeys([...hideComparisonKeys, key])
                }
              />
            )}
          </span>
        </th>,
      );

      // Update the current column index
      currentColumnIndex = startPosition + colSpan;
    });

    return (
      <tr
        css={css`
          th {
            border-right: 2px solid ${theme.colors.grayscale.light2};
          }
          th:first-child {
            border-left: none;
          }
          th:last-child {
            border-right: none;
          }
        `}
      >
        {headers}
      </tr>
    );
  };

  const groupHeaderColumns = useMemo(
    () => getHeaderColumns(filteredColumnsMeta, isUsingTimeComparison),
    [filteredColumnsMeta, isUsingTimeComparison],
  );

  // Function to handle column filter changes
  const handleColumnFilterChange = useCallback((key: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), value],
    }));
  }, []);

  // Function to remove a filter value
  const removeColumnFilterValue = useCallback((key: string, value: string) => {
    setColumnFilters(prev => {
      const updatedValues = (prev[key] || []).filter(v => v !== value);
      const updatedFilters = { ...prev };

      if (updatedValues.length === 0) {
        // Remove the key if no values left
        delete updatedFilters[key];
      } else {
        updatedFilters[key] = updatedValues;
      }

      return updatedFilters;
    });
  }, []);

  // Function to clear all filters
  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
  }, []);

  // Update data filtering to include column filters
  const memoizedData = useMemo(() => {
    if (Object.keys(columnFilters).length === 0) {
      return data;
    }

    return data.filter(row =>
      Object.entries(columnFilters).every(([key, filterValues]) => {
        if (!filterValues.length) return true;

        const value = row[key];
        if (value == null) return false;

        // Get the column metadata to check its type
        const columnMeta = columnsMeta.find(col => col.key === key);
        if (!columnMeta) return false;

        // Handle different types of columns differently
        if (columnMeta.dataType === GenericDataType.Temporal) {
          // For temporal columns, compare the dates
          try {
            // Convert values to strings before parsing with moment
            const rowDate = moment(String(value));

            // Check if the row date matches any of the filter dates
            return filterValues.some(filterValue => {
              const filterDate = moment(String(filterValue));
              // Check if both dates are valid
              if (rowDate.isValid() && filterDate.isValid()) {
                // Compare the dates (same day)
                return rowDate.isSame(filterDate, 'day');
              }
              return false;
            });
          } catch (e) {
            return false;
          }
        } else {
          // For non-temporal columns, use exact matching for any of the filter values
          const stringValue = String(value);
          return filterValues.includes(stringValue);
        }
      }),
    );
  }, [data, columnFilters, columnsMeta]);

  // Calculate how many rows are filtered
  const filteredRowCount = useMemo(() => {
    if (Object.keys(columnFilters).length === 0) {
      return data.length;
    }
    return memoizedData.length;
  }, [data.length, memoizedData.length, columnFilters]);

  const getColumnConfigs = useCallback(
    (column: DataColumnMeta, i: number): ColumnWithLooseAccessor<D> => {
      const {
        key,
        label,
        isNumeric,
        dataType,
        isMetric,
        isPercentMetric,
        config = {},
      } = column;
      const columnWidth = Number.isNaN(Number(config.columnWidth))
        ? config.columnWidth
        : Number(config.columnWidth);

      // inline style for both th and td cell
      const sharedStyle: CSSProperties = getSharedStyle(column);

      const alignPositiveNegative =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;
      const colorPositiveNegative =
        config.colorPositiveNegative === undefined
          ? defaultColorPN
          : config.colorPositiveNegative;

      const { truncateLongCells } = config;

      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const hasStringColumnColorFormatters =
        dataType === GenericDataType.String &&
        Array.isArray(stringColumnColorFormatters) &&
        stringColumnColorFormatters.length > 0;

      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;

      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        (config.showCellBars === undefined
          ? showCellBars
          : config.showCellBars) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(key, alignPositiveNegative);

      let className = '';
      if (emitCrossFilters && !isMetric) {
        className += ' dt-is-filter';
      }

      if (!isMetric && !isPercentMetric) {
        className += ' right-border-only';
      } else if (comparisonLabels.includes(label)) {
        const groupinHeader = key.substring(label.length);
        const columnsUnderHeader = groupHeaderColumns[groupinHeader] || [];
        if (i === columnsUnderHeader[columnsUnderHeader.length - 1]) {
          className += ' right-border-only';
        }
      }

      const isFilterable = filterableColumns.includes(key);

      return {
        id: String(i), // to allow duplicate column keys
        // must use custom accessor to allow `.` in column names
        // typing is incorrect in current version of `@types/react-table`
        // so we ask TS not to check.
        accessor: ((datum: D) => datum[key]) as never,
        Cell: ({ value, row }: { value: DataRecordValue; row: Row<D> }) => {
          const [isHtml, text] = formatColumnValue(column, value);
          const html = isHtml && allowRenderHtml ? { __html: text } : undefined;

          let backgroundColor;
          let arrow = '';
          const originKey = column.key.substring(column.label.length).trim();
          if (!hasColumnColorFormatters && hasBasicColorFormatters) {
            backgroundColor =
              basicColorFormatters[row.index][originKey]?.backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorFormatters[row.index][originKey]?.mainArrow
                : '';
          }

          if (hasColumnColorFormatters) {
            columnColorFormatters!
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => {
                const formatterResult =
                  value || value === 0
                    ? formatter.getColorFromValue(value as number)
                    : false;
                if (formatterResult) {
                  backgroundColor = formatterResult;
                }
              });
          }

          if (hasStringColumnColorFormatters) {
            stringColumnColorFormatters!
              .filter(formatter => formatter.column === column.key)
              .forEach(formatter => {
                const formatterResult =
                  value !== null && value !== undefined
                    ? formatter.getColorFromValue(String(value))
                    : false;
                if (formatterResult) {
                  backgroundColor = formatterResult;
                }
              });
          }

          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            backgroundColor =
              basicColorColumnFormatters[row.index][column.key]
                ?.backgroundColor || backgroundColor;
            arrow =
              column.label === comparisonLabels[0]
                ? basicColorColumnFormatters[row.index][column.key]?.mainArrow
                : '';
          }

          const StyledCell = styled.td`
            text-align: ${sharedStyle.textAlign};
            white-space: ${value instanceof Date ? 'nowrap' : undefined};
            position: relative;
            background: ${backgroundColor || undefined};
          `;

          const cellBarStyles = css`
            position: absolute;
            height: 100%;
            display: block;
            top: 0;
            ${valueRange &&
            `
                width: ${`${cellWidth({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                left: ${`${cellOffset({
                  value: value as number,
                  valueRange,
                  alignPositiveNegative,
                })}%`};
                background-color: ${cellBackground({
                  value: value as number,
                  colorPositiveNegative,
                })};
              `}
          `;

          let arrowStyles = css`
            color: ${basicColorFormatters &&
            basicColorFormatters[row.index][originKey]?.arrowColor ===
              ColorSchemeEnum.Green
              ? theme.colors.success.base
              : theme.colors.error.base};
            margin-right: ${theme.gridUnit}px;
          `;

          if (
            basicColorColumnFormatters &&
            basicColorColumnFormatters?.length > 0
          ) {
            arrowStyles = css`
              color: ${basicColorColumnFormatters[row.index][column.key]
                ?.arrowColor === ColorSchemeEnum.Green
                ? theme.colors.success.base
                : theme.colors.error.base};
              margin-right: ${theme.gridUnit}px;
            `;
          }

          const cellProps = {
            'aria-labelledby': `header-${column.key}`,
            role: 'cell',
            // show raw number in title in case of numeric values
            title: typeof value === 'number' ? String(value) : undefined,
            onClick:
              emitCrossFilters && !valueRange && !isMetric
                ? () => {
                    // allow selecting text in a cell
                    if (!getSelectedText()) {
                      toggleFilter(key, value);
                    }
                  }
                : undefined,
            onContextMenu: (e: MouseEvent) => {
              if (handleContextMenu) {
                e.preventDefault();
                e.stopPropagation();
                handleContextMenu(
                  row.original,
                  { key, value, isMetric },
                  e.nativeEvent.clientX,
                  e.nativeEvent.clientY,
                );
              }
            },
            className: [
              className,
              value == null ? 'dt-is-null' : '',
              isActiveFilterValue(key, value) ? ' dt-is-active-filter' : '',
            ].join(' '),
            tabIndex: 0,
          };
          if (html) {
            if (truncateLongCells) {
              // eslint-disable-next-line react/no-danger
              return (
                <StyledCell {...cellProps}>
                  <div
                    className="dt-truncate-cell"
                    style={columnWidth ? { width: columnWidth } : undefined}
                    dangerouslySetInnerHTML={html}
                  />
                </StyledCell>
              );
            }
            // eslint-disable-next-line react/no-danger
            return <StyledCell {...cellProps} dangerouslySetInnerHTML={html} />;
          }
          // If cellProps renders textContent already, then we don't have to
          // render `Cell`. This saves some time for large tables.
          return (
            <StyledCell {...cellProps}>
              {valueRange && (
                <div
                  /* The following classes are added to support custom CSS styling */
                  className={cx(
                    'cell-bar',
                    isNumber(value) && value < 0 ? 'negative' : 'positive',
                  )}
                  css={cellBarStyles}
                  role="presentation"
                />
              )}
              {truncateLongCells ? (
                <div
                  className="dt-truncate-cell"
                  style={columnWidth ? { width: columnWidth } : undefined}
                >
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </div>
              ) : (
                <>
                  {arrow && <span css={arrowStyles}>{arrow}</span>}
                  {text}
                </>
              )}
            </StyledCell>
          );
        },
        Header: ({ column: col, onClick, style, onDragStart, onDrop }) => (
          <th
            id={`header-${column.key}`}
            title={t('Shift + Click to sort by multiple columns')}
            className={[className, col.isSorted ? 'is-sorted' : ''].join(' ')}
            style={{
              ...sharedStyle,
              ...style,
            }}
            onKeyDown={(e: ReactKeyboardEvent<HTMLElement>) => {
              // programatically sort column on keypress
              if (Object.values(ACTION_KEYS).includes(e.key)) {
                col.toggleSortBy();
              }
            }}
            role="columnheader button"
            onClick={onClick}
            data-column-name={col.id}
            {...(allowRearrangeColumns && {
              draggable: 'true',
              onDragStart,
              onDragOver: e => e.preventDefault(),
              onDragEnter: e => e.preventDefault(),
              onDrop,
            })}
            tabIndex={0}
          >
            {/* can't use `columnWidth &&` because it may also be zero */}
            {config.columnWidth ? (
              // column width hint
              <div
                style={{
                  width: columnWidth,
                  height: 0.01,
                }}
              />
            ) : null}
            <div
              data-column-name={col.id}
              css={{
                display: 'inline-flex',
                alignItems: 'flex-end',
              }}
            >
              <span data-column-name={col.id}>{label}</span>
              <SortIcon column={col} />
            </div>
            {isFilterable && (
              <div className="dt-column-filter">
                <ColumnHeaderFilter
                  column={column}
                  data={data}
                  onChange={value => handleColumnFilterChange(key, value)}
                  currentFilterValue={columnFilters[key]?.[0]}
                  currentFilterValues={columnFilters[key]}
                  onRemove={value => removeColumnFilterValue(key, value)}
                />
              </div>
            )}
          </th>
        ),
        Footer: totals ? (
          i === 0 ? (
            <th>
              <div
                css={css`
                  display: flex;
                  align-items: center;
                  & svg {
                    margin-left: ${theme.gridUnit}px;
                    color: ${theme.colors.grayscale.dark1} !important;
                  }
                `}
              >
                {t('Summary')}
                <Tooltip
                  overlay={t(
                    'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
                  )}
                >
                  <InfoCircleOutlined />
                </Tooltip>
              </div>
            </th>
          ) : (
            <td style={sharedStyle}>
              <strong>{formatColumnValue(column, totals[key])[1]}</strong>
            </td>
          )
        ) : undefined,
        sortDescFirst: sortDesc,
        sortType: getSortTypeByDataType(dataType),
      };
    },
    [
      defaultAlignPN,
      defaultColorPN,
      emitCrossFilters,
      getValueRange,
      isActiveFilterValue,
      isRawRecords,
      showCellBars,
      sortDesc,
      toggleFilter,
      totals,
      columnColorFormatters,
      columnOrderToggle,
      filterableColumns,
      handleColumnFilterChange,
      memoizedData,
    ],
  );

  const columns = useMemo(
    () => filteredColumnsMeta.map(getColumnConfigs),
    [filteredColumnsMeta, getColumnConfigs],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      updateExternalFormData(setDataMask, pageNumber, pageSize);
    },
    [setDataMask],
  );

  const handleSizeChange = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      setTableSize({ width, height });
    },
    [],
  );

  useLayoutEffect(() => {
    const scrollBarSize = getScrollBarSize();
    const { width: currentTableWidth, height: currentTableHeight } = tableSize;

    // Calculate available height first
    let availableHeight = height;

    // Check if filter info section is rendered and subtract its height
    const filterInfoHeight = filterInfoRef.current?.offsetHeight || 0;
    if (filterInfoHeight > 0) {
      // Subtract height and add a margin (e.g., 8px or theme.gridUnit * 2)
      availableHeight -= filterInfoHeight + theme.gridUnit * 2;
    }

    // Ensure height doesn't go negative
    availableHeight = Math.max(0, availableHeight);

    // Compare with available width and height
    const widthDifference = Math.abs(width - currentTableWidth);
    const heightDifference = Math.abs(availableHeight - currentTableHeight);

    // Resize only if the difference is larger than the scrollbar size
    // to avoid twitching from scrollbar appearance/disappearance
    if (widthDifference > scrollBarSize || heightDifference > scrollBarSize) {
      // Calculate new dimensions, accounting for potential scrollbars
      // Note: This logic might need refinement based on exact scrollbar behavior
      const newWidth =
        width - (availableHeight < currentTableHeight ? scrollBarSize : 0);
      const newHeight =
        availableHeight - (width < currentTableWidth ? scrollBarSize : 0);

      handleSizeChange({
        width: Math.max(0, newWidth),
        height: Math.max(0, newHeight),
      });
    }
  }, [
    width,
    height,
    handleSizeChange,
    tableSize,
    columnFilters,
    theme.gridUnit,
  ]);

  // Extract width and height from tableSize for passing to DataTable
  const { width: widthFromState, height: heightFromState } = tableSize;

  return (
    <Styles>
      {/* Attach the ref to the filter info div */}
      {Object.keys(columnFilters).length > 0 && (
        <div
          ref={filterInfoRef}
          className="dt-filter-info"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            marginBottom: `${theme.gridUnit * 2}px`,
          }}
        >
          <div>
            <Badge
              count={`${filteredRowCount} ${t('of')} ${data.length} ${t('rows')}`}
            />
            <span className="filter-info-text">
              {t('Active filters')}:{' '}
              {Object.entries(columnFilters).map(([key, values], index) => {
                const column = columnsMeta.find(col => col.key === key);
                const columnName = column?.label || key;

                // Format the filter value based on column type
                let displayValues = values;
                if (
                  column?.dataType === GenericDataType.Temporal &&
                  values.length
                ) {
                  try {
                    // Format dates nicely
                    displayValues = values.map(value =>
                      moment(String(value)).format('MMM D, YYYY'),
                    );
                  } catch (e) {
                    // Fallback to raw values if formatting fails
                    displayValues = values;
                  }
                }

                return (
                  <span
                    key={key}
                    style={{ display: 'inline-block', marginRight: '12px' }}
                  >
                    <strong>{columnName}</strong>: {displayValues.join(', ')}
                    {index < Object.keys(columnFilters).length - 1 ? ';' : ''}
                  </span>
                );
              })}
            </span>
          </div>
          <button className="clear-filters-button" onClick={clearAllFilters}>
            {t('Clear all filters')}
          </button>
        </div>
      )}
      <DataTable<D>
        columns={columns}
        data={memoizedData}
        rowCount={rowCount}
        width={widthFromState}
        height={heightFromState}
        tableClassName="table table-striped table-condensed"
        pageSize={pageSize}
        serverPagination={serverPagination}
        pageSizeOptions={pageSizeOptions}
        serverPaginationData={serverPaginationData}
        onServerPaginationChange={handleServerPaginationChange}
        onColumnOrderChange={() => setColumnOrderToggle(!columnOrderToggle)}
        // 9 page items in > 340px works well even for 100+ pages
        maxPageItemCount={width > 340 ? 9 : 7}
        noResults={getNoResultsMessage}
        searchInput={includeSearch && SearchInput}
        selectPageSize={pageSize !== null && SelectPageSize}
        // not in use in Superset, but needed for unit tests
        sticky={sticky}
        renderGroupingHeaders={
          !isEmpty(groupHeaderColumns) ? renderGroupingHeaders : undefined
        }
        renderTimeComparisonDropdown={
          isUsingTimeComparison ? renderTimeComparisonDropdown : undefined
        }
      />
    </Styles>
  );
}
