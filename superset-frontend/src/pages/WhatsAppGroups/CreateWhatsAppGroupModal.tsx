import { useState } from 'react';
import { Modal, Form, Input, Button, notification } from 'antd';
import { SupersetClient, t } from '@superset-ui/core';

interface CreateWhatsAppGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  addSuccessToast: (msg: string) => void;
}

const CreateWhatsAppGroupModal: React.FC<CreateWhatsAppGroupModalProps> = ({
  visible,
  onClose,
  onSuccess,
  addSuccessToast,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setIsLoading(true);
      const response = await SupersetClient.post({
        endpoint: '/api/v1/whatsapp_groups/', // Updated endpoint
        jsonPayload: values,
      });
      setIsLoading(false);
      if (response.json.id) {
        addSuccessToast(
          t('Successfully created WhatsApp group: %s', values.name),
        );
        onSuccess();
        form.resetFields();
      } else {
        throw new Error(
          response.json.message || 'Failed to create WhatsApp group',
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = t(
        'An error occurred while creating the WhatsApp group.',
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
      console.error('Create WhatsApp Group Error:', error);
    }
  };

  return (
    <Modal
      title={t('Create New WhatsApp Group')} // Updated title
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
          {t('Create')}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical" name="createWhatsAppGroupForm">
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
            // Basic validation: checks if there are non-empty, comma-separated values.
            // More robust phone number validation (e.g., E.164 format) could be added here.
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
                  // if all entries after split are empty
                  return Promise.reject(
                    new Error(t('Please provide valid phone numbers.')),
                  );
                }
                // Example of a simple check for plus sign if desired, but can be too restrictive
                // const formattedNumbers = numbersArray.filter((n: string) => n.length > 0 && !n.startsWith('+'));
                // if (formattedNumbers.length > 0) {
                //   return Promise.reject(new Error(t('Phone numbers should ideally start with a + and country code.')));
                // }
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

export default CreateWhatsAppGroupModal;
