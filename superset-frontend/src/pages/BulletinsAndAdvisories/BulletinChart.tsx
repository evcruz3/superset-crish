import React, { useState, useEffect } from 'react';
import { t, SupersetClient } from '@superset-ui/core';
import { Link } from 'react-router-dom';
import Loading from 'src/components/Loading';

interface BulletinChartProps {
  chartId: number;
  height?: number;
}

export default function BulletinChart({ chartId, height = 400 }: BulletinChartProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isThumbnailReady, setIsThumbnailReady] = useState(false);
  const [maxRetriesReached, setMaxRetriesReached] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const MAX_RETRIES = 100;
  const RETRY_DELAY = 2000; // 2 seconds

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/chart/${chartId}`,
        });
        // console.log('Chart data response:', response.json.result);
        const fullThumbnailUrl = response.json.result.thumbnail_url.startsWith('/')
          ? `${window.location.origin}${response.json.result.thumbnail_url}`
          : response.json.result.thumbnail_url;
        setThumbnailUrl(fullThumbnailUrl);
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
        setMaxRetriesReached(true);
        setErrorMessage('Failed to fetch chart data');
        setIsLoading(false);
      }
    };

    if (chartId) {
      fetchChartData();
    }
  }, [chartId]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const checkThumbnail = async () => {
      if (!thumbnailUrl) {
        setMaxRetriesReached(true);
        setErrorMessage('No thumbnail URL available');
        setIsLoading(false);
        return;
      }

      if (retryCount >= MAX_RETRIES) {
        // console.log('Max retries reached for thumbnail generation');
        setMaxRetriesReached(true);
        setErrorMessage(`Timeout after ${MAX_RETRIES} attempts`);
        setIsLoading(false);
        return;
      }

      try {
        // console.log('Checking thumbnail URL:', thumbnailUrl);
        const response = await fetch(thumbnailUrl);
        // console.log('Thumbnail response status:', response.status);
        
        if (response.status === 202) {
          // Keep loading state true while retrying
          setIsLoading(true);
          setErrorMessage(`Generation in progress (${retryCount + 1}/${MAX_RETRIES})`);
          timeoutId = setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, RETRY_DELAY);
        } else if (response.status === 200) {
          const contentType = response.headers.get('content-type');
          const contentLength = response.headers.get('content-length');
          // console.log('Response headers:', { contentType, contentLength });

          try {
            const blob = await response.blob();
            // console.log('Image blob size:', blob.size);
            
            if (blob.size > 0 && contentType?.startsWith('image/')) {
              const imageUrl = URL.createObjectURL(blob);
              const img = new Image();
              img.onload = () => {
                URL.revokeObjectURL(imageUrl);
                setIsThumbnailReady(true);
                setIsLoading(false);
                setErrorMessage('');
              };
              img.onerror = () => {
                URL.revokeObjectURL(imageUrl);
                console.error('Image failed to load from blob');
                setErrorMessage('Invalid image data');
                setIsLoading(true);
                timeoutId = setTimeout(() => {
                  setRetryCount(prev => prev + 1);
                }, RETRY_DELAY);
              };
              img.src = imageUrl;
            } else {
              // console.log('Invalid image data received');
              setErrorMessage('Empty or invalid image data');
              setIsLoading(true);
              timeoutId = setTimeout(() => {
                setRetryCount(prev => prev + 1);
              }, RETRY_DELAY);
            }
          } catch (error) {
            console.error('Error processing image data:', error);
            setErrorMessage('Error processing image data');
            setIsLoading(true);
            timeoutId = setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, RETRY_DELAY);
          }
        } else {
          // console.log('Unexpected response status:', response.status);
          setMaxRetriesReached(true);
          setErrorMessage(`Unexpected response (${response.status})`);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking thumbnail:', error);
        setMaxRetriesReached(true);
        setErrorMessage('Network error');
        setIsLoading(false);
      }
    };

    checkThumbnail();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [thumbnailUrl, retryCount]);

  if (!chartId) return null;

  return (
    <Link to={`/explore/?slice_id=${chartId}`}>
      <div style={{ height, border: '1px solid #E0E0E0', borderRadius: '4px', position: 'relative' }}>
        {isLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '8px'
          }}>
            <Loading position="inline-centered" />
            {errorMessage && (
              <div style={{ color: '#666666', fontSize: '12px' }}>
                {errorMessage}
              </div>
            )}
          </div>
        ) : isThumbnailReady ? (
          <img
            alt={t('Chart thumbnail')}
            src={thumbnailUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: '8px',
            }}
            onError={(e) => {
              console.error('Image failed to load:', e);
              setMaxRetriesReached(true);
              setErrorMessage('Failed to display image');
            }}
          />
        ) : maxRetriesReached ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666666',
            padding: '8px',
            textAlign: 'center'
          }}>
            {t('Thumbnail is unavailable')}
            {errorMessage && (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                ({errorMessage})
              </div>
            )}
          </div>
        ) : null}
      </div>
    </Link>
  );
} 