import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { t, styled, SupersetClient } from '@superset-ui/core';
import {
  Button,
  InputNumber,
  Space,
  Card,
  Typography,
  Row,
  Col,
  Divider,
  Input,
  Select,
  Spin,
  Empty,
  Popover,
  Descriptions,
  Form,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  BankOutlined,
  PhoneOutlined,
  MailOutlined,
  InfoCircleOutlined,
  MedicineBoxOutlined,
  PlusSquareOutlined,
  HeartOutlined,
  HomeOutlined,
  ShopOutlined,
  ExperimentOutlined,
  TeamOutlined,
  MedicineBoxFilled,
  SmileOutlined,
} from '@ant-design/icons';
import DeckGL from '@deck.gl/react';
import {
  Layer,
  PickingInfo,
  WebMercatorViewport,
  LinearInterpolator,
} from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, BitmapLayer, IconLayer } from '@deck.gl/layers';
import rison from 'rison';
import debounce from 'lodash/debounce';
import { Facility, ViewState } from './types';
import {
  FACILITY_ICON_MAPPING,
  getFacilityIcon,
  FacilityIconMappingType,
} from './facilityIcons';

// Styled components specific to Map View
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

// New styled component for the map legend
const MapLegend = styled.div`
  position: absolute;
  bottom: 20px;
  left: 20px;
  z-index: 1;
  background: white;
  border-radius: 4px;
  padding: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  max-width: 280px;
  max-height: 300px;
  overflow-y: auto;
  transition: height 0.3s ease;
`;

const LegendTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  margin-bottom: 8px;
  cursor: pointer;
  user-select: none;
`;

const LegendContent = styled.div<{ isExpanded: boolean }>`
  height: ${props => (props.isExpanded ? 'auto' : '0')};
  overflow: hidden;
  transition: height 0.3s ease;
  opacity: ${props => (props.isExpanded ? '1' : '0')};
  transition: opacity 0.3s ease;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 6px;
`;

const LegendIcon = styled.img`
  width: 20px;
  height: 20px;
  margin-right: 8px;
`;

const NavButton = styled(Button)`
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const { Text, Title } = Typography;

// New styled component for the floating detail card
const FloatingDetailCard = styled(Card)`
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 380px; // Increased width
  max-height: 50%; // Increased height
  overflow-y: auto;
  z-index: 10;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;

  // Remove default Card padding and manage internally
  .ant-card-body {
    padding: 0 !important;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
`;

// Styled div for the scrollable body content
const ScrollableBody = styled.div`
  padding: 16px; // Increased padding
  overflow-y: auto;
  flex-grow: 1; // Allow body to take remaining space
`;

// Styled div for the sticky header/footer
const StickyHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9f9f9; // Light gray background
`;

const StickyFooter = styled.div`
  padding: 12px 16px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #f9f9f9; // Light gray background
`;

// New styled components for the Facility Details Card
const FacilityInfoItem = styled.div`
  display: flex;
  margin-bottom: 12px;
  align-items: flex-start;
`;

const InfoIcon = styled.div`
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1890ff;
  font-size: 18px;
`;

const InfoContent = styled.div`
  flex: 1;
`;

const InfoLabel = styled(Text)`
  display: block;
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 2px;
`;

const InfoValue = styled(Text)`
  display: block;
  font-size: 14px;
