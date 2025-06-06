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
import { useState, useEffect } from 'react';
import { styled, css, useTheme, SupersetTheme } from '@superset-ui/core';
import { debounce } from 'lodash';
import { Global } from '@emotion/react';
import { getUrlParam } from 'src/utils/urlUtils';
import { Row, Col, Grid } from 'src/components';
import { MainNav as DropdownMenu, MenuMode } from 'src/components/Menu';
import { Tooltip } from 'src/components/Tooltip';
import { NavLink, useLocation } from 'react-router-dom';
import { GenericLink } from 'src/components/GenericLink/GenericLink';
import Icons from 'src/components/Icons';
import { useUiConfig } from 'src/components/UiConfigContext';
import { URL_PARAMS } from 'src/constants';
import {
  MenuObjectChildProps,
  MenuObjectProps,
  MenuData,
} from 'src/types/bootstrapTypes';
import RightMenu from './RightMenu';

interface MenuProps {
  data: MenuData;
  isFrontendRoute?: (path?: string) => boolean;
}

const StyledHeader = styled.header`
  ${({ theme }) => `
      background-color: ${theme.colors.grayscale.light5};
      margin-bottom: 2px;
      z-index: 10;

      &:nth-last-of-type(2) nav {
        margin-bottom: 2px;
      }
      .caret {
        display: none;
      }
      .navbar-brand {
        display: flex;
        flex-direction: column;
        justify-content: center;
        /* must be exactly the height of the Antd navbar */
        min-height: 50px;
        padding: ${theme.gridUnit}px
          ${theme.gridUnit * 2}px
          ${theme.gridUnit}px
          ${theme.gridUnit * 4}px;
        max-width: ${theme.gridUnit * theme.brandIconMaxWidth}px;
        img {
          height: 100%;
          object-fit: contain;
        }
        &:focus {
          border-color: transparent;
        }
        &:focus-visible {
          border-color: ${theme.colors.primary.dark1};
        }
      }
      .navbar-brand-text {
        border-left: 1px solid ${theme.colors.grayscale.light2};
        border-right: 1px solid ${theme.colors.grayscale.light2};
        height: 100%;
        color: ${theme.colors.grayscale.dark1};
        padding-left: ${theme.gridUnit * 4}px;
        padding-right: ${theme.gridUnit * 4}px;
        margin-right: ${theme.gridUnit * 6}px;
        font-size: ${theme.gridUnit * 4}px;
        float: left;
        display: flex;
        flex-direction: column;
        justify-content: center;

        span {
          max-width: ${theme.gridUnit * 58}px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 1127px) {
          display: none;
        }
      }
      .main-nav .ant-menu-submenu-title > svg {
        top: ${theme.gridUnit * 5.25}px;
      }
      @media (max-width: 767px) {
        .navbar-brand {
          float: none;
        }
      }
      .ant-menu-horizontal .ant-menu-item {
        height: 100%;
        line-height: inherit;
      }
      .ant-menu > .ant-menu-item > a {
        padding: ${theme.gridUnit * 4}px;
      }
      @media (max-width: 767px) {
        .ant-menu-item {
          padding: 0 ${theme.gridUnit * 6}px 0
            ${theme.gridUnit * 3}px !important;
        }
        .ant-menu > .ant-menu-item > a {
          padding: 0px;
        }
        .main-nav .ant-menu-submenu-title > svg:nth-of-type(1) {
          display: none;
        }
        .ant-menu-item-active > a {
          &:hover {
            color: ${theme.colors.primary.base} !important;
            background-color: transparent !important;
          }
        }
      }
      .ant-menu-item a {
        &:hover {
          color: ${theme.colors.grayscale.dark1};
          background-color: ${theme.colors.primary.light5};
          border-bottom: none;
          margin: 0;
          &:after {
            opacity: 1;
            width: 100%;
          }
        }
      }
      .ant-menu-overflowed-submenu {
        .ant-menu-submenu-title {
          display: flex;
          align-items: center;
          height: 100%;
          span {
            font-size: ${theme.typography.sizes.xl}px;
            line-height: 1;
          }
        }
      }
  `}
`;
const globalStyles = (theme: SupersetTheme) => css`
  .ant-menu-submenu.ant-menu-submenu-popup.ant-menu.ant-menu-light.ant-menu-submenu-placement-bottomLeft {
    border-radius: 0px;
  }
  .ant-menu-submenu.ant-menu-submenu-popup.ant-menu.ant-menu-light {
    border-radius: 0px;
  }
  .ant-menu-vertical > .ant-menu-submenu.data-menu > .ant-menu-submenu-title {
    height: 28px;
    i {
      padding-right: ${theme.gridUnit * 2}px;
      margin-left: ${theme.gridUnit * 1.75}px;
    }
  }
  .ant-menu-item-selected {
    background-color: transparent;
    &:not(.ant-menu-item-active) {
      color: inherit;
      border-bottom-color: transparent;
      & > a {
        color: inherit;
      }
    }
  }
  .ant-menu-horizontal > .ant-menu-item:has(> .is-active) {
    color: ${theme.colors.primary.base};
    border-bottom-color: ${theme.colors.primary.base};
    & > a {
      color: ${theme.colors.primary.base};
    }
  }
  .ant-menu-vertical > .ant-menu-item:has(> .is-active) {
    background-color: ${theme.colors.primary.light5};
    & > a {
      color: ${theme.colors.primary.base};
    }
  }
`;
const { SubMenu } = DropdownMenu;

