import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { styled, t, useTheme } from '@superset-ui/core';
import { Global } from '@emotion/react';
import { LineEditableTabs } from 'src/components/Tabs';
import { useDashboard, useDashboardCharts } from 'src/hooks/apiResources';
import { RootState } from 'src/dashboard/types';
import { setDirectPathToChild } from 'src/dashboard/actions/dashboardState';
import { getRootLevelTabsComponent } from 'src/dashboard/components/DashboardBuilder/utils';
import { hydrateDashboard } from 'src/dashboard/actions/hydrate';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_ROOT_DEPTH,
} from 'src/dashboard/util/constants';
import {
  chartContextMenuStyles,
  filterCardPopoverStyle,
  focusStyle,
  headerStyles,
  chartHeaderStyles,
} from 'src/dashboard/styles';

export const StyledTabsContainer = styled.div`
  width: 100%;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};

  .dashboard-component-tabs-content {
    min-height: ${({ theme }) => theme.gridUnit * 12}px;
    margin-top: ${({ theme }) => theme.gridUnit / 4}px;
    position: relative;
  }

  .ant-tabs {
    overflow: visible;

    .ant-tabs-nav-wrap {
      min-height: ${({ theme }) => theme.gridUnit * 12.5}px;
    }

    .ant-tabs-content-holder {
      overflow: visible;
    }
  }

  div .ant-tabs-tab-btn {
    text-transform: none;
  }
`;

export const TabContentContainer = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

export const ChartContainer = styled.div`
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
`;

interface DashboardTabsProps {
  idOrSlug: string;
  selectedTabIndex?: number;
}

interface TabsComponent {
  id: string;
  type: string;
  children: string[];
  meta?: {
    text?: string;
  };
}

function findTabsComponent(layout: any): TabsComponent | null {
  // First try to find a component of type TABS
  for (const [_, component] of Object.entries(layout)) {
    if ((component as any).type === 'TABS') {
      // console.log('Found TABS component:', { id, component });
      return component as TabsComponent;
    }
  }

  // Fallback to getRootLevelTabsComponent
  return getRootLevelTabsComponent(layout) as TabsComponent | null;
}

function calculateDimensions(windowWidth: number) {
  const gutterWidth = 12; // Default gutter width in Superset
  const minColumnWidth = 100; // Minimum width per column
  const numColumns = 12; // Standard grid system

  // Calculate the available width after accounting for gutters
  const availableWidth = windowWidth - gutterWidth * (numColumns - 1);
  const columnWidth = Math.max(
    minColumnWidth,
    Math.floor(availableWidth / numColumns),
  );

  return {
    columnWidth,
    availableColumnCount: numColumns,
    gutterWidth,
  };
}

function renderTabContent(tabConfig: any, dashboardLayout: any) {
  if (!tabConfig?.children) return null;

  // Get window width for calculations
  const windowWidth = window.innerWidth - 64; // Account for margins/padding
  const { columnWidth, availableColumnCount } =
    calculateDimensions(windowWidth);

  return (
    <DashboardComponent
      id={tabConfig.id}
      parentId={DASHBOARD_ROOT_ID}
      depth={DASHBOARD_ROOT_DEPTH + 1}
      index={0}
      renderTabContent
      onChangeTab={() => {}}
      renderHoverMenu={false}
      isComponentVisible
    />
  );
}

