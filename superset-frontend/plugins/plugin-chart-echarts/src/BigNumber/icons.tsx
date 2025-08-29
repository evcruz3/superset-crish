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
import { styled } from '@superset-ui/core';

interface IconProps {
  color?: string;
  className?: string;
}

const StyledIcon = styled.span<IconProps>`
  display: inline-block;
  color: ${({ color }) => color};
  width: 1em;
  height: 1em;
  svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
  }
`;

// Define icon components using the SVG paths
export const DollarIcon = ({ color, className }: IconProps) => (
  <StyledIcon color={color} className={className}>
    <svg viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z" />
    </svg>
  </StyledIcon>
);

export const UserIcon = ({ color, className }: IconProps) => (
  <StyledIcon color={color} className={className}>
    <svg viewBox="0 0 24 24">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  </StyledIcon>
);

export const ChartLineIcon = ({ color, className }: IconProps) => (
  <StyledIcon color={color} className={className}>
    <svg viewBox="0 0 24 24">
      <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z" />
    </svg>
  </StyledIcon>
);

export const ChartBarIcon = ({ color, className }: IconProps) => (
  <StyledIcon color={color} className={className}>
    <svg viewBox="0 0 24 24">
      <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
    </svg>
  </StyledIcon>
);

export const ChartPieIcon = ({ color, className }: IconProps) => (
  <StyledIcon color={color} className={className}>
    <svg viewBox="0 0 24 24">
      <path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z" />
    </svg>
  </StyledIcon>
);

// Map icon names to components
export const ICONS = {
  dollar: DollarIcon,
  user: UserIcon,
  'chart-line': ChartLineIcon,
  'chart-bar': ChartBarIcon,
  'chart-pie': ChartPieIcon,
} as const;

export type IconKey = keyof typeof ICONS;
