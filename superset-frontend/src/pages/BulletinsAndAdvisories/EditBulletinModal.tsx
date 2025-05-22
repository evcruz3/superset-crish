import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Form, Input, Button, Upload, Alert, Spin, Select as AntdSelect, Card } from 'antd';
import { UploadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { SupersetClient, t, JsonObject } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { AsyncSelect } from 'src/components';
import { Bulletin, ImageAttachment } from './types';
import type { UploadFile, UploadChangeParam } from 'antd/es/upload/interface';
import rison from 'rison';
import { LabeledValue } from 'antd/lib/select';

interface EditBulletinModalProps {
  isOpen: boolean;
  toggle: () => void;
  bulletin: Bulletin | null;
  onBulletinUpdated: (bulletin: Bulletin) => void;
}

interface ChartRecord {
  id: number;
  slice_name: string;
}

// For antd AsyncSelect value
interface ChartOption extends LabeledValue {
  value: number;
  label: React.ReactNode;
}

// State for managing individual attachments in the form
interface EditableAttachmentState {
  uid: string; // Unique ID for antd Upload key and state management
  id?: number; // DB ID for existing attachments
  s3_key?: string;
  caption: string;
  file?: File; // For new uploads
  fileList: UploadFile[]; // For antd Upload component
  previewUrl?: string; // URL for preview (either existing from DB or ObjectURL for new files)
  isNew: boolean;
}

const EditBulletinModal: React.FC<EditBulletinModalProps> = ({
  isOpen,
  toggle,
  bulletin,
  onBulletinUpdated,
}) => {
  const [form] = Form.useForm();
  const { addSuccessToast, addDangerToast } = useToasts();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageAttachments, setImageAttachments] = useState<EditableAttachmentState[]>([]);
  const [isChartSelectorModalOpen, setIsChartSelectorModalOpen] = useState(false);
  const [selectedChartForThumbnail, setSelectedChartForThumbnail] = useState<LabeledValue | null>(null);
  const [chartThumbnailPreviewUrl, setChartThumbnailPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const mapImageAttachmentToState = (attachment: ImageAttachment): EditableAttachmentState => ({
    uid: String(attachment.id), // Use DB ID as UID for existing attachments
    id: attachment.id,
    s3_key: attachment.s3_key,
    caption: attachment.caption || '',
    previewUrl: attachment.url, // This is the presigned URL from backend
    fileList: attachment.url ? [{
      uid: String(attachment.id),
      name: attachment.s3_key?.split('/').pop() || 'image',
      status: 'done',
      url: attachment.url,
      size: 0, // Add dummy size
      type: 'image/jpeg', // Add dummy type
    }] : [],
    isNew: false,
  });

  useEffect(() => {
    if (isOpen && bulletin) {
      setIsFetchingDetails(true);
      setError(null);
      SupersetClient.get({
        endpoint: `/api/v1/bulletins_and_advisories/${bulletin.id}`,
      })
        .then(response => {
          const detailedBulletin = response.json.result as Bulletin;
          form.setFieldsValue({
            title: detailedBulletin.title,
            advisory: detailedBulletin.advisory,
            risks: detailedBulletin.risks,
            safety_tips: detailedBulletin.safety_tips,
            hashtags: detailedBulletin.hashtags || '',
          });

          const existingAttachments = (detailedBulletin.image_attachments || []).map(mapImageAttachmentToState);
          setImageAttachments(existingAttachments);
        })
        .catch(err => {
          console.error('Error fetching bulletin details:', err);
          setError(t('Failed to load bulletin details.'));
          addDangerToast(t('Failed to load bulletin details.'));
        })
        .finally(() => {
          setIsFetchingDetails(false);
          setIsChartSelectorModalOpen(false);
          setSelectedChartForThumbnail(null);
          setChartThumbnailPreviewUrl(null);
          setIsPreviewLoading(false);
        });
    } else if (!isOpen) {
      // Reset form when modal is closed
      form.resetFields();
      setImageAttachments([]);
      setError(null);
      setIsLoading(false);
      setIsFetchingDetails(false);
      setIsChartSelectorModalOpen(false);
      setSelectedChartForThumbnail(null);
      setChartThumbnailPreviewUrl(null);
      setIsPreviewLoading(false);
    }
  }, [isOpen, bulletin, form, addDangerToast]);

  const handleAddAttachmentField = () => {
    const newUid = `new_${Date.now()}`;
    setImageAttachments([...imageAttachments, { 
      uid: newUid, 
      caption: '', 
      fileList: [], 
      isNew: true 
    }]);
  };

  const handleRemoveAttachment = (index: number) => {
    const attachmentToRemove = imageAttachments[index];
    // If it's a new file preview, revoke its ObjectURL
    if (attachmentToRemove.isNew && attachmentToRemove.previewUrl && attachmentToRemove.fileList.length > 0) {
      URL.revokeObjectURL(attachmentToRemove.previewUrl);
    }
    const newAttachments = imageAttachments.filter((_, i) => i !== index);
    setImageAttachments(newAttachments);
  };

  const handleFileChange = (index: number, info: UploadChangeParam<UploadFile>) => {
    const newAttachments = [...imageAttachments];
    const currentAttachment = newAttachments[index];

    // If there was an old preview URL for a *new* file, revoke it
    if (currentAttachment.isNew && currentAttachment.previewUrl && currentAttachment.fileList.length > 0) {
       URL.revokeObjectURL(currentAttachment.previewUrl);
    }

    currentAttachment.fileList = [...info.fileList];
    currentAttachment.caption = ''; // Clear caption regardless of action

    if (info.fileList.length > 0 && info.fileList[0].originFileObj) {
      currentAttachment.file = info.fileList[0].originFileObj as File;
      currentAttachment.previewUrl = URL.createObjectURL(info.fileList[0].originFileObj as File);
      currentAttachment.isNew = true; // Explicitly mark as new if a new file is selected
    } else {
      // File removed from upload list
      currentAttachment.file = undefined;
      // If it was marked new and had a preview, clear it
      if (currentAttachment.isNew) {
          currentAttachment.previewUrl = undefined; 
      }
      // if it was an existing file, the original previewUrl (from s3) should remain unless explicitly cleared or replaced
    }
    setImageAttachments(newAttachments);
  };

  const handleCaptionChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const newAttachments = [...imageAttachments];
    newAttachments[index].caption = event.target.value;
    setImageAttachments(newAttachments);
  };

  const loadChartOptions = async (search: string, page: number, pageSize: number): Promise<{data: LabeledValue[], totalCount: number}> => {
    const query = rison.encode_uri({
      filters: search ? [{ col: 'slice_name', opr: 'ct', value: search }] : [],
      page,
      page_size: pageSize,
    });
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=${query}`,
      });
      const chartData = response.json.result as ChartRecord[];
      const chartCount = response.json.count as number;
      return {
        data: chartData.map((chart: ChartRecord) => ({
          value: chart.id,
          label: chart.slice_name,
          key: String(chart.id),
        })),
        totalCount: chartCount,
      };
    } catch (err) {
      console.error('Error loading charts for edit:', err);
      addDangerToast(t('Error loading charts'));
      return { data: [], totalCount: 0 };
    }
  };

  const handleSubmit = async () => {
    if (!bulletin) return;
    try {
      const values = await form.validateFields();
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('advisory', values.advisory);
      formData.append('risks', values.risks);
      formData.append('safety_tips', values.safety_tips);
      formData.append('hashtags', values.hashtags || '');
      
      let newFileIndex = 0;
      let existingFileIndex = 0;
      imageAttachments.forEach(attachment => {
        if (attachment.isNew && attachment.file) {
          formData.append(`image_attachment_file_${newFileIndex}`, attachment.file);
          formData.append(`image_caption_${newFileIndex}`, attachment.caption);
          newFileIndex++;
        } else if (!attachment.isNew && attachment.id) {
          // This is an existing attachment that we are keeping (or just updating its caption)
          formData.append(`existing_attachment_id_${existingFileIndex}`, String(attachment.id));
          formData.append(`existing_attachment_caption_${existingFileIndex}`, attachment.caption);
          existingFileIndex++;
        }
      });

      const response = await SupersetClient.put({
        endpoint: `/api/v1/bulletins_and_advisories/${bulletin.id}`,
        body: formData, 
        headers: {},
      });
      
      const updatedBulletin = response.json.result as Bulletin;
      addSuccessToast(t('Bulletin updated successfully!'));
      onBulletinUpdated(updatedBulletin);
      toggle();
    } catch (error: any) {
      console.error('Error updating bulletin:', error);
      const detailedMessage = error.response?.data?.message || error.message || t('Failed to update bulletin.');
      setError(detailedMessage);
      addDangerToast(detailedMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    // Resetting is handled by useEffect on isOpen changing to false
    toggle();
  };

  const handleChartSelectedAsAttachment = async (option: LabeledValue | undefined) => {
    if (option && option.value) {
      const chartId = option.value as number;
      const chartName = option.label as string;
      try {
        addSuccessToast(t('Fetching chart thumbnail... This may take a moment.'), { duration: 2000 }); // Temporary toast for user feedback
        // Fetch chart details to get the digest for the thumbnail URL
        const chartDetailsResponse = await SupersetClient.get({
          endpoint: `/api/v1/chart/${chartId}`,
        });
        const chartResult = chartDetailsResponse.json.result;
        const digest = chartResult.digest; 

        if (!digest) {
          addDangerToast(t('Could not retrieve chart digest for thumbnail.'));
          return;
        }

        const thumbnailUrl = `/api/v1/chart/${chartId}/thumbnail/${digest}/?force=true`; // Added force=true to try and ensure image is available

        // Fetch the thumbnail image
        const response = await fetch(thumbnailUrl);
        if (!response.ok) {
           // Try to trigger async generation if it was 202
           if(response.status === 202) {
             addSuccessToast(t('Thumbnail is generating. Please try adding it again in a few moments.'), { duration: 5000 });
             return;
           }
          throw new Error(t('Failed to fetch chart thumbnail image. Status: ') + response.status);
        }
        const imageBlob = await response.blob();
        const fileName = `${chartName.replace(/[^a-zA-Z0-9]/g, '_')}_thumbnail.png`;
        const imageFile = new File([imageBlob], fileName, { type: imageBlob.type || 'image/png' });

        const newUid = `chart_thumb_${chartId}_${Date.now()}`;
        const newAttachment: EditableAttachmentState = {
          uid: newUid,
          file: imageFile,
          caption: chartName, 
          fileList: [{
            uid: `chart_thumb_file_${chartId}_${Date.now()}`,
            name: fileName,
            status: 'done',
            originFileObj: imageFile,
            url: URL.createObjectURL(imageFile), 
            size: imageFile.size,
            type: imageFile.type,
          }],
          isNew: true,
          previewUrl: URL.createObjectURL(imageFile), // Set previewUrl for the new attachment
        };

        setImageAttachments(prevAttachments => [...prevAttachments, newAttachment]);
        addSuccessToast(t('Chart thumbnail added as an image attachment.'));

      } catch (err) {
        console.error('Error fetching chart thumbnail for edit modal:', err);
        addDangerToast(t('Failed to add chart thumbnail as attachment. ') + (err instanceof Error ? err.message : ''));
      }
    }
  };

  if (!isOpen && !bulletin) {
    return null; // Don't render if not open and no bulletin (avoids issues on initial hide)
  }

  return (
    <>
      <Modal
        title={t('Edit Bulletin')}
        visible={isOpen}
        onCancel={handleModalClose}
        onOk={handleSubmit}
        confirmLoading={isLoading || isFetchingDetails}
        destroyOnClose // This handles resetting form state and antd component states like Upload
        width={800}
        footer={[
          <Button key="back" onClick={handleModalClose} disabled={isFetchingDetails}>
            {t('Cancel')}
          </Button>,
          <Button key="submit" type="primary" loading={isLoading || isFetchingDetails} onClick={handleSubmit} disabled={isFetchingDetails}>
            {t('Save Changes')}
          </Button>,
        ]}
      >
        {isFetchingDetails ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <Spin size="large" />
            <p>{t('Loading bulletin details...')}</p>
          </div>
        ) : (
          <>
            {error && <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} className="mb-3" />}
            <Form form={form} layout="vertical" name="edit_bulletin_form">
              <Form.Item
                name="title"
                label={t('Title')}
                rules={[{ required: true, message: t('Title is required') }]}
              >
                <Input maxLength={500} />
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
                rules={[{ required: true, message: t('Safety Tips are required') }]}
              >
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item name="hashtags" label={t('Hashtags (comma-separated)')}>
                <Input maxLength={500} />
              </Form.Item>

              <Form.Item label={t('Image Attachments')}>
                {imageAttachments.map((attachment, index) => (
                  <Card
                    key={attachment.uid}
                    title={`${attachment.isNew ? t('New Image Attachment') : t('Existing Image')} ${index + 1}`}
                    className="mb-3"
                    extra={
                      <Button
                        icon={<DeleteOutlined />}
                        danger
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        {t('Remove Block')}
                      </Button>
                    }
                  >
                    <Form.Item label={attachment.isNew ? t('Select Image File') : t('Current Image File')}>
                      {attachment.previewUrl && (
                          <div className="mb-2">
                              <img
                                  src={attachment.previewUrl}
                                  alt={attachment.caption || 'Preview'}
                                  style={{ maxHeight: '250px', width: 'auto', display: 'block', marginBottom: '10px', border: '1px solid #f0f0f0' }}
                              />
                          </div>
                      )}
                      <Upload
                        name={`image_file_${index}`}
                        listType="picture"
                        fileList={attachment.fileList} // Controlled by state
                        beforeUpload={() => false} // We handle upload via FormData
                        onChange={(info) => handleFileChange(index, info)}
                        showUploadList={{ showRemoveIcon: false }} // Explicitly hide the remove icon
                        maxCount={1}
                      >
                        <Button icon={<UploadOutlined />}>
                          {attachment.isNew || !attachment.s3_key ? t('Select Image') : t('Replace Image')}
                        </Button>
                      </Upload>
                      {!attachment.isNew && attachment.s3_key && (
                          <small className="text-muted"> {t('Current filename:')} {attachment.s3_key.split('/').pop()}</small>
                      )}
                    </Form.Item>
                    <Form.Item label={`${t('Image Caption')} ${index + 1}`}>
                      <Input
                        value={attachment.caption}
                        onChange={(e) => handleCaptionChange(index, e)}
                        placeholder={t('Enter caption for the image')}
                      />
                    </Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={handleAddAttachmentField}
                  icon={<PlusOutlined />}
                  style={{ marginTop: '10px', marginRight: '10px' }}
                >
                  {t('Add File Attachment')}
                </Button>
                <Button
                  type="dashed"
                  onClick={() => setIsChartSelectorModalOpen(true)}
                  icon={<PlusOutlined />}
                  style={{ marginTop: '10px'}}
                >
                  {t('Add Chart Thumbnail')}
                </Button>
              </Form.Item>
              <div style={{ fontSize: '0.8em', color: 'gray', marginTop: '20px' }}>
                  {t('Fields marked with an asterisk (*) are required.')}
              </div>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        title={t('Select Chart for Thumbnail')}
        visible={isChartSelectorModalOpen}
        onOk={() => {
          if (selectedChartForThumbnail) {
            handleChartSelectedAsAttachment(selectedChartForThumbnail);
          }
          setIsChartSelectorModalOpen(false);
          setSelectedChartForThumbnail(null);
          setChartThumbnailPreviewUrl(null);
          setIsPreviewLoading(false);
        }}
        onCancel={() => {
          setIsChartSelectorModalOpen(false);
          setSelectedChartForThumbnail(null);
          setChartThumbnailPreviewUrl(null);
          setIsPreviewLoading(false);
        }}
        confirmLoading={isLoading || isFetchingDetails}
        okButtonProps={{ disabled: !selectedChartForThumbnail || isLoading || isFetchingDetails }}
        destroyOnClose
      >
        <div style={{ width: '100%' }}>
          <AsyncSelect
            allowClear
            labelInValue
            value={selectedChartForThumbnail || undefined}
            onChange={async (value: any) => {
              setSelectedChartForThumbnail(value as LabeledValue | null);
              if (value && value.value) {
                setIsPreviewLoading(true);
                setChartThumbnailPreviewUrl(null);
                try {
                  const chartId = value.value as number;
                  const chartDetailsResponse = await SupersetClient.get({
                    endpoint: `/api/v1/chart/${chartId}`,
                  });
                  const chartResult = chartDetailsResponse.json.result;
                  const digest = chartResult.digest;
                  if (digest) {
                    setChartThumbnailPreviewUrl(`/api/v1/chart/${chartId}/thumbnail/${digest}/?force=true`);
                  } else {
                    addDangerToast(t('Could not retrieve chart digest for thumbnail preview.'));
                    setChartThumbnailPreviewUrl(null);
                  }
                } catch (err) {
                  console.error('Error fetching chart details for preview (Edit Modal):', err);
                  addDangerToast(t('Failed to load chart thumbnail preview.'));
                  setChartThumbnailPreviewUrl(null);
                } finally {
                  setIsPreviewLoading(false);
                }
              } else {
                setChartThumbnailPreviewUrl(null);
                setIsPreviewLoading(false);
              }
            }}
            options={loadChartOptions}
            placeholder={t('Search for a chart')}
          />
        </div>
        {isPreviewLoading && <div style={{ textAlign: 'center', margin: '10px' }}><Spin /> <p>{t('Loading preview...')}</p></div>}
        {chartThumbnailPreviewUrl && !isPreviewLoading && (
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <img 
              src={chartThumbnailPreviewUrl} 
              alt={t('Chart thumbnail preview')} 
              style={{ maxWidth: '100%', maxHeight: '200px', border: '1px solid #f0f0f0' }} 
              onError={() => {
                addDangerToast(t('Thumbnail image not available or still generating. Try adding the chart to see if it becomes available.'));
                setChartThumbnailPreviewUrl(null);
              }}
            />
          </div>
        )}
        {!isPreviewLoading && !chartThumbnailPreviewUrl && selectedChartForThumbnail && (
          <div style={{ marginTop: '15px', textAlign: 'center', color: 'grey' }}>
            {t('No preview available or chart has no thumbnail.')}
          </div>
        )}
      </Modal>
    </>
  );
};

export default EditBulletinModal; 