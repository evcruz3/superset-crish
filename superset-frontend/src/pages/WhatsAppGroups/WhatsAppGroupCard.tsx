import React from 'react';
import { WhatsAppGroup } from './types'; // Changed import
import { Card, Tooltip } from 'antd'; 
import { styled, t } from '@superset-ui/core';
import Icons from 'src/components/Icons';
import moment from 'moment';

interface WhatsAppGroupCardProps {
  whatsAppGroup: WhatsAppGroup; // Changed prop name and type
  hasPerm: (permission: string) => boolean; 
  onEdit: () => void;
  onDelete: () => void;
}

const StyledCard = styled(Card)`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
  height: 320px; // Keep height or adjust as needed
  display: flex;
  flex-direction: column;

  .ant-card-head-title {
    font-weight: ${({ theme }) => theme.typography.weights.bold};
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    line-height: 1.3;
  }
  .ant-card-body {
    flex-grow: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .description {
    margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2; /* Limit to 2 lines */
    -webkit-box-orient: vertical;
    min-height: 2.8em; /* approx 2 lines */
  }
  .phone-numbers-preview { // Changed class name
    font-size: ${({ theme }) => theme.typography.sizes.s}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta-data {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    color: ${({ theme }) => theme.colors.grayscale.light1};
    margin-top: auto; /* Pushes to the bottom */
    padding-top: ${({ theme }) => theme.gridUnit * 2}px;
    border-top: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  }
`;

const CardActions = styled.div`
  margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  text-align: right;
  .anticon {
    font-size: ${({ theme }) => theme.typography.sizes.l}px;
    color: ${({ theme }) => theme.colors.grayscale.base};
    cursor: pointer;
    margin-left: ${({ theme }) => theme.gridUnit * 3}px;
    &:hover {
      color: ${({ theme }) => theme.colors.primary.base};
    }
  }
`;

const WhatsAppGroupCard: React.FC<WhatsAppGroupCardProps> = ({ whatsAppGroup, hasPerm, onEdit, onDelete }) => {
  const phoneNumbersString = whatsAppGroup.phone_numbers || ''; 
  const numberList = phoneNumbersString.split(',').map(n => n.trim()).filter(n => n);
  const numbersPreview = numberList.length > 2 
    ? `${numberList.slice(0, 2).join(', ')} and ${numberList.length - 2} more...`
    : numberList.join(', ');

  return (
    <StyledCard 
      title={whatsAppGroup.name}
      hoverable
    >
      <div className="description">
        {whatsAppGroup.description || t('No description')}
      </div>
      <Tooltip title={numberList.join(', \n')}>
        <div className="phone-numbers-preview"> {/* Changed class name */}
          <strong>{t('Phone Numbers:')}</strong> {numbersPreview || t('No numbers listed')} {/* Changed label */}
        </div>
      </Tooltip>
      
      <div className="meta-data">
        <div>
          {t('Created by:')} {whatsAppGroup.created_by ? `${whatsAppGroup.created_by.first_name || ''} ${whatsAppGroup.created_by.last_name || ''}`.trim() : t('N/A')}
        </div>
        <div>
          {t('Created on:')} {whatsAppGroup.created_on ? moment(whatsAppGroup.created_on).format('MMM D, YYYY') : t('N/A')}
        </div>
        {whatsAppGroup.changed_on && whatsAppGroup.changed_on !== whatsAppGroup.created_on && (
          <div>
            {t('Modified:')} {moment(whatsAppGroup.changed_on).fromNow()}
          </div>
        )}
      </div>
      <CardActions>
        {/* Assuming permission name will be 'WhatsAppGroups' for consistency with API and SPA View */}
        {hasPerm('can_write') && ( 
          <Tooltip title={t('Edit WhatsApp group')}>
            <Icons.EditAlt onClick={(e: React.MouseEvent) => { e.stopPropagation(); onEdit(); }} />
          </Tooltip>
        )}
        {hasPerm('can_write') && (
          <Tooltip title={t('Delete WhatsApp group')}>
            <Icons.Trash onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(); }} />
          </Tooltip>
        )}
      </CardActions>
    </StyledCard>
  );
};

export default WhatsAppGroupCard; 