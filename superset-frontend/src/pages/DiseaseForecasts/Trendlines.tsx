import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  styled,
  t,
  SupersetClient,
  supersetTheme,
} from '@superset-ui/core';
import Echart from '../../../plugins/plugin-chart-echarts/src/components/Echart';
import { Row, Col, Select, Radio, Switch } from 'antd';
import { Input } from 'src/components/Input';
import { DatePicker } from 'src/components/DatePicker';
import moment, { Moment } from 'moment';
import Loading from 'src/components/Loading';
import { useResizeDetector } from 'react-resize-detector';
import AutoSizer from 'react-virtualized-auto-sizer';
import SubMenu from 'src/features/home/SubMenu';

const ALERT_LEVEL_COLORS: Record<string, string> = {
  Epidemic: '#d32f2f',
  Alert: '#ef6c00',
  Normal: '#20a7c9', // Color for 'Normal' or other levels
};

const DISEASE_THRESHOLDS: Record<
  string,
  Array<{ value: number; label: string; color: string }>
> = {
  Dengue: [
    { value: 6, label: 'Severe', color: '#d32f2f' },
    { value: 2, label: 'High', color: '#ef6c00' },
    { value: 1, label: 'Moderate', color: '#fdd835' },
  ],
  Diarrhea: [
    { value: 100, label: 'Severe', color: '#d32f2f' },
    { value: 50, label: 'High', color: '#ef6c00' },
    { value: 25, label: 'Moderate', color: '#fdd835' },
    { value: 1, label: 'Low', color: '#20a7c9' },
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

const DISEASE_OPTIONS = ['Dengue', 'Diarrhea'].map(name => ({
  label: name,
  value: name,
}));

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
  height: 450px;
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

interface DiseaseDataPoint {
  forecast_date: string;
  predicted_cases: number;
  alert_level: string;
}

interface DiseaseDataSeries {
  [municipality: string]: DiseaseDataPoint[];
}

interface Filters {
  municipalities: string[];
  startDate: string;
  endDate: string;
}

type Level = 'municipality' | 'national';

const DiseaseTrendChart = ({
  filters,
  level,
  disease,
  showThresholds = true,
}: {
  filters: Filters;
  level: Level;
  disease: string;
  showThresholds?: boolean;
}) => {
  const [data, setData] = useState<DiseaseDataSeries>({});
  const [loading, setLoading] = useState(true);
  const { ref } = useResizeDetector();
  const echartRef = useRef<any>();

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    const { municipalities, startDate, endDate } = filters;

    if (
      (level === 'municipality' && municipalities.length === 0) ||
      !disease
    ) {
      setData({});
      setLoading(false);
      return () => {
        ignore = true;
      };
    }

    const commonParams: Record<string, string> = {
      page_size: '-1',
      disease_type: disease,
      forecast_date_start: startDate,
      forecast_date_end: endDate,
    };

    let fetchPromises;

    if (level === 'national') {
      const params = new URLSearchParams(commonParams);
      fetchPromises = [
        SupersetClient.get({
          endpoint: `/api/v1/disease_forecast_alert/?${params.toString()}`,
        }).then(response => {
          const allData: DiseaseDataPoint[] = response.json.result;

          const groupedByDate: Record<string, number[]> = {};
          allData.forEach(point => {
            if (!groupedByDate[point.forecast_date]) {
              groupedByDate[point.forecast_date] = [];
            }
            groupedByDate[point.forecast_date].push(point.predicted_cases);
          });

          const aggregatedData: DiseaseDataPoint[] = Object.entries(
            groupedByDate,
          ).map(([date, values]) => {
            const sum = values.reduce((acc, val) => acc + val, 0);
            return {
              forecast_date: date,
              predicted_cases: sum / values.length,
              alert_level: 'National Average', // Cannot determine level for an average
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
          ...commonParams,
          municipality_name: municipality,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/disease_forecast_alert/?${params.toString()}`,
        }).then(response => ({
          municipality,
          data: response.json.result.sort(
            (a: DiseaseDataPoint, b: DiseaseDataPoint) =>
              new Date(a.forecast_date).getTime() -
              new Date(b.forecast_date).getTime(),
          ),
        }));
      });
    }

    Promise.all(fetchPromises)
      .then(results => {
        if (ignore) return;
        const newData: DiseaseDataSeries = {};
        results.forEach(result => {
          if (result.data) {
            newData[result.municipality] = result.data;
          }
        });
        setData(newData);
      })
      .catch(error => {
        if (ignore) return;
        console.error(`Error fetching disease forecast data:`, error);
        setData({});
      })
      .finally(() => {
        if (ignore) return;
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters, level, disease]);

  const allDates = useMemo(
    () =>
      [
        ...new Set(
          Object.values(data).flatMap(d => d.map(item => item.forecast_date)),
        ),
      ].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
    [data],
  );

  const diseaseThresholds = showThresholds
    ? DISEASE_THRESHOLDS[disease]
    : undefined;

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
        const dataMap = new Map(
          munData.map(d => [
            moment(d.forecast_date).format('YYYY-MM-DD'),
            d,
          ]),
        );
        const color = FALLBACK_PALETTE[i % FALLBACK_PALETTE.length];
        return {
          name: municipality,
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'emptyCircle',
          symbolSize: 6,
          lineStyle: { color },
          itemStyle: { color },
          data: allDates.map(date => {
            const dataPoint = dataMap.get(moment(date).format('YYYY-MM-DD'));
            if (!dataPoint) return null;

            const { predicted_cases, alert_level } = dataPoint;

            const point: {
              value: number;
              itemStyle?: { color: string };
              symbol?: string;
              symbolSize?: number;
            } = {
              value: predicted_cases,
            };

            if (diseaseThresholds) {
              const threshold = diseaseThresholds.find(
                t => predicted_cases >= t.value,
              );
              if (threshold) {
                point.itemStyle = {
                  color: threshold.color,
                };
                point.symbol = 'triangle';
                point.symbolSize = 10;
              }
            }

            const alertColor = ALERT_LEVEL_COLORS[alert_level];
            if (alertColor && alert_level !== 'Normal') {
              point.itemStyle = { color: alertColor };
              point.symbol = 'triangle';
              point.symbolSize = 10;
            }

            return point;
          }),
        };
      }),
    [data, allDates, diseaseThresholds],
  );

  const echartOptions = useMemo(() => {
    const options: any = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          if (!params.length) return '';
          const date = moment(params[0].axisValue).format('DD MMM YYYY');
          const content = params
            .map(param => {
              const pointValue =
                typeof param.value === 'object' && param.value !== null
                  ? param.value.value
                  : param.value;
              if (pointValue == null) return null;
              return `${param.marker} ${
                param.seriesName
              }: <strong>${pointValue.toFixed(0)} cases</strong>`;
            })
            .filter(Boolean)
            .join('<br />');
          return `${date}<br />${content}`;
        },
      },
      legend: {
        data: Object.keys(data),
        type: 'scroll',
        bottom: 0,
      },
      xAxis: {
        type: 'category',
        data: allDates,
        axisLabel: {
          formatter: (value: string) => moment(value).format('DD MMM'),
        },
      },
      yAxis: {
        type: 'value',
        name: t('Predicted Cases'),
      },
      series: seriesData,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true,
      },
    };

    if (showThresholds && diseaseThresholds) {
      options.series.push({
        name: 'Thresholds',
        type: 'line',
        markLine: {
          symbol: 'none',
          silent: true,
          data: diseaseThresholds.map(t => ({
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
        .flatMap(series => series.map(point => point.predicted_cases))
        .filter(value => value !== null) as number[];

      const thresholdValues = diseaseThresholds.map(t => t.value);
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
  }, [data, allDates, seriesData, showThresholds, diseaseThresholds]);

  if (loading) return <Loading />;

  if (Object.keys(data).length === 0) {
    return (
      <div
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
    );
  }

  return (
    <EchartContainer ref={ref}>
      <AutoSizer>
        {({ height, width }) => (
          <Echart
            height={height}
            width={width}
            echartOptions={echartOptions}
            refs={{ echartRef }}
          />
        )}
      </AutoSizer>
    </EchartContainer>
  );
};

const PageContainer = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const Trendlines = () => {
  const [municipalities, setMunicipalities] = useState(['Dili']);
  const [startDate, setStartDate] = useState<Moment | null>(
    moment().startOf('isoWeek'),
  );
  const [endDate, setEndDate] = useState<Moment | null>(
    moment().add(1, 'week').endOf('isoWeek'),
  );
  const [level, setLevel] = useState<Level>('municipality');
  const [showThresholds, setShowThresholds] = useState(true);

  const filters: Filters | null = useMemo(() => {
    if (!startDate || !endDate) return null;
    return {
      municipalities,
      startDate: startDate.format('YYYY-MM-DD'),
      endDate: endDate.format('YYYY-MM-DD'),
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
              <Col span={24}>
                <ChartContainer>
                  <h4>{t('Forecast Trend for Dengue')}</h4>
                  <DiseaseTrendChart
                    filters={filters}
                    level={level}
                    disease="Dengue"
                    showThresholds={showThresholds}
                  />
                </ChartContainer>
              </Col>
              <Col span={24}>
                <ChartContainer>
                  <h4>{t('Forecast Trend for Diarrhea')}</h4>
                  <DiseaseTrendChart
                    filters={filters}
                    level={level}
                    disease="Diarrhea"
                    showThresholds={showThresholds}
                  />
                </ChartContainer>
              </Col>
            </Row>
          ) : (
            <Loading />
          )}
        </div>
      </div>
    </TrendlinesContainer>
  );
};

export default Trendlines; 