import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  styled,
  t,
  SupersetClient,
} from '@superset-ui/core';
import Echart from '../../../plugins/plugin-chart-echarts/src/components/Echart';
import { Row, Col, Select, Radio, Switch } from 'antd';
import { DatePicker } from 'src/components/DatePicker';
import moment, { Moment } from 'moment';
import Loading from 'src/components/Loading';
import { useResizeDetector } from 'react-resize-detector';
import AutoSizer from 'react-virtualized-auto-sizer';

const THRESHOLDS: Record<
  string,
  Array<{ value: number; label: string; color: string }>
> = {
  heat_index: [
    { value: 33, label: t('Extreme Danger'), color: '#d32f2f' },
    { value: 30, label: t('Danger'), color: '#ef6c00' },
    { value: 27, label: t('Extreme Caution'), color: '#fdd835' },
  ],
  rainfall: [
    { value: 100, label: t('Extreme Danger'), color: '#d32f2f' },
    { value: 50, label: t('Danger'), color: '#ef6c00' },
    { value: 20, label: t('Extreme Caution'), color: '#fdd835' },
  ],
  wind_speed: [
    { value: 25, label: t('Extreme Danger'), color: '#d32f2f' },
    { value: 20, label: t('Danger'), color: '#ef6c00' },
    { value: 15, label: t('Extreme Caution'), color: '#fdd835' },
  ],
};

const MUNICIPALITY_OPTIONS = [
  'Aileu',
  'Ainaro',
  'Atauro',
  'Baucau',
  'Bobonaro',
  'Covalima',
  'Dili',
  'Ermera',
  'Manatuto',
  'Manufahi',
  'Lautem',
  'Liquica',
  'Raeoa',
  'Viqueque',
].map(name => ({ label: name, value: name }));

const TrendlinesContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  border-radius: ${({ theme }) => theme.borderRadius}px;
`;

const FilterContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.gridUnit * 4}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  align-items: flex-end;
  justify-content: space-between;
`;

const FilterGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.gridUnit * 4}px;
  align-items: flex-end;
`;

const FilterItem = styled.div`
  display: flex;
  flex-direction: column;

  label {
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    margin-bottom: ${({ theme }) => theme.gridUnit}px;
  }
`;

const ChartContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 300px;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};

  h4 {
    margin: 0 0 ${({ theme }) => theme.gridUnit * 2}px 0;
    font-weight: ${({ theme }) => theme.typography.weights.bold};
  }
`;

const EchartContainer = styled.div`
  flex: 1;
  min-height: 0;
`;

const WEATHER_PARAMETER_UNITS: Record<string, string> = {
  humidity: '%',
  temp_max: '°C',
  temp_min: '°C',
  rainfall: 'mm',
  wind_speed: 'km/h',
  heat_index: '°C',
};

const WEATHER_PARAMETERS: Record<string, string> = {
  'Relative Humidity': 'humidity',
  'Max Temperature': 'temp_max',
  'Min Temperature': 'temp_min',
  Rainfall: 'rainfall',
  Windspeed: 'wind_speed',
};

interface WeatherDataPoint {
  forecast_date: string;
  value: number;
}

interface WeatherDataSeries {
  [municipality: string]: WeatherDataPoint[];
}

interface Filters {
  municipalities: string[];
  startDate: string;
  daysRange: number;
}

type Level = 'municipality' | 'national';

