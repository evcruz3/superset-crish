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
import React, { useState, useCallback, useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import DashboardTabs from '../WeatherForecasts/DashboardTabs';
import Modal from 'src/components/Modal';
import { SupersetClient } from '@superset-ui/core';

const FloatingToggle = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: white;
  padding: 10px 20px;
  border-radius: 20px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  cursor: pointer;
  z-index: 1000;
  &:hover {
    background: #f0f0f0;
  }
`;

const ChartContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
`;

const AlertsContainer = styled.div`
  position: absolute;
  top: 120px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 350px;
`;

const AlertCard = styled.div`
  display: flex;
  align-items: center;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-2px);
  }
`;

const IconContainer = styled.div<{ bgColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${({ bgColor }) => bgColor};
  color: white;
  width: 80px;
  height: 80px;
  padding: 20px;
`;

const AlertContent = styled.div`
  padding: 10px 15px;
  flex: 1;
`;

const AlertTitle = styled.h3`
  margin: 0 0 5px 0;
  font-size: 16px;
  font-weight: 500;
`;

const AlertDetail = styled.div`
  font-size: 14px;
  margin: 3px 0;
`;

interface AlertType {
  id: string;
  weather_parameter: string;
  alert_level: string;
  alert_title: string;
  alert_message: string;
  municipality_name: string;
  parameter_value: number;
  forecast_date: string;
  municipality_code: string;
}

interface GroupedAlertType {
  type: string;
  title: string;
  details: { label: string; count: number }[];
  color: string;
  alertData: AlertType[];
}

interface WelcomeProps {
  user: {
    userId: number;
  };
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  chartSlug?: string;
}

function Welcome({ user, addDangerToast, addSuccessToast, chartSlug = 'overview-map' }: WelcomeProps) {
  const [showFullChart, setShowFullChart] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [weatherAlerts, setWeatherAlerts] = useState<GroupedAlertType[]>([]);

  // Fetch alerts from the API
  const fetchAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log("[Weather Forecast Alerts] fetching alerts");
      const response = await SupersetClient.get({
        endpoint: `/api/v1/weather_forecast_alert/?q=${encodeURIComponent(JSON.stringify({
          page_size: 100, // Get more results per page
          page: 0,
          order_column: 'forecast_date',
          order_direction: 'desc'
        }))}`,
        headers: { Accept: 'application/json' },
      });
      
      console.log("[Weather Forecast Alerts] response.json", response.json);
      
      if (response.json?.result) {
        // Count alerts by type before processing
        const counts: Record<string, number> = {};
        response.json.result.forEach((alert: AlertType) => {
          counts[alert.weather_parameter] = (counts[alert.weather_parameter] || 0) + 1;
        });
        console.log("[Weather Forecast Alerts] Counts by parameter:", counts);
        
        // Process and group alerts by weather parameter
        processAlerts(response.json.result);
        addSuccessToast(t('Weather alerts loaded successfully'));
      } else {
        // Handle case where result is empty or undefined
        setWeatherAlerts([]);
        addDangerToast(t('No weather alerts returned from API'));
      }
    } catch (error) {
      console.error('Error fetching weather alerts:', error);
      addDangerToast(t('Failed to load weather alerts: %s', error.message || String(error)));
      // Set empty alerts with a fallback UI state
      setWeatherAlerts([{
        type: 'error',
        title: 'API Error',
        color: '#dc3545',
        details: [{ label: 'Status', count: 0 }],
        alertData: [{
          id: '0_0_Error',
          weather_parameter: 'Error',
          alert_level: 'Error',
          alert_title: 'Could not load alerts',
          alert_message: 'There was an error connecting to the alerts API. Please try again later.',
          municipality_name: '-',
          parameter_value: 0,
          forecast_date: new Date().toISOString(),
          municipality_code: '0'
        }]
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [addDangerToast, addSuccessToast]);

  // Process alerts and group them by type
  const processAlerts = useCallback((alerts: AlertType[]) => {
    // Log all the unique weather parameters for debugging
    const uniqueParameters = [...new Set(alerts.map(a => a.weather_parameter))];
    console.log("[Weather Forecast Alerts] Unique weather parameters:", uniqueParameters);
    
    // Group alerts by weather parameter
    const groupedByParameter: Record<string, AlertType[]> = {};
    
    alerts.forEach(alert => {
      // Make sure id exists, or create it from composite fields
      if (!alert.id && alert.municipality_code && alert.forecast_date && alert.weather_parameter) {
        alert.id = `${alert.municipality_code}_${alert.forecast_date}_${alert.weather_parameter}`;
      }
      
      // Log each alert for debugging
      console.log(`[Debug Alert] ${alert.weather_parameter} - ${alert.alert_level} - ${alert.municipality_name}`);
      
      if (!groupedByParameter[alert.weather_parameter]) {
        groupedByParameter[alert.weather_parameter] = [];
      }
      groupedByParameter[alert.weather_parameter].push(alert);
    });
    
    // Map to the format expected by the UI
    const alertGroups: GroupedAlertType[] = [];
    
    // Map weather parameters to types and colors - expanded to include more variations
    const parameterMapping: Record<string, { type: string; color: string; title: string }> = {
      'Rainfall': { type: 'rain', color: '#3a5998', title: 'Rainfall Alert' },
      'Wind Speed': { type: 'wind', color: '#4c9c6d', title: 'Wind Alert' },
      'Heat Index': { type: 'heat', color: '#a67533', title: 'Heat Alert' }
    };
    
    // Create alert groups for all parameters, don't skip any
    Object.entries(groupedByParameter).forEach(([parameter, alerts]) => {
      // Get mapping or create a default one if parameter is unknown
      const mapping = parameterMapping[parameter] || { 
        type: parameter.toLowerCase().replace(/\s+/g, '_'), 
        color: '#888888',
        title: `${parameter} Alert`
      };
      
      // Count alerts by all possible severity levels
      const extremeDanger = alerts.filter(a => 
        a.alert_level === 'Extreme Danger' || 
        a.alert_level === 'Severe'
      ).length;
      
      const danger = alerts.filter(a => 
        a.alert_level === 'Danger' || 
        a.alert_level === 'Heavy' ||
        a.alert_level === 'Strong'
      ).length;
      
      const extremeCaution = alerts.filter(a => 
        a.alert_level === 'Extreme Caution' || 
        a.alert_level === 'Moderate' ||
        a.alert_level === 'Caution'
      ).length;
      
      const light = alerts.filter(a => 
        a.alert_level === 'Light' || 
        a.alert_level === 'Normal'
      ).length;
      
      console.log(`[Weather Forecast Alerts] Counts for ${parameter}: 
        Extreme=${extremeDanger}, Danger=${danger}, Caution=${extremeCaution}, Light=${light}`);
      
      // Create group with all information
      alertGroups.push({
        type: mapping.type,
        title: mapping.title,
        color: mapping.color,
        details: [
          { label: 'Extreme Danger', count: extremeDanger },
          { label: 'Danger', count: danger },
          { label: 'Extreme Caution', count: extremeCaution },
          { label: 'Normal', count: light }
        ].filter(d => d.count > 0), // Only include non-zero counts
        alertData: alerts
      });
    });
    
    console.log("[Weather Forecast Alerts] Final alert groups:", alertGroups);
    
    setWeatherAlerts(alertGroups);
  }, []);

  // Fetch alerts on component mount
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleError = useCallback((error: Error) => {
    addDangerToast(t('Failed to load chart: %s', error.message));
  }, [addDangerToast]);

  const toggleView = useCallback(() => {
    setShowFullChart(prev => !prev);
  }, []);

  const handleAlertClick = useCallback((alertGroup: GroupedAlertType) => {
    setModalTitle(alertGroup.title);
    
    // Generate detailed content for the modal
    const content = (
      <div>
        {(() => {
          // Group alerts by date
          const alertsByDate: Record<string, AlertType[]> = {};
          
          alertGroup.alertData.forEach(alert => {
            // Format date for grouping (15 Apr 2025)
            let dateKey = alert.forecast_date;
            try {
              const date = new Date(alert.forecast_date);
              const day = date.getDate();
              const month = date.toLocaleString('en-US', { month: 'short' });
              const year = date.getFullYear();
              dateKey = `${day} ${month} ${year}`;
            } catch (e) {
              console.warn('Could not format date for grouping:', alert.forecast_date);
            }
            
            if (!alertsByDate[dateKey]) {
              alertsByDate[dateKey] = [];
            }
            alertsByDate[dateKey].push(alert);
          });
          
          // Sort dates (oldest first)
          const sortedDates = Object.keys(alertsByDate).sort((a, b) => {
            try {
              return new Date(a).getTime() - new Date(b).getTime();
            } catch (e) {
              return 0;
            }
          });
          
          return sortedDates.map(dateKey => {
            // Sort alerts by municipality name (alphabetically)
            const sortedAlerts = [...alertsByDate[dateKey]].sort((a, b) => 
              a.municipality_name.localeCompare(b.municipality_name)
            );
            
            return (
              <div key={dateKey} style={{ marginBottom: '30px' }}>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 600, 
                  marginBottom: '15px', 
                  padding: '10px',
                  borderBottom: '2px solid #f0f0f0'
                }}>
                  {dateKey}
                </div>
                
                {sortedAlerts.map(alert => {
                  // Format date in consistent format
                  let formattedDate = dateKey;
                  
                  // Determine status color based on alert level
                  let statusColor = '#888888';
                  if (alert.alert_level.includes('Extreme Danger') || alert.alert_level === 'Severe') {
                    statusColor = '#F44336'; // Red for extreme/severe
                  } else if (alert.alert_level === 'Danger' || alert.alert_level === 'Heavy' || alert.alert_level === 'Strong') {
                    statusColor = '#FF9800'; // Orange for danger
                  } else if (alert.alert_level.includes('Extreme Caution') || alert.alert_level === 'Moderate' || alert.alert_level === 'Caution') {
                    statusColor = '#FFEB3B'; // Yellow for caution
                  } else if (alert.alert_level === 'Light' || alert.alert_level === 'Normal') {
                    statusColor = '#4CAF50'; // Green for light/normal
                  }
                  
                  return (
                    <div 
                      key={alert.id} 
                      style={{ 
                        marginBottom: '20px', 
                        borderRadius: '8px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ 
                        padding: '12px 20px', 
                        borderBottom: '1px solid #f0f0f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#fafafa'
                      }}>
                        <div style={{ fontSize: '18px', fontWeight: 500 }}>{alert.municipality_name}</div>
                        <div style={{
                          background: statusColor,
                          color: 'white',
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '14px',
                          fontWeight: 500
                        }}>
                          {alert.alert_level}
                        </div>
                      </div>
                      
                      <div style={{ padding: '15px 20px' }}>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(2, 1fr)', 
                          gap: '10px',
                          marginBottom: '15px'
                        }}>
                          <div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Parameter</div>
                            <div style={{ fontSize: '15px' }}>{alert.weather_parameter}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Value</div>
                            <div style={{ fontSize: '15px' }}>
                              {typeof alert.parameter_value === 'number' 
                                ? (Number.isInteger(alert.parameter_value) 
                                  ? alert.parameter_value 
                                  : alert.parameter_value.toFixed(2)) 
                                : alert.parameter_value}
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ marginTop: '15px' }}>
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Advisory Message</div>
                          <div style={{ 
                            fontSize: '15px', 
                            padding: '10px', 
                            background: '#f9f9f9', 
                            borderRadius: '6px',
                            lineHeight: '1.5'
                          }}>
                            {alert.alert_message}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          });
        })()}
      </div>
    );
    
    setModalContent(content);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Weather icons
  const getIcon = (type: string) => {
    switch (type) {
      case 'rain':
        return '☔';
      case 'wind':
        return '💨';
      case 'heat':
        return '🌡️';
      default:
        return '⚠️';
    }
  };

  return (
    <ChartContainer>
      <FloatingToggle onClick={toggleView}>
        {showFullChart ? 'Show Alerts' : 'Show Map'}
      </FloatingToggle>
      
      <AlertsContainer style={{ display: showFullChart ? 'flex' : 'none' }}>
        {isLoading ? (
          <AlertCard>
            <AlertContent>
              <AlertTitle>Loading alerts...</AlertTitle>
            </AlertContent>
          </AlertCard>
        ) : weatherAlerts.length === 0 ? (
          <AlertCard>
            <AlertContent>
              <AlertTitle>No active alerts</AlertTitle>
            </AlertContent>
          </AlertCard>
        ) : (
          weatherAlerts.map((alert) => (
            <AlertCard key={alert.type} onClick={() => handleAlertClick(alert)}>
              <IconContainer bgColor={alert.color}>
                <span style={{ fontSize: '24px' }}>{getIcon(alert.type)}</span>
              </IconContainer>
              <AlertContent>
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.details.map((detail) => (
                  <AlertDetail key={detail.label}>
                    {detail.label}: {detail.count} Locations
                  </AlertDetail>
                ))}
              </AlertContent>
            </AlertCard>
          ))
        )}
      </AlertsContainer>
      
      <div style={{ 
        flex: 1,
        display: showFullChart ? 'block' : 'none',
        overflow: 'hidden'
      }}>
        <ResponsiveChartSlug
          slug={chartSlug}
          fillHeight
          onError={handleError}
        />
      </div>
      
      <div style={{ 
        flex: 1,
        display: showFullChart ? 'none' : 'block',
        overflow: 'hidden'
      }}>
        <DashboardTabs idOrSlug="overview" />
      </div>

      <Modal
        title={modalTitle}
        show={showModal}
        onHide={closeModal}
        footer={[
          <button key="refresh" onClick={fetchAlerts} style={{ marginRight: '10px' }}>
            Refresh Alerts
          </button>,
          <button key="close" onClick={closeModal}>
            Close
          </button>
        ]}
      >
        {modalContent}
      </Modal>
    </ChartContainer>
  );
}

export default withToasts(Welcome);
