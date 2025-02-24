import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Form, Input } from 'antd';
import { SupersetClient, t, useTheme, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { AsyncSelect } from 'src/components';
import { getClientErrorObject } from '@superset-ui/core';
import rison from 'rison';
import { SelectValue, LabeledValue as AntLabeledValue } from 'antd/lib/select';
import { CreateBulletinPayload } from './types';
import styled from 'styled-components';
import ImageLoader from 'src/components/ListViewCard/ImageLoader';

const ThumbnailPreview = styled.div`
  margin-top: 16px;
  text-align: center;
  height: 200px;
  position: relative;
  
  .gradient-container {
    position: relative;
    height: 100%;
  }
`;

interface CreateBulletinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ChartOption {
  value: number;
  label: string;
  thumbnail_url?: string;
}

// Use Ant Design's types for the select values
type SelectLabeledValue = AntLabeledValue & {
  value: number;
  thumbnail_url?: string;
};

export default function CreateBulletinModal({
  visible,
  onClose,
  onSuccess,
}: CreateBulletinModalProps) {
  const [form] = Form.useForm<CreateBulletinPayload>();
  const [loading, setLoading] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartOption | null>(null);
  const { addSuccessToast, addDangerToast } = useToasts();
  const theme = useTheme();

  const handleChartSelect = (value: SelectValue, option: any) => {
    console.log('handleChartSelect called with:', { value, option });
    
    if (!value || typeof value === 'string') {
      setSelectedChart(null);
      form.setFieldsValue({ 
        chart_id: null
      });
      return;
    }

    const labeledValue = value as SelectLabeledValue;
    const chartId = Number(labeledValue.value);
    
    const selectedValue = {
      value: chartId,
      label: labeledValue.label as string,
      thumbnail_url: option?.thumbnail_url
    };
    
    setSelectedChart(selectedValue);
    form.setFieldsValue({ 
      chart_id: chartId
    });
  };

  const loadChartOptions = useMemo(() => async (search: string, page: number, pageSize: number) => {
    console.log('loadChartOptions called with:', { search, page, pageSize });
    const query = rison.encode_uri({
      filters: search ? [{ col: 'slice_name', opr: 'ct', value: search }] : [],
      order_column: 'changed_on_delta_humanized',
      order_direction: 'desc',
      page,
      page_size: pageSize,
    });
    
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${query}`,
      });
      
      const { result, count } = response.json;
      const mappedData = result.map((chart: any) => ({
        value: String(chart.id),
        label: chart.slice_name,
        thumbnail_url: chart.thumbnail_url,
      }));
      
      return {
        data: mappedData,
        totalCount: count,
      };
    } catch (error) {
      console.error('Failed to load charts:', error);
      addDangerToast(t('Failed to load charts'));
      return {
        data: [],
        totalCount: 0,
      };
    }
  }, [addDangerToast]);

  // Remove the debug effects that might cause unnecessary re-renders
  const selectRef = useRef(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const payload = {
        title: values.title || '',
        advisory: values.advisory || '',
        risks: values.risks || '',
        safety_tips: values.safety_tips || '',
        hashtags: values.hashtags || '',
        chart_id: values.chart_id
      };
      
      await SupersetClient.post({
        endpoint: '/api/v1/bulletins_and_advisories/',
        jsonPayload: payload,
      });
      
      addSuccessToast(t('Bulletin created successfully'));
      form.resetFields();
      setSelectedChart(null);
      onSuccess();
    } catch (error) {
      console.log(error);
      const errorMessage = await getClientErrorObject(error);
      addDangerToast(errorMessage.message || t('Failed to create bulletin'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('Create New Bulletin')}
      visible={visible}
      onCancel={onClose}
      confirmLoading={loading}
      onOk={handleSubmit}
      width={800}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label={t('Title')}
          rules={[{ required: true, message: t('Title is required') }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="advisory"
          label={t('Advisory')}
          rules={[{ required: true, message: t('Advisory is required') }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item
          name="risks"
          label={t('Risks')}
          rules={[{ required: true, message: t('Risks are required') }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item
          name="safety_tips"
          label={t('Safety Tips')}
          rules={[{ required: true, message: t('Safety tips are required') }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item
          name="hashtags"
          label={t('Hashtags')}
          rules={[{ required: true, message: t('At least one hashtag is required') }]}
          help={t('Separate multiple hashtags with commas')}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="chart_id"
          label={t('Associated Chart')}
          getValueFromEvent={(val: SelectValue) => {
            if (!val || typeof val === 'string') return null;
            const labeledValue = val as SelectLabeledValue;
            return Number(labeledValue.value);
          }}
        >
          <AsyncSelect
            ref={selectRef}
            allowClear
            showSearch
            labelInValue
            placeholder={t('Select a chart')}
            onChange={handleChartSelect}
            options={loadChartOptions}
            value={selectedChart ? {
              value: String(selectedChart.value),
              label: selectedChart.label
            } : undefined}
            dropdownRender={menu => menu}
          />
        </Form.Item>

        {selectedChart?.thumbnail_url && (
          <ThumbnailPreview>
            <ImageLoader
              src={selectedChart.thumbnail_url}
              fallback="/static/assets/images/chart-card-fallback.svg"
              isLoading={false}
              position="top"
            />
          </ThumbnailPreview>
        )}
      </Form>
    </Modal>
  );
} 