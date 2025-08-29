import React from 'react';
import { styled } from '@superset-ui/core';
import { Skeleton } from 'antd';

const LoadingContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  grid-gap: ${({ theme }) => theme.gridUnit * 4}px;
  padding: ${({ theme }) => theme.gridUnit * 4}px;
`;

const CardSkeleton = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 3}px;
`;

interface LoadingCardsProps {
  cover?: boolean;
  count?: number;
}

export const LoadingCards: React.FC<LoadingCardsProps> = ({ 
  cover = true, 
  count = 6 
}) => (
  <LoadingContainer>
    {Array.from({ length: count }).map((_, index) => (
      <CardSkeleton key={index}>
        <Skeleton 
          active 
          paragraph={{ rows: cover ? 4 : 2 }}
        />
      </CardSkeleton>
    ))}
  </LoadingContainer>
);

export default LoadingCards;