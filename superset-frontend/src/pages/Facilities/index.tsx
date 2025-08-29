import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { t, styled, SupersetClient } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import ListView, {
  ListViewProps,
  Filter,
  Filters,
  FilterOperator,
} from 'src/components/ListView';
// import { embedDashboard } from '@superset-ui/embedded-sdk'
// import axios from 'axios';
import DashboardPage from 'src/dashboard/containers/DashboardPage';
import {
  Row,
  Col,
  Card,
  Table,
  Select,
  Input,
  Button,
  Tabs,
  Spin,
  Space,
  Typography,
  Statistic,
  Divider,
  Alert,
  Tag,
  Empty,
  Modal,
  Radio,
  InputNumber,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  InfoCircleOutlined,
  BarsOutlined,
  PieChartOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

// Replace Leaflet imports with DeckGL
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, ScatterplotLayer } from '@deck.gl/layers';
import { StaticMap, MapContext } from 'react-map-gl';
import { WebMercatorViewport, Layer, LinearInterpolator } from '@deck.gl/core';

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import rison from 'rison';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';

// Import shared types
import { PickingInfo } from '@deck.gl/core';
import { Facility, FacilityCountData, ChartDataItem, ViewState } from './types';

// Import child tab components
import ListViewTab from './ListViewTab';
import MapViewTab from './MapViewTab';
import AnalyticsTab from './AnalyticsTab';

// Import necessary types for MapViewTab props

const { TabPane } = Tabs;
// const { Title, Text } = Typography;
// const { Option } = Select; // Removed as unused

// Style constants
const MAPBOX_STYLE =
  'https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png';
const MARKER_SIZE = 20;
const SELECTED_MARKER_SIZE = 30;

// Initial map viewState centered on Timor-Leste
const INITIAL_VIEW_STATE = {
  longitude: 125.727539,
  latitude: -8.874217,
  zoom: 9,
  pitch: 0,
  bearing: 0,
};

// Helper function to encode rison parameters
const encodeRisonParams = (params: Record<string, any>) => {
  // Simple rison encoding for parameters
  const encodedParams = Object.keys(params)
    .map(key => `"${key}":${JSON.stringify(params[key])}`)
    .join(',');

  return `(${encodedParams})`;
};

// Styled components
const Container = styled.div`
  padding: 16px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const StyledMapContainer = styled.div`
  height: calc(100vh - 225px); /* Adjust for header, tabs, and padding */
  min-height: 500px;
  width: 100%;
  position: relative;
  margin-bottom: 16px;
`;

const NavigationControls = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: white;
  border-radius: 4px;
  padding: 4px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
`;

const NavButton = styled(Button)`
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FilterContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const FacilityDetailCard = styled(Card)`
  margin-top: 16px;
`;

const StyledStatistic = styled(Statistic)`
  .ant-statistic-title {
    font-size: 14px;
  }
