import React, { useState } from 'react';
import { t, styled } from '@superset-ui/core';
import { Upload, message, Button, Space, Card, Typography } from 'antd';
import { InboxOutlined, UploadOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { SupersetClient } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useHistory } from 'react-router-dom';

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;

const UploadContainer = styled.div`
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const StyledTitle = styled(Title)`
  margin-bottom: 24px !important;
`;

const GuideCard = styled(Card)`
  margin-bottom: 24px;
  background-color: #f9f9f9;
`;

const StepText = styled(Text)`
  display: block;
  margin-bottom: 8px;
`;

const ButtonContainer = styled.div`
  margin-top: 16px;
  text-align: right;
`;

function UpdateFacilities() {
  const history = useHistory();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/v1/update_facilities/template', {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'facilities_template.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        message.success(t('Template downloaded successfully'));

        setFileList([]); // Clear the file list after successful upload
        history.push('/facilities/'); // Use history.push instead of navigate
        
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download template');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      message.error(error.message || t('Template not available. Please upload a file first.'));
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning(t('Please select a file first'));
      return;
    }

    const formData = new FormData();
    const file = fileList[0];
    formData.append('file', file);
    
    setUploading(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/update_facilities/upload',
        postPayload: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      message.success(t('File uploaded and processed successfully'));
      setFileList([]); // Clear the file list after successful upload
      history.push('/facilities/'); // Use history.push instead of navigate
    } catch (error: any) {
      console.log('Upload error:', error);
      let errorMessage = t('Error processing file');
      if (error.response) {
        // If we have a response from the server
        try {
          const responseData = error.response.json();
          errorMessage = responseData.error || errorMessage;
        } catch (e) {
          // If response is not JSON
          errorMessage = error.response.text || errorMessage;
        }
      }
      message.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const uploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx',
    fileList,
    beforeUpload: (file: any) => {
      console.log('beforeUpload file:', file);
      setFileList([file]);
      return false; // Prevent automatic upload
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  return (
    <UploadContainer>
      <StyledTitle level={3}>{t('Update Health Facilities Data')}</StyledTitle>
      
      <GuideCard>
        <Typography>
          <Title level={5}>
            <InfoCircleOutlined style={{ marginRight: '8px' }} />
            {t('Guide to Updating Facilities Data')}
          </Title>
          <Paragraph>
            {t('Follow these steps to update the health facilities data:')}
          </Paragraph>
          <StepText>
            1. {t('Download the template file to see the required format')}
          </StepText>
          <StepText>
            2. {t('Ensure your Excel file contains the following sheets named after administrative posts:')}
            <Text type="secondary" style={{ marginLeft: '16px', display: 'block' }}>
              Aileu, Ainaro, Atauro, Baucau, Bobonaro, Covalima, Dili, Ermera, Manatuto, 
              Manufahi, Lautem, Liquica, Raeoa, Viqueque
            </Text>
          </StepText>
          <StepText>
            3. {t('Each sheet must include these required columns:')}
            <Text type="secondary" style={{ marginLeft: '16px', display: 'block' }}>
              Longitude, Latitude, Ambulance, Maternity bed, Total bed
            </Text>
          </StepText>
          <StepText>
            4. {t('Upload your completed Excel file using the upload area below')}
          </StepText>
          <Paragraph type="secondary">
            {t('Note: The most recently uploaded file will become the new template for future updates.')}
          </Paragraph>
        </Typography>
      </GuideCard>

      <Space direction="vertical" style={{ width: '100%', marginBottom: '24px' }}>
        <Button
          onClick={handleDownloadTemplate}
          loading={downloading}
          icon={<DownloadOutlined />}
          type="primary"
          ghost
        >
          {downloading ? t('Downloading...') : t('Download Template')}
        </Button>
      </Space>

      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          {t('Click or drag file to this area to upload')}
        </p>
        <p className="ant-upload-hint">
          {t('Support for .xlsx files only. Please ensure your file follows the template format.')}
        </p>
      </Dragger>

      <ButtonContainer>
        <Button
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          icon={<UploadOutlined />}
          disabled={fileList.length === 0}
        >
          {uploading ? t('Uploading') : t('Start Upload')}
        </Button>
      </ButtonContainer>
    </UploadContainer>
  );
}

export default withToasts(UpdateFacilities);