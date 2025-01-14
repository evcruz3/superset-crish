import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { SupersetClient, t, useTheme, isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { AsyncSelect } from 'src/components';
import { getClientErrorObject } from '@superset-ui/core';
import rison from 'rison';
import { SelectValue } from 'antd/lib/select';
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

  const loadChartOptions = useMemo(
    () =>
      async (search: string, page: number, pageSize: number) => {
        const query = rison.encode_uri({
          filters: search ? [{ col: 'slice_name', opr: 'ct', value: search }] : [],
          page,
          page_size: pageSize,
          order_column: 'changed_on_delta_humanized',
          order_direction: 'desc',
        });
        
        try {
          const response = await SupersetClient.get({
            endpoint: `/api/v1/chart/?q=${query}`,
          });
          
          const { result, count } = response.json;
          const data = result.map((chart: any) => ({
            value: chart.id,
            label: chart.slice_name,
            thumbnail_url: chart.thumbnail_url,
          }));
          
          return {
            data,
            totalCount: count,
          };
        } catch (error) {
          addDangerToast(t('Failed to load charts'));
          return { data: [], totalCount: 0 };
        }
      },
    [addDangerToast],
  );

  const handleChartSelect = (value: any, option: ChartOption | null) => {
    setSelectedChart(option);
    // Extract the numeric value if we received an object
    const chartId = typeof value === 'object' ? value.value : value;
    form.setFieldsValue({ chartId: chartId });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      // Get the current chart ID from the form and ensure it's a number
      const currentChartId = form.getFieldValue('chartId');
      const chartId = typeof currentChartId === 'object' ? currentChartId.value : currentChartId;
      
      const payload = {
        ...values,
        chartId: chartId ? Number(chartId) : null,
        message: values.message || '',
        title: values.title || '',
        hashtags: values.hashtags || ''
      };
      
      await SupersetClient.post({
        endpoint: '/api/v1/bulletins_and_advisories/create/',
        jsonPayload: payload,
      });
      
      addSuccessToast(t('Bulletin created successfully'));
      form.resetFields();
      setSelectedChart(null);
      onSuccess();
    } catch (error) {
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
      onOk={handleSubmit}
      confirmLoading={loading}
      width={800}
    >
      <Form<CreateBulletinPayload> form={form} layout="vertical">
        <Form.Item
          name="title"
          label={t('Title')}
          rules={[{ required: true, message: t('Title is required') }]}
        >
          <Input />
        </Form.Item>
        
        <Form.Item
          name="message"
          label={t('Message')}
          rules={[{ required: true, message: t('Message is required') }]}
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
          name="chartId"
          label={t('Associated Chart')}
        >
          <AsyncSelect
            name="chart"
            value={form.getFieldValue('chartId')}
            options={loadChartOptions}
            placeholder={t('Select a chart')}
            showSearch
            filterOption={false}
            allowClear
            onChange={handleChartSelect}
            onClear={() => {
              setSelectedChart(null);
              form.setFieldsValue({ chartId: null });
            }}
          />
        </Form.Item>

        {selectedChart?.thumbnail_url && isFeatureEnabled(FeatureFlag.Thumbnails) && (
          <ThumbnailPreview>
            <div className="gradient-container">
              <ImageLoader
                src={selectedChart.thumbnail_url}
                fallback="/static/assets/images/chart-card-fallback.svg"
                isLoading={false}
                position="top"
              />
            </div>
          </ThumbnailPreview>
        )}
      </Form>
    </Modal>
  );
} 