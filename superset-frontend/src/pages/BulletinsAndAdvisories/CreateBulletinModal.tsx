import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Upload,
  Alert,
  Select as AntdSelect,
  Spin,
  Card,
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { SupersetClient, t, JsonObject } from '@superset-ui/core';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { AsyncSelect } from 'src/components';
import type { UploadFile, UploadChangeParam } from 'antd/es/upload/interface';
import rison from 'rison';
import { LabeledValue } from 'antd/lib/select';
import { Bulletin } from './types';

interface CreateBulletinModalProps {
  isOpen: boolean;
  toggle: () => void;
  onBulletinCreated: (bulletin: Bulletin) => void;
  chartId?: number;
}

interface ChartRecord {
  id: number;
  slice_name: string;
}

interface ChartOption extends LabeledValue {
  value: number;
  label: React.ReactNode;
}

interface AttachmentState {
  uid: string;
  file?: File;
  caption: string;
  fileList: UploadFile[];
}

const CreateBulletinModal: React.FC<CreateBulletinModalProps> = ({
  isOpen,
  toggle,
  onBulletinCreated,
  chartId: initialChartId,
}) => {
  const [form] = Form.useForm();
  const { addSuccessToast, addDangerToast } = useToasts();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [imageAttachments, setImageAttachments] = useState<AttachmentState[]>(
    [],
  );
  const [isChartSelectorModalOpen, setIsChartSelectorModalOpen] =
    useState(false);
  const [selectedChartForThumbnail, setSelectedChartForThumbnail] =
    useState<LabeledValue | null>(null);
  const [chartThumbnailPreviewUrl, setChartThumbnailPreviewUrl] = useState<
    string | null
  >(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      form.resetFields();
      setImageAttachments([]);
      setError(null);
      setIsLoading(false);
      setIsChartSelectorModalOpen(false);
      setSelectedChartForThumbnail(null);
      setChartThumbnailPreviewUrl(null);
      setIsPreviewLoading(false);
    }
  }, [isOpen, form, addDangerToast]);

  const handleAddAttachment = () => {
    setImageAttachments([
      ...imageAttachments,
      { uid: `new_${Date.now()}`, caption: '', fileList: [] },
    ]);
  };

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...imageAttachments];
    newAttachments.splice(index, 1);
    setImageAttachments(newAttachments);
  };

  const handleFileChange = (
    index: number,
    info: UploadChangeParam<UploadFile>,
  ) => {
    const newAttachments = [...imageAttachments];
    newAttachments[index].fileList = [...info.fileList];
    if (info.fileList.length > 0 && info.fileList[0].originFileObj) {
      newAttachments[index].file = info.fileList[0].originFileObj as File;
      newAttachments[index].caption = '';
    } else {
      newAttachments[index].file = undefined;
      newAttachments[index].caption = '';
    }
    setImageAttachments(newAttachments);
  };

  const handleCaptionChange = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newAttachments = [...imageAttachments];
    newAttachments[index].caption = event.target.value;
    setImageAttachments(newAttachments);
  };

  const loadChartOptions = async (
    search: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: LabeledValue[]; totalCount: number }> => {
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
      console.error('Error loading charts:', err);
      addDangerToast(t('Error loading charts'));
      return { data: [], totalCount: 0 };
    }
  };

  const handleSubmit = async () => {
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

      imageAttachments.forEach((attachment, index) => {
        if (attachment.file) {
          formData.append(`image_attachment_file_${index}`, attachment.file);
          formData.append(`image_caption_${index}`, attachment.caption);
        }
      });

      const response = await SupersetClient.post({
        endpoint: '/api/v1/bulletins_and_advisories/',
        body: formData,
        headers: {},
      });

      const newBulletin = response.json.result as Bulletin;
      addSuccessToast(t('Bulletin created successfully!'));
      onBulletinCreated(newBulletin);
      toggle();
    } catch (error: any) {
      console.error('Error creating bulletin:', error);
      let detailedMessage = t('Failed to create bulletin.');
      if (
        error.response &&
        error.response.data &&
        error.response.data.message
      ) {
        detailedMessage = error.response.data.message;
      } else if (error.message) {
        detailedMessage = error.message;
      }
      setError(detailedMessage);
      addDangerToast(detailedMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    toggle();
  };

  const handleChartSelectedAsAttachment = async (
    option: LabeledValue | undefined,
  ) => {
    if (option && option.value) {
      const chartId = option.value as number;
      const chartName = option.label as string;
      try {
        const chartDetailsResponse = await SupersetClient.get({
          endpoint: `/api/v1/chart/${chartId}`,
        });
        const chartResult = chartDetailsResponse.json.result;
        const { digest } = chartResult;

        if (!digest) {
          addDangerToast(t('Could not retrieve chart digest for thumbnail.'));
          return;
        }

        const thumbnailUrl = `/api/v1/chart/${chartId}/thumbnail/${digest}/`;

        const response = await fetch(thumbnailUrl);
        if (!response.ok) {
          throw new Error(
            t('Failed to fetch chart thumbnail image. Status: ') +
              response.status,
          );
        }
        const imageBlob = await response.blob();
        const fileName = `${chartName.replace(/[^a-zA-Z0-9]/g, '_')}_thumbnail.png`;
        const imageFile = new File([imageBlob], fileName, {
          type: imageBlob.type || 'image/png',
        });

        const newAttachment: AttachmentState = {
          uid: `chart_thumb_${chartId}_${Date.now()}`,
          file: imageFile,
          caption: chartName,
          fileList: [
            {
              uid: `chart_thumb_file_${chartId}_${Date.now()}`,
              name: fileName,
              status: 'done',
              originFileObj: imageFile,
              url: URL.createObjectURL(imageFile),
              size: imageFile.size,
              type: imageFile.type,
            },
          ],
        };

        setImageAttachments(prevAttachments => {
          const firstEmptyIndex = prevAttachments.findIndex(
            att => !att.file && att.caption === '' && att.fileList.length === 0,
          );
          if (
            firstEmptyIndex === 0 &&
            prevAttachments.length === 1 &&
            !prevAttachments[0].file
          ) {
            return [newAttachment];
          }
          return [...prevAttachments, newAttachment];
        });

        addSuccessToast(t('Chart thumbnail added as an image attachment.'));
      } catch (err) {
        console.error('Error fetching chart thumbnail:', err);
        addDangerToast(
          t('Failed to add chart thumbnail as attachment. ') +
            (err instanceof Error ? err.message : ''),
        );
      }
    }
  };

  return (
    <>
      <Modal
        title={t('Create New Bulletin')}
        visible={isOpen}
        onCancel={handleModalClose}
        onOk={handleSubmit}
        confirmLoading={isLoading}
        destroyOnClose
        width={800}
        footer={[
          <Button key="back" onClick={handleModalClose}>
            {t('Cancel')}
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isLoading}
            onClick={handleSubmit}
          >
            {t('Create Bulletin')}
          </Button>,
        ]}
      >
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            className="mb-3"
          />
        )}
        <Form form={form} layout="vertical" name="create_bulletin_form">
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

          <Form.Item label={t('Image Attachments (Optional)')}>
            {imageAttachments.map((attachment, index) => (
              <Card
                key={attachment.uid}
                title={`${t('Image Attachment')} ${index + 1}`}
                className="mb-3"
                extra={
                  imageAttachments.length > 0 && (
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => handleRemoveAttachment(index)}
                    >
                      {t('Remove')}
                    </Button>
                  )
                }
              >
                {attachment.fileList[0]?.url && (
                  <div className="mb-2">
                    <img
                      src={attachment.fileList[0].url}
                      alt={attachment.caption || 'Preview'}
                      style={{
                        maxHeight: '250px',
                        width: 'auto',
                        display: 'block',
                        marginBottom: '10px',
                        border: '1px solid #f0f0f0',
                      }}
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <Form.Item label={`${t('Image File')} ${index + 1}`}>
                  <Upload
                    name={`image_file_${index}`}
                    listType="picture"
                    fileList={attachment.fileList}
                    beforeUpload={() => false}
                    onChange={(info: UploadChangeParam<UploadFile>) =>
                      handleFileChange(index, info)
                    }
                    showUploadList={{ showRemoveIcon: false }}
                    maxCount={1}
                  >
                    <Button icon={<UploadOutlined />}>
                      {t('Click to select image')}
                    </Button>
                  </Upload>
                </Form.Item>
                <Form.Item label={`${t('Image Caption')} ${index + 1}`}>
                  <Input
                    value={attachment.caption}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleCaptionChange(index, e)
                    }
                    placeholder={t('Enter caption for the image')}
                  />
                </Form.Item>
              </Card>
            ))}
            <Button
              type="dashed"
              onClick={handleAddAttachment}
              icon={<PlusOutlined />}
              style={{ marginTop: '10px', marginRight: '10px' }}
            >
              {t('Add File Attachment')}
            </Button>
            <Button
              type="dashed"
              onClick={() => setIsChartSelectorModalOpen(true)}
              icon={<PlusOutlined />}
              style={{ marginTop: '10px' }}
            >
              {t('Add Chart Thumbnail')}
            </Button>
          </Form.Item>
          <div style={{ fontSize: '0.8em', color: 'gray', marginTop: '20px' }}>
            {t('Fields marked with an asterisk (*) are required.')}
          </div>
        </Form>
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
        confirmLoading={isLoading}
        okButtonProps={{ disabled: !selectedChartForThumbnail }}
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
                  const { digest } = chartResult;
                  if (digest) {
                    setChartThumbnailPreviewUrl(
                      `/api/v1/chart/${chartId}/thumbnail/${digest}/?force=true`,
                    );
                  } else {
                    addDangerToast(
                      t(
                        'Could not retrieve chart digest for thumbnail preview.',
                      ),
                    );
                    setChartThumbnailPreviewUrl(null);
                  }
                } catch (err) {
                  console.error(
                    'Error fetching chart details for preview:',
                    err,
                  );
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
        {isPreviewLoading && (
          <div style={{ textAlign: 'center', margin: '10px' }}>
            <Spin /> <p>{t('Loading preview...')}</p>
          </div>
        )}
        {chartThumbnailPreviewUrl && !isPreviewLoading && (
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <img
              src={chartThumbnailPreviewUrl}
              alt={t('Chart thumbnail preview')}
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                border: '1px solid #f0f0f0',
              }}
              onError={() => {
                addDangerToast(
                  t(
                    'Thumbnail image not available or still generating. Try adding the chart to see if it becomes available.',
                  ),
                );
                setChartThumbnailPreviewUrl(null);
              }}
            />
          </div>
        )}
        {!isPreviewLoading &&
          !chartThumbnailPreviewUrl &&
          selectedChartForThumbnail && (
            <div
              style={{ marginTop: '15px', textAlign: 'center', color: 'grey' }}
            >
              {t('No preview available or chart has no thumbnail.')}
            </div>
          )}
      </Modal>
    </>
  );
};

export default CreateBulletinModal;
