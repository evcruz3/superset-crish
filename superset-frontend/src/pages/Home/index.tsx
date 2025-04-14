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
import React, { useState, useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import DashboardTabs from '../WeatherForecasts/DashboardTabs';
import Modal from 'src/components/Modal';

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

interface WelcomeProps {
  user: {
    userId: number;
  };
  addDangerToast: (message: string) => void;
  chartSlug?: string;
}

function Welcome({ user, addDangerToast, chartSlug = 'overview-map' }: WelcomeProps) {
  const [showFullChart, setShowFullChart] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');

  const handleError = useCallback((error: Error) => {
    addDangerToast(t('Failed to load chart: %s', error.message));
  }, [addDangerToast]);

  const toggleView = useCallback(() => {
    setShowFullChart(prev => !prev);
  }, []);

  const handleAlertClick = useCallback((title: string) => {
    setModalTitle(title);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  // Weather alert data
  const weatherAlerts = [
    {
      type: 'rain',
      title: 'Heavy Rain Alert',
      details: [
        { label: 'Extreme', count: 0 },
        { label: 'Heavy', count: 5 },
      ],
      color: '#3a5998',
    },
    {
      type: 'wind',
      title: 'Strong Wind Alert',
      details: [
        { label: 'Extreme', count: 0 },
        { label: 'Heavy', count: 0 },
      ],
      color: '#4c9c6d',
    },
    {
      type: 'heat',
      title: 'Heat Alert',
      details: [
        { label: 'Very Hot', count: 4 },
        { label: 'Hot', count: 0 },
      ],
      color: '#a67533',
    },
  ];

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
      
      <AlertsContainer>
        {weatherAlerts.map((alert) => (
          <AlertCard key={alert.type} onClick={() => handleAlertClick(alert.title)}>
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
        ))}
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
          <button key="close" onClick={closeModal}>
            Close
          </button>
        ]}
      >
        <p>Alert details will be displayed here.</p>
      </Modal>
    </ChartContainer>
  );
}

export default withToasts(Welcome);
