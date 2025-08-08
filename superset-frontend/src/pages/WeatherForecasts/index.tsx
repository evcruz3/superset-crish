import React, { useState, useCallback, useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
import { LineEditableTabs } from 'src/components/Tabs';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import { ChartContainer, StyledTabsContainer, TabContentContainer } from './DashboardTabs';
import Trendlines from './Trendlines';
import { SupersetClient } from '@superset-ui/core';

const DataSourceAttribution = styled.div`
  position: fixed;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.8);
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #666;
  z-index: 900;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
`;

const DataUpdateInfo = styled.span`
  margin-top: 3px;
  font-size: 11px;
  color: #888;
`;

// Type for Weather Data Pull History
interface PullHistoryType {
  id: number;
  pulled_at: string;
  parameters_pulled: string;
  pull_status: string;
  details?: string;
}

function WeatherForecasts() {
    const [activeTab, setActiveTab] = useState('1');
    const [lastPullInfo, setLastPullInfo] = useState<PullHistoryType | null>(null);
    const [lastPullLoading, setLastPullLoading] = useState(false);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
    };

    // Fetch last weather data pull information
    const fetchLastPull = useCallback(async () => {
        setLastPullLoading(true);
        try {
            console.log("[Weather Data Pull] Fetching last successful pull info");
            const response = await SupersetClient.get({
                endpoint: '/api/v1/weather_data_pull/last_pull',
                headers: { Accept: 'application/json' },
            });
            
            console.log("[Weather Data Pull] Response:", response.json);
            
            if (response.json?.result) {
                setLastPullInfo(response.json.result);
                console.log("[Weather Data Pull] Last successful pull:", response.json.result.pulled_at);
            } else {
                console.log("[Weather Data Pull] No successful pull info available");
                setLastPullInfo(null);
            }
        } catch (error) {
            // Handle 404 errors gracefully (no successful pulls yet)
            if (error.status === 404) {
                console.log("[Weather Data Pull] No successful pull history found");
            } else {
                console.error('Error fetching last pull info:', error);
            }
            setLastPullInfo(null);
        } finally {
            setLastPullLoading(false);
        }
    }, []);

    // Format date for display
    const formatDisplayDate = useCallback((dateString: string) => {
        try {
            const date = new Date(dateString);
            // Format: "May 15, 2023 at 10:30 AM"
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

    // Fetch data on component mount
    useEffect(() => {
        fetchLastPull();
    }, [fetchLastPull]);

    return (
        <StyledTabsContainer>
            <LineEditableTabs
                activeKey={activeTab}
                onChange={handleTabChange}
                type="card"
            >
                <LineEditableTabs.TabPane
                    tab={t("Forecasts")}
                    key="1"
                >
                    <TabContentContainer>
                        <ChartContainer>
                            <ResponsiveChartSlug 
                                slug="10_day_weather_forecast" 
                                fillHeight={true}
                                onError={(error) => console.error('Chart error:', error)}
                            />
                        </ChartContainer>
                        
                        {/* Data source attribution */}
                        <DataSourceAttribution>
                            <span>{t('Weather data provided by ECMWF')}</span>
                            {lastPullLoading ? (
                                <DataUpdateInfo>Loading last weather update time...</DataUpdateInfo>
                            ) : lastPullInfo ? (
                                <DataUpdateInfo>
                                    {t('Last successful weather update:')} {formatDisplayDate(lastPullInfo.pulled_at)}
                                </DataUpdateInfo>
                            ) : (
                                <DataUpdateInfo>{t('Weather update history unavailable')}</DataUpdateInfo>
                            )}
                        </DataSourceAttribution>
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab={t("Alerts")}
                    key="2"
                >
                    <TabContentContainer>
                        <ChartContainer>
                            <ResponsiveChartSlug 
                                slug="weather_forecast_alerts" 
                                fillHeight={true}
                                onError={(error) => console.error('Chart error:', error)}
                            />
                        </ChartContainer>
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab={t("Trendlines")}
                    key="3"
                >
                    <TabContentContainer>
                        <Trendlines />
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab={t("Table")}
                    key="4"
                >
                    <TabContentContainer>
                        {/* Alot horizontal padding */}
                        <ChartContainer style={{ paddingLeft: 16, paddingRight: 16 }}>
                            <ResponsiveChartSlug 
                                slug="weather_forecast_table" 
                                fillHeight={true}
                                onError={(error) => console.error('Chart error:', error)}
                            />
                        </ChartContainer>
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
            </LineEditableTabs>
        </StyledTabsContainer>
    );
}

export default WeatherForecasts;