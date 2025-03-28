import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { t, styled } from '@superset-ui/core';
import { SupersetClient } from '@superset-ui/core';
import withToasts from "src/components/MessageToasts/withToasts";
import { useListViewResource } from 'src/views/CRUD/hooks';
import ListView, { ListViewProps, Filter, Filters, FilterOperator } from 'src/components/ListView';
// import { embedDashboard } from '@superset-ui/embedded-sdk'
// import axios from 'axios';
import DashboardPage from "src/dashboard/containers/DashboardPage";
import { 
  Row, Col, Card, Table, Select, Input, Button, Tabs, Spin, Space,
  Typography, Statistic, Divider, Alert, Tag, Empty, Modal, Radio, InputNumber
} from 'antd';
import { 
  SearchOutlined, EnvironmentOutlined, BankOutlined, 
  PhoneOutlined, MailOutlined, InfoCircleOutlined,
  BarsOutlined, PieChartOutlined, BarChartOutlined 
} from '@ant-design/icons';

// Replace Leaflet imports with DeckGL
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import { StaticMap, MapContext } from 'react-map-gl';
import { WebMercatorViewport, Layer, LinearInterpolator } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';

import {
  ResponsiveContainer, PieChart, Pie, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import rison from 'rison';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';

const { TabPane } = Tabs;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

// Initial map viewState centered on Timor-Leste
const INITIAL_VIEW_STATE = {
  longitude: 125.727539,
  latitude: -8.874217,
  zoom: 9,
  pitch: 0,
  bearing: 0
};

// Style constants
const MAPBOX_STYLE = 'https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png';
const MARKER_SIZE = 20;
const SELECTED_MARKER_SIZE = 30;

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

// Type definitions
interface Facility {
  id: number;
  name: string;
  facility_type: string;
  location: string;
  municipality: string;
  address?: string;
  phone?: string;
  email?: string;
  services?: string;
  operating_hours?: string;
  latitude: number;
  longitude: number;
  total_beds?: number;
  maternity_beds?: number;
  has_ambulance: boolean;
  has_emergency: boolean;
  created_on?: string;
  distance?: number;
}

interface FacilityCountData {
  total: number;
  by_type: Record<string, number>;
  by_location: Record<string, number>;
  by_municipality: Record<string, number>;
}

interface ChartDataItem {
  name: string;
  value: number;
}

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch?: number;
  bearing?: number;
  transitionDuration?: number;
  transitionInterpolator?: LinearInterpolator;
}

const PAGE_SIZE = 25;

