import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Modal, Form, Input } from 'antd';
import { SupersetClient, t, useTheme, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { AsyncSelect } from 'src/components';
import { getClientErrorObject } from '@superset-ui/core';
import rison from 'rison';
import { SelectValue, LabeledValue as AntLabeledValue } from 'antd/lib/select';
import { Bulletin } from './types';
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

interface EditBulletinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bulletin: Bulletin | null;
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

export default function EditBulletinModal({
  visible,
  onClose,
  onSuccess,
  bulletin,
}: EditBulletinModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedChart, setSelectedChart] = useState<ChartOption | null>(null);
  const { addSuccessToast, addDangerToast } = useToasts();
  const theme = useTheme();

  // Initialize form with bulletin data when the modal becomes visible or bulletin changes
  useEffect(() => {
    if (visible && bulletin) {
      form.setFieldsValue({
        title: bulletin.title,
        advisory: bulletin.advisory,
        risks: bulletin.risks,
        safety_tips: bulletin.safety_tips,
        hashtags: bulletin.hashtags,
        chart_id: bulletin.chart_id
      });

      // If bulletin has a chart, set it as selected
      if (bulletin.chart_id) {
        // Load chart details to display it correctly
        const loadChartDetails = async () => {
          try {
            const response = await SupersetClient.get({
              endpoint: `/api/v1/chart/${bulletin.chart_id}`,
            });
            
            const chart = response.json;
            const chartOption = {
              value: chart.id,
              label: chart.slice_name,
              thumbnail_url: chart.thumbnail_url,
            };
            
            setSelectedChart(chartOption);
          } catch (error) {
            console.error('Failed to load chart details:', error);
          }
        };
        
        loadChartDetails();
      } else {
        setSelectedChart(null);
      }
    }
  }, [visible, bulletin]);

  const handleChartSelect = (value: SelectValue, option: any) => {
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

  const selectRef = useRef(null);

  const handleSubmit = async () => {
    if (!bulletin) return;
    
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
      
      await SupersetClient.put({
        endpoint: `/api/v1/bulletins_and_advisories/${bulletin.id}`,
        jsonPayload: payload,
      });
      
      addSuccessToast(t('Bulletin updated successfully'));
      onSuccess();
    } catch (error) {
      console.log(error);
      const errorMessage = await getClientErrorObject(error);
      // Format error message to ensure it's a string
      let errorText = t('Failed to update bulletin');
      if (errorMessage.message && typeof errorMessage.message === 'string') {
        errorText = errorMessage.message;
      } else if (errorMessage.message && typeof errorMessage.message === 'object') {
        // Handle nested error messages
        errorText = Object.entries(errorMessage.message)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('. ');
      }
      addDangerToast(errorText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('Edit Bulletin')}
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