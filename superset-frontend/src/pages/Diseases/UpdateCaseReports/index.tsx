import React, { useState, useMemo } from 'react';
import { t, styled } from '@superset-ui/core';
import { Upload, message, Button, Space, Card, Typography, InputNumber, Table, Tag, Tooltip } from 'antd';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { InboxOutlined, UploadOutlined, DownloadOutlined, InfoCircleOutlined, DeleteOutlined } from '@ant-design/icons';
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

type MunicipalityCode = 'TL-AL' | 'TL-AN' | 'TL-AT' | 'TL-BA' | 'TL-BO' | 'TL-CO' | 'TL-DI' | 
                        'TL-ER' | 'TL-LA' | 'TL-LI' | 'TL-MT' | 'TL-MF' | 'TL-OE' | 'TL-VI';

// Municipality codes mapping
const MUNICIPALITY_CODES: Record<MunicipalityCode, string> = {
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

// Reverse mapping for name to code lookup
const MUNICIPALITY_NAMES_TO_CODES: Record<string, MunicipalityCode> = Object.entries(MUNICIPALITY_CODES).reduce(
  (acc, [code, name]) => ({
    ...acc,
    [name.toLowerCase()]: code as MunicipalityCode,
  }),
  {} as Record<string, MunicipalityCode>
);

interface FileWithMunicipality extends Omit<UploadFile, 'status'> {
  file: File;
  municipalityCode: MunicipalityCode | null;
  status?: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

function UpdateCaseReports() {
  const history = useHistory();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fileList, setFileList] = useState<FileWithMunicipality[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [week, setWeek] = useState<number>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    const currentWeek = Math.ceil(diff / oneWeek);
    return Math.min(Math.max(1, currentWeek), 53);
  });

  // Function to detect municipality code from filename
  const detectMunicipalityCode = (filename: string): MunicipalityCode | null => {
    const normalizedFilename = filename.toLowerCase();
    
    // Try to find a municipality name in the filename
    const municipalityName = Object.values(MUNICIPALITY_CODES)
      .find(name => normalizedFilename.includes(name.toLowerCase()));
    
    if (municipalityName) {
      return MUNICIPALITY_NAMES_TO_CODES[municipalityName.toLowerCase()];
    }
    
    // Fallback to code detection if name not found
    return (Object.keys(MUNICIPALITY_CODES) as MunicipalityCode[])
      .find(code => normalizedFilename.includes(code.toLowerCase())) || null;
  };

  // Calculate missing municipalities
  const missingMunicipalities = useMemo(() => {
    const selectedMunicipalities = new Set(fileList.map(f => f.municipalityCode));
    return (Object.entries(MUNICIPALITY_CODES) as [MunicipalityCode, string][])
      .filter(([code]) => !selectedMunicipalities.has(code))
      .map(([code, name]) => ({ code, name }));
  }, [fileList]);

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

  const uploadSingleFile = async (fileInfo: FileWithMunicipality) => {
    const formData = new FormData();
    formData.append('file', fileInfo.file);
    formData.append('municipality_code', fileInfo.municipalityCode || '');
    formData.append('year', year.toString());
    formData.append('week', week.toString());

    try {
      await SupersetClient.post({
        endpoint: '/api/v1/update_case_reports/upload',
        postPayload: formData,
        headers: {
          'Accept': 'application/json',
        },
      });
      return true;
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
      throw new Error(errorMessage);
    }
  };

  const handleBulkUpload = async () => {
    if (fileList.length === 0) {
      message.warning(t('Please select files first'));
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

    setUploading(true);
    const updatedFiles = [...fileList];

    for (let i = 0; i < updatedFiles.length; i++) {
      const fileInfo = updatedFiles[i];
      if (!fileInfo.municipalityCode) {
        continue;
      }

      fileInfo.status = 'uploading';
      setFileList([...updatedFiles]);

      try {
        await uploadSingleFile(fileInfo);
        fileInfo.status = 'success';
      } catch (error: any) {
        fileInfo.status = 'error';
        fileInfo.error = error.message;
        message.error(`Failed to upload ${fileInfo.name}: ${error.message}`);
      }
      setFileList([...updatedFiles]);
    }

    setUploading(false);
    const successCount = updatedFiles.filter(f => f.status === 'success').length;
    if (successCount > 0) {
      message.success(`Successfully uploaded ${successCount} files`);
    }
  };

  const columns = [
    {
      title: t('Municipality'),
      key: 'municipality',
      render: (_: any, record: FileWithMunicipality) => (
        <span>
          {record.municipalityCode ? (
            <Tag color="blue">{MUNICIPALITY_CODES[record.municipalityCode]}</Tag>
          ) : (
            <Tag color="red">{t('Unknown')}</Tag>
          )}
        </span>
      ),
    },
    {
      title: t('Filename'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('Status'),
      key: 'status',
      render: (_: any, record: FileWithMunicipality) => (
        <Tag color={
          record.status === 'success' ? 'success' :
          record.status === 'error' ? 'error' :
          record.status === 'uploading' ? 'processing' :
          'default'
        }>
          {record.status || 'pending'}
        </Tag>
      ),
    },
    {
      title: t('Actions'),
      key: 'actions',
      render: (_: any, record: FileWithMunicipality) => {
        const canDelete = record.status !== 'success' && record.status !== 'uploading';
        return (
          <Tooltip title={!canDelete ? t('Cannot remove files that are uploading or already uploaded') : ''}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={!canDelete}
              onClick={() => {
                if (canDelete) {
                  setFileList(prev => prev.filter(f => f.uid !== record.uid));
                }
              }}
            />
          </Tooltip>
        );
      },
    },
  ];

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    accept: '.xlsx, .xls',
    showUploadList: false, // Hide the default upload list since we're using our own table
    fileList: fileList.map(f => ({
      ...f,
      status: f.status === 'pending' ? 'done' : f.status === 'uploading' ? 'uploading' : f.status === 'success' ? 'done' : 'error',
      originFileObj: f.file,
      type: f.file.type,
      size: f.file.size,
    })),
    beforeUpload: (file: File) => {
      const municipalityCode = detectMunicipalityCode(file.name);
      const newFile: FileWithMunicipality = {
        uid: `${Date.now()}-${file.name}`,
        name: file.name,
        file,
        type: file.type,
        size: file.size,
        municipalityCode,
        status: 'pending',
      };

      if (!municipalityCode) {
        message.warning(`Could not detect municipality code in filename: ${file.name}`);
      } else if (fileList.some(f => f.municipalityCode === municipalityCode)) {
        message.warning(`A file for ${MUNICIPALITY_CODES[municipalityCode]} has already been selected`);
        return false;
      }

      setFileList(prev => [...prev, newFile]);
      return false;
    },
  };

  return (
    <UploadContainer>
      <StyledTitle level={3}>{t('Update Disease Case Reports')}</StyledTitle>
      
      <GuideCard>
        <Typography>
          <Title level={5}>
            <InfoCircleOutlined style={{ marginRight: '8px' }} />
            {t('Guide to Uploading Case Reports')}
          </Title>
          <Paragraph>
            {t('Please ensure your files follow the TLHIS/22:Weekly surveillance Excel format and include the municipality name (e.g., Dili) or code (e.g., TL-DI) in the filename.')}
          </Paragraph>
          <Paragraph type="secondary">
            {t('Both .xls and .xlsx file formats are supported.')}
          </Paragraph>
        </Typography>
      </GuideCard>

      <Space direction="vertical" style={{ width: '100%', marginBottom: '24px' }}>
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
          <FormLabel>{t('Upload Files')}</FormLabel>
          <Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">
              {t('Click or drag files to this area to upload')}
            </p>
            <p className="ant-upload-hint">
              {t('Please include municipality name (e.g., Dili) or code (e.g., TL-DI) in filenames')}
            </p>
          </Dragger>
        </FormItem>
      </div>

      {fileList.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <Title level={5}>{t('Selected Files')}</Title>
          <Table
            dataSource={fileList}
            columns={columns}
            rowKey="uid"
            pagination={false}
            size="small"
          />
        </div>
      )}

      {missingMunicipalities.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <Title level={5}>{t('Missing Municipalities')}</Title>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {missingMunicipalities.map(({ code, name }) => (
              <Tag color="warning" key={code}>
                {name} ({code})
              </Tag>
            ))}
          </div>
        </div>
      )}

      <ButtonContainer>
        <Button
          type="primary"
          onClick={handleBulkUpload}
          loading={uploading}
          icon={<UploadOutlined />}
          disabled={fileList.length === 0 || !year || !week || week < 1 || week > 53}
          style={{ width: '200px' }}
        >
          {uploading ? t('Uploading') : t('Start Bulk Upload')}
        </Button>
      </ButtonContainer>
    </UploadContainer>
  );
}

export default withToasts(UpdateCaseReports); 