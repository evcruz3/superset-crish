import React, { useState } from 'react';
import { Modal, Form, Input, Upload, Button } from 'antd';
import { SupersetClient, t } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { getClientErrorObject } from '@superset-ui/core';
import { UploadOutlined } from '@ant-design/icons';
import { RcFile } from 'antd/lib/upload';
import { CreatePublicEducationPayload } from './types';

interface CreatePublicEducationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_FILES = 3;
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export default function CreatePublicEducationModal({
  visible,
  onClose,
  onSuccess,
}: CreatePublicEducationModalProps) {
  const [form] = Form.useForm<CreatePublicEducationPayload>();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<RcFile[]>([]);
  const { addSuccessToast, addDangerToast } = useToasts();

  const handleBeforeUpload = (file: RcFile) => {
    const isAllowedType = ALLOWED_FILE_TYPES.includes(file.type);
    if (!isAllowedType) {
      addDangerToast(t('Only PDF and image files are allowed'));
      return false;
    }

    const isLessThan5MB = file.size <= MAX_FILE_SIZE;
    if (!isLessThan5MB) {
      addDangerToast(t('File must be smaller than 5MB'));
      return false;
    }

    if (fileList.length >= MAX_FILES) {
      addDangerToast(t('Maximum of 3 files allowed'));
      return false;
    }

    setFileList([...fileList, file]);
    return false; // Prevent auto upload
  };

  const handleRemove = (file: RcFile) => {
    const index = fileList.indexOf(file);
    const newFileList = fileList.slice();
    newFileList.splice(index, 1);
    setFileList(newFileList);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('message', values.message);
      formData.append('hashtags', values.hashtags);
      fileList.forEach(file => {
        formData.append('attachments', file);
      });

      // Debug logging
      console.log('Form values:', values);
      console.log('Files:', fileList);
      for (const pair of formData.entries()) {
        console.log('FormData entry:', pair[0], pair[1]);
      }

      await SupersetClient.post({
        endpoint: '/api/v1/public_education/create/',
        postPayload: formData,
      });
      
      addSuccessToast(t('Post created successfully'));
      form.resetFields();
      setFileList([]);
      onSuccess();
    } catch (error) {
      const errorMessage = await getClientErrorObject(error);
      addDangerToast(errorMessage.message || t('Failed to create post'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={t('Create New Public Education Post')}
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={800}
    >
      <Form<CreatePublicEducationPayload> form={form} layout="vertical">
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
          label={t('Attachments')}
          help={t('Upload up to 3 PDF or image files (max 5MB each)')}
        >
          <Upload
            beforeUpload={handleBeforeUpload}
            onRemove={handleRemove}
            fileList={fileList}
            multiple
            accept={ALLOWED_FILE_TYPES.join(',')}
          >
            <Button 
              icon={<UploadOutlined />}
              disabled={fileList.length >= MAX_FILES}
            >
              {t('Upload File')}
            </Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
} 