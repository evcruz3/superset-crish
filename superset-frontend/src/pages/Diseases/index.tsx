import React, { useState, useEffect } from 'react';
import { styled, useTheme, SupersetClient, SupersetTheme, JsonObject } from '@superset-ui/core';
import { Spin, Alert, Select, Row, Col, DatePicker, Input } from 'antd';
import { DeckGL } from '@deck.gl/react';
import { GeoJsonLayer, GeoJsonLayerProps } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import moment from 'moment';
import withToasts from 'src/components/MessageToasts/withToasts';
import { LineEditableTabs } from 'src/components/Tabs';
import { ChartContainer, StyledTabsContainer, TabContentContainer } from '../WeatherForecasts/DashboardTabs';
import { ResponsiveChartSlug } from 'src/components/Chart/ResponsiveChartSlug';

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

interface DiseaseData {
  municipality_code: string;
  municipality: string;
  year: number;
  week_number: number;
  disease: string;
  totalCases: number;
  totalDeaths: number;
}

type DiseaseMetric = 'totalCases' | 'totalDeaths';

const INITIAL_VIEW_STATE = {
  longitude: 125.7,
  latitude: -8.8,
  zoom: 7.5,
  pitch: 0,
  bearing: 0,
};

const METRIC_LEVELS = [
    { range: [0, 0], label: '0', colorKey: 'grayscale.light2' },
    { range: [1, 10], label: '1-10', colorKey: 'success.base' },
    { range: [11, 50], label: '11-50', colorKey: 'warning.base' },
    { range: [51, 100], label: '51-100', colorKey: 'error.base' },
    { range: [101, Infinity], label: '101+', colorKey: 'error.dark1' },
];

const getMetricColor = (value: number, theme: SupersetTheme): [number, number, number, number] | string => {
  const level = METRIC_LEVELS.find(l => value >= l.range[0] && value <= l.range[1]);
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

  const hex = colorString.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return [r, g, b, 180];
};

