import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, notification } from 'antd';
import { SupersetClient, t } from '@superset-ui/core';
import { EmailGroup } from './types';

interface EditEmailGroupModalProps {
  emailGroup: EmailGroup | null;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  addSuccessToast: (msg: string) => void;
}

const EditEmailGroupModal: React.FC<EditEmailGroupModalProps> = ({
  emailGroup,
  visible,
  onClose,
  onSuccess,
  addSuccessToast,
}) => {
  const [form] = Form.useForm();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (emailGroup) {
      form.setFieldsValue({
        name: emailGroup.name,
        description: emailGroup.description,
        emails: emailGroup.emails,
      });
    } else {
      form.resetFields();
    }
  }, [emailGroup, form, visible]); // Rerun when emailGroup or visibility changes

  const handleSubmit = async () => {
    if (!emailGroup) return;

    try {
      const values = await form.validateFields();
      setIsLoading(true);
      const response = await SupersetClient.put({
        endpoint: `/api/v1/email_groups/${emailGroup.id}`,
        jsonPayload: values,
      });
      setIsLoading(false);
      if (
        response.json &&
        (response.json.id || (response.json.result && response.json.result.id))
      ) {
        onSuccess();
        addSuccessToast(t('Successfully updated email group: %s', values.name));
      } else {
        throw new Error(
          response.json.message || 'Failed to update email group',
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = t('An error occurred while updating the email group.');
      if (
        error.response &&
        error.response.body &&
        error.response.body.message
      ) {
        errorMessage = error.response.body.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      notification.error({
        message: t('Error'),
        description: errorMessage,
      });
      console.error('Update Email Group Error:', error);
    }
  };

  if (!emailGroup) return null; // Should not happen if visible is true and emailGroup is set

  return (
    <Modal
      title={t('Edit Email Group: %s', emailGroup.name)}
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
      <Form form={form} layout="vertical" name="editEmailGroupForm">
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
          name="emails"
          label={t('Email Addresses')}
          rules={[
            {
              required: true,
              message: t('Please input at least one email address!'),
            },
            {
              validator: (_, value) => {
                if (!value) return Promise.resolve();
                const emailsArray = value
                  .split(',')
                  .map((e: string) => e.trim());
                const invalidEmails = emailsArray.filter(
                  (e: string) => !/^[\w.-]+@[\w.-]+\.\w+$/.test(e),
                );
                if (invalidEmails.length > 0) {
                  return Promise.reject(
                    new Error(
                      t(
                        'Invalid email format found: %s',
                        invalidEmails.join(', '),
                      ),
                    ),
                  );
                }
                return Promise.resolve();
              },
            },
          ]}
          tooltip={t('Enter email addresses, separated by commas.')}
        >
          <Input.TextArea
            rows={3}
            placeholder={t('user1@example.com, user2@example.com')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default EditEmailGroupModal;
