import { Modal } from 'antd';
import { styled } from '@superset-ui/core';

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;

  tr {
    border-bottom: 1px solid #f0f0f0;
  }

  td {
    padding: 8px;

    &:first-child {
      font-weight: 500;
      color: #666;
      width: 40%;
    }

    &:last-child {
      color: #333;
    }
  }

  tr:last-child {
    border-bottom: none;
  }
`;

interface RegionProperties {
  ADM1?: string;
  ISO?: string;
  ADM_Code?: string;
  dateModifi?: string;
  CodeNotes?: string;
  PostoAdmin?: number;
  Sucos?: number;
  Aldeias?: number;
  area_sqkm?: number;
  Population?: number;
  Male_Pop?: number;
  Female_Pop?: number;
  SchoolBasi?: number;
  SchoolGenS?: number;
  SchoolTecS?: number;
  PubHospita?: number;
  PubHealCen?: number;
  PubHealPos?: number;
  SISca?: number;
  PrivClinic?: number;
  Notes?: string;
}

interface RegionInfoModalProps {
  visible: boolean;
  onClose: () => void;
  properties: RegionProperties;
}

const formatValue = (value: any): string => {
  if (typeof value === 'number') {
    // Format numbers with commas for thousands
    return value.toLocaleString();
  }
  return String(value);
};

const RegionInfoModal: React.FC<RegionInfoModalProps> = ({
  visible,
  onClose,
  properties,
}) => {
  // Define display names for properties
  const propertyDisplayNames: { [key: string]: string } = {
    ADM1: 'Region Name',
    ISO: 'ISO Code',
    ADM_Code: 'Administrative Code',
    dateModifi: 'Last Modified',
    CodeNotes: 'Code Notes',
    PostoAdmin: 'Administrative Posts',
    Sucos: 'Sucos',
    Aldeias: 'Aldeias',
    area_sqkm: 'Area (sq km)',
    Population: 'Total Population',
    Male_Pop: 'Male Population',
    Female_Pop: 'Female Population',
    SchoolBasi: 'Basic Schools',
    SchoolGenS: 'General Secondary Schools',
    SchoolTecS: 'Technical Secondary Schools',
    PubHospita: 'Public Hospitals',
    PubHealCen: 'Public Health Centers',
    PubHealPos: 'Public Health Posts',
    SISca: 'SISCa',
    PrivClinic: 'Private Clinics',
    Notes: 'Notes',
  };

  console.log('RegionInfoModal properties:', properties);
  console.log('RegionInfoModal visible:', visible);

  return (
    <Modal
      title={`${properties.ADM1 || 'Region'} Information`}
      visible={visible}
      // open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
    >
      <StyledTable>
        <tbody>
          {Object.entries(properties)
            .filter(
              ([key, value]) =>
                value !== undefined &&
                value !== null &&
                key in propertyDisplayNames,
            )
            .map(([key, value]) => (
              <tr key={key}>
                <td>{propertyDisplayNames[key] || key}</td>
                <td>{formatValue(value)}</td>
              </tr>
            ))}
        </tbody>
      </StyledTable>
    </Modal>
  );
};

export default RegionInfoModal;