`;

// Define props required by MapViewTab
interface MapViewTabProps {
  // Map state and handlers
  viewState: ViewState;
  handleViewStateChange: (params: any) => void;
  getFacilityTooltip: (
    info: PickingInfo,
  ) => { html: string; style?: object } | null;
  initialViewState: ViewState;
  // Map navigation controls
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleResetBearing: () => void;
  handleResetNorth: () => void;
  // State/handlers from parent
  selectedFacility: Facility | null;
  setActiveTab: (tab: string) => void;
  facilityTypes: string[];
  locations: string[];
  addDangerToast: (msg: string) => void;
  setSelectedFacility: (facility: Facility | null) => void;
}

const DEBOUNCE_DELAY = 1000; // Delay for fetching after map move/filter change

// Helper to get map bounds from view state
const getBoundsFromViewState = (
  viewState: ViewState,
): [number, number, number, number] | null => {
  try {
    const viewport = new WebMercatorViewport(viewState);
    // DeckGL uses [minLng, minLat, maxLng, maxLat]
    return viewport.getBounds();
  } catch (e) {
    console.error('Could not calculate bounds from viewState:', e);
    return null;
  }
};

// Boolean filter options for map filters
const booleanMapFilterOptions = [
  { label: t('Any'), value: undefined },
  { label: t('Yes'), value: 'true' },
  { label: t('No'), value: 'false' },
];

const MAP_TILE_URL =
  'https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png';

// Dili Coordinates (Approximate Center)
const DILI_COORDS = [-8.557, 125.574]; // Lat, Lng

// Add state for legend expansion
const MapViewTab: React.FC<MapViewTabProps> = ({
  // Map props
  viewState,
  handleViewStateChange,
  getFacilityTooltip,
  initialViewState,
  // Navigation props
  handleZoomIn,
  handleZoomOut,
  handleResetBearing,
  handleResetNorth,
  // State/handlers from parent
  selectedFacility,
  setActiveTab,
  facilityTypes,
  locations,
  addDangerToast,
  setSelectedFacility,
}) => {
  const deckRef = useRef<any>(null);

  // --- State for Map View ---
  const [mapFacilities, setMapFacilities] = useState<Facility[]>([]);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);

  // Filter States
  const [mapFilterName, setMapFilterName] = useState<string>('');
  const [mapFilterType, setMapFilterType] = useState<string[]>([]);
  const [mapFilterServices, setMapFilterServices] = useState<string>('');
  const [mapFilterHasAmbulance, setMapFilterHasAmbulance] = useState<
    string | undefined
  >(undefined);
  const [mapFilterHasEmergency, setMapFilterHasEmergency] = useState<
    string | undefined
  >(undefined);

  // State for user's current location (optional)
  const [currentUserLocation, setCurrentUserLocation] = useState<
    [number, number] | null
  >(null);
  const [isFetchingLocation, setIsFetchingLocation] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<boolean>(false);

  // Add state for legend expansion
  const [isLegendExpanded, setIsLegendExpanded] = useState<boolean>(true);

  // --- Data Fetching Logic ---
  const fetchFacilitiesInBounds = useCallback(async () => {
    const bounds = getBoundsFromViewState(viewState);
    if (!bounds) {
      // Don't fetch if bounds are invalid
      setMapFacilities([]);
      return;
    }

    setIsMapLoading(true);
    const [minLng, minLat, maxLng, maxLat] = bounds;

    const params: any = {
      min_latitude: minLat,
      min_longitude: minLng,
      max_latitude: maxLat,
      max_longitude: maxLng,
    };

    // Add filters to params
    if (mapFilterName) params.name = mapFilterName;
    if (mapFilterType && mapFilterType.length > 0)
      params.facility_type = mapFilterType;
    if (mapFilterServices) params.services = mapFilterServices;
    if (mapFilterHasAmbulance === 'true') params.has_ambulance = true;
    else if (mapFilterHasAmbulance === 'false') params.has_ambulance = false;
    if (mapFilterHasEmergency === 'true') params.has_emergency = true;
    else if (mapFilterHasEmergency === 'false') params.has_emergency = false;

    const risonQuery = rison.encode(params);
    console.log('Fetching map facilities with bounds:', params);

    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/health_facilities/bounds?q=${risonQuery}`,
      });
      if (response.json?.data?.facilities) {
        setMapFacilities(response.json.data.facilities);
      } else {
        setMapFacilities([]);
        console.warn('No facilities found or unexpected format:', response);
        // Optional: addDangerToast(t('No facilities found for this area/filter.'));
      }
    } catch (error) {
      console.error('Error fetching facilities in bounds:', error);
      setMapFacilities([]);
      addDangerToast(t('Failed to load facilities for this map area.'));
    } finally {
      setIsMapLoading(false);
    }
  }, [
    viewState,
    mapFilterName,
    mapFilterType,
    mapFilterServices,
    mapFilterHasAmbulance,
    mapFilterHasEmergency,
    addDangerToast,
  ]);

  // --- Debounced Fetching ---
  const debouncedFetch = useMemo(
    () => debounce(fetchFacilitiesInBounds, DEBOUNCE_DELAY),
    [fetchFacilitiesInBounds],
  );

  // Effect to trigger debounced fetch on viewState or filter changes
  useEffect(() => {
    debouncedFetch();
    // Cleanup function to cancel debounce on unmount or dependency change
    return () => {
      debouncedFetch.cancel();
    };
  }, [
    viewState,
    mapFilterName,
    mapFilterType,
    mapFilterServices,
    mapFilterHasAmbulance,
    mapFilterHasEmergency,
    debouncedFetch,
  ]);

  // Effect to pan map if selectedFacility changes (from parent)
  useEffect(() => {
    if (selectedFacility?.latitude && selectedFacility?.longitude) {
      // Call parent's handler to update the shared viewState - PAN ONLY
      handleViewStateChange({
        viewState: {
          // Pass the new viewState object
          ...viewState, // Keep existing pitch, bearing, AND ZOOM
          longitude: selectedFacility.longitude,
          latitude: selectedFacility.latitude,
          // zoom: 14, // REMOVE fixed zoom level
          transitionDuration: 500,
          transitionInterpolator: new LinearInterpolator([
            'longitude',
            'latitude',
          ]), // Only interpolate position
        },
      });
    }
  }, [selectedFacility]); // Run only when selectedFacility prop changes

  // --- Base Tile Layer ---
  const tileLayer = useMemo(
    () =>
      new TileLayer({
        id: 'base-tile-layer',
        data: MAP_TILE_URL,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        renderSubLayers: props => {
          // Cast bbox to any to bypass persistent linter error
          const { west, south, east, north } = props.tile.bbox as any;

          return new BitmapLayer(props, {
            data: undefined,
            image: props.data,
            bounds: [west, south, east, north],
          });
        },
      }),
    [],
  );

  // --- Layer Creation Logic --- (Add tileLayer)
  const mapLayers = useMemo(() => {
    // Create icon layer for facilities
    const iconLayer = new IconLayer<Facility>({
      id: 'facility-icon-layer',
      data: mapFacilities,
      pickable: true,
      getIcon: d => getFacilityIcon(d.facility_type),
      getPosition: d => [d.longitude, d.latitude],
      getSize: d => 24,
      getColor: d =>
        selectedFacility && d.id === selectedFacility.id
          ? [255, 255, 255, 255] // Full opacity for the selected facility
          : selectedFacility
            ? [255, 255, 255, 75] // half-opacity for non-selected facility
            : [255, 255, 255, 255], // Full opacity for all when there's no selected facility
      // Make sure the icons are properly centered
      autoHighlight: true,
      // Ensure proper rendering of SVG icons with transparency
      alphaCutoff: 0.05,
      updateTriggers: {
        getSize: [selectedFacility],
        // getColor: [selectedFacility]
      },
      billboard: true, // Icons always face the camera
      onClick: (info: PickingInfo) => {
        if (info.object) {
          const clickedFacility = info.object as Facility;
          setSelectedFacility(clickedFacility); // Update selected state
          // Pan map to center, keep current zoom
          handleViewStateChange({
            viewState: {
              ...viewState,
              longitude: clickedFacility.longitude,
              latitude: clickedFacility.latitude,
              transitionDuration: 300,
              transitionInterpolator: new LinearInterpolator([
                'longitude',
                'latitude',
              ]),
            },
          });
        }
      },
    });

    // Create a static highlight ring layer for the selected facility
    // const selectedFacilityLayer = selectedFacility ? new ScatterplotLayer<Facility>({
    //   id: 'selected-facility-highlight',
    //   data: [selectedFacility],
    //   pickable: false,
    //   stroked: true,
    //   filled: false,
    //   lineWidthUnits: 'pixels',
    //   getLineWidth: 4,
    //   radiusScale: 12,
    //   radiusMinPixels: 35,
    //   radiusMaxPixels: 60,
    //   getPosition: d => [d.longitude, d.latitude],
    //   getLineColor: [255, 0, 0, 255], // Bright red outline
    //   getRadius: 30,
    // }) : null;

    // Keep the ScatterplotLayer as a fallback/debugging layer
    const facilityLayer = new ScatterplotLayer<Facility>({
      id: 'map-facilities-layer',
      data: mapFacilities,
      pickable: false, // Set to false as we're using IconLayer for interaction
      opacity: 0, // Make invisible but keep for debugging purposes
      stroked: false,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: 5,
      radiusMaxPixels: 20,
      getPosition: d => [d.longitude, d.latitude],
      getFillColor: d =>
        selectedFacility && d.id === selectedFacility.id
          ? [255, 0, 0, 255] // Red for selected
          : [0, 140, 255, 200], // Default blue
      getRadius: d =>
        selectedFacility && d.id === selectedFacility.id ? 15 : 10,
      updateTriggers: {
        getFillColor: [selectedFacility],
        getRadius: [selectedFacility],
      },
    });

    return [
      tileLayer, // Add base tile layer first
      facilityLayer,
      // selectedFacilityLayer, // Add highlight ring before icon layer so it appears underneath
      iconLayer, // Add new icon layer last so it renders on top
    ].filter(Boolean); // Filter out null layers
  }, [mapFacilities, selectedFacility, tileLayer]); // Remove animation dependencies

  // --- Handlers ---
  const handleResultCardClick = (facility: Facility) => {
    setSelectedFacility(facility); // Set the selected facility globally
    // Pan map to center, keep current zoom
    handleViewStateChange({
      viewState: {
        ...viewState,
        longitude: facility.longitude,
        latitude: facility.latitude,
        transitionDuration: 300,
        transitionInterpolator: new LinearInterpolator([
          'longitude',
          'latitude',
        ]),
      },
    });
  };

  // Function to attempt getting user's location
  const getUserGeolocation = () => {
    if (navigator.geolocation) {
      if (isFetchingLocation) return; // Prevent multiple requests

      setIsFetchingLocation(true);
      setLocationError(false); // Reset error state on new attempt

      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          console.log('User GeoLocation Found:', [longitude, latitude]);
          setCurrentUserLocation([longitude, latitude]);
          setIsFetchingLocation(false);
          // Optionally: Show success toast
          // addSuccessToast(t('Current location updated.'));
        },
        error => {
          console.error('Error getting user location:', error);
          setCurrentUserLocation(null); // Ensure it's null on error
          setIsFetchingLocation(false);
          if (!locationError) {
            // Only show toast if it hasn't been shown for this "session" of errors
            addDangerToast(
              t('Could not get your location. Using default for directions.'),
            );
          }
          setLocationError(true);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }, // Options
      );
    } else {
      if (!locationError) {
        addDangerToast(t('Geolocation is not supported by this browser.'));
      }
      setLocationError(true);
    }
  };

  // Generate Google Maps URL
  const getDirectionsUrl = (facility: Facility): string => {
    const destination = `${facility.latitude},${facility.longitude}`;
    let origin = '';

    if (currentUserLocation) {
      origin = `${currentUserLocation[1]},${currentUserLocation[0]}`; // Lat,Lng
    } else {
      // Use Dili default if current location unknown
      origin = `${DILI_COORDS[0]},${DILI_COORDS[1]}`;
      // Attempt to get location when directions are first requested without one,
      // but only if there wasn't a recent error.
      if (!locationError) {
        getUserGeolocation();
      }
    }

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  };

  // Helper function to render the legend with facility types
  const renderMapLegend = useCallback(
    (commonFacilityTypes: string[]) => {
      // Get a subset of most common facility types to avoid overcrowding
      // We could also show/hide based on current filter
      const legendItems = commonFacilityTypes.slice(0, 8); // Show most common types (max 8)

      return (
        <MapLegend>
          <LegendTitle onClick={() => setIsLegendExpanded(!isLegendExpanded)}>
            <Typography.Text strong>{t('Facility Types')}</Typography.Text>
            <span>{isLegendExpanded ? '▼' : '▲'}</span>
          </LegendTitle>
          <LegendContent isExpanded={isLegendExpanded}>
            {legendItems.map(type => (
              <LegendItem key={type}>
                <LegendIcon
                  src={
                    FACILITY_ICON_MAPPING[type]?.url ||
                    FACILITY_ICON_MAPPING.default.url
                  }
                  alt={type}
                />
                <Typography.Text>{type}</Typography.Text>
              </LegendItem>
            ))}
          </LegendContent>
        </MapLegend>
      );
    },
    [isLegendExpanded],
  );

  // --- Render Logic ---
  return (
    <StyledCard bodyStyle={{ padding: 0, height: 'calc(100vh - 180px)' }}>
      {' '}
      {/* Approximate height */}
      <Row gutter={0} style={{ height: '100%' }}>
        {/* Filters & Results Column */}
        <Col
          span={6}
          style={{
            height: '100%', // Take full height of Row
            display: 'flex',
            flexDirection: 'column',
            background: '#f9f9f9',
          }}
        >
          <div style={{ padding: '16px 16px 0' }}>
            {' '}
            {/* Padding for filters */}
            <Title level={5}>{t('Filters')}</Title>
            <Form layout="vertical" size="small">
              <Form.Item label={t('Name')} style={{ marginBottom: 8 }}>
                <Input
                  placeholder={t('Enter name part')}
                  value={mapFilterName}
                  onChange={e => setMapFilterName(e.target.value)}
                />
              </Form.Item>
              <Form.Item label={t('Facility Type')} style={{ marginBottom: 8 }}>
                <Select
                  allowClear
                  showSearch
                  mode="multiple"
                  placeholder={t('Select type(s)')}
                  value={mapFilterType}
                  onChange={value => setMapFilterType(value)}
                  style={{ width: '100%' }}
                  options={facilityTypes.map(type => ({
                    label: type,
                    value: type,
                  }))}
                />
              </Form.Item>
              <Form.Item
                label={t('Services Offered')}
                style={{ marginBottom: 8 }}
              >
                <Input
                  placeholder={t('Enter service keyword')}
                  value={mapFilterServices}
                  onChange={e => setMapFilterServices(e.target.value)}
                />
              </Form.Item>
              <Form.Item
                label={t('Has Ambulance?')}
                style={{ marginBottom: 8 }}
              >
                <Select
                  allowClear
                  value={mapFilterHasAmbulance}
                  onChange={value => setMapFilterHasAmbulance(value)}
                  style={{ width: '100%' }}
                  options={booleanMapFilterOptions as any[]}
                />
              </Form.Item>
              <Form.Item
                label={t('Has Emergency?')}
                style={{ marginBottom: 8 }}
              >
                <Select
                  allowClear
                  value={mapFilterHasEmergency}
                  onChange={value => setMapFilterHasEmergency(value)}
                  style={{ width: '100%' }}
                  options={booleanMapFilterOptions as any[]}
                />
              </Form.Item>
            </Form>
          </div>
          <Divider style={{ margin: '16px 0' }} />
          <div style={{ padding: '0 16px', flexGrow: 1, overflowY: 'auto' }}>
            {' '}
            {/* Scrollable Results */}
            <Title
              level={5}
            >{`${t('Results')} (${mapFacilities.length})`}</Title>
            <Spin spinning={isMapLoading}>
              {mapFacilities.length > 0
                ? mapFacilities.map(facility => (
                    <Card
                      key={facility.id}
                      size="small"
                      style={{
                        marginBottom: 8,
                        borderLeft:
                          selectedFacility?.id === facility.id
                            ? '4px solid #1890ff'
                            : 'none',
                        backgroundColor:
                          selectedFacility?.id === facility.id
                            ? '#e6f7ff'
                            : 'white',
                        boxShadow:
                          selectedFacility?.id === facility.id
                            ? '0 2px 8px rgba(24, 144, 255, 0.2)'
                            : 'none',
                      }}
                      hoverable
                      onClick={() => handleResultCardClick(facility)}
                      bordered
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'flex-start' }}
                      >
                        <div style={{ marginRight: '8px', marginTop: '2px' }}>
                          <img
                            src={
                              FACILITY_ICON_MAPPING[facility.facility_type]
                                ?.url || FACILITY_ICON_MAPPING.default.url
                            }
                            alt={facility.facility_type}
                            style={{ width: '16px', height: '16px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <Text
                            strong
                            style={{
                              color:
                                selectedFacility?.id === facility.id
                                  ? '#1890ff'
                                  : 'inherit',
                            }}
                          >
                            {facility.name}
                          </Text>
                          <br />
                          <Text type="secondary">{facility.facility_type}</Text>
                          <br />
                          <Text type="secondary">{facility.location}</Text>
                          {facility.has_emergency && (
                            <Text
                              type="warning"
                              style={{ display: 'block', fontSize: '12px' }}
                            >
                              ⚠️ Emergency Services
                            </Text>
                          )}
                          {facility.has_ambulance && (
                            <Text
                              type="success"
                              style={{ display: 'block', fontSize: '12px' }}
                            >
                              Ambulance Available
                            </Text>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                : !isMapLoading && (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('No facilities found')}
                    />
                  )}
            </Spin>
          </div>
        </Col>

        {/* Map Column */}
        <Col span={18} style={{ height: '100%', position: 'relative' }}>
          {' '}
          {/* Make relative for positioning children */}
          {/* Use height 100% for map container */}
          <StyledMapContainer style={{ height: '100%' }}>
            <NavigationControls>
              <NavButton onClick={handleZoomIn}>+</NavButton>
              <NavButton onClick={handleZoomOut}>-</NavButton>
              <NavButton onClick={handleResetBearing}>⟳</NavButton>{' '}
              {/* Rotated arrow for bearing */}
              <NavButton onClick={handleResetNorth}>⬆</NavButton>{' '}
              {/* North arrow */}
            </NavigationControls>

            {/* Add the Legend to the map */}
            {renderMapLegend(facilityTypes)}

            <DeckGL
              ref={deckRef}
              initialViewState={initialViewState}
              viewState={viewState}
              onViewStateChange={handleViewStateChange}
              controller
              width="100%"
              height="100%"
              layers={mapLayers} // Use layers including the new tileLayer
              glOptions={{ preserveDrawingBuffer: true }}
              getTooltip={getFacilityTooltip}
            >
              {/* Remove StaticMap component */}
              {/* <StaticMap ... /> */}
            </DeckGL>
          </StyledMapContainer>
          {/* Floating Detail Card - Enhanced Structure */}
          {selectedFacility && (
            <FloatingDetailCard>
              {/* Sticky Header */}
              <StickyHeader>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <Title level={4} style={{ margin: 0, fontSize: '18px' }}>
                        {selectedFacility.name}
                      </Title>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                      }}
                    >
                      <Button
                        type="primary"
                        size="small"
                        href={getDirectionsUrl(selectedFacility)}
                        target="_blank"
                        icon={<EnvironmentOutlined />}
                      >
                        {t('Get Directions')}
                      </Button>
                      <Button
                        type="text"
                        shape="circle"
                        size="small"
                        icon={<span style={{ fontSize: '16px' }}>✕</span>}
                        onClick={() => setSelectedFacility(null)}
                      />
                    </div>
                  </div>
                </div>
              </StickyHeader>

              {/* Scrollable Body */}
              <ScrollableBody>
                <FacilityInfoItem>
                  <InfoIcon>
                    <BankOutlined />
                  </InfoIcon>
                  <InfoContent>
                    <InfoLabel>{t('Facility Type')}</InfoLabel>
                    <InfoValue strong>
                      {selectedFacility.facility_type}
                    </InfoValue>
                  </InfoContent>
                </FacilityInfoItem>

                <FacilityInfoItem>
                  <InfoIcon>
                    <EnvironmentOutlined />
                  </InfoIcon>
                  <InfoContent>
                    <InfoLabel>{t('Location')}</InfoLabel>
                    <InfoValue>
                      {selectedFacility.location},{' '}
                      {selectedFacility.municipality}
                    </InfoValue>
                  </InfoContent>
                </FacilityInfoItem>

                {selectedFacility.address && (
                  <FacilityInfoItem>
                    <InfoIcon>
                      <EnvironmentOutlined />
                    </InfoIcon>
                    <InfoContent>
                      <InfoLabel>{t('Address')}</InfoLabel>
                      <InfoValue>{selectedFacility.address}</InfoValue>
                    </InfoContent>
                  </FacilityInfoItem>
                )}

                {selectedFacility.phone && (
                  <FacilityInfoItem>
                    <InfoIcon>
                      <PhoneOutlined />
                    </InfoIcon>
                    <InfoContent>
                      <InfoLabel>{t('Phone')}</InfoLabel>
                      <InfoValue>{selectedFacility.phone}</InfoValue>
                    </InfoContent>
                  </FacilityInfoItem>
                )}

                {selectedFacility.email && (
                  <FacilityInfoItem>
                    <InfoIcon>
                      <MailOutlined />
                    </InfoIcon>
                    <InfoContent>
                      <InfoLabel>{t('Email')}</InfoLabel>
                      <InfoValue>{selectedFacility.email}</InfoValue>
                    </InfoContent>
                  </FacilityInfoItem>
                )}

                {selectedFacility.services && (
                  <FacilityInfoItem>
                    <InfoIcon>
                      <InfoCircleOutlined />
                    </InfoIcon>
                    <InfoContent>
                      <InfoLabel>{t('Services')}</InfoLabel>
                      <InfoValue>{selectedFacility.services}</InfoValue>
                    </InfoContent>
                  </FacilityInfoItem>
                )}

                {selectedFacility.has_ambulance && (
                  <div
                    style={{
                      background: '#f6ffed',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      marginTop: '8px',
                      borderLeft: '4px solid #52c41a',
                    }}
                  >
                    <Text strong style={{ color: '#52c41a' }}>
                      {t('Ambulance Service Available')}
                    </Text>
                  </div>
                )}

                {selectedFacility.has_emergency && (
                  <div
                    style={{
                      background: '#fff2e8',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      marginTop: '8px',
                      borderLeft: '4px solid #fa8c16',
                    }}
                  >
                    <Text strong style={{ color: '#fa8c16' }}>
                      {t('Emergency Services Available')}
                    </Text>
                  </div>
                )}
              </ScrollableBody>
            </FloatingDetailCard>
          )}
        </Col>
      </Row>
    </StyledCard>
  );
};

export default MapViewTab;
