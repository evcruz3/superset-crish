import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { SupersetClient, t, useTheme } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { AsyncSelect } from 'src/components';
import { getClientErrorObject } from '@superset-ui/core';
import rison from 'rison';
import { SelectValue } from 'antd/lib/select';
import { CreateBulletinPayload } from './types';
import styled from 'styled-components';

const ThumbnailPreview = styled.div`
  margin-top: 16px;
  text-align: center;
  
  img {
    max-width: 100%;
    max-height: 200px;
    border-radius: 4px;
    border: 1px solid #d9d9d9;
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

  const handleChartSelect = (value: any, option: any) => {
    setSelectedChart(option);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      await SupersetClient.post({
        endpoint: '/api/v1/bulletins_and_advisories/create/',
        jsonPayload: values,
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
            options={loadChartOptions}
            placeholder={t('Select a chart')}
            showSearch
            filterOption={false}
            allowClear
            onChange={handleChartSelect}
          />
        </Form.Item>

        {selectedChart?.thumbnail_url && (
          <ThumbnailPreview>
            <img
              src={selectedChart.thumbnail_url}
              alt={selectedChart.label}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/static/assets/images/chart-card-fallback.svg';
              }}
            />
          </ThumbnailPreview>
        )}
      </Form>
    </Modal>
  );
} 