// Main component
function Facilities({ addSuccessToast, addDangerToast }: {
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
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [countData, setCountData] = useState<FacilityCountData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('list');
  const [showFacilityModal, setShowFacilityModal] = useState<boolean>(false);
  
  // Filter state
  const [filteredFacilities, setFilteredFacilities] = useState<Facility[]>([]);
  
  // User location
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [nearbyFacilities, setNearbyFacilities] = useState<Facility[]>([]);
  const [searchRadius, setSearchRadius] = useState<number>(10);
  const [showNearbyModal, setShowNearbyModal] = useState<boolean>(false);
  const [nearbyLoading, setNearbyLoading] = useState<boolean>(false);

  // Map state
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [hoveredFacility, setHoveredFacility] = useState<Facility | null>(null);
  const deckRef = useRef<any>(null);

  // Handle view state changes with proper typing
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const TICK = 250; // milliseconds

  const handleViewStateChange = useCallback((params: any) => {
    const { viewState } = params;
    setViewState(viewState);
    setLastUpdate(Date.now());
  }, []);

  // Rate limit viewport updates
  useEffect(() => {
    if (lastUpdate && Date.now() - lastUpdate > TICK) {
      setLastUpdate(null);
    }
  }, [lastUpdate, viewState]);

  // Update view state when selected facility changes
  useEffect(() => {
    if (selectedFacility?.latitude && selectedFacility?.longitude) {
      setViewState({
        ...viewState,
        longitude: selectedFacility.longitude,
        latitude: selectedFacility.latitude,
        zoom: 14,
        transitionDuration: 500,
        transitionInterpolator: new LinearInterpolator(),
      });
    }
  }, [selectedFacility]);

  // Create the base tile layer using the same pattern as DeckGLContainer.tsx
  const osmTileLayer = useMemo(() => new TileLayer({
    id: 'osm-tile-layer',
    data: MAPBOX_STYLE,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => {
      const [[west, south], [east, north]] = props.tile.boundingBox;
      const {data, ...otherProps} = props;

      return [
        new BitmapLayer(otherProps, {
          image: data,
          bounds: [west, south, east, north]
        })
      ];
    }
  }), []);

  // Create a ScatterplotLayer for facilities
  const facilitiesLayer = useMemo(() => new ScatterplotLayer({
    id: 'facilities-layer',
    data: filteredFacilities,
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
      if (hoveredFacility && d.id === hoveredFacility.id) {
        return [255, 140, 0, 255]; // Orange for hovered
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
      getFillColor: [selectedFacility, hoveredFacility],
      getRadius: [selectedFacility]
    },
    onClick: (info: any) => {
      if (info.object) {
        setSelectedFacility(info.object);
        setViewState({
          ...viewState,
          longitude: info.object.longitude,
          latitude: info.object.latitude,
          zoom: 14,
          transitionDuration: 500
        });
      }
    },
    onHover: (info: any) => {
      setHoveredFacility(info.object || null);
    }
  }), [filteredFacilities, selectedFacility, hoveredFacility, viewState]);

  // User location marker layer
  const userLocationLayer = useMemo(() => {
    if (!userLocation) return null;
    
    return new ScatterplotLayer({
      id: 'user-location-layer',
      data: [{ position: userLocation }],
      pickable: false,
      stroked: true,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: 8,
      radiusMaxPixels: 20,
      getPosition: (d: any) => d.position,
      getFillColor: [0, 0, 255, 180],
      getLineColor: [0, 0, 255, 255],
      getLineWidth: 2
    });
  }, [userLocation]);

  // Radius visualization layer - updated to use a properly typed layer
  const radiusLayer = useMemo(() => {
    if (!userLocation || !searchRadius) return null;
    
    // Calculate the radius in meters at this latitude
    const radiusInMeters = searchRadius * 1000;
    
    return new ScatterplotLayer({
      id: 'radius-layer',
      data: [{ center: userLocation, radius: radiusInMeters }],
      pickable: false,
      stroked: true,
      filled: true,
      getPosition: (d: any) => d.center,
      getRadius: (_: any) => radiusInMeters,
      getFillColor: [0, 0, 255, 20],
      getLineColor: [0, 0, 255, 100],
      getLineWidth: 2,
    });
  }, [userLocation, searchRadius]);

  // Combine all layers using the DeckGLContainer pattern
  const layers = useMemo(() => {
    const allLayers: Layer[] = [osmTileLayer];
    
    // Add the facilities layer
    allLayers.push(facilitiesLayer);
    
    // Add conditional layers if they exist
    if (userLocationLayer) allLayers.push(userLocationLayer);
    if (radiusLayer) allLayers.push(radiusLayer);
    
    return allLayers;
  }, [osmTileLayer, facilitiesLayer, userLocationLayer, radiusLayer]);

  const handleMapClick = useCallback((info: any) => {
    const { coordinate } = info;
    
    // If not clicking on a facility, set user location
    if (!info.object && coordinate) {
      setUserLocation([coordinate[0], coordinate[1]]);
    }
  }, []);

  // Navigation control handlers
  const handleZoomIn = useCallback(() => {
    setViewState(currentViewState => ({
      ...currentViewState,
      zoom: Math.min((currentViewState.zoom || 0) + 1, 20),
      transitionDuration: 300
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setViewState(currentViewState => ({
      ...currentViewState,
      zoom: Math.max((currentViewState.zoom || 0) - 1, 1),
      transitionDuration: 300
    }));
  }, []);

  const handleResetBearing = useCallback(() => {
    setViewState(currentViewState => ({
      ...currentViewState,
      bearing: 0,
      transitionDuration: 300
    }));
  }, []);

  const handleResetNorth = useCallback(() => {
    setViewState(currentViewState => ({
      ...currentViewState,
      pitch: 0,
      bearing: 0,
      transitionDuration: 300
    }));
  }, []);

  // Additional refs for handling tooltip button clicks
  const showDetailsHandlers = useRef<{ [key: number]: () => void }>({});

  useEffect(() => {
    // Setup global window handlers for tooltip button clicks
    if (typeof window !== 'undefined') {
      // @ts-ignore
      window.showFacilityDetails = (facilityId: number) => {
        const facility = filteredFacilities.find(f => f.id === facilityId);
        if (facility) {
          setSelectedFacility(facility);
          setShowFacilityModal(true);
        }
      };
    }
    
    return () => {
      // Clean up handler on unmount
      if (typeof window !== 'undefined') {
        // @ts-ignore
        delete window.showFacilityDetails;
      }
    };
  }, [filteredFacilities]);

  // Update tooltip content
  const getFacilityTooltip = useCallback(({object}: any) => {
    if (object && 'name' in object) {
      const facility = object as Facility;
      return {
        html: `
          <div style="padding: 8px">
            <b>${facility.name}</b><br/>
            Type: ${facility.facility_type}<br/>
            Location: ${facility.location}<br/>
          </div>
        `,
        style: {
          backgroundColor: 'white',
          fontSize: '0.8em',
          color: '#333',
          borderRadius: '4px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }
      };
    }
    return null;
  }, []);

  // Effects
  useEffect(() => {
    fetchFacilityTypes();
    fetchLocations();
    fetchCountData();
  }, []);

  useEffect(() => {
    setFilteredFacilities([...nearbyFacilities, ...facilities]);
  }, [facilities, nearbyFacilities]);

  const typesToSelectOptions = (types: string[]) => {
    return types.map(type => ({
      value: type,
      label: type,
      key: type,
    }));
  };

  // Data fetching functions
  const fetchFacilityTypes = async (filterValue = '', page = 0, pageSize = 25) => {
    try {
      const response = await cachedSupersetGet({
        endpoint: '/api/v1/health_facilities/types',
      });
      
      if (response.json?.data?.types) {
        const types = typesToSelectOptions(response.json.data.types);
        return {
          data: types.slice(page * pageSize, (page + 1) * pageSize),
          totalCount: types.length
        };
      } else {
        console.warn('Unexpected response format for facility types:', response);
        addDangerToast(t('Received unexpected facility types data format'));
        return { data: [], totalCount: 0 };
      }
    } catch (error) {
      console.error('Error fetching facility types:', error);
      addDangerToast(t('Error loading facility types'));
      return { data: [], totalCount: 0 };
    }
  };

  const municipalitiesToSelectOptions = (municipalities: string[]) => {
    return municipalities.map(municipality => ({
      value: municipality,
      label: municipality,
      key: municipality,
    }));
  };
  
  const fetchMunicipalities = async (filterValue = '', page = 0, pageSize = 25) => {
    try {
      // Since the municipalities endpoint is not registered, we'll use locations endpoint 
      // which is registered in include_route_methods
      const response = await cachedSupersetGet({
        endpoint: '/api/v1/health_facilities/municipalities',
      });
      console.log('response', response);
      let municipalities: { value: string; label: string; key: string }[] = [];
      
      if (response.json?.data?.municipalities) {
        municipalities = municipalitiesToSelectOptions(response.json.data.municipalities);
      } else {
        console.warn('Unexpected response format for municipalities:', response);
        addDangerToast(t('Unexpected response format for municipalities'));
      }
      
      // Filter based on search value if provided
      const filteredData = filterValue 
        ? municipalities.filter(m => 
            m.label.toLowerCase().includes(filterValue.toLowerCase())
          )
        : municipalities;
      
      // Format the return to match expected structure for fetchSelects
      return {
        data: filteredData.slice(page * pageSize, (page + 1) * pageSize),
        totalCount: filteredData.length
      };
    } catch (error) {
      console.error('Error fetching municipalities:', error);
      addDangerToast(t('Error loading municipalities'));
      return { data: [], totalCount: 0 };
    }
  };

  const locationsToSelectOptions = (locations: string[]) => {
    return locations.map(location => ({
      value: location,
      label: location,
      key: location,
    }));
  };

  const fetchLocations = async (filterValue = '', page = 0, pageSize = 25) => {
    try {
      const response = await cachedSupersetGet({
        endpoint: '/api/v1/health_facilities/locations',
      });
      
      if (response.json?.data?.locations) {
        const locations = locationsToSelectOptions(response.json.data.locations);
        return {
          data: locations.slice(page * pageSize, (page + 1) * pageSize),
          totalCount: locations.length
        };
      } else {
        console.warn('Unexpected response format for locations:', response);
        addDangerToast(t('Received unexpected locations data format'));
        return { data: [], totalCount: 0 };
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      addDangerToast(t('Error loading facility locations'));
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

  const searchNearbyFacilities = async () => {
    if (!userLocation) {
      addDangerToast(t('Please set your location first'));
      return;
    }
    
    setNearbyLoading(true);
    try {
      const [lng, lat] = userLocation;
      
      // Create the params object
      const params = {
        latitude: lat,
        longitude: lng,
        radius: searchRadius,
      };
      
      // Use the rison library directly to encode parameters correctly
      const risonQuery = rison.encode(params);
      
      const response = await SupersetClient.get({
        endpoint: `/api/v1/health_facilities/nearby?q=${risonQuery}`,
      });
      
      if (response.json?.data?.facilities) {
        setNearbyFacilities(response.json.data.facilities);
        addSuccessToast(t(`Found ${response.json.data.facilities.length} facilities nearby`));
      } else {
        console.warn('Unexpected response format for nearby facilities:', response);
        setNearbyFacilities([]);
        addDangerToast(t('No facilities found nearby'));
      }
      
      setNearbyLoading(false);
      setShowNearbyModal(true);
    } catch (error) {
      console.error('Error searching nearby facilities:', error);
      setNearbyLoading(false);
      addDangerToast(t('Error searching for nearby facilities'));
    }
  };

  // Helper functions
  const handleFacilityClick = (facility: Facility) => {
    setSelectedFacility(facility);
    setShowFacilityModal(true);
    if (facility.latitude && facility.longitude) {
      setViewState({
        ...viewState,
        longitude: facility.longitude,
        latitude: facility.latitude,
        zoom: 14,
        transitionDuration: 500
      });
    }
  };

  const formatCountData = (data: Record<string, number> | undefined): ChartDataItem[] => {
    if (!data) return [];
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  };

  const filters: Filter[] = [
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

  const columns = [
    {
      accessor: 'name',
      Header: t('Name'),
      size: 'xl',
      Cell: ({ row: { original } }: any) => (
        <a onClick={() => handleFacilityClick(original)}>{original.name}</a>
      ),
    },
    {
      accessor: 'facility_type',
      Header: t('Type'),
      size: 'xl',
      Cell: ({ value }: any) => <Tag color="blue">{value}</Tag>,
    },
    {
      accessor: 'location',
      Header: t('Location'),
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
      Cell: ({ row: { original } }: any) => (
        <Button 
          type="primary" 
          size="small" 
          icon={<EnvironmentOutlined />}
          onClick={() => {
            setSelectedFacility(original);
            setActiveTab('map');
          }}
        >
          {t('Show on Map')}
        </Button>
      ),
    },
  ];

  return (
    <Container>
      {/* <Title level={2}>{t('Health Facilities')}</Title> */}
      
      {errorMessage && (
        <Alert message={errorMessage} type="error" showIcon closable style={{ marginBottom: 16 }} />
      )}

      <Tabs activeKey={activeTab} onChange={key => setActiveTab(key)}>
        <TabPane tab={<span><BarsOutlined /> {t('List View')}</span>} key="list">
          <ListView<Facility>
            bulkActions={[]}
            bulkSelectEnabled={false}
            className="facilities-list-view"
            columns={columns}
            count={facilityCount}
            data={filteredFacilities}
            fetchData={fetchData}
            filters={filters}
            initialSort={[{ id: 'name', desc: false }]}
            loading={loading}
            pageSize={PAGE_SIZE}
            refreshData={refreshData}
            renderCard={undefined}
            defaultViewMode="table"
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
          />
        </TabPane>
        
        <TabPane tab={<span><EnvironmentOutlined /> {t('Map View')}</span>} key="map">
          <StyledCard bodyStyle={{ padding: 0 }}>
            <div style={{ padding: '16px 16px 0' }}>
              <Space style={{ marginBottom: 16 }}>
                <Text>
                  {t('Click on the map to set your location, then search for nearby facilities.')}
                </Text>
                <Space>
                  <Text>{t('Radius')}: </Text>
                  <InputNumber
                    min={1}
                    max={100}
                    value={searchRadius}
                    onChange={value => setSearchRadius(value as number)}
                    style={{ width: 80 }}
                  />
                  <Text> km</Text>
                </Space>
                <Button 
                  type="primary" 
                  onClick={searchNearbyFacilities}
                  loading={nearbyLoading}
                  disabled={!userLocation}
                  icon={<SearchOutlined />}
                >
                  {t('Find Nearby')}
                </Button>
                {userLocation && (
                  <Button
                    danger
                    onClick={() => setUserLocation(null)}
                  >
                    {t('Clear Location')}
                  </Button>
                )}
              </Space>
            </div>
            
            <StyledMapContainer>
              <NavigationControls>
                <NavButton onClick={handleZoomIn}>+</NavButton>
                <NavButton onClick={handleZoomOut}>-</NavButton>
                <NavButton onClick={handleResetNorth}>⭯</NavButton>
              </NavigationControls>
              
              <DeckGL
                ref={deckRef}
                initialViewState={INITIAL_VIEW_STATE}
                viewState={viewState}
                onViewStateChange={handleViewStateChange}
                controller={true}
                width="100%"
                height="100%"
                layers={layers}
                onClick={handleMapClick}
                glOptions={{ preserveDrawingBuffer: true }}
                getTooltip={getFacilityTooltip}
              >
                <StaticMap
                  preserveDrawingBuffer
                  mapStyle="light"
                  mapboxApiAccessToken={process.env.MAPBOX_API_KEY || ''}
                />
              </DeckGL>
            </StyledMapContainer>
          </StyledCard>
        </TabPane>
        
        <TabPane tab={<span><PieChartOutlined /> {t('Analytics')}</span>} key="analytics">
          <StyledCard>
            {countData ? (
              <>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <StyledStatistic 
                      title={t('Total Health Facilities')} 
                      value={countData.total} 
                      valueStyle={{ color: '#3f8600' }}
                    />
                  </Col>
                  <Col span={8}>
                    <StyledStatistic 
                      title={t('Facility Types')} 
                      value={Object.keys(countData.by_type || {}).length} 
                    />
                  </Col>
                  <Col span={8}>
                    <StyledStatistic 
                      title={t('Administrative Posts with Facilities')} 
                      value={Object.keys(countData.by_location || {}).length} 
                    />
                  </Col>
                </Row>
                
                <Divider orientation="left">{t('Facilities by Type')}</Divider>
                <Row gutter={16}>
                  <Col span={12}>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={formatCountData(countData.by_type)}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, value }: {name: string, value: number}) => `${name}: ${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {formatCountData(countData.by_type).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </Col>
                  <Col span={12}>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={formatCountData(countData.by_type)}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#8884d8" name="Facilities" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Col>
                </Row>
                
                <Divider orientation="left">{t('Facilities by Location')}</Divider>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={formatCountData(countData.by_location)}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#82ca9d" name="Facilities" />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin size="large" />
                <div style={{ marginTop: 16 }}>{t('Loading analytics...')}</div>
              </div>
            )}
          </StyledCard>
        </TabPane>
      </Tabs>
      
      {/* Facility Details Modal */}
      <Modal
        title={selectedFacility ? `${selectedFacility.name} Details` : ''}
        visible={showFacilityModal}
        onCancel={() => setShowFacilityModal(false)}
        footer={[
          <Button key="view-map" type="primary" onClick={() => {
            // setSelectedFacility(null);
            setShowFacilityModal(false);
            setActiveTab('map');
          }}>
            {t('View on Map')}
          </Button>,
          <Button key="close" type="primary" onClick={() => setShowFacilityModal(false)}>
            {t('Close Details')}
          </Button>
        ]}
        width={700}
      >
        {selectedFacility && (
          <Row gutter={16}>
            <Col span={12}>
              <p><BankOutlined /> <strong>Type:</strong> {selectedFacility.facility_type}</p>
              <p><EnvironmentOutlined /> <strong>Location:</strong> {selectedFacility.location}, {selectedFacility.municipality}</p>
              {selectedFacility.address && (
                <p><EnvironmentOutlined /> <strong>Address:</strong> {selectedFacility.address}</p>
              )}
              {selectedFacility.phone && (
                <p><PhoneOutlined /> <strong>Phone:</strong> {selectedFacility.phone}</p>
              )}
              {selectedFacility.email && (
                <p><MailOutlined /> <strong>Email:</strong> {selectedFacility.email}</p>
              )}
            </Col>
            <Col span={12}>
              {selectedFacility.services && (
                <p><InfoCircleOutlined /> <strong>Services:</strong> {selectedFacility.services}</p>
              )}
              {selectedFacility.operating_hours && (
                <p><InfoCircleOutlined /> <strong>Hours:</strong> {selectedFacility.operating_hours}</p>
              )}
              <p><InfoCircleOutlined /> <strong>Total Beds:</strong> {selectedFacility.total_beds || 'N/A'}</p>
              <p><InfoCircleOutlined /> <strong>Maternity Beds:</strong> {selectedFacility.maternity_beds || 'N/A'}</p>
              <p><InfoCircleOutlined /> <strong>Ambulance:</strong> {selectedFacility.has_ambulance ? 'Yes' : 'No'}</p>
              <p><InfoCircleOutlined /> <strong>Emergency Services:</strong> {selectedFacility.has_emergency ? 'Yes' : 'No'}</p>
            </Col>
          </Row>
        )}
      </Modal>
      
      {/* Nearby Facilities Modal */}
      <Modal
        title={t('Nearby Health Facilities')}
        visible={showNearbyModal}
        onCancel={() => setShowNearbyModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowNearbyModal(false)}>
            {t('Close')}
          </Button>
        ]}
        width={800}
      >
        {nearbyLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin />
            <div style={{ marginTop: 16 }}>{t('Searching for facilities...')}</div>
          </div>
        ) : (
          <>
            {nearbyFacilities.length > 0 ? (
              <Table
                columns={[
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string, record: Facility) => (
                      <a onClick={() => {
                        handleFacilityClick(record);
                        setShowNearbyModal(false);
                      }}>{text}</a>
                    ),
                  },
                  {
                    title: 'Type',
                    dataIndex: 'facility_type',
                    key: 'facility_type',
                    render: (text: string) => <Tag color="blue">{text}</Tag>,
                  },
                  {
                    title: 'Distance',
                    dataIndex: 'distance',
                    key: 'distance',
                    render: (distance: number) => `${distance} km`,
                    sorter: (a: Facility, b: Facility) => 
                      (a.distance || Infinity) - (b.distance || Infinity),
                    defaultSortOrder: 'ascend',
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    render: (_: any, record: Facility) => (
                      <Space>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<EnvironmentOutlined />}
                          onClick={() => {
                            handleFacilityClick(record);
                            setShowNearbyModal(false);
                          }}
                        >
                          View on Map
                        </Button>
                        <Button
                          size="small"
                          href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation?.[1]},${userLocation?.[0]}&destination=${record.latitude},${record.longitude}`}
                          target="_blank"
                        >
                          Get Directions
                        </Button>
                      </Space>
                    ),
                  },
                ]}
                dataSource={nearbyFacilities}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                bordered
              />
            ) : (
              <Empty description={
                t('No facilities found within {radius} km of your location', { radius: searchRadius })
              } />
            )}
          </>
        )}
      </Modal>
    </Container>
  );
}

export default withToasts(Facilities);