import { useEffect } from 'react';
import DashboardPage from 'src/dashboard/containers/DashboardPage';

interface DashboardPageWrapperProps {
  idOrSlug: string;
}

/**
 * A wrapper component for DashboardPage that ensures the filter bar is hidden by default
 */
export const DashboardPageWrapper = ({
  idOrSlug,
}: DashboardPageWrapperProps) => {
  useEffect(() => {
    // Preserve existing URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    // Explicitly set expandFilters to false
    urlParams.set('expand_filters', 'false');

    // Construct the new URL while preserving the path
    const path = window.location.pathname;
    const search = urlParams.toString();
    const newUrl = `${path}${search ? `?${search}` : ''}`;

    // Update URL without reloading the page
    window.history.replaceState(null, '', newUrl);

    // Log for debugging
    console.debug('DashboardPageWrapper: Filter bar hidden via URL param');
  }, []);

  return <DashboardPage idOrSlug={idOrSlug} />;
};

export default DashboardPageWrapper;
