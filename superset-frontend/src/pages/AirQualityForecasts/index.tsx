import React, { useState, useEffect, ElementType, ClassAttributes, HTMLAttributes } from 'react';
import { styled, useTheme, SupersetClient, SupersetTheme, JsonObject } from '@superset-ui/core';
import { Spin, Alert, Select, Row, Col, DatePicker } from 'antd';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, GeoJsonLayerProps } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import moment from 'moment';
import { LineEditableTabs } from 'src/components/Tabs';
import { StyledTabsContainer, TabContentContainer } from '../WeatherForecasts/DashboardTabs';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';

// Recharts imports
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Label
} from 'recharts';

const { Option } = Select;

const MapContainer = styled.div<{ theme: SupersetTheme }>`
  background-color: ${({ theme }: { theme: SupersetTheme }) => theme.colors.grayscale.light5};
  padding: ${({ theme }: { theme: SupersetTheme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }: { theme: SupersetTheme }) => theme.borderRadius}px;
  height: 70vh;
  position: relative;
  display: flex;
  flex-direction: column;
`;

const LegendContainer = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background-color: white;
  padding: 10px;
  border-radius: 5px;
  box-shadow: 0 0 10px rgba(0,0,0,0.2);
  z-index: 1000;
  h4 {
    margin-top: 0;
    margin-bottom: 5px;
  }
  div {
    display: flex;
    align-items: center;
    margin-bottom: 3px;
  }
  span {
    width: 20px;
    height: 20px;
    margin-right: 8px;
    border: 1px solid #ccc;
  }
`;

const ForecastCard = styled.div<{ theme: SupersetTheme }>`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  h3 {
    color: ${({ theme }) => theme.colors.primary.dark1};
    margin-top: 0;
  }
  p {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    line-height: 1.6;
  }
  strong {
    color: ${({ theme }) => theme.colors.grayscale.dark1};
  }
`;

interface PollutantPillProps {
  theme: SupersetTheme;
  aqi: number;
  className?: string;
}

const PollutantPill = styled.span<PollutantPillProps>`
  background-color: ${({ theme, aqi }) => getAqiColor(aqi, theme, true)};
  color: white;
  padding: ${({ theme }) => theme.gridUnit}px ${({ theme }) => theme.gridUnit * 2}px;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  margin-right: ${({ theme }) => theme.gridUnit * 2}px;
  display: inline-block;
  margin-bottom: ${({ theme }) => theme.gridUnit}px;
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
  { range: [0, 50], label: 'Good', colorKey: 'success.base' },
  { range: [51, 100], label: 'Moderate', colorKey: 'warning.base' },
  { range: [101, 150], label: 'Unhealthy for Sensitive Groups', colorKey: 'error.base' },
  { range: [151, 200], label: 'Unhealthy', colorKey: 'error.dark1' },
  { range: [201, 300], label: 'Very Unhealthy', colorKey: 'error.dark2' },
  { range: [301, Infinity], label: 'Hazardous', colorKey: 'error.dark2' },
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

