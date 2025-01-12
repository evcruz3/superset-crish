import React, { useState } from 'react';
import { t, styled } from '@superset-ui/core';
import { Upload, message, Button, Space, Card, Typography, Select, InputNumber } from 'antd';
import { InboxOutlined, UploadOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { SupersetClient } from '@superset-ui/core';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useHistory } from 'react-router-dom';

const { Dragger } = Upload;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

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

const SelectContainer = styled.div`
  margin-bottom: 24px;
  max-width: 500px;
`;

const FormLabel = styled(Typography.Text)`
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #666;
`;

const FormItem = styled.div`
  margin-bottom: 16px;
`;

// Municipality codes mapping
const MUNICIPALITY_CODES = {
  'TL-AL': 'Aileu',
  'TL-AN': 'Ainaro',
  'TL-AT': 'Atauro',
  'TL-BA': 'Baucau',
  'TL-BO': 'Bobonaro',
  'TL-CO': 'Covalima',
  'TL-DI': 'Dili',
  'TL-ER': 'Ermera',
  'TL-LA': 'Lautem',
  'TL-LI': 'Liquica',
  'TL-MT': 'Manatuto',
  'TL-MF': 'Manufahi',
  'TL-OE': 'Oecusse',
  'TL-VI': 'Viqueque'
};

function UpdateCaseReports() {
  const history = useHistory();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);
  const [municipalityCode, setMunicipalityCode] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [week, setWeek] = useState<number>(() => {
    // Calculate current week number
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const currentWeek = Math.ceil(diff / oneWeek);
    return Math.min(Math.max(1, currentWeek), 53); // Ensure week is between 1 and 53
  });

  const handleDownloadTemplate = async () => {
    setDownloading(true);
    try {
      const response = await fetch('/api/v1/update_case_reports/template', {
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
        link.setAttribute('download', 'case_reports_template.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        message.success(t('Template downloaded successfully'));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to download template');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      message.error(error.message || t('Template not available'));
    } finally {
      setDownloading(false);
    }
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning(t('Please select a file first'));
      return;
    }

    if (!municipalityCode) {
      message.warning(t('Please select a municipality'));
      return;
    }

    if (!year) {
      message.warning(t('Please select a year'));
      return;
    }

    if (!week || week < 1 || week > 53) {
      message.warning(t('Please select a valid week number (1-53)'));
      return;
    }

    const formData = new FormData();
    const file = fileList[0];
    formData.append('file', file);
    formData.append('municipality_code', municipalityCode);
    formData.append('year', year.toString());
    formData.append('week', week.toString());
    
    setUploading(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/update_case_reports/upload',
        postPayload: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      message.success(t('Case reports uploaded successfully'));
      setFileList([]); // Clear the file list after successful upload
      setMunicipalityCode(''); // Reset municipality selection
      setYear(new Date().getFullYear()); // Reset year to current year
      
      // Reset week to current week
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const diff = now.getTime() - start.getTime();
      const oneWeek = 1000 * 60 * 60 * 24 * 7;
      const currentWeek = Math.ceil(diff / oneWeek);
      setWeek(Math.min(Math.max(1, currentWeek), 53));
      
    //   history.push('/diseases/'); // Redirect to diseases overview
    } catch (error: any) {
      console.error('Upload error:', error);
      let errorMessage = t('Error processing file');
      if (error.response) {
        try {
          const responseData = error.response.json();
          errorMessage = responseData.error || errorMessage;
        } catch (e) {
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
    accept: '.xlsx, .xls',
    fileList,
    beforeUpload: (file: any) => {
      setFileList([file]);
      return false; // Prevent automatic upload
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  return (
    <UploadContainer>
      <StyledTitle level={3}>{t('Update Disease Case Reports')}</StyledTitle>
      
      <GuideCard>
        <Typography>
          <Title level={5}>
            <InfoCircleOutlined style={{ marginRight: '8px' }} />
            {t('Guide to Updating Case Reports')}
          </Title>
          <Paragraph>
            {t('Please ensure your file follows the TLHIS/22:Weekly surveillance Excel format.')}
          </Paragraph>
          <Paragraph type="secondary">
            {t('Both .xls and .xlsx file formats are supported.')}
          </Paragraph>
        </Typography>
      </GuideCard>

      <SelectContainer>
        <FormItem>
          <FormLabel>{t('Municipality')}</FormLabel>
          <Select
            placeholder={t('Select Municipality')}
            style={{ width: '100%' }}
            value={municipalityCode || undefined}
            onChange={(value: string) => setMunicipalityCode(value)}
          >
            {Object.entries(MUNICIPALITY_CODES).map(([code, name]) => (
              <Option key={code} value={code}>
                {name} ({code})
              </Option>
            ))}
          </Select>
        </FormItem>
        
        <FormItem>
          <FormLabel>{t('Year')}</FormLabel>
          <InputNumber
            style={{ width: '200px' }}
            value={year}
            onChange={(value: number | null) => setYear(value || new Date().getFullYear())}
            min={2000}
            max={new Date().getFullYear() + 1}
            placeholder={t('Select Year')}
          />
        </FormItem>

        <FormItem>
          <FormLabel>{t('Week')}</FormLabel>
          <InputNumber
            style={{ width: '200px' }}
            value={week}
            onChange={(value: number | null) => setWeek(value || 1)}
            min={1}
            max={53}
            placeholder={t('Select Week (1-53)')}
          />
        </FormItem>
      </SelectContainer>

      <Space direction="vertical" style={{ width: '100%', marginBottom: '24px', maxWidth: '500px' }}>
        <FormItem>
          <FormLabel>{t('Template')}</FormLabel>
          <Button
            onClick={handleDownloadTemplate}
            loading={downloading}
            icon={<DownloadOutlined />}
            type="primary"
            ghost
            style={{ width: '200px' }}
          >
            {downloading ? t('Downloading...') : t('Download Template')}
          </Button>
        </FormItem>
      </Space>

      <div style={{ maxWidth: '800px', marginBottom: '24px' }}>
        <FormItem>
          <FormLabel>{t('Upload File')}</FormLabel>
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {t('Click or drag file to this area to upload')}
            </p>
            <p className="ant-upload-hint">
              {t('Please upload your TLHIS/22:Weekly surveillance Excel file (.xls or .xlsx)')}
            </p>
          </Dragger>
        </FormItem>
      </div>

      <ButtonContainer>
        <Button
          type="primary"
          onClick={handleUpload}
          loading={uploading}
          icon={<UploadOutlined />}
          disabled={fileList.length === 0 || !municipalityCode || !year || !week || week < 1 || week > 53}
          style={{ width: '200px' }}
        >
          {uploading ? t('Uploading') : t('Start Upload')}
        </Button>
      </ButtonContainer>
    </UploadContainer>
  );
}

export default withToasts(UpdateCaseReports); 