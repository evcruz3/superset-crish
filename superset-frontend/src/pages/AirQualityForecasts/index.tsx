import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { styled, useTheme, SupersetClient, SupersetTheme, JsonObject, t } from '@superset-ui/core';
import { Spin, Alert, Select, Row, Col, DatePicker } from 'antd';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, GeoJsonLayerProps } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import moment from 'moment';
import { LineEditableTabs } from 'src/components/Tabs';
import { StyledTabsContainer, TabContentContainer } from '../WeatherForecasts/DashboardTabs';

// Recharts imports
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

const { Option } = Select;

const DataSourceAttribution = styled.div`
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: ${({ theme }) => theme.gridUnit * 2}px ${({ theme }) => theme.gridUnit * 3}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  z-index: 900;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
`;

const DataUpdateInfo = styled.span`
  margin-top: ${({ theme }) => theme.gridUnit}px;
  font-size: ${({ theme }) => theme.typography.sizes.xs}px;
  color: ${({ theme }) => theme.colors.grayscale.base};
`;


const CurrentAQIMarker = styled.div<{ position: number }>`
  position: absolute;
  left: ${({ position }) => position}%;
  top: -10px;
  transform: translateX(-50%);
  
  &::before {
    content: '';
    display: block;
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 10px solid ${({ theme }) => theme.colors.grayscale.dark2};
  }
  
  &::after {
    content: attr(data-value);
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: ${({ theme }) => theme.colors.grayscale.dark2};
    color: white;
    padding: ${({ theme }) => theme.gridUnit}px ${({ theme }) => theme.gridUnit * 2}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
`;

const MapContainer = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  height: calc(100vh - 200px);
  min-height: 500px;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
`;

const LegendContainer = styled.div`
  position: absolute;
  bottom: ${({ theme }) => theme.gridUnit * 4}px;
  right: ${({ theme }) => theme.gridUnit * 4}px;
  background-color: rgba(255, 255, 255, 0.95);
  padding: ${({ theme }) => theme.gridUnit * 3}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  z-index: 1000;
  backdrop-filter: blur(10px);
  min-width: 200px;
  
  h4 {
    margin: 0 0 ${({ theme }) => theme.gridUnit * 2}px 0;
    font-size: ${({ theme }) => theme.typography.sizes.m}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    color: ${({ theme }) => theme.colors.grayscale.dark2};
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.gridUnit * 1.5}px;
    transition: all 0.2s ease;
    
    &:hover {
      transform: translateX(4px);
    }
  }
  
  .legend-color {
    width: 24px;
    height: 24px;
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  
  .legend-label {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    flex: 1;
  }
  
  .legend-range {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
    margin-left: ${({ theme }) => theme.gridUnit}px;
  }
`;

const ForecastCard = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  padding: ${({ theme }) => theme.gridUnit * 5}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  
  &:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }
  
  h3 {
    color: ${({ theme }) => theme.colors.grayscale.dark2};
    margin: 0 0 ${({ theme }) => theme.gridUnit * 3}px 0;
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
  
  .forecast-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  }
  
  .pollutant-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: ${({ theme }) => theme.gridUnit * 2}px;
    margin-top: ${({ theme }) => theme.gridUnit * 3}px;
  }
  
  .pollutant-item {
    background: ${({ theme }) => theme.colors.grayscale.light4};
    padding: ${({ theme }) => theme.gridUnit * 2}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    text-align: center;
    
    .pollutant-name {
      font-size: ${({ theme }) => theme.typography.sizes.xs}px;
      color: ${({ theme }) => theme.colors.grayscale.base};
      text-transform: uppercase;
      margin-bottom: ${({ theme }) => theme.gridUnit}px;
    }
    
    .pollutant-value {
      font-size: ${({ theme }) => theme.typography.sizes.xl}px;
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      color: ${({ theme }) => theme.colors.grayscale.dark2};
    }
    
    .pollutant-unit {
      font-size: ${({ theme }) => theme.typography.sizes.xs}px;
      color: ${({ theme }) => theme.colors.grayscale.base};
    }
  }
  
  .health-advisory {
    margin-top: ${({ theme }) => theme.gridUnit * 3}px;
    padding: ${({ theme }) => theme.gridUnit * 3}px;
    background: ${({ theme }) => theme.colors.warning.light2};
    border-radius: ${({ theme }) => theme.borderRadius}px;
    border-left: 4px solid ${({ theme }) => theme.colors.warning.base};
    
    .advisory-title {
      font-weight: ${({ theme }) => theme.typography.weights.bold};
      color: ${({ theme }) => theme.colors.grayscale.dark2};
      margin-bottom: ${({ theme }) => theme.gridUnit}px;
    }
    
    .advisory-text {
      color: ${({ theme }) => theme.colors.grayscale.dark1};
      line-height: 1.6;
    }
  }
`;

const PollutantPill = styled.span`
  color: white;
  padding: ${({ theme }) => theme.gridUnit * 1.5}px ${({ theme }) => theme.gridUnit * 3}px;
  border-radius: 20px;
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.gridUnit}px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  
  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.5);
    animation: pulse 2s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  }
`;

const FilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.gridUnit * 3}px;
  padding: ${({ theme }) => theme.gridUnit * 3}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  flex-wrap: wrap;
  
  .filter-label {
    font-weight: ${({ theme }) => theme.typography.weights.medium};
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    min-width: fit-content;
  }
  
  .ant-select, .ant-picker {
    min-width: 180px;
  }
