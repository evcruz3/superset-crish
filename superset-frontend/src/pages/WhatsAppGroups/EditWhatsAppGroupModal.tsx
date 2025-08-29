import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, notification } from 'antd';
import { SupersetClient, t } from '@superset-ui/core';
import { WhatsAppGroup } from './types'; // Updated import

interface EditWhatsAppGroupModalProps {
  whatsAppGroup: WhatsAppGroup | null; // Updated prop name
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  addSuccessToast: (msg: string) => void;
}

const EditWhatsAppGroupModal: React.FC<EditWhatsAppGroupModalProps> = ({
  whatsAppGroup,
  visible,
  onClose,
  onSuccess,
  addSuccessToast,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (whatsAppGroup) {
      form.setFieldsValue({
        name: whatsAppGroup.name,
        description: whatsAppGroup.description,
        phone_numbers: whatsAppGroup.phone_numbers, // Updated field name
      });
    } else {
      form.resetFields();
    }
  }, [whatsAppGroup, form, visible]);

  const handleSubmit = async () => {
    if (!whatsAppGroup) return;

    try {
      const values = await form.validateFields();
      setIsLoading(true);
      const response = await SupersetClient.put({
        endpoint: `/api/v1/whatsapp_groups/${whatsAppGroup.id}`, // Updated endpoint
        jsonPayload: values,
      });
      setIsLoading(false);
      // Check if response.json itself or response.json.result has an id (common patterns for FAB API responses)
      if (response.json?.id || response.json?.result?.id) {
        onSuccess();
        addSuccessToast(
          t('Successfully updated WhatsApp group: %s', values.name),
        );
      } else {
        throw new Error(
          response.json.message || 'Failed to update WhatsApp group',
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = t(
        'An error occurred while updating the WhatsApp group.',
      );
      if (error.response?.body?.message) {
        errorMessage = error.response.body.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      notification.error({
        message: t('Error'),
        description: errorMessage,
      });
      console.error('Update WhatsApp Group Error:', error);
    }
  };

  if (!whatsAppGroup) return null;

  return (
    <Modal
      title={t('Edit WhatsApp Group: %s', whatsAppGroup.name)} // Updated title
      visible={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isLoading}
      footer={[
        <Button key="back" onClick={onClose} disabled={isLoading}>
          {t('Cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={isLoading}
          onClick={handleSubmit}
        >
          {t('Update')}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" name="editWhatsAppGroupForm">
        <Form.Item
          name="name"
          label={t('Group Name')}
          rules={[
            { required: true, message: t('Please input the group name!') },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="description" label={t('Description')}>
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item
          name="phone_numbers" // Updated field name
          label={t('Phone Numbers')} // Updated label
          rules={[
            {
              required: true,
              message: t('Please input at least one phone number!'),
            },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                const numbersArray = value
                  .split(',')
                  .map((n: string) => n.trim());
                const invalidNumbers = numbersArray.filter(
                  (n: string) => n.length === 0,
                );
                if (
                  invalidNumbers.length > 0 &&
                  numbersArray.length === invalidNumbers.length
                ) {
                  return Promise.reject(
                    new Error(t('Please provide valid phone numbers.')),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
          tooltip={t(
            'Enter phone numbers, separated by commas (e.g., +1234567890, +0987654321).',
          )}
        >
          <Input.TextArea
            rows={3}
            placeholder={t('+1234567890, +0987654321')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditWhatsAppGroupModal;
