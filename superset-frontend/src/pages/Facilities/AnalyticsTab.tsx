import React from 'react';
import { t, styled, useTheme } from '@superset-ui/core';
import { Row, Col, Card, Statistic, Divider, Spin } from 'antd';
import {
  ResponsiveContainer, PieChart, Pie, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, Cell
} from 'recharts';
import { FacilityCountData, ChartDataItem } from './types'; // Import shared types

// Styled components with Superset theme standards
const StyledCard = styled(Card)`
  ${({ theme }) => `
    margin-bottom: ${theme.gridUnit * 4}px;
    box-shadow: 0 1px 3px ${theme.colors.grayscale.light2};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const StyledStatistic = styled(Statistic)`
  ${({ theme }) => `
    .ant-statistic-title {
      font-size: ${theme.typography.sizes.s}px;
      color: ${theme.colors.grayscale.base};
    }
    .ant-statistic-content {
      color: ${theme.colors.grayscale.dark1};
    }
  `}
`;

const ChartContainer = styled.div`
  ${({ theme }) => `
    padding: ${theme.gridUnit * 2}px 0;
    .recharts-default-tooltip {
      border-radius: ${theme.borderRadius}px;
      box-shadow: ${theme.gridUnit / 4}px ${theme.gridUnit / 2}px ${theme.gridUnit * 4}px ${theme.colors.grayscale.light2};
      background-color: ${theme.colors.grayscale.light5} !important;
      border: 1px solid ${theme.colors.grayscale.light2} !important;
      .recharts-tooltip-label {
        font-weight: ${theme.typography.weights.bold};
        color: ${theme.colors.grayscale.dark1};
      }
      .recharts-tooltip-item-name, .recharts-tooltip-item-value {
        color: ${theme.colors.grayscale.dark1};
      }
    }
    .recharts-cartesian-axis-line, .recharts-cartesian-axis-tick-line {
      stroke: ${theme.colors.grayscale.light2};
    }
    .recharts-cartesian-axis-tick-value {
      fill: ${theme.colors.grayscale.dark1};
      font-size: ${theme.typography.sizes.s}px;
    }
    .recharts-cartesian-grid line {
      stroke: ${theme.colors.grayscale.light2};
    }
    .recharts-legend-item-text {
      color: ${theme.colors.grayscale.dark1} !important;
      font-size: ${theme.typography.sizes.s}px;
    }
  `}
`;

// Define props required by AnalyticsTab
interface AnalyticsTabProps {
  countData: FacilityCountData | null;
  loading: boolean; // Add loading state prop
}

// Helper function to format data for charts
const formatCountData = (data: Record<string, number> | undefined): ChartDataItem[] => {
  if (!data) return [];
  return Object.entries(data).map(([name, value]) => ({ name, value }));
};

const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ countData, loading }) => {
  const theme = useTheme();
  
  // Chart colors from Superset's theme
  const chartColors = [
    theme.colors.primary.base,
    theme.colors.secondary.base,
    theme.colors.success.base,
    theme.colors.info.base,
    theme.colors.warning.base,
    theme.colors.error.base,
    theme.colors.primary.light1,
    theme.colors.success.light1,
    theme.colors.info.light1,
    theme.colors.warning.light1
  ];

  return (
    <StyledCard>
      {loading || !countData ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>{t('Loading analytics...')}</div>
        </div>
      ) : (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <StyledStatistic 
                title={t('Total Health Facilities')} 
                value={countData.total} 
                valueStyle={{ color: theme.colors.success.base }}
              />
            </Col>
            <Col span={8}>
              <StyledStatistic 
                title={t('Facility Types')} 
                value={Object.keys(countData.by_type || {}).length} 
              />
            </Col>
            <Col span={8}>
              <StyledStatistic 
                title={t('Administrative Posts with Facilities')} 
                value={Object.keys(countData.by_location || {}).length} 
              />
            </Col>
          </Row>
          
          <Divider orientation="left">{t('Facilities by Type')}</Divider>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <ChartContainer>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart margin={{ top: 0, right: 30, left: 0, bottom: 10 }}>
                    <Pie
                      data={formatCountData(countData.by_type)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => 
                        percent > 0.05 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius={100}
                      innerRadius={40} // Make it a donut chart
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {formatCountData(countData.by_type).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={chartColors[index % chartColors.length]} 
                          stroke={theme.colors.grayscale.light5}
                          strokeWidth={1}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value} (${((value / countData.total) * 100).toFixed(1)}%)`, 
                        name
                      ]}
                    />
                    <Legend 
                      layout="horizontal" 
                      verticalAlign="bottom" 
                      align="center"
                      wrapperStyle={{ paddingTop: 20 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Col>
            <Col xs={24} md={12}>
              <ChartContainer>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={formatCountData(countData.by_type)}
                    margin={{ top: 10, right: 30, left: 20, bottom: 40 }}
                    layout="vertical"
                    barSize={20}
                    barGap={2}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis 
                      type="number" 
                      tickLine={true}
                      axisLine={true}
                      tickFormatter={(value) => value.toLocaleString()}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={150} 
                      tick={{ fill: theme.colors.grayscale.dark1 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      formatter={(value: number) => [
                        `${value} (${((value / countData.total) * 100).toFixed(1)}%)`, 
                        t('Facilities')
                      ]}
                      cursor={{ fill: theme.colors.grayscale.light3, opacity: 0.3 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: 10 }} />
                    <Bar 
                      dataKey="value" 
                      fill={theme.colors.primary.base} 
                      name={t('Facilities')}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </Col>
          </Row>
          
          <Divider orientation="left">{t('Facilities by Administrative Post')}</Divider>
          <ChartContainer>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={formatCountData(countData.by_location)}
                margin={{ top: 10, right: 30, left: 20, bottom: 70 }}
                barSize={20}
                barGap={2}
                maxBarSize={40}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70}
                  tick={{ fill: theme.colors.grayscale.dark1 }}
                  tickLine={true}
                  axisLine={true}
                />
                <YAxis 
                  tickFormatter={(value) => value.toLocaleString()}
                  tick={{ fill: theme.colors.grayscale.dark1 }}
                  tickLine={false}
                  axisLine={true}
                />
                <Tooltip 
                  formatter={(value: number) => [
                    `${value} (${((value / countData.total) * 100).toFixed(1)}%)`, 
                    t('Facilities')
                  ]}
                  cursor={{ fill: theme.colors.grayscale.light3, opacity: 0.3 }}
                />
                <Legend wrapperStyle={{ paddingTop: 20 }} />
                <Bar 
                  dataKey="value" 
                  fill={theme.colors.success.base}
                  name={t('Facilities')}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </>
      )}
    </StyledCard>
  );
};

export default AnalyticsTab; 