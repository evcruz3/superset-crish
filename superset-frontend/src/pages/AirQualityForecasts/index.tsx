import React, { useState, useEffect, useCallback } from 'react';
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

const AQIIndicatorBar = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
`;

const AQIScale = styled.div`
  display: flex;
  flex: 1;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  overflow: hidden;
  margin-right: ${({ theme }) => theme.gridUnit * 3}px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
`;

const AQIScaleSegment = styled.div<{ color: string; flex: number }>`
  flex: ${({ flex }) => flex};
  background: ${({ color }) => color};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: ${({ theme }) => theme.typography.sizes.xs}px;
  font-weight: ${({ theme }) => theme.typography.weights.medium};
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  border-right: 1px solid rgba(255,255,255,0.2);
  
  &:last-child {
    border-right: none;
  }
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
  height: calc(100vh - 280px);
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
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, 
      #00E400 0%, 
      #FFFF00 20%, 
      #FF7E00 40%, 
      #FF0000 60%, 
      #8F3F97 80%, 
      #7E0023 100%);
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

interface PollutantPillProps {
  aqi: number;
}

const PollutantPill = styled.span<PollutantPillProps>`
  background-color: ${({ theme, aqi }) => getAqiColor(aqi, theme, true)};
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

interface AirQualityData {
  municipality_code: string;
  municipality_name: string;
  forecast_date: string;
  overall_aqi: number;
  pm25?: number;
  pm10?: number;
  o3?: number;
  no2?: number;
  so2?: number;
  co?: number;
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
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("TL-DI");
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [selectedPollutant, setSelectedPollutant] = useState<string>('overall_aqi');
  const [selectedDate, setSelectedDate] = useState(moment());
  const [lastAirQualityRunInfo, setLastAirQualityRunInfo] = useState<PipelineRunHistoryType | null>(null);
  const [lastAirQualityRunLoading, setLastAirQualityRunLoading] = useState(false);

  // State for Trendline Tab
  const [trendlineData, setTrendlineData] = useState<any[]>([]); // For Recharts data array
  const [trendlineSeriesKeys, setTrendlineSeriesKeys] = useState<string[]>([]); // To store dynamic series keys
  const [selectedTrendPollutants, setSelectedTrendPollutants] = useState<string[]>(['pm25', 'pm10']);
  const [selectedTrendMunicipalities, setSelectedTrendMunicipalities] = useState<string[]>(["TL-DI", "TL-BA"]);
  const [trendlineLoading, setTrendlineLoading] = useState(false); 
  const [trendlineError, setTrendlineError] = useState<string | null>(null); 

  const ALL_POLLUTANTS_OPTIONS = [
    { label: t('PM2.5'), value: 'pm25' },
    { label: t('PM10'), value: 'pm10' },
    { label: t('Ozone (O₃)'), value: 'o3' },
    { label: t('Nitrogen Dioxide (NO₂)'), value: 'no2' },
    { label: t('Sulfur Dioxide (SO₂)'), value: 'so2' },
    { label: t('Carbon Monoxide (CO)'), value: 'co' },
  ];

  const municipalitiesOptions = geojson?.features?.map((f: any) => ({ 
      label: f.properties.ADM1, 
      value: f.properties.ISO 
  })) || [];

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
      console.log("[Air Quality Pipeline Run] Fetching last successful run info");
      const response = await SupersetClient.get({
        endpoint: '/api/v1/air_quality_pipeline_run_history/last_successful_run',
        headers: { Accept: 'application/json' },
      });
      
      console.log("[Air Quality Pipeline Run] Response:", response.json);
      
      if (response.json?.result) {
        setLastAirQualityRunInfo(response.json.result);
        console.log("[Air Quality Pipeline Run] Last successful run:", response.json.result.ran_at);
      } else {
        console.log("[Air Quality Pipeline Run] No successful run info available");
        setLastAirQualityRunInfo(null);
      }
    } catch (error) {
      if (error.status === 404) {
        console.log("[Air Quality Pipeline Run] No successful run history found");
      } else {
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
          endpoint: `/api/v1/air_quality_forecast/forecasts?municipality_code=${selectedMunicipality}&days=10`,
        });
        setForecastData(response.json.result);
      } catch (e) {
        console.error('Failed to fetch card forecast data:', e);
        setError('Failed to load 10-day forecast data.');
      }
      setLoading(false);
    };
    fetchCardData();
  }, [selectedMunicipality, activeTab]);

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
          endpoint: `/api/v1/air_quality_forecast/map?forecast_date=${selectedDate.format('YYYY-MM-DD')}`,
        });
        setMapForecastData(mapDataResponse.json.result);

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
          endpoint: `/api/v1/air_quality_forecast/trends?municipalities=${selectedTrendMunicipalities.join(',')}&pollutants=${selectedTrendPollutants.join(',')}&days=7`,
        });
        const apiData = response.json.result;
        setTrendlineData(apiData);

        // Dynamically generate series keys from the first data point (if data exists)
        if (apiData && apiData.length > 0) {
          const firstPoint = apiData[0];
          const keys = Object.keys(firstPoint).filter(key => key !== 'date');
          setTrendlineSeriesKeys(keys);
        } else {
          setTrendlineSeriesKeys([]);
        }

      } catch (e) {
        console.error('Failed to fetch trendline data:', e);
        setTrendlineError('Failed to load trendline data.');
        setTrendlineData([]);
        setTrendlineSeriesKeys([]);
      }
      setTrendlineLoading(false);
    };

    if (selectedTrendMunicipalities.length > 0 && selectedTrendPollutants.length > 0) {
        fetchTrendlineData();
    } else {
        setTrendlineData([]);
        setTrendlineSeriesKeys([]);
    }
  }, [activeTab, selectedTrendPollutants, selectedTrendMunicipalities]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };

  const renderForecasts = () => {
    if (loading && activeTab === '2') return <Spin tip="Loading forecast data..." />;
    if (error && activeTab === '2') return <Alert message={error} type="error" showIcon />;
    if (!forecastData || forecastData.length === 0 && activeTab === '2') return <Alert message="No forecast data available for the selected municipality." type="info" showIcon />;

    return forecastData.map((data, index) => {
      const aqiLevel = AQI_LEVELS.find(l => data.overall_aqi >= l.range[0] && data.overall_aqi <= l.range[1]);
      
      return (
        <ForecastCard key={index}>
          <div className="forecast-header">
            <h3>{moment(data.forecast_date).format('dddd, DD MMMM YYYY')}</h3>
            <PollutantPill aqi={data.overall_aqi}>AQI {data.overall_aqi}</PollutantPill>
          </div>
          
          <p style={{ color: theme.colors.grayscale.base, marginBottom: theme.gridUnit * 2 }}>
            {data.municipality_name} • {aqiLevel?.description}
          </p>
          
          <div className="pollutant-grid">
            {data.pm25 && (
              <div className="pollutant-item">
                <div className="pollutant-name">PM2.5</div>
                <div className="pollutant-value">{data.pm25}</div>
                <div className="pollutant-unit">µg/m³</div>
              </div>
            )}
            {data.pm10 && (
              <div className="pollutant-item">
                <div className="pollutant-name">PM10</div>
                <div className="pollutant-value">{data.pm10}</div>
                <div className="pollutant-unit">µg/m³</div>
              </div>
            )}
            {data.o3 && (
              <div className="pollutant-item">
                <div className="pollutant-name">O₃</div>
                <div className="pollutant-value">{data.o3}</div>
                <div className="pollutant-unit">ppm</div>
              </div>
            )}
            {data.no2 && (
              <div className="pollutant-item">
                <div className="pollutant-name">NO₂</div>
                <div className="pollutant-value">{data.no2}</div>
                <div className="pollutant-unit">ppm</div>
              </div>
            )}
            {data.so2 && (
              <div className="pollutant-item">
                <div className="pollutant-name">SO₂</div>
                <div className="pollutant-value">{data.so2}</div>
                <div className="pollutant-unit">ppm</div>
              </div>
            )}
            {data.co && (
              <div className="pollutant-item">
                <div className="pollutant-name">CO</div>
                <div className="pollutant-value">{data.co}</div>
                <div className="pollutant-unit">ppm</div>
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

  const geoJsonLayer = geojson && new GeoJsonLayer<JsonObject, GeoJsonLayerProps<JsonObject>>({
    id: 'geojson-layer',
    data: geojson as any,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthMinPixels: 1,
    getFillColor: (d: any) => {
        const municipalityCode = d.properties.ISO;
        const forecast = mapForecastData.find(f => f.municipality_code === municipalityCode);
        const aqiValue = forecast ? forecast[selectedPollutant as keyof AirQualityData] as number : undefined;
        if (selectedPollutant !== 'overall_aqi' && aqiValue !== undefined) {
            if (selectedPollutant === 'pm25') {
                if (aqiValue <= 12) return [0, 255, 0, 180];
                if (aqiValue <= 35.4) return [255, 255, 0, 180];
                if (aqiValue <= 55.4) return [255, 165, 0, 180];
                if (aqiValue <= 150.4) return [255, 0, 0, 180];
                if (aqiValue <= 250.4) return [128, 0, 128, 180];
                return [128, 0, 0, 180];
            }
            return getAqiColor(aqiValue, theme) as [number,number,number,number];
        }
        return aqiValue !== undefined ? getAqiColor(aqiValue, theme) as [number,number,number,number] : [200, 200, 200, 100];
    },
    getLineColor: [0,0,0,200],
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
    const legendLevels = AQI_LEVELS;
    const pollutantName = selectedPollutant === 'overall_aqi' ? 'AQI' : selectedPollutant.toUpperCase();

    return (
      <LegendContainer>
        <h4>{pollutantName} {t('Scale')}</h4>
        {legendLevels.map(level => (
          <div key={level.label} className="legend-item">
            <div 
              className="legend-color" 
              style={{ backgroundColor: level.color }} 
            />
            <div className="legend-label">{level.label}</div>
            <div className="legend-range">
              {level.range[0]}-{level.range[1] === Infinity ? '500+' : level.range[1]}
            </div>
          </div>
        ))}
      </LegendContainer>
    );
  };

  const handleMunicipalityChange = (value: string) => {
    setSelectedMunicipality(value);
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
                    <Option value="pm25">{t('PM2.5 Particulate')}</Option>
                    <Option value="pm10">{t('PM10 Particulate')}</Option>
                    <Option value="o3">{t('Ozone (O₃)')}</Option>
                    <Option value="no2">{t('Nitrogen Dioxide (NO₂)')}</Option>
                    <Option value="so2">{t('Sulfur Dioxide (SO₂)')}</Option>
                    <Option value="co">{t('Carbon Monoxide (CO)')}</Option>
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
                
                {/* AQI Scale Indicator */}
                <AQIIndicatorBar>
                  <AQIScale>
                    {AQI_LEVELS.map((level, index) => (
                      <AQIScaleSegment 
                        key={index} 
                        color={level.color} 
                        flex={index === AQI_LEVELS.length - 1 ? 2 : 1}
                      >
                        {level.range[0]}
                      </AQIScaleSegment>
                    ))}
                  </AQIScale>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: theme.typography.sizes.s, color: theme.colors.grayscale.base }}>
                      {t('Air Quality Index Scale')}
                    </div>
                  </div>
                </AQIIndicatorBar>
                
                <MapContainer>
                  <DeckGL
                    initialViewState={INITIAL_VIEW_STATE}
                    controller={true}
                    layers={[baseMapLayer, geoJsonLayer].filter(Boolean) as any}
                  >
                    {hoverInfo && hoverInfo.object && (() => {
                      const municipalityData = mapForecastData.find(f => f.municipality_code === hoverInfo.object.properties.ISO);
                      const value = municipalityData?.[selectedPollutant as keyof AirQualityData];
                      const aqiLevel = selectedPollutant === 'overall_aqi' && value ? 
                        AQI_LEVELS.find(l => value >= l.range[0] && value <= l.range[1]) : null;
                      
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
                              {hoverInfo.object.properties.ADM1}
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: theme.gridUnit * 2 }}>
                              <div style={{ 
                                fontSize: theme.typography.sizes.xl,
                                fontWeight: theme.typography.weights.bold,
                                color: aqiLevel ? aqiLevel.color : theme.colors.grayscale.dark1
                              }}>
                                {value || 'N/A'}
                              </div>
                              <div style={{ fontSize: theme.typography.sizes.s, color: theme.colors.grayscale.base }}>
                                {selectedPollutant === 'overall_aqi' ? 'AQI' : 
                                 (selectedPollutant === 'pm25' || selectedPollutant === 'pm10' ? 'µg/m³' : 'ppm')}
                              </div>
                            </div>
                            
                            {selectedPollutant === 'overall_aqi' && aqiLevel && (
                              <div style={{ 
                                marginTop: theme.gridUnit * 2,
                                paddingTop: theme.gridUnit * 2,
                                borderTop: `1px solid ${theme.colors.grayscale.light2}`
                              }}>
                                <div style={{ fontSize: theme.typography.sizes.s, color: aqiLevel.color, fontWeight: theme.typography.weights.medium }}>
                                  {aqiLevel.label}
                                </div>
                                {municipalityData?.dominant_pollutant && (
                                  <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.grayscale.base, marginTop: theme.gridUnit }}>
                                    Primary: {municipalityData.dominant_pollutant}
                                  </div>
                                )}
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
              <span className="filter-label">{t('Municipality')}:</span>
              <Select 
                value={selectedMunicipality} 
                onChange={handleMunicipalityChange}
                loading={loading && activeTab === '1'}
                disabled={!geojson}
                placeholder="Select municipality"
              >
                {municipalitiesOptions.map((m: {label: string, value: string}) => (
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
              <span className="filter-label">{t('Municipalities')}:</span>
              <Select
                mode="multiple"
                allowClear
                placeholder="Select municipalities"
                value={selectedTrendMunicipalities}
                onChange={(value: string[]) => setSelectedTrendMunicipalities(value)}
                options={municipalitiesOptions} 
                disabled={!geojson}
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
                          (selectedTrendPollutants[0] === 'pm25' || selectedTrendPollutants[0] === 'pm10' ? 'µg/m³' : 'ppm') : 
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
                        const parts = value.split('_');
                        if (parts.length === 2) {
                          const [pollutant, municipality] = parts;
                          const municName = municipality.replace(/TLDI/g, 'Dili').replace(/TLBA/g, 'Baucau');
                          const pollutantName = ALL_POLLUTANTS_OPTIONS.find(p => p.value === pollutant)?.label || pollutant.toUpperCase();
                          return `${municName} - ${pollutantName}`;
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
            {!trendlineLoading && !trendlineError && trendlineData.length === 0 && selectedTrendMunicipalities.length > 0 && selectedTrendPollutants.length > 0 && (
                <Alert message="No trendline data available for the current selection." type="info" showIcon />
            )}
          </TabContentContainer>
        </LineEditableTabs.TabPane>
      </LineEditableTabs>
    </StyledTabsContainer>
  );
} 