function Diseases() {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [geojson, setGeojson] = useState<JsonObject | null>(null);
    const [mapData, setMapData] = useState<DiseaseData[]>([]);
    const [hoverInfo, setHoverInfo] = useState<any>(null);
    
    const [selectedDate, setSelectedDate] = useState(moment());
    const [selectedDisease, setSelectedDisease] = useState('Dengue');
    const [selectedMetric, setSelectedMetric] = useState<DiseaseMetric>('totalCases');
    
    useEffect(() => {
        const fetchGeojson = async () => {
            try {
              const geojsonResponse = await fetch('/static/assets/geojson/timorleste.geojson');
              if (!geojsonResponse.ok) {
                const errorText = await geojsonResponse.text();
                console.error(`Failed to load GeoJSON. Status: ${geojsonResponse.status}, Path: /assets/geojson/timorleste.geojson, Response: ${errorText}`);
                throw new Error(`Failed to load GeoJSON map data. Status: ${geojsonResponse.status}.`);
              }
              const geojsonData = await geojsonResponse.json();
              setGeojson(geojsonData);
            } catch (e: any) {
              console.error('Failed to fetch GeoJSON:', e);
              setError(e.message || 'Failed to load map data.');
            }
        };
        fetchGeojson();
    }, []);

    useEffect(() => {
        if (activeTab !== 'overview' || !selectedDisease) return;
    
        const fetchDiseaseData = async () => {
          setLoading(true);
          setError(null);
          try {
            const year = selectedDate.isoWeekYear();
            const week = selectedDate.isoWeek();
            
            let diseaseData: DiseaseData[] = [];

            if (selectedDisease === 'Diarrhea') {
                const diseasesToFetch = [
                    "Blood Diarrhea (Diarreia ho ran)",
                    "Acute Diarrhea (Diarreia aguda)"
                ];

                const promises = diseasesToFetch.map(diseaseName => {
                    const params = new URLSearchParams({
                        year: year.toString(),
                        week_number: week.toString(),
                        disease: diseaseName,
                        page_size: '-1',
                    });
                    return SupersetClient.get({
                        endpoint: `/api/v1/disease_data/?${params.toString()}`,
                    });
                });

                const responses = await Promise.all(promises);
                const results = responses.map(res => res.json.result as DiseaseData[]);
                
                const dataMap: Map<string, DiseaseData> = new Map();

                results.flat().forEach(record => {
                    const existing = dataMap.get(record.municipality_code);
                    if (existing) {
                        existing.totalCases += record.totalCases;
                        existing.totalDeaths += record.totalDeaths;
                    } else {
                        dataMap.set(record.municipality_code, { ...record, disease: 'Diarrhea' });
                    }
                });

                diseaseData = Array.from(dataMap.values());

            } else {
                let diseaseQueryParam = '';
                if (selectedDisease === 'Dengue') {
                    diseaseQueryParam = 'Dengue *';
                } else if (selectedDisease === 'ARI') {
                    diseaseQueryParam = 'ISPA/ARI (Acute Respiratory Infection)';
                }

                if (diseaseQueryParam) {
                    const params = new URLSearchParams({
                        year: year.toString(),
                        week_number: week.toString(),
                        disease: diseaseQueryParam,
                        page_size: '-1',
                    });
        
                    const response = await SupersetClient.get({
                        endpoint: `/api/v1/disease_data/?${params.toString()}`,
                    });
                    diseaseData = response.json.result;
                }
            }

            setMapData(diseaseData);
          } catch (e) {
            console.error('Failed to fetch disease data:', e);
            setError('Failed to load disease data.');
            setMapData([]);
          }
          setLoading(false);
        };
        fetchDiseaseData();
    }, [activeTab, selectedDate, selectedDisease]);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
    };

    const onHover = (info: any) => {
        setHoverInfo(info);
    };

    const handleDateChange = (date: moment.Moment | null) => {
        if (date) {
          setSelectedDate(date);
        }
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
            const record = mapData.find(f => f.municipality_code === municipalityCode);
            const value = record ? record[selectedMetric] : 0;
            return getMetricColor(value, theme) as [number,number,number,number];
        },
        getLineColor: [0,0,0,200],
        onHover: onHover,
        updateTriggers: {
            getFillColor: [mapData, selectedMetric]
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
        const metricName = selectedMetric === 'totalCases' ? 'Cases' : 'Deaths';
        return (
            <LegendContainer>
            <h4>{metricName} Legend</h4>
            {METRIC_LEVELS.map(level => (
                <div key={level.label}>
                <span style={{ backgroundColor: getMetricColor(level.range[0], theme) as string }} />
                {level.label}
                </div>
            ))}
            </LegendContainer>
        );
    };

    return (
        <StyledTabsContainer theme={theme}>
            <LineEditableTabs
                activeKey={activeTab}
                onChange={handleTabChange}
                type="card"
            >
                <LineEditableTabs.TabPane
                    tab="Overview"
                    key="overview"
                >
                    <TabContentContainer theme={theme}>
                        <ChartContainer>
                            <ResponsiveChartSlug 
                                slug="weekly_cases_by_municipality" 
                                fillHeight={true}
                                onError={(error) => console.error('Chart error:', error)}
                            />
                        </ChartContainer>
                        {/* {loading && <Spin tip="Loading map and data..." />}
                        {error && <Alert message={error} type="error" showIcon />}
                        {!loading && !error && geojson && (
                            <>
                                <Row gutter={[16,16]} style={{marginBottom: theme.gridUnit * 2, paddingLeft: theme.gridUnit *2, paddingRight: theme.gridUnit*2, alignItems: 'center'}}>
                                    <Col>Select Date:</Col>
                                    <Col>
                                        <DatePicker 
                                            onChange={handleDateChange} 
                                            value={selectedDate}
                                            picker="week"
                                            allowClear={false} 
                                        />
                                    </Col>
                                    <Col>Disease:</Col>
                                    <Col>
                                        <Select
                                            style={{ width: 200 }}
                                            value={selectedDisease}
                                            onChange={(value) => setSelectedDisease(value)}
                                        >
                                            <Option value="Dengue">Dengue</Option>
                                            <Option value="Diarrhea">Diarrhea</Option>
                                            <Option value="ARI">ARI</Option>
                                        </Select>
                                    </Col>
                                    <Col>Metric:</Col>
                                    <Col>
                                        <Select
                                            value={selectedMetric}
                                            onChange={(value) => setSelectedMetric(value as DiseaseMetric)}
                                            style={{ width: 150 }}
                                        >
                                            <Option value="totalCases">Total Cases</Option>
                                            <Option value="totalDeaths">Total Deaths</Option>
                                        </Select>
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
                                            {selectedMetric === 'totalCases' ? 'Cases' : 'Deaths'}: {mapData.find(f => f.municipality_code === hoverInfo.object.properties.ISO)?.[selectedMetric] ?? 'N/A'}<br />
                                        </div>
                                        )}
                                    </DeckGL>
                                    {renderMapLegend()}
                                </MapContainer>
                            </>
                        )} */}
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab="Death Cases"
                    key="death_cases"
                >
                    <TabContentContainer>
                        <ChartContainer>
                            <ResponsiveChartSlug 
                                slug="weekly-disease-deaths-by-municipality" 
                                fillHeight={true}
                                onError={(error) => console.error('Chart error:', error)}
                            />
                        </ChartContainer>
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab="Trendlines"
                    key="trendlines"
                >
                    <TabContentContainer>
                        {/* Content for Trendlines */}
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
            </LineEditableTabs>
        </StyledTabsContainer>
    );
}

export default withToasts(Diseases); 