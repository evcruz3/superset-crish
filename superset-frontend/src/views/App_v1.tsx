/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { Suspense, useEffect } from 'react';
import { hot } from 'react-hot-loader/root';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  useLocation,
} from 'react-router-dom';
import { bindActionCreators } from 'redux';
import { GlobalStyles } from 'src/GlobalStyles';
import ErrorBoundary from 'src/components/ErrorBoundary';
import Loading from 'src/components/Loading';
import Menu from 'src/features/home/Menu_v1';
import getBootstrapData from 'src/utils/getBootstrapData';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import setupApp from 'src/setup/setupApp';
import setupPlugins from 'src/setup/setupPlugins';
import { routes, isFrontendRoute } from 'src/views/routes';
import { Logger, LOG_ACTIONS_SPA_NAVIGATION } from 'src/logger/LogUtils';
import setupExtensions from 'src/setup/setupExtensions';
import { logEvent } from 'src/logger/actions';
import { store } from 'src/views/store';
import { RootContextProviders } from './RootContextProviders';
import { ScrollToTop } from './ScrollToTop';
import { styled } from '@superset-ui/core';
import { useUiConfig } from 'src/components/UiConfigContext';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';

setupApp();
setupPlugins();
setupExtensions();

const bootstrapData = getBootstrapData();

// Define SIDEBAR_WIDTH, ensure this is the same as in Menu.tsx or import it
// For now, hardcoding, but ideally this would be a shared constant.
const SIDEBAR_WIDTH = 300; // px

const AppContainer = styled.div`
  display: flex;
  height: 100vh; // Ensure full viewport height
`;

const MainContent = styled.main<{ $sidebarVisible: boolean }>`
  flex-grow: 1;
  padding-left: ${({ $sidebarVisible }) =>
    $sidebarVisible ? `${SIDEBAR_WIDTH}px` : '0px'};
  overflow-y: auto; // Allow content to scroll independently
  height: 100%; // Ensure it can scroll full height if content overflows
`;

let lastLocationPathname: string;

const boundActions = bindActionCreators({ logEvent }, store.dispatch);

const LocationPathnameLogger = () => {
  const location = useLocation();
  useEffect(() => {
    // This will log client side route changes for single page app user navigation
    boundActions.logEvent(LOG_ACTIONS_SPA_NAVIGATION, {
      path: location.pathname,
    });
    // reset performance logger timer start point to avoid soft navigation
    // cause dashboard perf measurement problem
    if (lastLocationPathname && lastLocationPathname !== location.pathname) {
      Logger.markTimeOrigin();
    }
    lastLocationPathname = location.pathname;
  }, [location.pathname]);
  return <></>;
};

const App = () => {
  const uiConfig = useUiConfig();
  const standalone = getUrlParam(URL_PARAMS.standalone);
  const sidebarVisible = !(standalone || uiConfig.hideNav);

  return (
    <Router>
      <ScrollToTop />
      <LocationPathnameLogger />
      <RootContextProviders>
        <GlobalStyles />
        <AppContainer>
          <Menu
            data={bootstrapData.common.menu_data}
            isFrontendRoute={isFrontendRoute}
          />
          <MainContent $sidebarVisible={sidebarVisible}>
            <Switch>
              {routes.map(({ path, Component, props = {}, Fallback = Loading }) => (
                <Route path={path} key={path}>
                  <Suspense fallback={<Fallback />}>
                    <ErrorBoundary>
                      <Component user={bootstrapData.user} {...props} />
                    </ErrorBoundary>
                  </Suspense>
                </Route>
              ))}
            </Switch>
            <ToastContainer />
          </MainContent>
        </AppContainer>
      </RootContextProviders>
    </Router>
  );
};

export default hot(App);
