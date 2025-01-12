import React from 'react';
import { Card, List } from 'antd';
import BulletinChart from './BulletinChart';
import { Bulletin } from './types';

// ... other imports ...

export default function BulletinList() {

  const renderBulletin = (bulletin: Bulletin) => (
    <List.Item>
      <Card
        title={bulletin.title}
        style={{ width: '100%' }}
      >
        <p>{bulletin.message}</p>
        <p>
          <small>
            {bulletin.hashtags.split(',').map(tag => (
              <Tag key={tag}>{tag.trim()}</Tag>
            ))}
          </small>
        </p>
        {bulletin.chart_id && (
          <div style={{ marginTop: '16px' }}>
            <BulletinChart chartId={bulletin.chart_id} />
          </div>
        )}
        <div style={{ marginTop: '16px' }}>
          <small>
            {t('Created by')} {bulletin.created_by} {t('on')}{' '}
            {moment(bulletin.created_on).format('MMMM D, YYYY')}
          </small>
        </div>
      </Card>
    </List.Item>
  );

  return (
    <List
      dataSource={bulletins}
      renderItem={renderBulletin}
      pagination={{
        pageSize: 10,
        total: total,
        onChange: handlePageChange,
      }}
    />
  );
} 