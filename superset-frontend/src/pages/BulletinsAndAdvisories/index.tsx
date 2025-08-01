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
import BulletinDetailModal from './BulletinDetailModal';
import moment from 'moment';
import { createErrorHandler } from 'src/views/CRUD/utils';
import DeleteModal from 'src/components/DeleteModal';
import Icons from 'src/components/Icons';
import { SupersetClient } from '@superset-ui/core';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import rison from 'rison';
import FacePile from 'src/components/FacePile';
import { Tooltip, Dropdown, Menu, Button } from 'antd';
import Tag from 'antd/es/tag';
import { DownloadOutlined, MailOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Carousel } from 'antd';
import cx from 'classnames';

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
  'image_attachments',
  'created_by.first_name',
  'created_by.last_name',
  'created_on',
  'changed_on',
  'disease_forecast_alert.municipality_code',
  'disease_forecast_alert.municipality_name',
  'disease_forecast_alert.forecast_date',
  'disease_forecast_alert.disease_type',
  'disease_forecast_alert.alert_level',
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

const FeedCardWrapper = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.card-selected {
    border-color: ${({ theme }) => theme.colors.primary.base};
    box-shadow: 0 0 0 3px ${({ theme }) => theme.colors.primary.light2}, 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  .feed-card-title {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  }

  .feed-card-meta {
    color: ${({ theme }) => theme.colors.grayscale.base};
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }

  .feed-card-section {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    white-space: pre-wrap; // Handles \n for newlines

    .section-title {
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
      font-size: ${({ theme }) => theme.typography.sizes.m}px;
    }

    .section-content {
      font-size: ${({ theme }) => theme.typography.sizes.s}px;
      white-space: pre-wrap;
    }
  }

  .feed-card-attachments {
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    .feed-card-attachment-image {
      width: 100%;
      max-height: 300px; // Adjust as needed
      object-fit: cover;
      border-radius: ${({ theme }) => theme.borderRadius}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
    }
    .attachment-caption {
      font-size: ${({ theme }) => theme.typography.sizes.xs}px;
      color: ${({ theme }) => theme.colors.grayscale.base};
      text-align: center;
      margin-top: ${({ theme }) => theme.gridUnit}px;
    }
  }
   // Custom styles for Carousel arrows
  .ant-carousel {
    .slick-prev,
    .slick-next {
      font-size: ${({ theme }) => theme.typography.sizes.l}px;
      color: ${({ theme }) => theme.colors.grayscale.light5};
      background-color: rgba(0, 0, 0, 0.2);
      border-radius: 50%;
      width: 25px;
      height: 25px;
      line-height: 25px;
      z-index: 1;
      &:hover {
        background-color: rgba(0, 0, 0, 0.4);
      }
    }
    .slick-prev { left: 5px; }
    .slick-next { right: 5px; }
    .slick-dots li button {
        background: ${({ theme }) => theme.colors.primary.base};
    }
    .slick-dots li.slick-active button {
        background: ${({ theme }) => theme.colors.primary.dark1};
    }
  }


  .feed-card-hashtags {
    margin-top: ${({ theme }) => theme.gridUnit * 2}px;
    .ant-tag {
      margin-right: ${({ theme }) => theme.gridUnit * 1}px;
      margin-bottom: ${({ theme }) => theme.gridUnit * 1}px;
    }
  }
`;

// New styled components for FeedCard actions
const FeedActionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
  margin-left: ${({ theme }) => theme.gridUnit * 4}px;
  flex-shrink: 0; // Prevent shrinking when card content is long
`;

const FeedActionButton = styled(Button)`
  // Styling for individual action buttons in the feed view
  // e.g., to ensure consistent sizing or appearance
  // width: 32px;
  // height: 32px;
  // display: flex;
  // align-items: center;
  // justify-content: center;
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
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [bulletinToView, setBulletinToView] = useState<Bulletin | null>(null);

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

  const handleDownloadPdf = async (bulletinId: number, bulletinTitle: string) => {
    console.log('handleDownloadPdf function entered for ID:', bulletinId, 'at', new Date().toISOString());
    try {
      // Direct navigation to trigger download
      const pdfUrl = `/api/v1/bulletins_and_advisories/${bulletinId}/pdf/`;
      window.location.href = pdfUrl;
      // No need to add success toast here as the browser handles the download.
    } catch (error) { // This catch might not even be hit if direct navigation works
      console.error('Error initiating PDF download:', error);
      addDangerToast(t('Failed to initiate PDF download. Please check the console for details.'));
    }
  };

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
        Cell: ({ row: { original } }: any) => {
          const handleClick = () => {
            setBulletinToView(original);
            setDetailModalVisible(true);
          };
          
          return (
            <div 
              role="button" 
              tabIndex={0}
              onClick={handleClick}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <Icons.File style={{ marginRight: 8, color: '#666' }} />
              {original.title}
            </div>
          );
        },
        Header: t('Title'),
        accessor: 'title',
      },
      {
        Cell: ({ row: { original } }: any) => {
          if (original.alert_type === 'disease') {
            return <>{t('Disease')}</>;
          }
          if (original.alert_type === 'weather') {
            return <>{t('Weather')}</>;
          }
          return null;
        },
        Header: t('Bulletin Type'),
        accessor: 'alert_type',
      },
      {
        Cell: ({ row: { original } }: any) => {
          if (original.disease_forecast_alert?.disease_type) {
            return <>{original.disease_forecast_alert.disease_type}</>;
          }
          if (original.weather_forecast_alert?.weather_parameter) {
            return <>{original.weather_forecast_alert.weather_parameter}</>;
          }
          return null;
        },
        Header: t('Parameter'),
        accessor: 'parameter',
      },
      {
        Cell: ({ row: { original } }: any) => {
          if (original.disease_forecast_alert?.municipality_name) {
            return <>{original.disease_forecast_alert.municipality_name}</>;
          }
          if (original.weather_forecast_alert?.municipality_name) {
            return <>{original.weather_forecast_alert.municipality_name}</>;
          }
          return null;
        },
        Header: t('Municipality'),
        accessor: 'municipality_name',
      },
      {
        Cell: ({ row: { original } }: any) => {
          if (original.disease_forecast_alert?.forecast_date) {
            return <>{moment(original.disease_forecast_alert.forecast_date).format('DD MMMM, YYYY')}</>;
          }
          if (original.weather_forecast_alert?.forecast_date) {
            return <>{moment(original.weather_forecast_alert.forecast_date).format('DD MMMM, YYYY')}</>;
          }
          return null;
        },
        Header: t('Forecast Date'),
        accessor: 'forecast_date',
      },
      {
        Cell: ({ row: { original } }: any) => <>{moment(original.created_on).format('DD MMMM, YYYY hh:mm A')}</>,
        Header: t('Created Date'),
        accessor: 'created_on',
      },
      {
        Cell: ({ row: { original } }: any) => {
          // Only show if different from created_on
          if (original.changed_on && original.changed_on !== original.created_on) {
            return <>{moment(original.changed_on).format('DD MMMM, YYYY hh:mm A')}</>;
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
          
          const handleDisseminate = () => {
            window.location.href = `/disseminatebulletin/form/?bulletin_id=${original.id}`;
          };
          
          return (
            <Actions className="actions">
              {hasPerm('can_write') && (
                <>
                  <Tooltip
                    id="disseminate-action-tooltip"
                    title={t('Disseminate Bulletin')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={handleDisseminate}
                      data-test="bulletin-disseminate-action"
                    >
                      <Icons.Email data-test="bulletin-disseminate-icon" />
                    </span>
                  </Tooltip>
                  <Tooltip
                    id="download-pdf-action-tooltip"
                    title={t('Download PDF')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('Download button span clicked for ID:', original.id, 'at', new Date().toISOString());
                        handleDownloadPdf(original.id, original.title);
                      }}
                      data-test="bulletin-download-pdf-action"
                    >
                      <DownloadOutlined data-test="bulletin-download-pdf-icon" />
                    </span>
                  </Tooltip>
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
                      data-test="bulletin-delete-action"
                    >
                      <Icons.Trash data-test="bulletin-delete-icon" />
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
      // Hidden columns for filter support
      {
        Header: '',
        id: 'alert_type_hidden',
        accessor: 'alert_type',
        disableSortBy: true,
        disableResizing: true,
        disableFilters: false,
        hidden: true,
      },
      {
        Header: '',
        id: 'created_on_start',
        accessor: 'created_on_start',
        disableSortBy: true,
        disableResizing: true,
        disableFilters: false,
        hidden: true,
      },
      {
        Header: '',
        id: 'forecast_date_start',
        accessor: 'forecast_date_start',
        disableSortBy: true,
        disableResizing: true,
        disableFilters: false,
        hidden: true,
      },
      {
        Header: '',
        id: 'bulletin_type',
        accessor: 'bulletin_type',
        disableSortBy: true,
        disableResizing: true,
        disableFilters: false,
        hidden: true,
      },
      {
        Header: '',
        id: 'municipality_code',
        accessor: 'municipality_code',
        disableSortBy: true,
        disableResizing: true,
        disableFilters: false,
        hidden: true,
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
        Header: t('Created Date Range'),
        id: 'created_on_start',
        key: 'created_on_start',
        input: 'datetime_range',
        operator: FilterOperator.Between,
      },
      {
        Header: t('Forecast Date Range'),
        id: 'forecast_date_start',
        key: 'forecast_date_start',
        input: 'datetime_range',
        operator: FilterOperator.Between,
      },
      {
        Header: t('Bulletin Type'),
        id: 'bulletin_type',
        key: 'bulletin_type',
        input: 'select',
        operator: FilterOperator.Equals,
        selects: [
          { label: t('Disease'), value: 'disease' },
          { label: t('Weather'), value: 'weather' },
        ],
      },
      {
        Header: t('Municipality'),
        id: 'municipality_code',
        key: 'municipality_code',
        input: 'select',
        operator: FilterOperator.Equals,
        selects: [
          { label: t('Aileu'), value: 'TL-AL' },
          { label: t('Ainaro'), value: 'TL-AN' },
          { label: t('Atauro'), value: 'TL-AT' },
          { label: t('Baucau'), value: 'TL-BA' },
          { label: t('Bobonaro'), value: 'TL-BO' },
          { label: t('Covalima'), value: 'TL-CO' },
          { label: t('Dili'), value: 'TL-DI' },
          { label: t('Ermera'), value: 'TL-ER' },
          { label: t('Manatuto'), value: 'TL-MT' },
          { label: t('Manufahi'), value: 'TL-MF' },
          { label: t('Lautém'), value: 'TL-LA' },
          { label: t('Liquiça'), value: 'TL-LI' },
          { label: t('Raeoa'), value: 'TL-OE' },
          { label: t('Viqueque'), value: 'TL-VI' },
        ],
      },
      // {
      //   Header: t('Hashtags'),
      //   id: 'hashtags',
      //   key: 'hashtags',
      //   input: 'search',
      //   operator: FilterOperator.Contains,
      //   debounceTime: 300,
      // },
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

  const renderFeedCard = useCallback((bulletin: Bulletin & { isSelected?: boolean }) => {
    if (!bulletin) {
      return null;
    }
    const { isSelected } = bulletin;
    // const hashtags = bulletin.hashtags?.split(',').map(tag => tag.trim()).filter(tag => tag) || [];

    // console.log(`Rendering FeedCard: ${bulletin.title}, isSelected: ${isSelected}, bulkSelectEnabled: ${bulkSelectEnabled}`); // DEBUG

    const handleEdit = () => {
      setBulletinToEdit(bulletin);
      setEditModalVisible(true);
    };

    const handleDelete = () => {
      setBulletinToDelete(bulletin);
    };

    const handleDisseminate = () => {
      window.location.href = `/disseminatebulletin/form/?bulletin_id=${bulletin.id}`;
    };

    const menu = (
      <Menu>
        {hasPerm('can_write') && (
          <Menu.Item key="edit" icon={<EditOutlined />} onClick={(e) => { e.domEvent.stopPropagation(); handleEdit(); }}>
            {t('Edit')}
          </Menu.Item>
        )}
        {hasPerm('can_write') && (
          <Menu.Item key="delete" icon={<DeleteOutlined />} onClick={(e) => { e.domEvent.stopPropagation(); handleDelete(); }}>
            {t('Delete')}
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
        <FeedCardWrapper 
          style={{ flexGrow: 1, minWidth: 0 }}
          className={cx({ 'card-selected': bulkSelectEnabled && isSelected })}
        >
          <div className="feed-card-title" onClick={() => { setBulletinToView(bulletin); setDetailModalVisible(true); }} style={{cursor: 'pointer'}}>{bulletin.title}</div>
          <div className="feed-card-meta">
            {bulletin.created_by && (
              <span>
                {t('Posted by %s %s', bulletin.created_by.first_name, bulletin.created_by.last_name)}
                {' • '}
              </span>
            )}
            {bulletin.created_on && (
              <span>
                {t('Created %s', moment(bulletin.created_on).format('DD MMMM, YYYY hh:mm A'))}
              </span>
            )}
            {bulletin.changed_on && bulletin.changed_on !== bulletin.created_on && (
              <span>
                {' • '}
                {t('Updated %s', moment(bulletin.changed_on).format('DD MMMM, YYYY hh:mm A'))}
              </span>
            )}
            {(bulletin.disease_forecast_alert?.forecast_date || bulletin.weather_forecast_alert?.forecast_date) && (
              <span>
                {' • '}
                {t('Forecast Date: %s', moment(
                  bulletin.disease_forecast_alert?.forecast_date || bulletin.weather_forecast_alert?.forecast_date
                ).format('DD MMMM, YYYY'))}
              </span>
            )}
            {(bulletin.disease_forecast_alert?.municipality_name || bulletin.weather_forecast_alert?.municipality_name) && (
              <span>
                {' • '}
                {t('Municipality: %s', bulletin.disease_forecast_alert?.municipality_name || bulletin.weather_forecast_alert?.municipality_name)}
              </span>
            )}
            {bulletin.disease_forecast_alert?.disease_type && (
              <span>
                {' • '}
                {t('Disease: %s', bulletin.disease_forecast_alert.disease_type)}
              </span>
            )}
            {bulletin.weather_forecast_alert?.weather_parameter && (
              <span>
                {' • '}
                {t('Parameter: %s', bulletin.weather_forecast_alert.weather_parameter)}
              </span>
            )}
          </div>

          {bulletin.image_attachments && bulletin.image_attachments.length > 0 && (
            <div className="feed-card-attachments feed-card-section">
              <div className="section-title">{t('Attachments')}</div>
              {bulletin.image_attachments.length === 1 ? (
                <div>
                  <img
                    className="feed-card-attachment-image"
                    src={bulletin.image_attachments[0].url}
                    alt={bulletin.image_attachments[0].caption || 'Attachment'}
                  />
                  {bulletin.image_attachments[0].caption && (
                    <p className="attachment-caption">{bulletin.image_attachments[0].caption}</p>
                  )}
                </div>
              ) : (
                <Carousel autoplay dotPosition="top">
                  {bulletin.image_attachments.map(attachment => (
                    <div key={attachment.id}>
                      <img
                        className="feed-card-attachment-image"
                        src={attachment.url}
                        alt={attachment.caption || 'Attachment'}
                      />
                      {attachment.caption && (
                        <p className="attachment-caption">{attachment.caption}</p>
                      )}
                    </div>
                  ))}
                </Carousel>
              )}
            </div>
          )}

          {bulletin.advisory && (
            <div className="feed-card-section">
              <div className="section-title">{t('Advisory')}</div>
              <div className="section-content">
                {bulletin.advisory.split('\\n').map((line, index, arr) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {bulletin.risks && (
            <div className="feed-card-section">
              <div className="section-title">{t('Risks')}</div>
              <div className="section-content">
                {bulletin.risks.split('\\n').map((line, index, arr) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {bulletin.safety_tips && (
            <div className="feed-card-section">
              <div className="section-title">{t('Safety Tips')}</div>
              <div className="section-content">
                {bulletin.safety_tips.split('\\n').map((line, index, arr) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < arr.length - 1 && <br />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* {hashtags.length > 0 && (
            <div className="feed-card-hashtags feed-card-section">
              <div className="section-title">{t('Hashtags')}</div>
              {hashtags.map(tag => (
                <Tag key={tag}>#{tag}</Tag>
              ))}
            </div>
          )} */}
        </FeedCardWrapper>
        <FeedActionsContainer>
          {hasPerm('can_write') && <Tooltip title={t('Disseminate Bulletin')}>
            <FeedActionButton
              icon={<MailOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDisseminate();
              }}
              aria-label={t('Disseminate Bulletin')}
            />
          </Tooltip>}
          <Tooltip title={t('Download PDF')}>
            <FeedActionButton
              icon={<DownloadOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleDownloadPdf(bulletin.id, bulletin.title);
              }}
              aria-label={t('Download PDF')}
            />
          </Tooltip>
          {hasPerm('can_write') && (
            <Dropdown overlay={menu} trigger={['click']}>
              <FeedActionButton
                icon={<MoreOutlined />}
                onClick={e => e.stopPropagation()}
                aria-label={t('More actions')}
              />
            </Dropdown>
          )}
        </FeedActionsContainer>
      </div>
    );
  }, [hasPerm, refreshData, addDangerToast, addSuccessToast, setBulletinToEdit, setEditModalVisible, setBulletinToDelete, setBulletinToView, setDetailModalVisible, bulkSelectEnabled]);

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
            renderFeedCard={renderFeedCard}
            defaultViewMode="table"
          />
        )}
      </ConfirmStatusChange>

      <CreateBulletinModal
        isOpen={createModalVisible}
        toggle={() => setCreateModalVisible(false)}
        onBulletinCreated={() => {
          setCreateModalVisible(false);
          refreshData();
        }}
      />

      <EditBulletinModal
        isOpen={editModalVisible}
        toggle={() => {
          setEditModalVisible(false);
          setBulletinToEdit(null);
        }}
        onBulletinUpdated={() => {
          setEditModalVisible(false);
          setBulletinToEdit(null);
          refreshData();
        }}
        bulletin={bulletinToEdit}
      />

      {bulletinToView && (
        <BulletinDetailModal
          bulletin={bulletinToView}
          onClose={() => {
            setDetailModalVisible(false);
            setBulletinToView(null);
          }}
          hasPerm={hasPerm}
          refreshData={refreshData}
        />
      )}

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