function DashboardTabs({ idOrSlug, selectedTabIndex = 0 }: DashboardTabsProps) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const history = useHistory();
  const [activeTabIndex, setActiveTabIndex] = useState(selectedTabIndex);
  const [isInitialized, setIsInitialized] = useState(false);

  // Move useMemo hook to the top with other hooks
  const globalStyles = useMemo(
    () => [
      filterCardPopoverStyle(theme),
      headerStyles(theme),
      chartContextMenuStyles(theme),
      focusStyle(theme),
      chartHeaderStyles(theme),
    ],
    [theme],
  );

  // Fetch dashboard data
  const { result: dashboard } = useDashboard(idOrSlug);
  const { result: charts } = useDashboardCharts(idOrSlug);
  const dashboardLayout = useSelector<RootState, any>(
    state => state.dashboardLayout?.present,
  );

  // console.log('DashboardTabs render - props:', { idOrSlug, selectedTabIndex });

  // console.log('Dashboard data:', {
  //     dashboardFound: !!dashboard,
  //     dashboardId: dashboard?.id,
  //     layoutExists: !!dashboardLayout,
  //     layoutKeys: dashboardLayout ? Object.keys(dashboardLayout) : [],
  //     chartsFound: !!charts,
  //     isInitialized,
  //     dashboardMetadata: dashboard?.metadata,
  //     position_json: dashboard?.position_json,
  //     position_data: dashboard?.position_data
  // });

  // Initialize dashboard layout
  useEffect(() => {
    if (dashboard && charts && !isInitialized) {
      // console.log('Initializing dashboard layout:', {
      //     dashboard,
      //     charts,
      //     metadata: dashboard.metadata,
      //     position_json: dashboard.position_json,
      //     position_data: dashboard.position_data
      // });

      // Try to get position data from either position_json or position_data
      let positionData;
      try {
        if (dashboard.position_json) {
          positionData = JSON.parse(dashboard.position_json);
        } else if (dashboard.position_data) {
          positionData = dashboard.position_data;
        }

        // console.log('Parsed position data:', positionData);

        if (!positionData) {
          console.error('No valid position data found in dashboard');
          return;
        }

        // Create a modified dashboard object with the position data
        const dashboardWithPosition = {
          ...dashboard,
          position_json: JSON.stringify(positionData),
        };

        dispatch(
          hydrateDashboard({
            history,
            dashboard: dashboardWithPosition,
            charts,
            activeTabs: [],
            dataMask: {},
          }),
        );
        setIsInitialized(true);
      } catch (error) {
        console.error('Error parsing dashboard position data:', error);
      }
    }
  }, [dispatch, dashboard, charts, isInitialized]);

  useEffect(() => {
    if (dashboardLayout) {
      const tabsComponent = findTabsComponent(dashboardLayout);
      // console.log('Effect - Tabs component found:', {
      //     found: !!tabsComponent,
      //     component: tabsComponent,
      //     children: tabsComponent?.children,
      //     dashboardMetadata: dashboard?.metadata,
      //     dashboardPosition: dashboard?.position_data,
      //     fullLayout: dashboardLayout
      // });

      if (tabsComponent?.children) {
        const tabId = tabsComponent.children[activeTabIndex];
        // console.log('Effect - Setting active tab:', {
        //     activeTabIndex,
        //     tabId,
        //     allTabIds: tabsComponent.children,
        //     tabConfig: dashboardLayout[tabId]
        // });

        if (tabId) {
          dispatch(setDirectPathToChild([tabsComponent.id, tabId]));
        }
      }
    }
  }, [dispatch, dashboardLayout, activeTabIndex, dashboard]);

  if (!dashboard || !dashboardLayout || !charts) {
    // console.log('Loading state - Missing data:', {
    //     hasDashboard: !!dashboard,
    //     hasLayout: !!dashboardLayout,
    //     hasCharts: !!charts,
    //     dashboardData: dashboard,
    //     layoutData: dashboardLayout
    // });
    return <div>{t('Loading...')}</div>;
  }

  const tabsComponent = findTabsComponent(dashboardLayout);
  // console.log('Render - Tabs component:', {
  //     found: !!tabsComponent,
  //     component: tabsComponent,
  //     children: tabsComponent?.children,
  //     dashboardLayoutKeys: Object.keys(dashboardLayout),
  //     position: dashboard.position_data,
  //     metadata: dashboard.metadata,
  //     fullLayout: dashboardLayout
  // });

  if (!tabsComponent?.children) {
    return <div>{t('No tabs found in this dashboard')}</div>;
  }

  const handleTabChange = (tabId: string) => {
    // console.log('Tab change:', { tabId, currentIndex: activeTabIndex });
    const newIndex = tabsComponent.children.indexOf(tabId);
    if (newIndex !== -1) {
      setActiveTabIndex(newIndex);
    }
  };

  // Ensure we have valid tab configurations before rendering
  const validTabs = tabsComponent!.children
    .map((tabId: string) => {
      const tabConfig = dashboardLayout[tabId];
      // console.log('Tab configuration:', {
      //     tabId,
      //     config: tabConfig,
      //     hasMetadata: !!tabConfig?.meta,
      //     text: tabConfig?.meta?.text,
      //     type: tabConfig?.type
      // });
      // Check for both meta and type being TAB
      return tabConfig && (tabConfig.type === 'TAB' || tabConfig.meta)
        ? { id: tabId, config: tabConfig }
        : null;
    })
    .filter((tab: any) => tab !== null);

  if (validTabs.length === 0) {
    console.error('No valid tab configurations found');
    return <div>{t('No valid tabs found in this dashboard')}</div>;
  }

  return (
    <>
      <Global styles={globalStyles} />
      <StyledTabsContainer>
        <LineEditableTabs
          id={tabsComponent!.id}
          activeKey={tabsComponent!.children[activeTabIndex]}
          onChange={handleTabChange}
          type="card"
        >
          {validTabs.map((tab: { id: string; config: any }) => (
            <LineEditableTabs.TabPane
              key={tab.id}
              tab={tab.config.meta?.text || tab.config.id || t('Untitled')}
            >
              <TabContentContainer>
                {renderTabContent(tab.config, dashboardLayout)}
              </TabContentContainer>
            </LineEditableTabs.TabPane>
          ))}
        </LineEditableTabs>
      </StyledTabsContainer>
    </>
  );
}

export default DashboardTabs;