`;

interface PollutantData {
  status: string;
  color: string;
  value: number;
}

interface TimestampData {
  date: string;
  timezone_type: number;
  timezone: string;
}

interface AirQualityData {
  id?: string;
  station_id?: string;
  station_name: string;
  city_name: string;
  latitude: string;
  longitude: string;
  pm1?: PollutantData;
  pm25?: PollutantData;
  pm10?: PollutantData;
  co2?: PollutantData;
  ts: TimestampData;
  // Legacy fields for backward compatibility
  municipality_code?: string;
  municipality_name?: string;
  forecast_date?: string;
  overall_aqi?: number;
  dominant_pollutant?: string;
  health_advisory?: string;
}

const INITIAL_VIEW_STATE = {
  longitude: 125.7,
  latitude: -8.8,
  zoom: 7.5,
  pitch: 0,
  bearing: 0,
};

// Helper function to process raw API data into trendline format
const processTrendlineData = (
  rawData: AirQualityData[], 
  selectedStations: string[], 
  selectedPollutants: string[]
) => {
  // Group data by date
  const dataByDate: { [date: string]: any } = {};
  const seriesKeys: string[] = [];
  
  // If no stations selected, use all available stations from the data
  const stationIds = selectedStations.length > 0 ? selectedStations : 
    [...new Set(rawData.map(item => item.id || item.station_id || ''))];
  
  
  rawData.forEach(item => {
    // Extract date from timestamp
    const date = item.ts.date.split(' ')[0];
    
    // Get station identifier
    const stationId = item.id || item.station_id || '';
    
    // Only process selected stations (or all if none selected)
    if (!stationIds.includes(stationId)) {
      return;
    }
    
    if (!dataByDate[date]) {
      dataByDate[date] = { date };
    }
    
    // Process each selected pollutant
    selectedPollutants.forEach(pollutant => {
      const pollutantData = item[pollutant as keyof AirQualityData] as PollutantData;
      if (pollutantData && typeof pollutantData === 'object' && 'value' in pollutantData) {
        const seriesKey = `${pollutant}_${item.station_name.replace(/\s+/g, '_')}`;
        dataByDate[date][seriesKey] = pollutantData.value;
        
        if (!seriesKeys.includes(seriesKey)) {
          seriesKeys.push(seriesKey);
        }
      }
    });
  });
  
  // Convert to array and sort by date
  const data = Object.values(dataByDate).sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  return { data, keys: seriesKeys };
};

const AQI_LEVELS = [
  { range: [0, 50], label: t('Good'), colorKey: 'success.base', color: '#00E400', description: 'Air quality is satisfactory' },
  { range: [51, 100], label: t('Moderate'), colorKey: 'warning.base', color: '#FFFF00', description: 'Acceptable for most people' },
  { range: [101, 150], label: t('Unhealthy for Sensitive Groups'), colorKey: 'error.base', color: '#FF7E00', description: 'Sensitive groups may experience health effects' },
  { range: [151, 200], label: t('Unhealthy'), colorKey: 'error.dark1', color: '#FF0000', description: 'Everyone may experience health effects' },
  { range: [201, 300], label: t('Very Unhealthy'), colorKey: 'error.dark2', color: '#8F3F97', description: 'Health warnings of emergency conditions' },
  { range: [301, Infinity], label: t('Hazardous'), colorKey: 'error.dark2', color: '#7E0023', description: 'Emergency conditions' },
];

const getAqiColor = (aqi: number, theme: SupersetTheme, forPill: boolean = false): [number, number, number, number] | string => {
  const level = AQI_LEVELS.find(l => aqi >= l.range[0] && aqi <= l.range[1]);
  let colorString = theme.colors.grayscale.light2;

  if (level) {
    const colorParts = level.colorKey.split('.');
    let colorObj: any = theme.colors;
    colorParts.forEach(part => {
      if (colorObj && typeof colorObj === 'object' && part in colorObj) {
        colorObj = colorObj[part];
      }
    });
    if (typeof colorObj === 'string') {
        colorString = colorObj;
    }
  }

  if (aqi > 300 && !forPill) colorString = '#6A0DAD';
  else if (aqi > 200 && aqi <=300 && !forPill) colorString = '#800000';

  if (forPill) return colorString;

  const hex = colorString.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b, 180];
};

// Type for Air Quality Pipeline Run History
interface PipelineRunHistoryType {
  id: number;
  ran_at: string;
  pipeline_name: string;
  status: string;
  details?: string;
}

export default function AirQualityForecastsPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('1');
  const [forecastData, setForecastData] = useState<AirQualityData[]>([]);
  const [mapForecastData, setMapForecastData] = useState<AirQualityData[]>([]);
  const [geojson, setGeojson] = useState<JsonObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string>("1");
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [selectedPollutant, setSelectedPollutant] = useState<string>('pm25');
  const [selectedDate, setSelectedDate] = useState(moment());
  const [lastAirQualityRunInfo, setLastAirQualityRunInfo] = useState<PipelineRunHistoryType | null>(null);
  const [lastAirQualityRunLoading, setLastAirQualityRunLoading] = useState(false);

  // State for Trendline Tab
  const [trendlineData, setTrendlineData] = useState<any[]>([]); // For Recharts data array
  const [trendlineSeriesKeys, setTrendlineSeriesKeys] = useState<string[]>([]); // To store dynamic series keys
  const [selectedTrendPollutants, setSelectedTrendPollutants] = useState<string[]>(['pm1', 'pm25']);
  const [selectedTrendStations, setSelectedTrendStations] = useState<string[]>(["1", "2"]);
  const [trendlineLoading, setTrendlineLoading] = useState(false); 
  const [trendlineError, setTrendlineError] = useState<string | null>(null); 

  const ALL_POLLUTANTS_OPTIONS = [
    { label: t('PM1'), value: 'pm1' },
    { label: t('PM2.5'), value: 'pm25' },
    { label: t('PM10'), value: 'pm10' },
    { label: t('Carbon Dioxide (CO₂)'), value: 'co2' },
  ];

  // Create station options from the map data
  const stationOptions = useMemo(() => {
    if (mapForecastData && mapForecastData.length > 0) {
      return mapForecastData.map((station: AirQualityData) => ({ 
        label: `${station.station_name} - ${station.city_name}`, 
        value: station.id || station.station_id || ''
      }));
    }
    // Default stations if no data loaded yet
    return [
      { label: 'Dili Environmental Station - Dili', value: '1' },
      { label: 'Baucau MET Office - Baucau', value: '2' },
      { label: 'Manatuto Monitoring Station - Manatuto', value: '3' },
      { label: 'Viqueque Environmental Office - Viqueque', value: '4' },
      { label: 'Aileu Highland Station - Aileu', value: '5' }
    ];
  }, [mapForecastData]);

  // Format date for display
  const formatDisplayDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateString;
    }
  }, []);

  // Fetch last air quality pipeline run information
  const fetchLastAirQualityRun = useCallback(async () => {
    setLastAirQualityRunLoading(true);
    try {
      const response = await SupersetClient.get({
        endpoint: '/api/v1/air_quality_pipeline_run_history/last_successful_run',
        headers: { Accept: 'application/json' },
      });
      
      if (response.json?.result) {
        setLastAirQualityRunInfo(response.json.result);
      } else {
        setLastAirQualityRunInfo(null);
      }
    } catch (error) {
      if (error.status !== 404) {
        console.error('Error fetching last air quality run info:', error);
      }
      setLastAirQualityRunInfo(null);
    } finally {
      setLastAirQualityRunLoading(false);
    }
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchLastAirQualityRun();
  }, [fetchLastAirQualityRun]);

  useEffect(() => {
    if (activeTab !== '2' && activeTab !== '1') return;

    const fetchCardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/air_quality_forecast/forecast?station_id=${selectedStation}&days=10`,
        });
        setForecastData(response.json.data || []);
      } catch (e) {
        console.error('Failed to fetch card forecast data:', e);
        setError('Failed to load 10-day forecast data.');
      }
      setLoading(false);
    };
    fetchCardData();
  }, [selectedStation, activeTab]);

  useEffect(() => {
    if (activeTab !== '1') return;

    const fetchMapResources = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!geojson) {
          const geojsonResponse = await fetch('/static/assets/geojson/timorleste.geojson');
          if (!geojsonResponse.ok) {
            const errorText = await geojsonResponse.text();
            console.error(`Failed to load GeoJSON. Status: ${geojsonResponse.status}, Path: /assets/geojson/timorleste.geojson, Response: ${errorText}`);
            throw new Error(`Failed to load GeoJSON map data. Status: ${geojsonResponse.status}. Check console for path and server response.`);
          }
          const geojsonData = await geojsonResponse.json();
          setGeojson(geojsonData);
        }

        const mapDataResponse = await SupersetClient.get({
          endpoint: `/api/v1/air_quality_forecast/current`,
        });
        setMapForecastData(mapDataResponse.json.data || []);

      } catch (e: any) {
        console.error('Failed to fetch map resources:', e);
        setError(e.message || 'Failed to load map data or AQI overview.');
      }
      setLoading(false);
    };

    fetchMapResources();
  }, [activeTab, selectedDate, geojson]);

  // Effect for fetching Trendline data for Recharts
  useEffect(() => {
    if (activeTab !== '3') return;

    const fetchTrendlineData = async () => {
      setTrendlineLoading(true);
      setTrendlineError(null);
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/air_quality_forecast/daily?days=7`,
        });
        const rawData = response.json.data || [];
        
        // Process the raw data to create trendline format
        const processedData = processTrendlineData(rawData, selectedTrendStations, selectedTrendPollutants);
        
        setTrendlineData(processedData.data);
        setTrendlineSeriesKeys(processedData.keys);

      } catch (e) {
        console.error('Failed to fetch trendline data:', e);
        setTrendlineError('Failed to load trendline data.');
        setTrendlineData([]);
        setTrendlineSeriesKeys([]);
      }
      setTrendlineLoading(false);
    };

    // Check if stations and pollutants are selected
    if (selectedTrendStations.length > 0 && selectedTrendPollutants.length > 0) {
        fetchTrendlineData();
    } else {
        setTrendlineData([]);
        setTrendlineSeriesKeys([]);
    }
  }, [activeTab, selectedTrendPollutants, selectedTrendStations]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderForecasts = () => {
    if (loading && activeTab === '2') return <Spin tip="Loading forecast data..." />;
    if (error && activeTab === '2') return <Alert message={error} type="error" showIcon />;
    if (!forecastData || forecastData.length === 0 && activeTab === '2') return <Alert message="No forecast data available for the selected station." type="info" showIcon />;

    return forecastData.map((data, index) => {
      // Get the worst pollutant status for display
      const pollutants = [data.pm1, data.pm25, data.pm10, data.co2].filter(p => p);
      const worstPollutant = pollutants.reduce((worst, current) => {
        if (!worst) return current;
        const statusOrder = ['Good', 'Normal', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous'];
        return statusOrder.indexOf(current.status) > statusOrder.indexOf(worst.status) ? current : worst;
      }, null as PollutantData | null);
      
      return (
        <ForecastCard key={index}>
          <div className="forecast-header">
            <h3>{moment(data.ts.date).format('dddd, DD MMMM YYYY')}</h3>
            {worstPollutant && (
              <PollutantPill style={{ backgroundColor: worstPollutant.color, color: '#fff' }}>
                {worstPollutant.status}
              </PollutantPill>
            )}
          </div>
          
          <p style={{ color: theme.colors.grayscale.base, marginBottom: theme.gridUnit * 2 }}>
            {data.station_name} • {data.city_name}
          </p>
          
          <div className="pollutant-grid">
            {data.pm1 && (
              <div className="pollutant-item" style={{ borderLeft: `4px solid ${data.pm1.color}` }}>
                <div className="pollutant-name">PM1</div>
                <div className="pollutant-value">{data.pm1.value}</div>
                <div className="pollutant-unit">µg/m³</div>
                <div style={{ fontSize: '12px', color: data.pm1.color, marginTop: '4px' }}>{data.pm1.status}</div>
              </div>
            )}
            {data.pm25 && (
              <div className="pollutant-item" style={{ borderLeft: `4px solid ${data.pm25.color}` }}>
                <div className="pollutant-name">PM2.5</div>
                <div className="pollutant-value">{data.pm25.value}</div>
                <div className="pollutant-unit">µg/m³</div>
                <div style={{ fontSize: '12px', color: data.pm25.color, marginTop: '4px' }}>{data.pm25.status}</div>
              </div>
            )}
            {data.pm10 && (
              <div className="pollutant-item" style={{ borderLeft: `4px solid ${data.pm10.color}` }}>
                <div className="pollutant-name">PM10</div>
                <div className="pollutant-value">{data.pm10.value}</div>
                <div className="pollutant-unit">µg/m³</div>
                <div style={{ fontSize: '12px', color: data.pm10.color, marginTop: '4px' }}>{data.pm10.status}</div>
              </div>
            )}
            {data.co2 && (
              <div className="pollutant-item" style={{ borderLeft: `4px solid ${data.co2.color}` }}>
                <div className="pollutant-name">CO₂</div>
                <div className="pollutant-value">{data.co2.value}</div>
                <div className="pollutant-unit">ppm</div>
                <div style={{ fontSize: '12px', color: data.co2.color, marginTop: '4px' }}>{data.co2.status}</div>
              </div>
            )}
          </div>
          
          {data.health_advisory && (
            <div className="health-advisory">
              <div className="advisory-title">{t('Health Advisory')}</div>
              <div className="advisory-text">{data.health_advisory}</div>
            </div>
          )}
          
          {data.dominant_pollutant && (
            <p style={{ marginTop: theme.gridUnit * 2, fontSize: theme.typography.sizes.s, color: theme.colors.grayscale.base }}>
              {t('Primary pollutant')}: <strong>{data.dominant_pollutant}</strong>
            </p>
          )}
        </ForecastCard>
      );
    });
  };

  const onHover = (info: any) => {
    setHoverInfo(info);
  };

  // Create station markers instead of municipality polygons
  const stationMarkers = mapForecastData.map(station => {
    const pollutantData = station[selectedPollutant as keyof AirQualityData] as PollutantData;
    const color = pollutantData?.color || '#808080';
    
    return {
      type: 'Feature',
      properties: {
        ...station,
        color,
        value: pollutantData?.value,
        status: pollutantData?.status
      },
      geometry: {
        type: 'Point',
        coordinates: [parseFloat(station.longitude), parseFloat(station.latitude)]
      }
    };
  });

  const stationLayer = new GeoJsonLayer<JsonObject, GeoJsonLayerProps<JsonObject>>({
    id: 'station-layer',
    data: {
      type: 'FeatureCollection',
      features: stationMarkers
    } as any,
    pickable: true,
    stroked: true,
    filled: true,
    pointType: 'circle',
    getPointRadius: 8000, // 8km radius
    getFillColor: (d: any) => {
      const hex = d.properties.color || '#808080';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b, 200];
    },
    getLineColor: [0, 0, 0, 255],
    lineWidthMinPixels: 2,
    onHover: onHover,
    updateTriggers: {
      getFillColor: [mapForecastData, selectedPollutant]
    }
  });

  const baseMapLayer = new TileLayer({
    id: 'carto-voyager-tile-layer',
    data: 'https://cartodb-basemaps-a.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => {
      const { west, south, east, north } = props.tile.bbox as { west: number; south: number; east: number; north: number };

      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
      });
    },
  });

  const renderMapLegend = () => {
    // Define pollutant-specific levels
    const getPollutantLevels = () => {
      switch(selectedPollutant) {
        case 'pm1':
          return [
            { label: t('Good'), color: '#2ecc40', range: '0-10' },
            { label: t('Moderate'), color: '#f3eb12', range: '11-20' },
            { label: t('Unhealthy for Sensitive Groups'), color: '#f39a3a', range: '21-30' },
            { label: t('Unhealthy'), color: '#e62d39', range: '31-40' },
            { label: t('Very Unhealthy'), color: '#8b008b', range: '40+' }
          ];
        case 'pm25':
          return [
            { label: t('Good'), color: '#2ecc40', range: '0-50' },
            { label: t('Moderate'), color: '#f3eb12', range: '51-100' },
            { label: t('Unhealthy for Sensitive Groups'), color: '#f39a3a', range: '101-150' },
            { label: t('Unhealthy'), color: '#e62d39', range: '151-200' },
            { label: t('Very Unhealthy'), color: '#8b008b', range: '201-300' },
            { label: t('Hazardous'), color: '#7e0023', range: '300+' }
          ];
        case 'pm10':
          return [
            { label: t('Good'), color: '#2ecc40', range: '0-50' },
            { label: t('Moderate'), color: '#f3eb12', range: '51-100' },
            { label: t('Unhealthy for Sensitive Groups'), color: '#f39a3a', range: '101-150' },
            { label: t('Unhealthy'), color: '#e62d39', range: '151-200' },
            { label: t('Very Unhealthy'), color: '#8b008b', range: '201-300' },
            { label: t('Hazardous'), color: '#7e0023', range: '300+' }
          ];
        case 'co2':
          return [
            { label: t('Normal'), color: '#2ecc40', range: '0-400' },
            { label: t('Moderate'), color: '#f3eb12', range: '401-600' },
            { label: t('Poor'), color: '#f39a3a', range: '601-1000' },
            { label: t('Very Poor'), color: '#e62d39', range: '1000+' }
          ];
        default:
          return [];
      }
    };

    const levels = getPollutantLevels();
    const pollutantNames = {
      'pm1': 'PM1',
      'pm25': 'PM2.5', 
      'pm10': 'PM10',
      'co2': 'CO₂'
    };
    const pollutantName = pollutantNames[selectedPollutant] || selectedPollutant.toUpperCase();
    const unit = selectedPollutant === 'co2' ? 'ppm' : 'µg/m³';

    return (
      <LegendContainer>
        <h4>{pollutantName} {t('Scale')} ({unit})</h4>
        {levels.map(level => (
          <div key={level.label} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: level.color }} 
            />
            <div className="legend-label">{level.label}</div>
            <div className="legend-range">{level.range}</div>
          </div>
        ))}
      </LegendContainer>
    );
  };

  const handleStationChange = (value: string) => {
    setSelectedStation(value);
  };

  const handlePollutantChange = (value: string) => {
    setSelectedPollutant(value);
  };

  const handleDateChange = (date: moment.Moment | null, dateString: string) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  return (
    <StyledTabsContainer>
      <LineEditableTabs 
        activeKey={activeTab} 
        onChange={handleTabChange} 
        type="card"
      >
        <LineEditableTabs.TabPane tab={t("AQI Map")} key="1">
          <TabContentContainer>
            {loading && activeTab === '1' && <Spin tip="Loading map and data..." />}
            {error && activeTab === '1' && <Alert message={error} type="error" showIcon />}
            {!loading && !error && activeTab === '1' && geojson && (
              <>
                <FilterContainer>
                  <span className="filter-label">{t('View by')}:</span>
                  <Select 
                    value={selectedPollutant} 
                    onChange={handlePollutantChange}
                    placeholder="Select pollutant"
                  >
                    <Option value="overall_aqi">{t('Overall AQI')}</Option>
                    <Option value="pm1">{t('PM1 Particulate')}</Option>
                    <Option value="pm25">{t('PM2.5 Particulate')}</Option>
                    <Option value="pm10">{t('PM10 Particulate')}</Option>
                    <Option value="co2">{t('Carbon Dioxide (CO₂)')}</Option>
                  </Select>
                  
                  <span className="filter-label">{t('Date')}:</span>
                  <DatePicker 
                    onChange={handleDateChange} 
                    value={selectedDate}
                    format="YYYY-MM-DD"
                    allowClear={false}
                    placeholder="Select date"
                  />
                </FilterContainer>
                
                <MapContainer>
                  <DeckGL
                    initialViewState={INITIAL_VIEW_STATE}
                    controller={true}
                    layers={[baseMapLayer, stationLayer].filter(Boolean) as any}
                  >
                    {hoverInfo && hoverInfo.object && (() => {
                      const stationData = hoverInfo.object.properties;
                      const pollutantData = stationData[selectedPollutant] as PollutantData;
                      
                      return (
                        <div style={{
                          position: 'absolute',
                          zIndex: 1,
                          pointerEvents: 'none',
                          left: hoverInfo.x,
                          top: hoverInfo.y,
                          transform: 'translate(-50%, -100%)',
                          marginTop: -10
                        }}>
                          <div style={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            padding: `${theme.gridUnit * 3}px`,
                            borderRadius: theme.borderRadius,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            backdropFilter: 'blur(10px)',
                            minWidth: '200px'
                          }}>
                            <div style={{ 
                              fontWeight: theme.typography.weights.bold, 
                              fontSize: theme.typography.sizes.m,
                              marginBottom: theme.gridUnit * 2,
                              color: theme.colors.grayscale.dark2
                            }}>
                              {stationData.station_name}
                            </div>
                            
                            <div style={{ 
                              fontSize: theme.typography.sizes.s,
                              marginBottom: theme.gridUnit * 2,
                              color: theme.colors.grayscale.base
                            }}>
                              {stationData.city_name}
                            </div>
                            
                            {pollutantData && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: theme.gridUnit * 2 }}>
                                  <div style={{ 
                                    fontSize: theme.typography.sizes.xl,
                                    fontWeight: theme.typography.weights.bold,
                                    color: pollutantData.color
                                  }}>
                                    {pollutantData.value}
                                  </div>
                                  <div style={{ fontSize: theme.typography.sizes.s, color: theme.colors.grayscale.base }}>
                                    {selectedPollutant === 'co2' ? 'ppm' : 'µg/m³'}
                                  </div>
                                </div>
                                <div style={{ 
                                  fontSize: theme.typography.sizes.s,
                                  marginTop: theme.gridUnit,
                                  color: pollutantData.color,
                                  fontWeight: theme.typography.weights.medium
                                }}>
                                  {pollutantData.status}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Arrow pointing down */}
                          <div style={{
                            position: 'absolute',
                            bottom: -8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '8px solid transparent',
                            borderRight: '8px solid transparent',
                            borderTop: '8px solid rgba(255, 255, 255, 0.95)',
                            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.1))'
                          }} />
                        </div>
                      );
                    })()}
                  </DeckGL>
                  {renderMapLegend()}
                </MapContainer>
              </>
            )}
            
            {/* Data source attribution */}
            <DataSourceAttribution>
              <span>{t('Air quality data provided by internal models')}</span>
              {lastAirQualityRunLoading ? (
                <DataUpdateInfo>Loading last air quality update time...</DataUpdateInfo>
              ) : lastAirQualityRunInfo ? (
                <DataUpdateInfo>
                  {t('Last successful air quality update:')} {formatDisplayDate(lastAirQualityRunInfo.ran_at)}
                </DataUpdateInfo>
              ) : (
                <DataUpdateInfo>{t('Air quality update history unavailable')}</DataUpdateInfo>
              )}
            </DataSourceAttribution>
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab={t("10-Day Forecast")} key="2">
          <TabContentContainer>
            <FilterContainer>
              <span className="filter-label">{t('Station')}:</span>
              <Select 
                value={selectedStation} 
                onChange={handleStationChange}
                loading={loading && activeTab === '1'}
                disabled={stationOptions.length === 0}
                placeholder="Select station"
              >
                {stationOptions.map((m: {label: string, value: string}) => (
                  <Option key={m.value} value={m.value}>{m.label}</Option>
                ))}
              </Select>
            </FilterContainer>
            {renderForecasts()}
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab={t("Trendlines")} key="3">
          <TabContentContainer>
            <FilterContainer>
              <span className="filter-label">{t('Stations')}:</span>
              <Select
                mode="multiple"
                allowClear
                placeholder="Select stations"
                value={selectedTrendStations}
                onChange={(value: string[]) => setSelectedTrendStations(value)}
                options={stationOptions} 
                disabled={stationOptions.length === 0}
                style={{ minWidth: 250 }}
              />
              
              <span className="filter-label">{t('Pollutants')}:</span>
              <Select
                mode="multiple"
                allowClear
                placeholder="Select pollutants"
                value={selectedTrendPollutants}
                onChange={(value: string[]) => setSelectedTrendPollutants(value)}
                options={ALL_POLLUTANTS_OPTIONS}
                style={{ minWidth: 250 }}
              />
            </FilterContainer>

            {trendlineLoading && <Spin tip="Loading trendline data..." />}
            {trendlineError && <Alert message={trendlineError} type="error" showIcon />}
            {!trendlineLoading && !trendlineError && trendlineData.length > 0 && (
              <div style={{ 
                height: 'calc(100vh - 350px)', 
                minHeight: '400px',
                backgroundColor: theme.colors.grayscale.light5,
                borderRadius: theme.borderRadius,
                padding: theme.gridUnit * 3,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendlineData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                    <defs>
                      {trendlineSeriesKeys.map((key, index) => {
                        const colors = [
                          { start: '#1890ff', end: '#096dd9' },
                          { start: '#52c41a', end: '#389e0d' },
                          { start: '#fa8c16', end: '#d46b08' },
                          { start: '#f5222d', end: '#a8071a' },
                          { start: '#722ed1', end: '#531dab' },
                          { start: '#13c2c2', end: '#08979c' },
                        ];
                        const color = colors[index % colors.length];
                        return (
                          <linearGradient key={`gradient-${key}`} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color.start} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={color.end} stopOpacity={0.8} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid 
                      strokeDasharray="3 3" 
                      stroke={theme.colors.grayscale.light2}
                      vertical={false}
                    />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(tick) => moment(tick).format('MMM DD')} 
                      stroke={theme.colors.grayscale.base}
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      stroke={theme.colors.grayscale.base}
                      tick={{ fontSize: 12 }}
                      label={{ 
                        value: selectedTrendPollutants.length === 1 ? 
                          (selectedTrendPollutants[0] === 'pm1' || selectedTrendPollutants[0] === 'pm25' || selectedTrendPollutants[0] === 'pm10' ? 'µg/m³' : 'ppm') : 
                          'Value',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fontSize: 14, fill: theme.colors.grayscale.dark1 }
                      }}
                    />
                    <Tooltip 
                      labelFormatter={(label) => moment(label).format('dddd, DD MMMM YYYY')}
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: 'none',
                        borderRadius: theme.borderRadius,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        padding: theme.gridUnit * 2
                      }}
                      labelStyle={{
                        color: theme.colors.grayscale.dark2,
                        fontWeight: theme.typography.weights.bold,
                        marginBottom: theme.gridUnit
                      }}
                    />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="line"
                      wrapperStyle={{
                        paddingBottom: theme.gridUnit * 2
                      }}
                      formatter={(value) => {
                        // Format: pollutant_Station_Name_With_Spaces
                        const firstUnderscore = value.indexOf('_');
                        if (firstUnderscore !== -1) {
                          const pollutant = value.substring(0, firstUnderscore);
                          const stationName = value.substring(firstUnderscore + 1).replace(/_/g, ' ');
                          const pollutantName = ALL_POLLUTANTS_OPTIONS.find(p => p.value === pollutant)?.label || pollutant.toUpperCase();
                          return `${stationName} - ${pollutantName}`;
                        }
                        return value;
                      }}
                    />
                    {trendlineSeriesKeys.map((key, index) => {
                      return (
                        <Line 
                          key={key} 
                          type="monotone" 
                          dataKey={key} 
                          stroke={`url(#gradient-${key})`}
                          strokeWidth={3}
                          dot={{ fill: theme.colors.grayscale.light5, strokeWidth: 2, r: 4 }}
                          activeDot={{ 
                            r: 6, 
                            fill: theme.colors.primary.base,
                            stroke: theme.colors.grayscale.light5,
                            strokeWidth: 2
                          }}
                          name={key}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {!trendlineLoading && !trendlineError && trendlineData.length === 0 && selectedTrendStations.length > 0 && selectedTrendPollutants.length > 0 && (
                <Alert message="No trendline data available for the current selection." type="info" showIcon />
            )}
          </TabContentContainer>
        </LineEditableTabs.TabPane>
      </LineEditableTabs>
    </StyledTabsContainer>
  );
} 