`;

const PAGE_SIZE = 25;

// Main component
function Facilities({
  addSuccessToast,
  addDangerToast,
}: {
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
}) {
  const {
    state: {
      loading,
      resourceCount: facilityCount,
      resourceCollection: facilities,
      bulkSelectEnabled,
    },
    hasPerm,
    fetchData,
    refreshData,
  } = useListViewResource<Facility>(
    'health_facilities',
    t('health facility'),
    addDangerToast,
  );

  // State hooks
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(
    null,
  );
  const [countData, setCountData] = useState<FacilityCountData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('list');
  const [showFacilityModal, setShowFacilityModal] = useState<boolean>(false);

  // Filter state for ListView (Remains)
  // const [filteredFacilities, setFilteredFacilities] = useState<Facility[]>([]); // Removed, ListView uses data prop

  // Map state (Remains for map control)
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const deckRef = useRef<any>(null); // This might move to MapViewTab if DeckGL moves entirely

  // Handle view state changes with proper typing
  const handleViewStateChange = useCallback((params: any) => {
    const { viewState: nextViewState } = params;
    setViewState(nextViewState);
    // Debounced API call would happen in MapViewTab based on this viewState change
  }, []);

  // Restore Navigation control handlers
  const handleZoomIn = useCallback(() => {
    setViewState((currentViewState: ViewState) => ({
      ...currentViewState,
      zoom: Math.min((currentViewState.zoom || 0) + 1, 20),
      transitionDuration: 300,
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState((currentViewState: ViewState) => ({
      ...currentViewState,
      zoom: Math.max((currentViewState.zoom || 0) - 1, 1),
      transitionDuration: 300,
    }));
  }, []);

  const handleResetBearing = useCallback(() => {
    setViewState((currentViewState: ViewState) => ({
      ...currentViewState,
      bearing: 0,
      transitionDuration: 300,
    }));
  }, []);

  const handleResetNorth = useCallback(() => {
    setViewState((currentViewState: ViewState) => ({
      ...currentViewState,
      pitch: 0,
      bearing: 0,
      transitionDuration: 300,
    }));
  }, []);
  // End Restore Navigation control handlers

  // Create the base tile layer using the same pattern as DeckGLContainer.tsx
  const osmTileLayer = useMemo(
    () =>
      new TileLayer({
        id: 'osm-tile-layer',
        data: MAPBOX_STYLE,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        renderSubLayers: props => {
          const [[west, south], [east, north]] = props.tile.boundingBox;
          const { data, ...otherProps } = props;

          return [
            new BitmapLayer(otherProps, {
              image: data,
              bounds: [west, south, east, north],
            }),
          ];
        },
      }),
    [],
  );

  // Create a ScatterplotLayer for facilities
  const facilitiesLayer = useMemo(
    () =>
      new ScatterplotLayer({
        id: 'facilities-layer',
        data: facilities,
        pickable: true,
        stroked: false,
        filled: true,
        radiusScale: 6,
        radiusMinPixels: 5,
        radiusMaxPixels: 30,
        getPosition: (d: Facility) => [d.longitude, d.latitude],
        getFillColor: (d: Facility) => {
          if (selectedFacility && d.id === selectedFacility.id) {
            return [255, 0, 0, 255]; // Red for selected
          }
          if (selectedFacility && d.id === selectedFacility.id) {
            return [255, 140, 0, 255]; // Orange for selected
          }
          return [0, 140, 255, 200]; // Default blue
        },
        getRadius: (d: Facility) => {
          if (selectedFacility && d.id === selectedFacility.id) {
            return SELECTED_MARKER_SIZE;
          }
          return MARKER_SIZE;
        },
        updateTriggers: {
          getFillColor: [selectedFacility],
          getRadius: [selectedFacility],
        },
        onHover: (info: any) => {
          // setHoveredFacility(info.object || null);
        },
      }),
    [selectedFacility, viewState, facilities],
  );

  // User location marker layer
  const userLocationLayer = useMemo(() => {
    if (!selectedFacility) return null;

    return new ScatterplotLayer({
      id: 'user-location-layer',
      data: [
        { position: [selectedFacility.longitude, selectedFacility.latitude] },
      ],
      pickable: false,
      stroked: true,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      getPosition: (d: any) => d.position,
      getFillColor: [0, 0, 255, 180],
      getLineColor: [0, 0, 255, 255],
      getLineWidth: 2,
    });
  }, [selectedFacility]);

  // Combine all layers using the DeckGLContainer pattern
  const layers = useMemo(() => {
    const allLayers: Layer[] = [osmTileLayer];

    // Add the facilities layer
    allLayers.push(facilitiesLayer);

    // Add conditional layers if they exist
    if (userLocationLayer) allLayers.push(userLocationLayer);

    return allLayers;
  }, [osmTileLayer, facilitiesLayer, userLocationLayer]);

  // Tooltip logic (Can remain here, passed to MapViewTab)
  const getFacilityTooltip = useCallback(
    (info: PickingInfo): { html: string; style?: object } | null => {
      // Check if the picked object is a Facility (adjust check as needed based on your layers)
      if (
        info.object &&
        typeof info.object === 'object' &&
        'facility_type' in info.object
      ) {
        const facility = info.object as Facility;

        // Create emergency and ambulance indicators if available
        const emergencyIndicator = facility.has_emergency
          ? '<div style="color: #fa8c16; margin-top: 4px;"><span style="margin-right: 4px;">⚠️</span> Emergency services available</div>'
          : '';

        const ambulanceIndicator = facility.has_ambulance
          ? '<div style="color: #52c41a; margin-top: 4px;"><span style="margin-right: 4px;">🚑</span> Ambulance service available</div>'
          : '';

        // Create a more informative tooltip
        return {
          html: `
          <div style="padding: 10px">
            <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 4px;">${facility.name}</div>
            <div><span style="color: #666;">Type:</span> ${facility.facility_type}</div>
            <div><span style="color: #666;">Location:</span> ${facility.location || 'N/A'}</div>
            <div><span style="color: #666;">Municipality:</span> ${facility.municipality || 'N/A'}</div>
            ${emergencyIndicator}
            ${ambulanceIndicator}
          </div>
        `,
          style: {
            backgroundColor: 'white',
            fontSize: '0.8em',
            color: '#333',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            maxWidth: '280px',
            pointerEvents: 'none',
          },
        };
      }
      return null;
    },
    [],
  );

  // Effects
  useEffect(() => {
    loadFacilityTypes();
    fetchLocations();
    fetchCountData();
  }, []);

  const typesToSelectOptions = (types: string[]) =>
    types.map(type => ({
      value: type,
      label: type,
      key: type,
    }));

  // Add this new function for populating state
  const loadFacilityTypes = async () => {
    try {
      // Use SupersetClient directly as we just need the list
      const response = await SupersetClient.get({
        endpoint: '/api/v1/health_facilities/types',
      });
      const types = response.json?.data?.types;
      if (Array.isArray(types)) {
        console.log('Setting Facility Types State:', types); // Log for debugging
        setFacilityTypes(types); // Update the state directly
      } else {
        console.warn(
          'Unexpected response format for facility types state:',
          response,
        );
        setFacilityTypes([]);
        addDangerToast(t('Received unexpected facility types data format'));
      }
    } catch (error) {
      console.error('Error loading facility types for state:', error);
      setFacilityTypes([]);
      addDangerToast(t('Error loading facility types'));
    }
  };

  // *** Restore the original fetchFacilityTypes for ListView filters ***
  const fetchFacilityTypes = async (
    filterValue = '',
    page = 0,
    pageSize = 25,
  ) => {
    try {
      // Use cachedSupersetGet as originally intended for filters
      const response = await cachedSupersetGet({
        endpoint: '/api/v1/health_facilities/types',
      });

      let typeOptions: { value: string; label: string; key: string }[] = [];
      if (
        response.json?.data?.types &&
        Array.isArray(response.json.data.types)
      ) {
        typeOptions = typesToSelectOptions(response.json.data.types);
      } else {
        console.warn(
          'Unexpected response format for facility types (filter):',
          response,
        );
        addDangerToast(t('Received unexpected facility types data format'));
      }

      // Filter based on search value if provided
      const filteredData = filterValue
        ? typeOptions.filter(t =>
            t.label.toLowerCase().includes(filterValue.toLowerCase()),
          )
        : typeOptions;

      // Return the object structure expected by fetchSelects
      return {
        data: filteredData.slice(page * pageSize, (page + 1) * pageSize),
        totalCount: filteredData.length,
      };
    } catch (error) {
      console.error('Error fetching facility types (filter):', error);
      addDangerToast(t('Error loading facility types'));
      return { data: [], totalCount: 0 };
    }
  };
  // *** End Restore ***

  const municipalitiesToSelectOptions = (municipalities: string[]) =>
    municipalities.map(municipality => ({
      value: municipality,
      label: municipality,
      key: municipality,
    }));

  const fetchMunicipalities = async (
    filterValue = '',
    page = 0,
    pageSize = 25,
  ) => {
    try {
      // Since the municipalities endpoint is not registered, we'll use locations endpoint
      // which is registered in include_route_methods
      const response = await cachedSupersetGet({
        endpoint: '/api/v1/health_facilities/municipalities',
      });
      console.log('response', response);
      let municipalities: { value: string; label: string; key: string }[] = [];

      if (response.json?.data?.municipalities) {
        municipalities = municipalitiesToSelectOptions(
          response.json.data.municipalities,
        );
      } else {
        console.warn(
          'Unexpected response format for municipalities:',
          response,
        );
        addDangerToast(t('Unexpected response format for municipalities'));
      }

      // Filter based on search value if provided
      const filteredData = filterValue
        ? municipalities.filter(m =>
            m.label.toLowerCase().includes(filterValue.toLowerCase()),
          )
        : municipalities;

      // Format the return to match expected structure for fetchSelects
      return {
        data: filteredData.slice(page * pageSize, (page + 1) * pageSize),
        totalCount: filteredData.length,
      };
    } catch (error) {
      console.error('Error fetching municipalities:', error);
      addDangerToast(t('Error loading municipalities'));
      return { data: [], totalCount: 0 };
    }
  };

  const locationsToSelectOptions = (locations: string[]) =>
    locations.map(location => ({
      value: location,
      label: location,
      key: location,
    }));

  const fetchLocations = async (filterValue = '', page = 0, pageSize = 25) => {
    try {
      const response = await cachedSupersetGet({
        endpoint: '/api/v1/health_facilities/locations',
      });

      if (response.json?.data?.locations) {
        const fetchedLocations = response.json.data.locations;
        // Also update the locations state here
        if (Array.isArray(fetchedLocations)) {
          console.log('Setting Locations State:', fetchedLocations);
          setLocations(fetchedLocations);
        }
        // Continue formatting for ListView filter
        const locationOptions = locationsToSelectOptions(fetchedLocations);
        const filteredData = filterValue
          ? locationOptions.filter(l =>
              l.label.toLowerCase().includes(filterValue.toLowerCase()),
            )
          : locationOptions;
        return {
          data: filteredData.slice(page * pageSize, (page + 1) * pageSize),
          totalCount: filteredData.length,
        };
      }
      console.warn('Unexpected response format for locations:', response);
      addDangerToast(t('Received unexpected locations data format'));
      setLocations([]); // Clear state on error/bad format
      return { data: [], totalCount: 0 };
    } catch (error) {
      console.error('Error fetching locations:', error);
      addDangerToast(t('Error loading facility locations'));
      setLocations([]); // Clear state on error
      return { data: [], totalCount: 0 };
    }
  };

  const fetchCountData = async () => {
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/health_facilities/counts',
      });

      if (response.json?.data) {
        setCountData(response.json.data);
      } else {
        console.warn('Unexpected response format for count data:', response);
        setCountData(null);
        addDangerToast(t('Received unexpected count data format'));
      }
    } catch (error) {
      console.error('Error fetching count data:', error);
      addDangerToast(t('Error loading facility count data'));
    }
  };

  // Helper functions
  const handleFacilityClick = (facility: Facility) => {
    setSelectedFacility(facility);
    setShowFacilityModal(true);
    // Optionally trigger map view change here or let MapViewTab handle it via useEffect
    // setViewState({...});
  };

  // Filter definition for ListView (Remains)
  const listViewFilters: Filter[] = [
    {
      Header: t('Name'),
      id: 'name',
      key: 'name',
      input: 'search',
      operator: FilterOperator.Contains,
    },
    {
      Header: t('Type'),
      id: 'facility_type',
      key: 'facility_type',
      input: 'select',
      operator: FilterOperator.Equals,
      fetchSelects: fetchFacilityTypes,
    },
    {
      Header: t('Location'),
      id: 'location',
      key: 'location',
      input: 'select',
      operator: FilterOperator.Equals,
      fetchSelects: fetchLocations,
    },
    {
      Header: t('Municipality'),
      id: 'municipality',
      key: 'municipality',
      input: 'select',
      operator: FilterOperator.Equals,
      fetchSelects: fetchMunicipalities,
    },
    {
      Header: t('Services Offered'),
      id: 'services',
      key: 'services',
      input: 'search',
      operator: FilterOperator.Contains,
    },
  ];

  return (
    <Container>
      {/* <Title level={2}>{t('Health Facilities')}</Title> */}

      {errorMessage && (
        <Alert
          message={errorMessage}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={key => setActiveTab(key)}>
        <TabPane
          tab={
            <span>
              <BarsOutlined /> {t('List View')}
            </span>
          }
          key="list"
        >
          <ListViewTab
            loading={loading}
            facilityCount={facilityCount}
            facilities={facilities}
            fetchData={fetchData}
            refreshData={refreshData}
            filters={listViewFilters}
            handleFacilityClick={handleFacilityClick}
            setSelectedFacility={setSelectedFacility}
            setActiveTab={setActiveTab}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
            pageSize={PAGE_SIZE}
          />
        </TabPane>

        <TabPane
          tab={
            <span>
              <EnvironmentOutlined /> {t('Map View')}
            </span>
          }
          key="map"
        >
          <MapViewTab
            // Map state and handlers
            viewState={viewState}
            handleViewStateChange={handleViewStateChange}
            getFacilityTooltip={getFacilityTooltip}
            initialViewState={INITIAL_VIEW_STATE}
            // Map navigation controls
            handleZoomIn={handleZoomIn}
            handleZoomOut={handleZoomOut}
            handleResetBearing={handleResetBearing}
            handleResetNorth={handleResetNorth}
            // State/handlers from parent
            selectedFacility={selectedFacility}
            setActiveTab={setActiveTab}
            facilityTypes={facilityTypes}
            locations={locations}
            addDangerToast={addDangerToast}
            setSelectedFacility={setSelectedFacility}
          />
        </TabPane>

        <TabPane
          tab={
            <span>
              <PieChartOutlined /> {t('Analytics')}
            </span>
          }
          key="analytics"
        >
          <AnalyticsTab countData={countData} loading={loading || !countData} />
        </TabPane>
      </Tabs>

      {/* Facility Details Modal */}
      <Modal
        title={selectedFacility ? `${selectedFacility.name} Details` : ''}
        visible={showFacilityModal}
        onCancel={() => setShowFacilityModal(false)}
        footer={[
          <Button
            key="view-map"
            type="primary"
            onClick={() => {
              // setSelectedFacility(null);
              setShowFacilityModal(false);
              setActiveTab('map');
            }}
          >
            {t('View on Map')}
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => setShowFacilityModal(false)}
          >
            {t('Close Details')}
          </Button>,
        ]}
        width={700}
      >
        {selectedFacility && (
          <Row gutter={16}>
            <Col span={12}>
              <p>
                <BankOutlined /> <strong>Type:</strong>{' '}
                {selectedFacility.facility_type}
              </p>
              <p>
                <EnvironmentOutlined /> <strong>Location:</strong>{' '}
                {selectedFacility.location}, {selectedFacility.municipality}
              </p>
              {selectedFacility.address && (
                <p>
                  <EnvironmentOutlined /> <strong>Address:</strong>{' '}
                  {selectedFacility.address}
                </p>
              )}
              {selectedFacility.phone && (
                <p>
                  <PhoneOutlined /> <strong>Phone:</strong>{' '}
                  {selectedFacility.phone}
                </p>
              )}
              {selectedFacility.email && (
                <p>
                  <MailOutlined /> <strong>Email:</strong>{' '}
                  {selectedFacility.email}
                </p>
              )}
            </Col>
            <Col span={12}>
              {selectedFacility.services && (
                <p>
                  <InfoCircleOutlined /> <strong>Services:</strong>{' '}
                  {selectedFacility.services}
                </p>
              )}
              {selectedFacility.operating_hours && (
                <p>
                  <InfoCircleOutlined /> <strong>Hours:</strong>{' '}
                  {selectedFacility.operating_hours}
                </p>
              )}
              <p>
                <InfoCircleOutlined /> <strong>Total Beds:</strong>{' '}
                {selectedFacility.total_beds || 'N/A'}
              </p>
              <p>
                <InfoCircleOutlined /> <strong>Maternity Beds:</strong>{' '}
                {selectedFacility.maternity_beds || 'N/A'}
              </p>
              <p>
                <InfoCircleOutlined /> <strong>Ambulance:</strong>{' '}
                {selectedFacility.has_ambulance ? 'Yes' : 'No'}
              </p>
              <p>
                <InfoCircleOutlined /> <strong>Emergency Services:</strong>{' '}
                {selectedFacility.has_emergency ? 'Yes' : 'No'}
              </p>
            </Col>
          </Row>
        )}
      </Modal>
    </Container>
  );
}

export default withToasts(Facilities);
