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
import { styled, t, tn } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import DashboardTabs from '../WeatherForecasts/DashboardTabs';
import Modal from 'src/components/Modal';
import { SupersetClient } from '@superset-ui/core';

// Import the SVG as a React Component
import StomachIcon from 'src/assets/images/icons/stomach.svg';
import MosquitoIcon from 'src/assets/images/icons/mosquito.svg'; // Import mosquito SVG

export const ChartContainer = styled.div`
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

// SVG Animation Components
const SvgContainer = styled.div`
  width: 40px; // Adjust size as needed
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }
`;

const RainAnimation = () => (
  <SvgContainer>
    <svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="rainGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8EB8E5" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="dropGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#BEE8FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#89C5FB" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E6F4FF" />
        </linearGradient>
        <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" />
          <feOffset dx="0.5" dy="0.5" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="rainBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.6" />
        </filter>
        <filter id="splashBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.3" />
        </filter>
        <radialGradient id="puddleGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#C1E3FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#A5D8FF" stopOpacity="0.1" />
        </radialGradient>
      </defs>
      
      {/* Fluffy cloud with multiple layers */}
      <g className="cloud-group">
        {/* Background cloud shadow */}
        <ellipse
          cx="20"
          cy="18"
          rx="18"
          ry="3"
          fill="#E6F4FF"
          opacity="0.3"
          filter="url(#cloudShadow)"
        />
        
        {/* Cloud base layer */}
        <path 
          d="M7,16 
             Q5,14 8,12
             Q10,9 14,10
             Q16,8 20,9
             Q24,6 28,8
             Q32,6 34,10
             Q38,10 36,14
             Q39,16 36,17
             Q34,19 30,17.5
             Q27,19 22,18
             Q18,19 14,17.5
             Q10,19 7,16
             Z" 
          fill="url(#cloudGradient)" 
          opacity="0.9"
          filter="url(#cloudShadow)"
        >
          <animate
            attributeName="opacity"
            values="0.9;0.95;0.9"
            dur="5s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* Cloud details - fluffy parts with independent animations */}
        <g>
          {/* Top left fluffy bump */}
          <ellipse
            cx="12"
            cy="10"
            rx="4"
            ry="3.2"
            fill="#FFFFFF"
            opacity="0.8"
          >
            <animate
              attributeName="ry"
              values="3.2;3.4;3.2"
              dur="4s"
              begin="0.2s"
              repeatCount="indefinite"
            />
          </ellipse>
          
          {/* Top middle fluffy bump */}
          <ellipse
            cx="20"
            cy="9"
            rx="4.5"
            ry="3"
            fill="#FFFFFF"
            opacity="0.85"
          >
            <animate
              attributeName="ry"
              values="3;3.3;3"
              dur="3.7s"
              begin="0.5s"
              repeatCount="indefinite"
            />
          </ellipse>
          
          {/* Top right fluffy bump */}
          <ellipse
            cx="28"
            cy="10"
            rx="4"
            ry="3.2"
            fill="#FFFFFF"
            opacity="0.8"
          >
            <animate
              attributeName="ry"
              values="3.2;3.5;3.2"
              dur="4.3s"
              begin="0.7s"
              repeatCount="indefinite"
            />
          </ellipse>
          
          {/* Right side fluffy bump */}
          <ellipse
            cx="34"
            cy="14"
            rx="3.5"
            ry="3"
            fill="#FFFFFF"
            opacity="0.75"
          >
            <animate
              attributeName="rx"
              values="3.5;3.7;3.5"
              dur="3.5s"
              begin="1s"
              repeatCount="indefinite"
            />
          </ellipse>
          
          {/* Bottom right fluffy bump */}
          <circle
            cx="30"
            cy="17"
            r="3"
            fill="#FFFFFF"
            opacity="0.7"
          >
            <animate
              attributeName="r"
              values="3;3.2;3"
              dur="4s"
              begin="0.3s"
              repeatCount="indefinite"
            />
          </circle>
          
          {/* Bottom middle fluffy bump */}
          <circle
            cx="20"
            cy="17.5"
            r="3.5"
            fill="#FFFFFF"
            opacity="0.8"
          >
            <animate
              attributeName="r"
              values="3.5;3.7;3.5"
              dur="4.5s"
              begin="0.8s"
              repeatCount="indefinite"
            />
          </circle>
          
          {/* Bottom left fluffy bump */}
          <circle
            cx="11"
            cy="17"
            r="3"
            fill="#FFFFFF"
            opacity="0.7"
          >
            <animate
              attributeName="r"
              values="3;3.2;3"
              dur="3.8s"
              begin="1.2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
        
        {/* Cloud highlights for dimension */}
        <path
          d="M12,10 Q17,8 22,9 Q27,7 31,9 Q34,10 35,13"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        >
          <animate
            attributeName="opacity"
            values="0.6;0.8;0.6"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      </g>
      
      {/* Puddle at the bottom */}
      <ellipse
        cx="20"
        cy="36"
        rx="15"
        ry="2"
        fill="url(#puddleGradient)"
        opacity="0.7"
      >
        <animate
          attributeName="rx"
          values="13;15;13"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0.8;0.6"
          dur="2s"
          repeatCount="indefinite"
        />
      </ellipse>
      
      {/* Enhanced raindrops with more variation and better physics */}
      {[...Array(10)].map((_, i) => {
        const xPos = 8 + (i % 5) * 6;
        const yStart = 18 + (i % 3);
        const delay = (i % 5) * 0.2;
        const duration = 0.9 + Math.random() * 0.4;
        const size = 0.9 + Math.random() * 0.3;
        
        return (
          <g key={`drop-${i}`}>
            {/* Main raindrop with teardrop shape */}
            <path
              d={`M${xPos},${yStart} q0.8,1 0,2.5 t-0.8,-1 z`}
              fill="url(#dropGradient)"
              opacity="0.9"
              filter="url(#rainBlur)"
              transform={`scale(${size})`}
            >
              <animate
                attributeName="transform"
                values={`scale(${size}) translate(0,0); scale(${size * 0.95}) translate(0,${15/size})`}
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.9;0.7;0"
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="d"
                values={`M${xPos},${yStart} q0.8,1 0,2.5 t-0.8,-1 z;
                         M${xPos},${yStart} q0.7,1.2 0,2.3 t-0.7,-0.8 z;
                         M${xPos},${yStart} q0.8,1 0,2.5 t-0.8,-1 z`}
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
            </path>
            
            {/* Splash effect when drop hits the puddle */}
            <g opacity="0" transform={`translate(${xPos}, 34)`}>
              <animate
                attributeName="opacity"
                values="0;0.8;0"
                dur={`${duration}s`}
                begin={`${delay + duration * 0.7}s`}
                repeatCount="indefinite"
              />
              
              {/* Left splash particle */}
              <circle cx="-1.5" cy="0.2" r="0.3" fill="#BEE8FF" filter="url(#splashBlur)">
                <animate
                  attributeName="cx"
                  values="-0.2;-1.5"
                  dur={`${duration * 0.3}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cy"
                  values="0;0.2"
                  dur={`${duration * 0.3}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
              </circle>
              
              {/* Right splash particle */}
              <circle cx="1.5" cy="0.2" r="0.3" fill="#BEE8FF" filter="url(#splashBlur)">
                <animate
                  attributeName="cx"
                  values="0.2;1.5"
                  dur={`${duration * 0.3}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="cy"
                  values="0;0.2"
                  dur={`${duration * 0.3}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
              </circle>
              
              {/* Center splash particles */}
              <circle cx="0" cy="-0.5" r="0.4" fill="#BEE8FF" filter="url(#splashBlur)">
                <animate
                  attributeName="cy"
                  values="0;-0.5"
                  dur={`${duration * 0.3}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="r"
                  values="0.2;0.4;0.1"
                  dur={`${duration * 0.3}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
              </circle>
              
              {/* Ripple effect */}
              <circle cx="0" cy="0" r="0.8" fill="none" stroke="#BEE8FF" strokeWidth="0.2" opacity="0.5">
                <animate
                  attributeName="r"
                  values="0.2;2"
                  dur={`${duration * 0.4}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.7;0"
                  dur={`${duration * 0.4}s`}
                  begin={`${delay + duration * 0.7}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </g>
        );
      })}
      
      {/* Light rain particles in the background for depth */}
      {[...Array(15)].map((_, i) => {
        const xPos = 2 + Math.random() * 36;
        const yStart = 10 + Math.random() * 10;
        const delay = Math.random() * 1.5;
        const duration = 0.7 + Math.random() * 0.5;
        
        return (
          <line
            key={`light-drop-${i}`}
            x1={xPos}
            y1={yStart}
            x2={xPos}
            y2={yStart + 2}
            stroke="#BEE8FF"
            strokeWidth="0.3"
            opacity="0.4"
          >
            <animate
              attributeName="transform"
              values={`translate(0,0); translate(0,${20})`}
              dur={`${duration}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.4;0;0"
              dur={`${duration}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </line>
        );
      })}
    </svg>
  </SvgContainer>
);

const WindAnimation = () => (
  <SvgContainer>
    <svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="windGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.1" />
        </linearGradient>
        <filter id="windGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
        </filter>
      </defs>
      
      {/* Leaf that moves with the wind */}
      <path
        d="M15,15 q2,-3 4,-2 q3,1 2,4 q-1,3 -4,2 q-3,-1 -2,-4 z"
        fill="#8DD396"
        opacity="0.9"
      >
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 20,5; 0,0"
          dur="3s"
          repeatCount="indefinite"
        />
        <animateTransform
          attributeName="transform"
          type="rotate"
          values="0 15 15; 45 15 15; 0 15 15"
          dur="3s"
          additive="sum"
          repeatCount="indefinite"
        />
      </path>
      
      {/* Multiple curved wind paths with different animations */}
      {[...Array(3)].map((_, i) => {
        const yPos = 14 + i * 7;
        const delay = i * 0.2;
        
        return (
          <g key={i}>
            <path
              d={`M0,${yPos} C10,${yPos-3} 20,${yPos+3} 40,${yPos}`}
              stroke="url(#windGradient)"
              strokeWidth={2 - i * 0.3}
              fill="none"
              strokeLinecap="round"
              opacity={0.8 - i * 0.1}
              filter="url(#windGlow)"
            >
              <animate
                attributeName="stroke-dasharray"
                values="0,40; 40,0"
                dur={`${1.5 + i * 0.3}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-dashoffset"
                values="40;0"
                dur={`${1.5 + i * 0.3}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values={`${0.8 - i * 0.1};${0.3 - i * 0.05};${0.8 - i * 0.1}`}
                dur={`${1.5 + i * 0.3}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        );
      })}
      
      {/* Small particles being blown by the wind */}
      {[...Array(5)].map((_, i) => {
        const yPos = 12 + i * 4;
        const delay = i * 0.3;
        
        return (
          <circle
            key={`particle-${i}`}
            cx="5"
            cy={yPos}
            r={0.5 + Math.random() * 0.5}
            fill="#ffffff"
            opacity="0.7"
          >
            <animate
              attributeName="cx"
              values="5;40"
              dur={`${1 + Math.random() * 0.5}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              values={`${yPos};${yPos + (Math.random() * 10 - 5)}`}
              dur={`${1 + Math.random() * 0.5}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur={`${1 + Math.random() * 0.5}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        );
      })}
    </svg>
  </SvgContainer>
);

const HeatAnimation = () => (
  <SvgContainer>
    <svg viewBox="0 0 40 40" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id="sunGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="#FFEB3B" />
          <stop offset="70%" stopColor="#FF9800" />
          <stop offset="100%" stopColor="#FF5722" />
        </radialGradient>
        <filter id="heatBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
        <filter id="heatGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Sun with pulsating effect */}
      <circle
        cx="20"
        cy="17"
        r="8"
        fill="url(#sunGradient)"
        filter="url(#heatGlow)"
      >
        <animate
          attributeName="r"
          values="8;8.5;8"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;1;0.8"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      
      {/* Sun rays */}
      {[...Array(8)].map((_, i) => {
        const angle = (i * 45) * Math.PI / 180;
        const x1 = 20 + Math.cos(angle) * 10;
        const y1 = 17 + Math.sin(angle) * 10;
        const x2 = 20 + Math.cos(angle) * 14;
        const y2 = 17 + Math.sin(angle) * 14;
        
        return (
          <line
            key={`ray-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#FFEB3B"
            strokeWidth="1.5"
            opacity="0.6"
            strokeLinecap="round"
          >
            <animate
              attributeName="opacity"
              values="0.2;0.6;0.2"
              dur={`${1 + (i % 3) * 0.3}s`}
              begin={`${i * 0.1}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="x2"
              values={`${x2};${20 + Math.cos(angle) * 16};${x2}`}
              dur={`${1.5 + (i % 2) * 0.5}s`}
              begin={`${i * 0.1}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="y2"
              values={`${y2};${17 + Math.sin(angle) * 16};${y2}`}
              dur={`${1.5 + (i % 2) * 0.5}s`}
              begin={`${i * 0.1}s`}
              repeatCount="indefinite"
            />
          </line>
        );
      })}
      
      {/* Heat waves */}
      {[...Array(3)].map((_, i) => {
        const yPos = 26 + i * 3;
        
        return (
          <path
            key={`wave-${i}`}
            d={`M5,${yPos} Q12,${yPos-4} 20,${yPos} Q28,${yPos+4} 35,${yPos}`}
            stroke="rgba(255, 87, 34, 0.6)"
            strokeWidth="1.5"
            fill="none"
            filter="url(#heatBlur)"
          >
            <animate
              attributeName="d"
              values={`M5,${yPos} Q12,${yPos-4} 20,${yPos} Q28,${yPos+4} 35,${yPos};
                      M5,${yPos} Q12,${yPos+4} 20,${yPos} Q28,${yPos-4} 35,${yPos};
                      M5,${yPos} Q12,${yPos-4} 20,${yPos} Q28,${yPos+4} 35,${yPos}`}
              dur={`${3 + i}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.2;0.6;0.2"
              dur={`${3 + i}s`}
              repeatCount="indefinite"
            />
          </path>
        );
      })}
    </svg>
  </SvgContainer>
);

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

// Shared interface for processed alert groups (Weather and Disease)
interface GroupedAlertType {
  type: string; // e.g., 'rain', 'dengue'
  title: string; // e.g., 'Rainfall Alert', 'Dengue Alert'
  details: { label: string; count: number }[];
  color: string;
  alertData: AlertType[]; // Contains original alert objects (weather or disease)
  isDisease?: boolean; // Flag to differentiate
}

// Type for Weather Alerts from API (can keep existing structure)
interface WeatherAlertType {
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

// Type for Disease Alerts from API
interface DiseaseAlertType {
  id: string; // Composite ID like 'TL-DI_2023-10-16_Dengue'
  disease_type: string; // 'Dengue' or 'Diarrhea'
  alert_level: string; // 'Severe', 'High', 'Moderate', 'Low'
  alert_title: string;
  alert_message: string;
  municipality_name: string;
  predicted_cases: number;
  forecast_date: string; // Represents week_start
  municipality_code: string;
}

// Union type for the alert data array
type AlertType = WeatherAlertType | DiseaseAlertType;

interface WelcomeProps {
  user: {
    userId: number;
  };
  addDangerToast: (message: string) => void;
  addSuccessToast: (message: string) => void;
  chartSlug?: string;
}

// Type for Weather Data Pull History
interface PullHistoryType {
  id: number;
  pulled_at: string;
  parameters_pulled: string;
  pull_status: string;
  details?: string;
}

// Type for Disease Pipeline Run History
interface PipelineRunHistoryType {
  id: number;
  ran_at: string; // ISO format datetime string
  pipeline_name: string;
  status: string;
  details?: string;
  municipalities_processed_count?: number;
  alerts_generated_count?: number;
  bulletins_created_count?: number;
}

function Welcome({ user, addDangerToast, addSuccessToast, chartSlug = 'overview-map' }: WelcomeProps) {
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherAlerts, setWeatherAlerts] = useState<GroupedAlertType[]>([]);
  const [lastPullInfo, setLastPullInfo] = useState<PullHistoryType | null>(null);
  const [lastPullLoading, setLastPullLoading] = useState(false);

  // State for Disease Alerts
  const [isDiseaseLoading, setIsDiseaseLoading] = useState(false);
  const [diseaseAlerts, setDiseaseAlerts] = useState<GroupedAlertType[]>([]);
  const [lastDiseaseRunInfo, setLastDiseaseRunInfo] = useState<PipelineRunHistoryType | null>(null);
  const [lastDiseaseRunLoading, setLastDiseaseRunLoading] = useState(false);

  // Fetch weather alerts from the API
  const fetchWeatherAlerts = useCallback(async () => {
    setIsWeatherLoading(true);
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
          if ('weather_parameter' in alert) {
            counts[alert.weather_parameter] = (counts[alert.weather_parameter] || 0) + 1;
          }
        });
        console.log("[Weather Forecast Alerts] Counts by parameter:", counts);
        
        // Process and group alerts by weather parameter
        processWeatherAlerts(response.json.result);
        // addSuccessToast(t('Weather alerts loaded successfully')); // Maybe too noisy
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
      setIsWeatherLoading(false);
    }
  }, [addDangerToast]);

  // Fetch disease alerts from the API
  const fetchDiseaseAlerts = useCallback(async () => {
    setIsDiseaseLoading(true);
    try {
      console.log("[Disease Forecast Alerts] fetching alerts");
      const response = await SupersetClient.get({
        endpoint: `/api/v1/disease_forecast_alert/?q=${encodeURIComponent(JSON.stringify({
          page_size: 100, // Get many results
          page: 0,
          order_column: 'forecast_date', // Sort by week start date
          order_direction: 'desc'
        }))}`,
        headers: { Accept: 'application/json' },
      });
      
      console.log("[Disease Forecast Alerts] response.json", response.json);
      
      if (response.json?.result) {
        processDiseaseAlerts(response.json.result);
        // addSuccessToast(t('Disease alerts loaded successfully'));
      } else {
        setDiseaseAlerts([]);
        addDangerToast(t('No disease alerts returned from API'));
      }
    } catch (error) {
      console.error('Error fetching disease alerts:', error);
      addDangerToast(t('Failed to load disease alerts: %s', error.message || String(error)));
      setDiseaseAlerts([]);
    } finally {
      setIsDiseaseLoading(false);
    }
  }, [addDangerToast]); // Removed addSuccessToast dependency here too

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

  // Fetch last disease pipeline run information
  const fetchLastDiseaseRun = useCallback(async () => {
    setLastDiseaseRunLoading(true);
    try {
      console.log("[Disease Pipeline Run] Fetching last successful run info");
      // We might want to fetch for specific pipelines if needed
      // e.g., ?pipeline_name=Dengue%20Predictor%20Pipeline
      const response = await SupersetClient.get({
        endpoint: '/api/v1/disease_pipeline_run_history/last_successful_run',
        headers: { Accept: 'application/json' },
      });
      
      console.log("[Disease Pipeline Run] Response:", response.json);
      
      if (response.json?.result) {
        setLastDiseaseRunInfo(response.json.result);
        console.log("[Disease Pipeline Run] Last successful run:", response.json.result.ran_at);
      } else {
        console.log("[Disease Pipeline Run] No successful run info available");
        setLastDiseaseRunInfo(null);
      }
    } catch (error) {
      if (error.status === 404) {
        console.log("[Disease Pipeline Run] No successful run history found");
      } else {
        console.error('Error fetching last disease run info:', error);
      }
      setLastDiseaseRunInfo(null);
    } finally {
      setLastDiseaseRunLoading(false);
    }
  }, []);

  // Process weather alerts and group them
  const processWeatherAlerts = useCallback((alerts: WeatherAlertType[]) => {
    const groupedByParameter: Record<string, WeatherAlertType[]> = {};
    
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
    
    const alertGroups: GroupedAlertType[] = [];
    const parameterMapping: Record<string, { type: string; color: string; title: string }> = {
      'Rainfall': { type: 'rain', color: '#3a5998', title: t('Rainfall Alert') },
      'Wind Speed': { type: 'wind', color: '#4c9c6d', title: t('Wind Alert') },
      'Heat Index': { type: 'heat', color: '#a67533', title: t('Heat Alert') }
    };

    Object.entries(groupedByParameter).forEach(([parameter, parameterAlerts]) => {
      const mapping = parameterMapping[parameter] || { 
        type: parameter.toLowerCase().replace(/\s+/g, '_'), 
        color: '#888888',
        title: tn(
          '%(parameter)s Alert',
          '%(parameter)s Alerts',
          parameterAlerts.length,
          { parameter: parameter }
        )
      };
      const extremeDanger = parameterAlerts.filter(a => a.alert_level === 'Extreme Danger' || a.alert_level === 'Severe').length;
      const danger = parameterAlerts.filter(a => a.alert_level === 'Danger' || a.alert_level === 'Heavy' || a.alert_level === 'Strong').length;
      const extremeCaution = parameterAlerts.filter(a => a.alert_level === 'Extreme Caution' || a.alert_level === 'Moderate' || a.alert_level === 'Caution').length;
      const light = parameterAlerts.filter(a => a.alert_level === 'Light' || a.alert_level === 'Normal').length;
      
      alertGroups.push({
        type: mapping.type,
        title: mapping.title,
        color: mapping.color,
        details: [
          { label: t('Extreme Danger'), count: extremeDanger },
          { label: t('Danger'), count: danger },
          { label: t('Extreme Caution'), count: extremeCaution },
          { label: t('Normal/Light'), count: light }
        ].filter(d => d.count > 0), 
        alertData: parameterAlerts,
        isDisease: false // Mark as weather
      });
    });
    setWeatherAlerts(alertGroups);
  }, []);

  // Process disease alerts and group them
  const processDiseaseAlerts = useCallback((alerts: DiseaseAlertType[]) => {
    const groupedByDisease: Record<string, DiseaseAlertType[]> = {};
    alerts.forEach(alert => {
      // Ensure composite ID exists if needed for consistency (though GET should provide it)
      if (!alert.id && alert.municipality_code && alert.forecast_date && alert.disease_type) {
        alert.id = `${alert.municipality_code}_${alert.forecast_date}_${alert.disease_type}`;
      }
      const diseaseType = alert.disease_type || 'Unknown Disease';
      if (!groupedByDisease[diseaseType]) {
        groupedByDisease[diseaseType] = [];
      }
      groupedByDisease[diseaseType].push(alert);
    });

    const alertGroups: GroupedAlertType[] = [];
    const diseaseMapping: Record<string, { type: string; color: string; title: string; icon: string }> = {
      'Dengue': { type: 'dengue', color: '#aa3535', title: t('Dengue Alert'), icon: '🦟' }, // Red from mosquito.svg gradient
      'Diarrhea': { type: 'diarrhea', color: '#56ACE0', title: t('Diarrhea Alert'), icon: '<0xF0><0x9F><0xA7><0xBB>' } // Light blue from stomach.svg
    };

    Object.entries(groupedByDisease).forEach(([disease, diseaseAlerts]) => {
      const mapping = diseaseMapping[disease] || {
        type: disease.toLowerCase().replace(/\s+/g, '_'),
        color: '#6c757d', // Gray for unknown
        title: t(`${disease} Alert`),
        icon: '❓'
      };

      // Count by severity levels used in disease alerts
      const severe = diseaseAlerts.filter(a => a.alert_level === 'Severe').length;
      const high = diseaseAlerts.filter(a => a.alert_level === 'High').length;
      const moderate = diseaseAlerts.filter(a => a.alert_level === 'Moderate').length;
      const low = diseaseAlerts.filter(a => a.alert_level === 'Low').length;

      alertGroups.push({
        type: mapping.type,
        title: mapping.title,
        color: mapping.color,
        details: [
          { label: t('Severe'), count: severe },
          { label: t('High'), count: high },
          { label: t('Moderate'), count: moderate },
          { label: t('Low'), count: low }
        ].filter(d => d.count > 0),
        alertData: diseaseAlerts,
        isDisease: true // Mark as disease
      });
    });
    setDiseaseAlerts(alertGroups);
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

  // Fetch all data on component mount
  useEffect(() => {
    fetchWeatherAlerts();
    fetchLastPull();
    fetchDiseaseAlerts();
    fetchLastDiseaseRun();
  }, [fetchWeatherAlerts, fetchLastPull, fetchDiseaseAlerts, fetchLastDiseaseRun]);

  const handleError = useCallback((error: Error) => {
    addDangerToast(t(t('Failed to load chart: %s'), error.message));
  }, [addDangerToast]);

  // Unified alert click handler
  const handleAlertClick = useCallback((alertGroup: GroupedAlertType) => {
    setModalTitle(alertGroup.title);
    
    const content = (
      <div>
        {(() => {
          const alertsByDate: Record<string, AlertType[]> = {};
          alertGroup.alertData.forEach(alert => {
            let dateKey = alert.forecast_date;
            try {
              const date = new Date(alert.forecast_date);
              const day = date.getDate();
              const month = date.toLocaleString('en-US', { month: 'short' });
              const year = date.getFullYear();
              dateKey = `${day} ${month} ${year}`;
            } catch (e) { /* ignore */ }
            if (!alertsByDate[dateKey]) alertsByDate[dateKey] = [];
            alertsByDate[dateKey].push(alert);
          });

          const sortedDates = Object.keys(alertsByDate).sort((a, b) => {
            try { return new Date(a).getTime() - new Date(b).getTime(); } catch (e) { return 0; }
          });

          return sortedDates.map(dateKey => {
            const sortedAlerts = [...alertsByDate[dateKey]].sort((a, b) => 
              a.municipality_name.localeCompare(b.municipality_name)
            );
            
            return (
              <div key={dateKey} style={{ marginBottom: '30px' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px', padding: '10px', borderBottom: '2px solid #f0f0f0' }}>
                  {dateKey} {alertGroup.isDisease ? '(Forecast Week Start)' : '(Forecast Day)'} 
                </div>
                {sortedAlerts.map(alert => {
                  let statusColor = '#888888'; // Default
                  const level = alert.alert_level.toLowerCase();
                  // Unified color logic
                  if (level.includes('extreme danger') || level === 'severe') statusColor = '#F44336';
                  else if (level === 'danger' || level === 'heavy' || level === 'strong' || level === 'high') statusColor = '#FF9800';
                  else if (level.includes('extreme caution') || level === 'moderate' || level === 'caution') statusColor = '#FFEB3B';
                  else if (level === 'light' || level === 'normal' || level === 'low') statusColor = '#4CAF50';
                  
                  // Define variables outside the conditional block
                  let parameterName: string;
                  let parameterValue: string | number;
                  let valueName: string;
                  let value: string | number;
                  
                  // Use if/else based on group type for clearer type narrowing
                  if (alertGroup.isDisease) {
                      const diseaseAlert = alert as DiseaseAlertType; // Cast once here
                      parameterName = 'Disease';
                      parameterValue = diseaseAlert.disease_type;
                      valueName = 'Predicted Cases';
                      value = diseaseAlert.predicted_cases;
                  } else {
                      // Add extra type guard check
                      if (!('disease_type' in alert)) {
                          const weatherAlert = alert as WeatherAlertType; // Cast once here
                          parameterName = 'Parameter';
                          parameterValue = weatherAlert.weather_parameter;
                          valueName = 'Value';
                          value = weatherAlert.parameter_value;
                      } else {
                           // Fallback for unexpected case
                           parameterName = 'Unknown';
                           parameterValue = 'N/A';
                           valueName = 'Unknown';
                           value = 'N/A';
                      }
                  }
                  
                  return (
                    <div key={alert.id} style={{ marginBottom: '20px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                        <div style={{ fontSize: '18px', fontWeight: 500 }}>{alert.municipality_name}</div>
                        <div style={{ background: statusColor, color: statusColor === '#FFEB3B' ? '#333' : 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '14px', fontWeight: 500 }}>
                          {alert.alert_level}
                        </div>
                      </div>
                      <div style={{ padding: '15px 20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '15px' }}>
                          <div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>{parameterName}</div>
                            <div style={{ fontSize: '15px' }}>{parameterValue}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>{valueName}</div>
                            <div style={{ fontSize: '15px' }}>
                              {(() => {
                                if (typeof value === 'number') {
                                  const formattedValue = Number.isInteger(value) ? value : value.toFixed(2);
                                  // Add units based on parameter type
                                  if (!alertGroup.isDisease) {
                                    const weatherAlert = alert as WeatherAlertType;
                                    if (weatherAlert.weather_parameter === 'Rainfall') {
                                      return `${formattedValue} mm`;
                                    } else if (weatherAlert.weather_parameter === 'Wind Speed') {
                                      return `${formattedValue} km/h`;
                                    } else if (weatherAlert.weather_parameter === 'Heat Index') {
                                      return `${formattedValue} °C`;
                                    }
                                  } else {
                                    // For disease cases, just show the number
                                    return formattedValue;
                                  }
                                  return formattedValue;
                                }
                                return value;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: '15px' }}>
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Advisory Message</div>
                          <div style={{ fontSize: '15px', padding: '10px', background: '#f9f9f9', borderRadius: '6px', lineHeight: '1.5' }}>
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

  // Combined weather/disease icons
  const getIcon = (type: string) => {
    switch (type) {
      case 'rain': return '☔';
      case 'wind': return '💨';
      case 'heat': return '🌡️';
      case 'dengue': return '🦟';
      case 'diarrhea': return '<0xF0><0x9F><0xA7><0xBB>'; // Test tube emoji
      default: return '⚠️';
    }
  };

  // Use animated icons for weather, simple emojis for diseases for now
  const AlertIcon = ({ type, isDisease }: { type: string, isDisease?: boolean }) => {
    if (isDisease) {
      // Use new animated components for diseases
      switch (type) {
        case 'dengue': return <MosquitoIcon width="40" height="40" />;
        case 'diarrhea': return <StomachIcon width="40" height="40" />;
        default: return <span style={{ fontSize: '28px' }}>{getIcon(type)}</span>; // Fallback emoji
      }
    }
    // Use animated weather icons
    switch (type) {
      case 'rain': return <RainAnimation />;
      case 'wind': return <WindAnimation />;
      case 'heat': return <HeatAnimation />;
      default: return <span style={{ fontSize: '24px' }}>{getIcon(type)}</span>;
    }
  };

  // Combine all alerts, sort maybe? For now, just concatenate
  const allAlerts = [...weatherAlerts, ...diseaseAlerts];
  const allLoading = isWeatherLoading || isDiseaseLoading;

  const renderWeatherAlertDetail = (alert: WeatherAlertType) => (
    <div style={{ padding: '15px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '15px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Parameter</div>
          <div style={{ fontSize: '15px' }}>{alert.weather_parameter}</div>
        </div>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Value</div>
          <div style={{ fontSize: '15px' }}>
            {(() => {
              if (typeof alert.parameter_value === 'number') {
                const formattedValue = Number.isInteger(alert.parameter_value) ? alert.parameter_value : alert.parameter_value.toFixed(2);
                // Add units based on weather parameter
                if (alert.weather_parameter === 'Rainfall') {
                  return `${formattedValue} mm`;
                } else if (alert.weather_parameter === 'Wind Speed') {
                  return `${formattedValue} km/h`;
                } else if (alert.weather_parameter === 'Heat Index') {
                  return `${formattedValue} °C`;
                }
                return formattedValue;
              }
              return alert.parameter_value;
            })()}
          </div>
        </div>
      </div>
      <div style={{ marginTop: '15px' }}>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Advisory Message</div>
        <div style={{ fontSize: '15px', padding: '10px', background: '#f9f9f9', borderRadius: '6px', lineHeight: '1.5' }}>
          {alert.alert_message}
        </div>
      </div>
    </div>
  );

  const renderDiseaseAlertDetail = (alert: DiseaseAlertType) => (
    <div style={{ padding: '15px 20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '15px' }}>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Disease</div>
          <div style={{ fontSize: '15px' }}>{alert.disease_type}</div>
        </div>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Predicted Cases</div>
          <div style={{ fontSize: '15px' }}>{alert.predicted_cases}</div>
        </div>
      </div>
      <div style={{ marginTop: '15px' }}>
        <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Advisory Message</div>
        <div style={{ fontSize: '15px', padding: '10px', background: '#f9f9f9', borderRadius: '6px', lineHeight: '1.5' }}>
          {alert.alert_message}
        </div>
      </div>
    </div>
  );

  return (
    <ChartContainer>
      <AlertsContainer>
        {allLoading ? (
          <AlertCard>
            <AlertContent>
              <AlertTitle>Loading alerts...</AlertTitle>
            </AlertContent>
          </AlertCard>
        ) : allAlerts.length === 0 ? (
          <AlertCard>
            <AlertContent>
              <AlertTitle>No active alerts</AlertTitle>
            </AlertContent>
          </AlertCard>
        ) : (
          allAlerts.map((alert) => (
            <AlertCard key={alert.type} onClick={() => handleAlertClick(alert)}>
              <IconContainer bgColor={alert.color}>
                <AlertIcon type={alert.type} isDisease={alert.isDisease} />
              </IconContainer>
              <AlertContent>
                <AlertTitle>{alert.title}</AlertTitle>
                {alert.details.map((detail) => (
                  <AlertDetail key={detail.label}>
                    {detail.label}: {tn(
                      "%(count)s Location",
                      "%(count)s Locations",
                      detail.count,
                      { count: detail.count }
                    )}
                  </AlertDetail>
                ))}
              </AlertContent>
            </AlertCard>
          ))
        )}
      </AlertsContainer>
      
      <ResponsiveChartSlug
        slug={chartSlug}
        fillHeight
        onError={handleError}
      />

      {/* Data source attribution updated */}
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
        {/* <span style={{marginTop: '5px'}}>Disease forecast data generated internally</span>
        {lastDiseaseRunLoading ? (
          <DataUpdateInfo>Loading last disease forecast time...</DataUpdateInfo>
        ) : lastDiseaseRunInfo ? (
          <DataUpdateInfo>
            Last successful disease forecast: {formatDisplayDate(lastDiseaseRunInfo.ran_at)}
          </DataUpdateInfo>
        ) : (
          <DataUpdateInfo>Disease forecast history unavailable</DataUpdateInfo>
        )} */}
      </DataSourceAttribution>

      <Modal
        title={modalTitle}
        show={showModal}
        onHide={closeModal}
        footer={[
          <button key="refresh" onClick={() => { fetchWeatherAlerts(); fetchDiseaseAlerts(); }} style={{ marginRight: '10px' }}>
            Refresh All Alerts
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
