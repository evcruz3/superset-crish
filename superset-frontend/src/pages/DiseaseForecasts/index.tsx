/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useState } from 'react';
import DashboardTabs, { ChartContainer, TabContentContainer, StyledTabsContainer } from '../WeatherForecasts/DashboardTabs';
import { LineEditableTabs } from 'src/components/Tabs';
import { t, useTheme } from '@superset-ui/core';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
export default function DiseaseForecasts() {

  // return <DashboardTabs idOrSlug="disease_forecasts" selectedTabIndex={0} />;

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
                    tab={t("Forecasts")}
                    key="1"
                >
                    <TabContentContainer>
                        <ChartContainer>
                            <ResponsiveChartSlug 
                                slug="multi-disease-forecast" 
                                fillHeight={true}
                                onError={(error) => console.error('Chart error:', error)}
                            />
                        </ChartContainer>
                    </TabContentContainer>
                </LineEditableTabs.TabPane>
                <LineEditableTabs.TabPane
                    tab={t("Alerts")}
                    key="2"
                >
                    <TabContentContainer>
                        <ChartContainer>
                            <ResponsiveChartSlug 
                                slug="disease_forecast_alerts" 
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
                        <DashboardTabs idOrSlug="disease_forecasts" selectedTabIndex={0} />
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
                                slug="disease_forecast_table" 
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