const WeatherTrendChart = ({
  parameter,
  title,
  filters,
  level,
  showThresholds = true,
}: {
  parameter: string;
  title: string;
  filters: Filters;
  level: Level;
  showThresholds?: boolean;
}) => {
  const [data, setData] = useState<WeatherDataSeries>({});
  const [loading, setLoading] = useState(true);
  const { ref } = useResizeDetector();
  const echartRef = useRef<any>();

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const { municipalities, startDate, daysRange } = filters;

    if (level === 'municipality' && municipalities.length === 0) {
      setData({});
      setLoading(false);
      return () => {
        ignore = true;
      };
    }

    let fetchPromises;

    if (level === 'national') {
      const params = new URLSearchParams({
        forecast_date: startDate,
        days_range: String(daysRange),
        page_size: '-1', // Fetch all data points for the range
      });
      fetchPromises = [
        SupersetClient.get({
          endpoint: `/api/v1/weather_forecasts/${parameter}?${params}`,
        }).then(response => {
          const allData: WeatherDataPoint[] = response.json.result;

          const groupedByDate: Record<string, number[]> = {};
          allData.forEach(point => {
            if (!groupedByDate[point.forecast_date]) {
              groupedByDate[point.forecast_date] = [];
            }
            groupedByDate[point.forecast_date].push(point.value);
          });

          const aggregatedData: WeatherDataPoint[] = Object.entries(
            groupedByDate,
          ).map(([date, values]) => {
            const sum = values.reduce((acc, val) => acc + val, 0);
            return {
              forecast_date: date,
              value: sum / values.length,
            };
          });

          return {
            municipality: 'National',
            data: aggregatedData.sort(
              (a, b) =>
                new Date(a.forecast_date).getTime() -
                new Date(b.forecast_date).getTime(),
            ),
          };
        }),
      ];
    } else {
      fetchPromises = municipalities.map(municipality => {
        const params = new URLSearchParams({
          municipality_name: municipality,
          forecast_date: startDate,
          days_range: String(daysRange),
          page_size: '-1', // Fetch all data points for the range
        });
        return SupersetClient.get({
          endpoint: `/api/v1/weather_forecasts/${parameter}?${params}`,
        }).then(response => ({
          municipality,
          data: response.json.result.sort(
            (a: WeatherDataPoint, b: WeatherDataPoint) =>
              new Date(a.forecast_date).getTime() -
              new Date(b.forecast_date).getTime(),
          ),
        }));
      });
    }

    Promise.all(fetchPromises)
      .then(results => {
        if (ignore) return;
        const newData: WeatherDataSeries = {};
        results.forEach(result => {
          if (result.data) {
            newData[result.municipality] = result.data;
          }
        });
        setData(newData);
      })
      .catch(error => {
        if (ignore) return;
        console.error(`Error fetching ${title} data:`, error);
        setData({});
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [parameter, title, filters, level]);

  const allDates = useMemo(
    () =>
      [
        ...new Set(
          Object.values(data).flatMap(d => d.map(item => item.forecast_date)),
        ),
      ].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [data],
  );

  const parameterThresholds = showThresholds ? THRESHOLDS[parameter] : undefined;

  const FALLBACK_PALETTE = [
    '#5470c6',
    '#91cc75',
    '#73c0de',
    '#3ba272',
    '#9a60b4',
    '#ea7ccc',
    '#009688',
    '#607d8b',
    '#8a2be2',
  ];

  const seriesData = useMemo(
    () =>
      Object.entries(data).map(([municipality, munData], i) => {
        const dataMap = new Map(munData.map(d => [d.forecast_date, d.value]));
        const color = FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
        return {
          name: municipality,
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'emptyCircle',
          symbolSize: 6,
          lineStyle: {
            color,
          },
          itemStyle: {
            color,
          },
          data: allDates.map(date => {
            const value = dataMap.get(date);

            if (value === null || value === undefined) {
              return null;
            }

            const point: {
              value: number;
              itemStyle?: { color: string };
              symbol?: string;
              symbolSize?: number;
            } = {
              value,
            };

            if (parameterThresholds) {
              // The thresholds are sorted from most severe to least severe.
              // Find the first threshold that the value is greater than or equal to.
              const threshold = [...parameterThresholds]
                .reverse()
                .find(t => value >= t.value);
              if (threshold) {
                point.itemStyle = {
                  color: threshold.color,
                };
                point.symbol = 'triangle';
                point.symbolSize = 10;
              }
            }

            return point;
          }),
        };
      }),
    [data, allDates, parameterThresholds],
  );

  const echartOptions = useMemo(() => {
    const options: any = {
      title: {
        text: title,
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          if (!params.length) {
            return '';
          }

          const unit = WEATHER_PARAMETER_UNITS[parameter] || '';
          const date = moment(params[0].axisValue).format('DD MMM YYYY');

          const content = params
            .map(param => {
              // The 'Thresholds' series for markLine should not be in tooltip
              if (param.seriesName === 'Thresholds') {
                return null;
              }

              const pointValue =
                typeof param.value === 'object' && param.value !== null
                  ? param.value.value
                  : param.value;

              if (pointValue == null) {
                return null;
              }
              return `${param.marker} ${
                param.seriesName
              }: <strong>${pointValue.toFixed(2)}${unit}</strong>`;
            })
            .filter(Boolean)
            .join('<br />');

          return `${date}<br />${content}`;
        },
      },
      legend: {
        data: Object.keys(data),
        type: 'scroll',
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          formatter: (value: string) => moment(value).format('DD MMM YYYY'),
        },
      },
      yAxis: {
        type: 'value',
        name: WEATHER_PARAMETER_UNITS[parameter] || '',
      },
      series: seriesData,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        containLabel: true,
      },
    };

    if (showThresholds && parameterThresholds) {
      options.series.push({
        name: 'Thresholds',
        type: 'line',
        markLine: {
          symbol: 'none',
          silent: true,
          data: parameterThresholds.map(t => ({
            yAxis: t.value,
            name: t.label,
            lineStyle: {
              color: t.color,
              type: 'dashed',
            },
            label: {
              formatter: '{b}',
              position: 'insideEndTop',
              color: t.color,
            },
          })),
        },
      });

      const allDataValues = Object.values(data)
        .flatMap(series => series.map(point => point.value))
        .filter(value => value !== null) as number[];

      const thresholdValues = parameterThresholds.map(t => t.value);
      const combinedValues = [...allDataValues, ...thresholdValues];

      if (combinedValues.length > 0) {
        let min = Math.min(...combinedValues);
        let max = Math.max(...combinedValues);

        if (min === max) {
          min -= 10;
          max += 10;
        }

        const padding = (max - min) * 0.1 || 5;
        const yMin = min - padding;
        const yMax = max + padding;

        options.yAxis.min = yMin < 0 && min >= 0 ? 0 : Math.floor(yMin);
        options.yAxis.max = Math.ceil(yMax);
      }
    }
    return options;
  }, [
    title,
    parameter,
    data,
    allDates,
    seriesData,
    showThresholds,
    parameterThresholds,
  ]);

  if (loading) {
    return <Loading />;
  }

  if (Object.keys(data).length === 0 || echartOptions.series.length === 0) {
    return (
      <>
        <h4>{title}</h4>
        <div
          ref={ref}
          style={{
            height: '100%',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <p>{t('No data available for the selected criteria.')}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <h4>{title}</h4>
      <EchartContainer ref={ref}>
        <AutoSizer>
          {({ height, width }: { height: number; width: number }) => (
            <Echart
              height={height}
              width={width}
              echartOptions={echartOptions}
              refs={{ echartRef }}
            />
          )}
        </AutoSizer>
      </EchartContainer>
    </>
  );
};

const PageContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const Trendlines = () => {
  const [municipalities, setMunicipalities] = useState(['Dili']);
  const [startDate, setStartDate] = useState<Moment | null>(moment());
  const [endDate, setEndDate] = useState<Moment | null>(moment().add(10, 'days'));
  const [level, setLevel] = useState<Level>('national');
  const [showThresholds, setShowThresholds] = useState(true);

  const filters: Filters | null = useMemo(() => {
    if (!startDate || !endDate) {
      return null;
    }
    const daysRange = endDate.diff(startDate, 'days');

    return {
      municipalities,
      startDate: startDate.format('YYYY-MM-DD'),
      daysRange: daysRange >= 0 ? daysRange : 0,
    };
  }, [municipalities, startDate, endDate]);

  const handleLevelChange = (newLevel: Level) => {
    setLevel(newLevel);
    if (newLevel === 'national') {
      setMunicipalities([]);
    } else {
      setMunicipalities(['Dili']);
    }
  };

  return (
    <PageContainer>
      {/* <SubMenu name={t('Weather Forecast Trendlines')} buttons={[]} /> */}
      <TrendlinesContainer>
        <div className="superset-list-view">
          <div className="header">
            <div className="controls">
              <FilterContainer>
                <FilterGroup>
                  <FilterItem>
                    <label>{t('Level')}</label>
                    <Radio.Group
                      onChange={e => handleLevelChange(e.target.value)}
                      value={level}
                    >
                      <Radio value="national">{t('National')}</Radio>
                      <Radio value="municipality">{t('Municipality')}</Radio>
                    </Radio.Group>
                  </FilterItem>
                  <FilterItem>
                    <label>{t('Municipalities')}</label>
                    <Select
                      mode="multiple"
                      placeholder={t('Select municipalities')}
                      value={municipalities}
                      onChange={values => setMunicipalities(values)}
                      style={{ minWidth: 200, maxWidth: 400 }}
                      options={MUNICIPALITY_OPTIONS}
                      allowClear
                      disabled={level === 'national'}
                    />
                  </FilterItem>
                  <FilterItem>
                    <label>{t('Start Date')}</label>
                    <DatePicker
                      value={startDate}
                      onChange={date => setStartDate(date)}
                    />
                  </FilterItem>
                  <FilterItem>
                    <label>{t('End Date')}</label>
                    <DatePicker
                      value={endDate}
                      onChange={date => setEndDate(date)}
                    />
                  </FilterItem>
                </FilterGroup>
                <FilterItem>
                  <label>{t('Show Thresholds')}</label>
                  <Switch
                    checked={showThresholds}
                    onChange={setShowThresholds}
                    style={{ display: 'flex' }}
                  />
                </FilterItem>
              </FilterContainer>
            </div>
          </div>
          <div className="body">
            {filters ? (
              <Row gutter={[16, 16]}>
                <Col span={24} key="heat-index">
                  <ChartContainer>
                    <WeatherTrendChart
                      parameter="heat_index"
                      title={t('Heat Index')}
                      filters={filters}
                      level={level}
                      showThresholds={showThresholds}
                    />
                  </ChartContainer>
                </Col>
                {Object.entries(WEATHER_PARAMETERS).map(([title, param]) => (
                  <Col span={24} key={param}>
                    <ChartContainer>
                      <WeatherTrendChart
                        parameter={param}
                        title={t(title)}
                        filters={filters}
                        level={level}
                        showThresholds={showThresholds}
                      />
                    </ChartContainer>
                  </Col>
                ))}
              </Row>
            ) : (
              <Loading />
            )}
          </div>
        </div>
      </TrendlinesContainer>
    </PageContainer>
  );
};

export default Trendlines; 