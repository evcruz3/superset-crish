import React, { useState } from 'react';
import { styled, useTheme } from '@superset-ui/core';
import { LineEditableTabs } from 'src/components/Tabs';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import DashboardTabs, { ChartContainer, StyledTabsContainer, TabContentContainer } from './DashboardTabs';


function WeatherForecasts() {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState('1');

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
    };

    return (
        <StyledTabsContainer>
            <LineEditableTabs
                activeKey={activeTab}
                onChange={handleTabChange}
                type="card"
            >
                <LineEditableTabs.TabPane
                    tab="Forecasts"
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
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab="Alerts"
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
                    tab="Trendlines"
                    key="3"
                >
                    <TabContentContainer>
                        <DashboardTabs idOrSlug="weather_forecast" selectedTabIndex={0} />
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab="Table"
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