export default function AirQualityForecastsPage() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState('map');
  const [forecastData, setForecastData] = useState<AirQualityData[]>([]);
  const [mapForecastData, setMapForecastData] = useState<AirQualityData[]>([]);
  const [geojson, setGeojson] = useState<JsonObject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("TL-DI");
  const [hoverInfo, setHoverInfo] = useState<any>(null);
  const [selectedPollutant, setSelectedPollutant] = useState<string>('overall_aqi');
  const [selectedDate, setSelectedDate] = useState(moment());

  // State for Trendline Tab
  const [trendlineData, setTrendlineData] = useState<any[]>([]); // For Recharts data array
  const [trendlineSeriesKeys, setTrendlineSeriesKeys] = useState<string[]>([]); // To store dynamic series keys
  const [selectedTrendPollutants, setSelectedTrendPollutants] = useState<string[]>(['pm25', 'pm10']);
  const [selectedTrendMunicipalities, setSelectedTrendMunicipalities] = useState<string[]>(["TL-DI", "TL-BA"]);
  const [trendlineLoading, setTrendlineLoading] = useState(false); 
  const [trendlineError, setTrendlineError] = useState<string | null>(null); 

  const ALL_POLLUTANTS_OPTIONS = [
    { label: 'PM2.5', value: 'pm25' },
    { label: 'PM10', value: 'pm10' },
    { label: 'Ozone (O₃)', value: 'o3' },
    { label: 'Nitrogen Dioxide (NO₂)', value: 'no2' },
    { label: 'Sulfur Dioxide (SO₂)', value: 'so2' },
    { label: 'Carbon Monoxide (CO)', value: 'co' },
  ];

  const municipalitiesOptions = geojson?.features?.map((f: any) => ({ 
      label: f.properties.ADM1, 
      value: f.properties.ISO 
  })) || [];

  useEffect(() => {
    if (activeTab !== 'cards' && activeTab !== 'map') return;

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
    if (activeTab !== 'map') return;

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
    if (activeTab !== 'trendline') return;

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
    if (loading && activeTab === 'cards') return <Spin tip="Loading forecast data..." />;
    if (error && activeTab === 'cards') return <Alert message={error} type="error" showIcon />;
    if (!forecastData || forecastData.length === 0 && activeTab === 'cards') return <Alert message="No forecast data available for the selected municipality." type="info" showIcon />;

    return forecastData.map((data, index) => (
      <ForecastCard key={index} theme={theme}>
        <h3>{moment(data.forecast_date).format('DD MMMM, YYYY')} - {data.municipality_name}</h3>
        <p><PollutantPill theme={theme} aqi={data.overall_aqi}>AQI: {data.overall_aqi}</PollutantPill></p>
        {data.dominant_pollutant && <p><strong>Dominant Pollutant:</strong> {data.dominant_pollutant}</p>}
        {data.pm25 && <p><strong>PM2.5:</strong> {data.pm25} µg/m³</p>}
        {data.pm10 && <p><strong>PM10:</strong> {data.pm10} µg/m³</p>}
        {data.o3 && <p><strong>Ozone (O₃):</strong> {data.o3} ppm</p>}
        {data.no2 && <p><strong>Nitrogen Dioxide (NO₂):</strong> {data.no2} ppm</p>}
        {data.so2 && <p><strong>Sulfur Dioxide (SO₂):</strong> {data.so2} ppm</p>}
        {data.co && <p><strong>Carbon Monoxide (CO):</strong> {data.co} ppm</p>}
        {data.health_advisory && <p><strong>Health Advisory:</strong> {data.health_advisory}</p>}
      </ForecastCard>
    ));
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
        <h4>{pollutantName} Legend</h4>
        {legendLevels.map(level => (
            <div key={level.label}>
            <span style={{ backgroundColor: getAqiColor(level.range[0], theme, true) as string }} />
            {level.label} ({level.range[0]} - {level.range[1] === Infinity ? '500+' : level.range[1]})
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
    <StyledTabsContainer theme={theme}>
      <LineEditableTabs 
        activeKey={activeTab} 
        onChange={handleTabChange} 
        type="card"
      >
        <LineEditableTabs.TabPane tab="AQI Map" key="map">
          <TabContentContainer theme={theme}>
            {loading && activeTab === 'map' && <Spin tip="Loading map and data..." />}
            {error && activeTab === 'map' && <Alert message={error} type="error" showIcon />}
            {!loading && !error && activeTab === 'map' && geojson && (
              <>
                <Row gutter={[16,16]} style={{marginBottom: theme.gridUnit * 2, paddingLeft: theme.gridUnit *2, paddingRight: theme.gridUnit*2, alignItems: 'center'}}>
                    <Col>
                        Select Pollutant:
                    </Col>
                    <Col>
                        <Select 
                            value={selectedPollutant} 
                            onChange={handlePollutantChange}
                            style={{width: 150, marginRight: theme.gridUnit * 2}}
                        >
                            <Option value="overall_aqi">Overall AQI</Option>
                            <Option value="pm25">PM2.5</Option>
                            <Option value="pm10">PM10</Option>
                            <Option value="o3">Ozone (O₃)</Option>
                            <Option value="no2">Nitrogen Dioxide (NO₂)</Option>
                            <Option value="so2">Sulfur Dioxide (SO₂)</Option>
                            <Option value="co">Carbon Monoxide (CO)</Option>
                        </Select>
                    </Col>
                    <Col>
                        Select Date:
                    </Col>
                    <Col>
                        <DatePicker 
                            onChange={handleDateChange} 
                            value={selectedDate}
                            format="YYYY-MM-DD"
                            allowClear={false} 
                        />
                    </Col>
                </Row>
                <MapContainer theme={theme}>
                  <DeckGL
                    initialViewState={INITIAL_VIEW_STATE}
                    controller={true}
                    layers={[baseMapLayer, geoJsonLayer].filter(Boolean) as any}
                  >
                    {hoverInfo && hoverInfo.object && (
                      <div style={{
                        position: 'absolute',
                        zIndex: 1,
                        pointerEvents: 'none',
                        left: hoverInfo.x,
                        top: hoverInfo.y,
                        backgroundColor: 'white',
                        padding: '5px',
                        borderRadius: '3px',
                        boxShadow: '0 0 5px rgba(0,0,0,0.3)'
                      }}>
                        <strong>{hoverInfo.object.properties.ADM1}</strong><br />
                        {selectedPollutant === 'overall_aqi' ? 'AQI' : selectedPollutant.toUpperCase()}: {mapForecastData.find(f => f.municipality_code === hoverInfo.object.properties.ISO)?.[selectedPollutant as keyof AirQualityData] || 'N/A'}<br />
                        {selectedPollutant === 'overall_aqi' && (
                            <>Dominant: {mapForecastData.find(f => f.municipality_code === hoverInfo.object.properties.ISO)?.dominant_pollutant || 'N/A'}<br /></>
                        )}
                      </div>
                    )}
                  </DeckGL>
                  {renderMapLegend()}
                </MapContainer>
              </>
            )}
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab="10-Day Forecast Cards" key="cards">
            <Row gutter={[16,16]} style={{marginBottom: theme.gridUnit * 4}}>
                <Col>
                    Select Municipality:
                </Col>
                <Col>
                    <Select 
                        value={selectedMunicipality} 
                        onChange={handleMunicipalityChange}
                        style={{width: 200}}
                        loading={loading && activeTab === 'map'}
                        disabled={!geojson}
                    >
                        {municipalitiesOptions.map((m: {label: string, value: string}) => <Option key={m.value} value={m.value}>{m.label}</Option>)}
                    </Select>
                </Col>
            </Row>
          <TabContentContainer theme={theme}>
            {renderForecasts()}
          </TabContentContainer>
        </LineEditableTabs.TabPane>
        <LineEditableTabs.TabPane tab="Trendline" key="trendline">
          <TabContentContainer theme={theme}>
            <Row gutter={[16, 16]} style={{ marginBottom: theme.gridUnit * 4 }}>
              <Col>
                Select Municipalities:
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: '100%', minWidth: 200, marginRight: theme.gridUnit * 2 }}
                  placeholder="Select municipalities"
                  value={selectedTrendMunicipalities}
                  onChange={(value: string[]) => setSelectedTrendMunicipalities(value)}
                  options={municipalitiesOptions} 
                  disabled={!geojson}
                />
              </Col>
              <Col>
                Select Pollutants:
                <Select
                  mode="multiple"
                  allowClear
                  style={{ width: '100%', minWidth: 200 }}
                  placeholder="Select pollutants"
                  value={selectedTrendPollutants}
                  onChange={(value: string[]) => setSelectedTrendPollutants(value)}
                  options={ALL_POLLUTANTS_OPTIONS}
                />
              </Col>
            </Row>

            {trendlineLoading && <Spin tip="Loading trendline data..." />}
            {trendlineError && <Alert message={trendlineError} type="error" showIcon />}
            {!trendlineLoading && !trendlineError && trendlineData.length > 0 && (
              <div style={{ height: '500px', width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={trendlineData} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="date" 
                        tickFormatter={(tick) => moment(tick).format('DD MMM, YYYY')} 
                    />
                    <YAxis />
                    <Tooltip 
                        labelFormatter={(label) => moment(label).format('DD MMMM, YYYY')} 
                    />
                    <Legend />
                    {trendlineSeriesKeys.map((key, index) => {
                      // Cycle through a predefined list of theme colors for the lines
                      const lineColors = [
                        theme.colors.primary.base,
                        theme.colors.secondary.base,
                        theme.colors.success.base,
                        theme.colors.info.base,
                        theme.colors.error.base,
                        theme.colors.warning.base,
                        theme.colors.primary.dark1,
                        theme.colors.secondary.dark1,
                        theme.colors.success.dark1,
                        theme.colors.info.dark1,
                      ];
                      return (
                        <Line 
                          key={key} 
                          type="monotone" 
                          dataKey={key} 
                          stroke={lineColors[index % lineColors.length]} 
                          activeDot={{ r: 6 }}
                          name={key.replace(/_/g, ' - ').replace(/TLDI/g, 'Dili').replace(/TLBA/g, 'Baucau')} // Example prettify
                          strokeWidth={2}
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