const { useBreakpoint } = Grid;

export function Menu({
  data: {
    menu,
    brand,
    navbar_right: navbarRight,
    settings,
    environment_tag: environmentTag,
  },
  isFrontendRoute = () => false,
}: MenuProps) {
  const [showMenu, setMenu] = useState<MenuMode>('horizontal');
  const screens = useBreakpoint();
  const uiConfig = useUiConfig();
  const theme = useTheme();

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth <= 767) {
        setMenu('inline');
      } else setMenu('horizontal');
    }
    handleResize();
    const windowResize = debounce(() => handleResize(), 10);
    window.addEventListener('resize', windowResize);
    return () => window.removeEventListener('resize', windowResize);
  }, []);

  enum Paths {
    Explore = '/explore',
    Dashboard = '/dashboard',
    Chart = '/chart',
    Datasets = '/tablemodelview',
  }

  const defaultTabSelection: string[] = [];
  const [activeTabs, setActiveTabs] = useState(defaultTabSelection);
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    switch (true) {
      case path.startsWith(Paths.Dashboard):
        setActiveTabs(['Dashboards']);
        break;
      case path.startsWith(Paths.Chart) || path.startsWith(Paths.Explore):
        setActiveTabs(['Charts']);
        break;
      case path.startsWith(Paths.Datasets):
        setActiveTabs(['Datasets']);
        break;
      default:
        setActiveTabs(defaultTabSelection);
    }
  }, [location.pathname]);

  const standalone = getUrlParam(URL_PARAMS.standalone);
  if (standalone || uiConfig.hideNav) return <></>;

  const renderSubMenu = ({
    label,
    childs,
    url,
    index,
    isFrontendRoute,
  }: MenuObjectProps) => {
    if (url && isFrontendRoute) {
      return (
        <DropdownMenu.Item key={label} role="presentation">
          <NavLink role="button" to={url} activeClassName="is-active">
            {label}
          </NavLink>
        </DropdownMenu.Item>
      );
    }
    if (url) {
      return (
        <DropdownMenu.Item key={label}>
          <a href={url}>{label}</a>
        </DropdownMenu.Item>
      );
    }
    return (
      <SubMenu
        key={index}
        title={label}
        icon={showMenu === 'inline' ? <></> : <Icons.TriangleDown />}
      >
        {childs?.map((child: MenuObjectChildProps | string, index1: number) => {
          if (typeof child === 'string' && child === '-' && label !== 'Data') {
            return <DropdownMenu.Divider key={`$${index1}`} />;
          }
          if (typeof child !== 'string') {
            return (
              <DropdownMenu.Item key={`${child.label}`}>
                {child.isFrontendRoute ? (
                  <NavLink
                    to={child.url || ''}
                    exact
                    activeClassName="is-active"
                  >
                    {child.label}
                  </NavLink>
                ) : (
                  <a href={child.url}>{child.label}</a>
                )}
              </DropdownMenu.Item>
            );
          }
          return null;
        })}
      </SubMenu>
    );
  };
  return (
    <StyledHeader className="top" id="main-menu" role="navigation">
      <Global styles={globalStyles(theme)} />
      <Row>
        <Col md={20} xs={24} style={{ display: 'flex', alignItems: 'center' }}>
          <Tooltip
            id="brand-tooltip"
            placement="bottomLeft"
            title={brand.tooltip}
            arrowPointAtCenter
          >
            {isFrontendRoute(window.location.pathname) ? (
              <GenericLink className="navbar-brand" to={brand.path}>
                <img src={brand.icon} alt={brand.alt} />
              </GenericLink>
            ) : (
              <a className="navbar-brand" href={brand.path} tabIndex={-1}>
                <img src={brand.icon} alt={brand.alt} />
              </a>
            )}
          </Tooltip>
          {brand.text && (
            <div className="navbar-brand-text">
              <span>{brand.text}</span>
            </div>
          )}
          <DropdownMenu
            mode={showMenu}
            data-test="navbar-top"
            className="main-nav"
            selectedKeys={activeTabs}
            overflowedIndicator={<Icons.MoreHoriz />}
            style={{ flex: '1 1 auto', minWidth: 0 /* Important for flex shrink */ }}
          >
            {menu.map((item, index) => {
              const props = {
                index,
                ...item,
                isFrontendRoute: isFrontendRoute(item.url),
                childs: item.childs?.map(c => {
                  if (typeof c === 'string') {
                    return c;
                  }

                  return {
                    ...c,
                    isFrontendRoute: isFrontendRoute(c.url),
                  };
                }),
              };

              return renderSubMenu(props);
            })}
          </DropdownMenu>
        </Col>
        <Col md={4} xs={24}>
          <RightMenu
            align={screens.md ? 'flex-end' : 'flex-start'}
            settings={settings}
            navbarRight={navbarRight}
            isFrontendRoute={isFrontendRoute}
            environmentTag={environmentTag}
          />
        </Col>
      </Row>
    </StyledHeader>
  );
}

// transform the menu data to reorganize components
export default function MenuWrapper({ data, ...rest }: MenuProps) {
  const newMenuData = {
    ...data,
  };

  // Menu items that should go into settings dropdown
  const settingsMenus = {
    Data: true,
    Security: true,
    Manage: true,
  };

  // Cycle through menu.menu to build out cleanedMenu and settings
  const cleanedMenu: MenuObjectProps[] = [
  ];
  const settings: MenuObjectProps[] = [];
  newMenuData.menu.forEach((item: any) => {
    if (!item) {
      return;
    }

    const children: (MenuObjectProps | string)[] = [];
    const newItem = {
      ...item,
    };

    // Filter childs
    if (item.childs) {
      item.childs.forEach((child: MenuObjectChildProps | string) => {
        if (typeof child === 'string') {
          children.push(child);
        } else if ((child as MenuObjectChildProps).label) {
          children.push(child);
        }
      });

      newItem.childs = children;
    }

    if (!settingsMenus.hasOwnProperty(item.name)) {
      cleanedMenu.push(newItem);
    } else {
      settings.push(newItem);
    }
  });

  newMenuData.menu = cleanedMenu;
  newMenuData.settings = settings;

  return <Menu data={newMenuData} {...rest} />;
}
