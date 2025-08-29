import { Select } from 'antd';
import { t } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { ChartsState } from 'src/dashboard/types';

interface ChartSelectProps {
  value?: number;
  onChange?: (value: number) => void;
}

export default function ChartSelect({ value, onChange }: ChartSelectProps) {
  const charts = useSelector<RootState, ChartsState>(state => state.charts);

  const chartOptions = Object.values(charts).map(chart => ({
    label: chart.form_data?.viz_type || `Chart ${chart.id}`,
    value: chart.id,
  }));

  return (
    <Select
      showSearch
      placeholder={t('Select a chart')}
      value={value}
      onChange={onChange}
      options={chartOptions}
      filterOption={(input, option) =>
        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
      }
    />
  );
}
