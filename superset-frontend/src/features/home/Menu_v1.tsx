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
import { styled, css, useTheme, SupersetTheme, t } from '@superset-ui/core';
import { debounce } from 'lodash';
import { Global } from '@emotion/react';
import { getUrlParam } from 'src/utils/urlUtils';
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
  NavBarProps,
  BrandProps,
} from 'src/types/bootstrapTypes';
import LanguagePicker from './LanguagePicker';
import Label from 'src/components/Label';

interface MenuProps {
  data: MenuData;
  isFrontendRoute?: (path?: string) => boolean;
}

interface MenuDataForSidebar {
  mainNavItems: MenuObjectProps[];      // For Charts, Dashboards etc.
  createMenuItems: MenuObjectProps[];   // For the "Create" submenu items
  settingsPageGroups: MenuObjectProps[]; // For Data, Manage, Security page groups
  brand: BrandProps;
  navbar_right: NavBarProps;
  environment_tag: { text: string; color: string; };
}

interface ExtendedMenuProps {
  data: MenuDataForSidebar;
  isFrontendRoute?: (path?: string) => boolean;
}

const SIDEBAR_WIDTH = 300; // px

const StyledSidebar = styled.aside`
  ${({ theme }) => `
    background-color: ${theme.colors.grayscale.light5};
    width: ${SIDEBAR_WIDTH}px;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    padding-top: ${theme.gridUnit * 2}px; // Adjusted padding
    border-right: 1px solid ${theme.colors.grayscale.light2};
    overflow-y: auto;

    .navbar-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      /* must be exactly the height of the Antd navbar */
      min-height: 50px; // from .bak
      padding: ${theme.gridUnit}px ${theme.gridUnit * 2}px; // from .bak
      margin-bottom: ${theme.gridUnit * 2}px; // Adjusted margin
      max-width: ${theme.gridUnit * theme.brandIconMaxWidth}px; // from .bak
      img {
        height: 100%; // from .bak
        max-width: ${theme.gridUnit * 20}px;
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
      color: ${theme.colors.grayscale.dark1};
      font-size: ${theme.typography.sizes.m}px;
      text-align: center;
      margin-top: ${theme.gridUnit}px;
      margin-bottom: ${theme.gridUnit * 4}px; // Increased bottom margin
      padding-left: ${theme.gridUnit}px; // Adjusted padding
      padding-right: ${theme.gridUnit}px; // Adjusted padding
      span {
        max-width: ${SIDEBAR_WIDTH - theme.gridUnit * 4}px; // Ensure text fits
        white-space: normal;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .main-nav {
      width: 100%;
      &.ant-menu-inline {
        border-right: none;

        // Ensure all top-level list items have no bottom margin for consistent spacing
        > .ant-menu-item,
        > .ant-menu-submenu.ant-menu-submenu-inline {
          margin-bottom: 0 !important;
        }

        .ant-menu-item, // This is the <li> for a direct link item
        .ant-menu-submenu-title { // This is the <div> title part of a SubMenu <li>
          margin: 0; // Ensures no internal vertical margins within these elements themselves
          width: 100%;
          border-radius: 0;
          
          // Explicitly set all padding components to control height accurately
          padding-top: 0;
          padding-bottom: 0;
          padding-left: ${theme.gridUnit * 4}px !important; // User's current value
          padding-right: ${theme.gridUnit * 4}px; // Add some padding for the submenu arrow or if text is long

          // background-color: ${theme.colors.alert.base}; // Removing user's temporary debug background

          display: flex;
          align-items: center;
          height: ${theme.gridUnit * 10}px; // Consistent height
          line-height: normal; // Let flex align-items handle vertical centering of text
        }

        .ant-menu-item a, .ant-menu-submenu-title a { // Targets <a> tags *inside* the above
          padding: 0; // Removes any padding from the <a> tag itself
          // background-color: ${theme.colors.alert.base}; // Removing user's temporary debug background
        }

        .ant-menu-item::after {
          border-right: none;
        }

        .ant-menu-item-selected {
          background-color: ${theme.colors.primary.light4} !important; // Ensure high specificity
          a {
            color: ${theme.colors.primary.dark1};
          }
        }
        .ant-menu-item:hover,
        .ant-menu-submenu-title:hover {
          background-color: ${theme.colors.primary.light5};
          color: ${theme.colors.grayscale.dark1}; // from .bak .ant-menu-item a:hover
        }
        .ant-menu-item a:hover { // from .bak
            color: ${theme.colors.grayscale.dark1};
            background-color: ${theme.colors.primary.light5};
            border-bottom: none;
            margin: 0;
            &:after {
              opacity: 1;
              width: 100%;
            }
        }

        .ant-menu-submenu {
          .ant-menu-sub {
            padding-left: 0;
            background-color: ${theme.colors.grayscale.light4};
          }
          .ant-menu-item {
             padding-left: ${theme.gridUnit * 8}px !important; // Slightly increased indent for sub-items
          }
        }
      }
      // Copied from .bak .main-nav .ant-menu-submenu-title > svg
      .ant-menu-submenu-title > .ant-menu-submenu-arrow {
        top: ${theme.gridUnit * 4}px; // Adjusted for vertical alignment
      }
    }
    .caret { // from .bak
      display: none;
    }

    .menu-container {
      flex-grow: 1;
      overflow-y: auto;
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
    height: auto; // Keep auto for vertical
    line-height: normal; // Keep normal for vertical
    i {
      padding-right: ${theme.gridUnit * 2}px;
      margin-left: ${theme.gridUnit * 1.75}px;
    }
  }
  .ant-menu-item-selected {
    background-color: transparent; // from .bak - ensure this doesn't conflict with StyledSidebar's selected style
    &:not(.ant-menu-item-active) {
      color: inherit;
      // border-bottom-color: transparent; // Not applicable for vertical
      & > a {
        color: inherit;
      }
    }
  }
  .ant-menu-inline > .ant-menu-item:has(> .is-active) {
    // background-color: ${theme.colors.primary.light5}; // Already handled by .ant-menu-item-selected in StyledSidebar
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

  // specific to new sidebar for better pop-up menu alignment and styling
  .ant-menu-submenu-popup.ant-menu-light.ant-menu-vertical {
    border-radius: ${theme.borderRadius}px;
    box-shadow: 0px 3px 6px -4px rgba(0, 0, 0, 0.12), 0px 9px 28px 8px rgba(0, 0, 0, 0.05); // Inspired by ActionCell SHADOW constant
    background-color: ${theme.colors.grayscale.light5}; // Match sidebar bg
  }

  .ant-menu-submenu-popup .ant-menu-item,
  .ant-menu-submenu-popup .ant-menu-submenu-title {
    padding-left: ${theme.gridUnit * 4}px !important;
    padding-right: ${theme.gridUnit * 4}px !important;
  }

  .ant-menu-submenu-popup .ant-menu-item a:hover {
    background-color: ${theme.colors.primary.light5};
  }

  .ant-menu-submenu-popup .ant-menu-item-selected {
     background-color: ${theme.colors.primary.light4} !important;
      a {
        color: ${theme.colors.primary.dark1} !important;
      }
  }
`;

const { SubMenu } = DropdownMenu;

const EnvironmentTagWrapper = styled.div`
  text-align: center;
  margin-bottom: ${({ theme }: { theme: SupersetTheme }) => theme.gridUnit * 4}px;
  padding: 0 ${({ theme }: { theme: SupersetTheme }) => theme.gridUnit * 2}px;
`;

const footerLinkStyles = (theme: SupersetTheme) => css`
  display: block;
  color: ${theme.colors.grayscale.dark1};
  padding: ${theme.gridUnit * 2}px ${theme.gridUnit * 2}px;
  font-size: ${theme.typography.sizes.s}px;
  border-radius: ${theme.borderRadius}px;

  &:hover {
    background-color: ${theme.colors.grayscale.light3};
    text-decoration: none;
  }

  i {
    margin-right: ${theme.gridUnit * 2}px;
    width: ${theme.gridUnit * 3}px;
    text-align: center;
  }
`;

const FooterLink = styled(NavLink)`
  ${({ theme }: { theme: SupersetTheme }) => footerLinkStyles(theme)}
`;

const FooterAnchor = styled.a`
  ${({ theme }: { theme: SupersetTheme }) => footerLinkStyles(theme)}
`;

const VersionInfoContainer = styled.div`
  font-size: ${({ theme }: { theme: SupersetTheme }) => theme.typography.sizes.xs}px;
  color: ${({ theme }: { theme: SupersetTheme }) => theme.colors.grayscale.base};
  padding: ${({ theme }: { theme: SupersetTheme }) => theme.gridUnit}px ${({ theme }: { theme: SupersetTheme }) => theme.gridUnit * 2}px;
  
  div {
    margin-bottom: ${({ theme }: { theme: SupersetTheme }) => theme.gridUnit / 2}px;
  }
`;


export function Menu({
  data: {
    mainNavItems,
    createMenuItems,   // Now available from props
    settingsPageGroups,
    brand,
    navbar_right: navbarRight,
    environment_tag: environmentTag,
  },
  isFrontendRoute = () => false,
}: ExtendedMenuProps) {
  const uiConfig = useUiConfig();
  const theme = useTheme();

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
    let foundActive = false;
    // Try to set active tab based on mainNavItems first
    mainNavItems.forEach(item => {
      if (path.startsWith(item.url || 'a\b\c\d')) { // a\b\c\d is unlikely to match
        setActiveTabs([item.name || item.label]);
        foundActive = true;
      }
    });
    if (foundActive) return;

    // Then check settingsPageGroups if no match in mainNav
    settingsPageGroups.forEach(group => {
        if (group.childs && Array.isArray(group.childs)) {
            group.childs.forEach(child => {
                if (typeof child !== 'string' && child.url && path.startsWith(child.url)) {
                    setActiveTabs([child.name || child.label]);
                    foundActive = true;
                }
            });
        }
    });
    if (foundActive) return;
    
    // Fallback to original logic if still no match
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
  }, [location.pathname, mainNavItems, settingsPageGroups]);

  const standalone = getUrlParam(URL_PARAMS.standalone);
  if (standalone || uiConfig.hideNav) return <></>;

  const renderSubMenu = ({
    label,
    childs,
    url,
    name,
    icon,
    isFrontendRoute: itemIsFrontendRoute,
    onClick,
  }: MenuObjectProps, isTopLevelCall: boolean = true) => {
    const key = name || label;

    if (url && itemIsFrontendRoute) {
      return (
        <DropdownMenu.Item key={key} role="presentation" 
        // icon={isTopLevelCall && icon && <i className={`fa ${icon}`} />}
         >
          <NavLink role="button" to={url} activeClassName="is-active">
            {label}
          </NavLink>
        </DropdownMenu.Item>
      );
    }
    if (url) {
      return (
        <DropdownMenu.Item key={key} icon={isTopLevelCall && icon && <i className={`fa ${icon}`} />} >
          <a href={url}>{label}</a>
        </DropdownMenu.Item>
      );
    }
    return (
      <SubMenu
        key={key}
        title={label}
        icon={icon && <i className={`fa ${icon}`} 
        />
      }
      >
        {childs?.map((child: MenuObjectChildProps | string) => {
          if (typeof child === 'string' && child === '-') {
            return <DropdownMenu.Divider key={`divider-${key}-${child}`} />;
          }
          if (typeof child !== 'string') {
            return renderSubMenu(prepareItemForRender(child as MenuObjectProps, false), false);
          }
          return null;
        })}
      </SubMenu>
    );
  };

  const prepareItemForRender = (item: MenuObjectProps, isTopLevel: boolean = true): MenuObjectProps => ({
    ...item,
    isFrontendRoute: item.url ? isFrontendRoute(item.url) : false,
    childs: item.childs?.map(c => 
        typeof c === 'string' ? c : prepareItemForRender(c as MenuObjectProps, false) 
    )
  });

  return (
    <StyledSidebar className="main-sidebar" id="main-menu" role="navigation">
      <Global styles={globalStyles(theme)} />
      {/* Brand and Environment Tag */}
      <Tooltip id="brand-tooltip" placement="right" title={brand.tooltip} arrowPointAtCenter>
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
        <div className="navbar-brand-text"><span>{brand.text}</span></div>
      )}
      {environmentTag?.text && (
        <EnvironmentTagWrapper>
          <Label css={{ borderRadius: `${theme.gridUnit * 125}px` }}
            color={ /^#(?:[0-9a-f]{3}){1,2}$/i.test(environmentTag.color) ? environmentTag.color : environmentTag.color.split('.').reduce((o: any, i: string) => o?.[i], theme.colors as any)}>
            {environmentTag.text}
          </Label>
        </EnvironmentTagWrapper>
      )}

      {/* Scrollable Menu Container */}
      <div className="menu-container">
        <DropdownMenu mode="inline" data-test="sidebar-nav" className="main-nav" selectedKeys={activeTabs}>
          {/* == Main Application Navigation (TOP PART) == */}
          {mainNavItems.map((item: MenuObjectProps) => renderSubMenu(prepareItemForRender(item, true), true))}

          {/* == Visually Separated Bottom Part (formerly RightMenu items) == */}
          {(mainNavItems.length > 0 || createMenuItems.length > 0 || settingsPageGroups.length > 0 || navbarRight.show_language_picker) && 
            <DropdownMenu.Divider 
              key="top-bottom-separator" 
              style={{ 
                margin: `${theme.gridUnit * 3}px 0 ${theme.gridUnit * 1.5}px 0`,
                borderTop: `1.5px solid ${theme.colors.grayscale.light1}` 
              }}
            />
          }

          {/* "Create" SubMenu */}
          {createMenuItems && createMenuItems.length > 0 && (
             <SubMenu key="create_new_section" title={t('Create')} 
             icon={<i className="fa fa-plus" />}
             >
                {createMenuItems.map(item => renderSubMenu(prepareItemForRender(item, false), false))}
             </SubMenu>
          )}

          {/* "Settings" SubMenu (containing Data, Manage, Security groups) */}
          {settingsPageGroups && settingsPageGroups.length > 0 && (
            <SubMenu key="settings_group_section" title={t('Settings')} icon={<i className="fa fa-cog" />}>
              {settingsPageGroups.map((groupItem: MenuObjectProps) => renderSubMenu(prepareItemForRender(groupItem, false), false))}
            </SubMenu>
          )}
          
          {/* Language Picker SubMenu */}
          {navbarRight.show_language_picker && (
            <LanguagePicker 
              locale={navbarRight.locale} 
              languages={navbarRight.languages} 
              key="language_picker_key" // Added key
            />
          )}

          {/* Help SubMenu */}
          {(navbarRight.documentation_url || navbarRight.bug_report_url) && (
              <SubMenu key="help_section" title={t('Help')} icon={<i className="fa fa-question-circle" />}>
                {navbarRight.documentation_url && 
                    renderSubMenu(prepareItemForRender({ label: navbarRight.documentation_text || t('Documentation'), name: 'doc_link', url: navbarRight.documentation_url, icon:'fa-book'}, false), false)}
                {navbarRight.bug_report_url && 
                    renderSubMenu(prepareItemForRender({ label: navbarRight.bug_report_text || t('Report a Bug'), name: 'bug_link', url: navbarRight.bug_report_url, icon:'fa-bug'}, false), false)}
              </SubMenu>
          )}
          
          {/* User Actions / Login Link */}
          {!navbarRight.user_is_anonymous && (
              <SubMenu key="user_section" title={t('User')} icon={<i className="fa fa-user" />}>
                 {navbarRight.user_info_url && 
                    renderSubMenu(prepareItemForRender({ label: t('Info'), name: 'user_info', url: navbarRight.user_info_url }, false), false)}
                 {renderSubMenu(prepareItemForRender({ label: t('Logout'), name: 'logout', url: navbarRight.user_logout_url, onClick: () => { window.location.href = navbarRight.user_logout_url; } }, false), false)}
              </SubMenu>
          )}
           {navbarRight.user_is_anonymous && (
               renderSubMenu(prepareItemForRender({ label: t('Login'), name: 'login', url: navbarRight.user_login_url, icon: 'fa-sign-in' }, true), true)
           )}

          {/* About Section SubMenu */}
          {(navbarRight.version_string || navbarRight.version_sha || navbarRight.build_number) && (
            <SubMenu key="about_section" title={t('About')} icon={<i className="fa fa-info-circle" />}>
                {navbarRight.show_watermark && <DropdownMenu.Item key="watermark" disabled style={{cursor: 'default', color: theme.colors.grayscale.base, paddingLeft: theme.gridUnit * 4, fontSize: theme.typography.sizes.s}}>{t('Powered by Apache Superset')}</DropdownMenu.Item>}
                {navbarRight.version_string && <DropdownMenu.Item key="version" disabled style={{cursor: 'default', color: theme.colors.grayscale.base, paddingLeft: theme.gridUnit * 4, fontSize: theme.typography.sizes.s}}>{t('Version')}: {navbarRight.version_string}</DropdownMenu.Item>}
                {navbarRight.version_sha && <DropdownMenu.Item key="sha" disabled style={{cursor: 'default', color: theme.colors.grayscale.base, paddingLeft: theme.gridUnit * 4, fontSize: theme.typography.sizes.s}}>{t('SHA')}: {navbarRight.version_sha}</DropdownMenu.Item>}
                {navbarRight.build_number && <DropdownMenu.Item key="build" disabled style={{cursor: 'default', color: theme.colors.grayscale.base, paddingLeft: theme.gridUnit * 4, fontSize: theme.typography.sizes.s}}>{t('Build')}: {navbarRight.build_number}</DropdownMenu.Item>}
            </SubMenu>
          )}
          </DropdownMenu>
      </div>
      {/* <SidebarFooter>
        {navbarRight.show_language_picker && (
          <>
            <div className="footer-section-title">{t('Language')}</div>
            <DropdownMenu
              mode="inline"
              css={css`
                background: transparent;
                border-right: none;
                &.ant-menu-inline {
                  .ant-menu-item,
                  .ant-menu-submenu-title {
                    margin: 0;
                    width: 100%;
                    border-radius: 0;
                    // Adjusted padding to be less than main menu items, similar to other footer links
                    padding-left: ${theme.gridUnit * 2}px !important;
                    padding-right: ${theme.gridUnit * 2}px !important;
                  }
                  // Ensure sub-menu popups are styled reasonably
                  .ant-menu-sub.ant-menu-vertical {
                    background-color: ${theme.colors.grayscale.light5}; // Example color
                  }
                }
              `}
            >
              <LanguagePicker
                locale={navbarRight.locale}
                languages={navbarRight.languages}
                key="language_picker_key" // Key reinstated
              />
            </DropdownMenu>
            <DropdownMenu.Divider key="lang-divider" style={{ margin: `${theme.gridUnit * 2}px 0`}} />
          </>
        )}

        {(navbarRight.documentation_url || navbarRight.bug_report_url) && (
          <>
            <div className="footer-section-title">{t('Help')}</div>
            {navbarRight.documentation_url && (
              <FooterAnchor
                href={navbarRight.documentation_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className={`fa ${navbarRight.documentation_icon || 'fa-question'}`} />
                {navbarRight.documentation_text || t('Documentation')}
              </FooterAnchor>
            )}
            {navbarRight.bug_report_url && (
              <FooterAnchor
                href={navbarRight.bug_report_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className={`fa ${navbarRight.bug_report_icon || 'fa-bug'}`} />
                {navbarRight.bug_report_text || t('Report a Bug')}
              </FooterAnchor>
            )}
          </>
        )}
        
        {!navbarRight.user_is_anonymous && (
          <>
            <DropdownMenu.Divider key="user-actions-divider" style={{ margin: `${theme.gridUnit * 2}px 0`}}/>
            <div className="footer-section-title">{t('User')}</div>
            {navbarRight.user_info_url && (
              <FooterAnchor href={navbarRight.user_info_url}>
                <i className="fa fa-user" />
                {t('Info')}
              </FooterAnchor>
            )}
            <FooterAnchor href={navbarRight.user_logout_url} onClick={() => { handleLogout(); window.location.href = navbarRight.user_logout_url; }}>
              <i className="fa fa-sign-out" />
              {t('Logout')}
            </FooterAnchor>
          </>
        )}
        {navbarRight.user_is_anonymous && (
          <>
            <DropdownMenu.Divider key="login-divider" style={{ margin: `${theme.gridUnit * 2}px 0`}}/>
            <FooterAnchor href={navbarRight.user_login_url}>
              <i className="fa fa-sign-in" />
              {t('Login')}
            </FooterAnchor>
          </>
        )}
        
        {(navbarRight.version_string || navbarRight.version_sha || navbarRight.build_number) && (
            <>
            <DropdownMenu.Divider key="version-divider" style={{ margin: `${theme.gridUnit * 2}px 0`}}/>
            <div className="footer-section-title">{t('About')}</div>
            <VersionInfoContainer>
                {navbarRight.show_watermark && (
                    <div>{t('Powered by Apache Superset')}</div>
                )}
                {navbarRight.version_string && (
                <div>{t('Version')}: {navbarRight.version_string}</div>
                )}
                {navbarRight.version_sha && (
                <div>{t('SHA')}: {navbarRight.version_sha}</div>
                )}
                {navbarRight.build_number && (
                <div>{t('Build')}: {navbarRight.build_number}</div>
                )}
            </VersionInfoContainer>
            </>
        )}
      </SidebarFooter> */}
    </StyledSidebar>
  );
}

export default function MenuWrapper({ data: originalData, isFrontendRoute }: { data: MenuData, isFrontendRoute?: (path?: string) => boolean }) {
  
  const mainNavItems: MenuObjectProps[] = [];
  const settingsPageGroups: MenuObjectProps[] = [];

  const settingsGroupNames: Record<string, boolean> = {
    Data: true,
    Security: true,
    Manage: true,
  };

  originalData.menu.forEach((item: MenuObjectProps) => {
    if (!item) return;
    const children: (MenuObjectChildProps | string)[] = [];
    if (item.childs) {
      item.childs.forEach((child: MenuObjectChildProps | string) => {
        if (typeof child === 'string') children.push(child);
        else if (child.label) {
          if (child.url && isFrontendRoute) child.isFrontendRoute = isFrontendRoute(child.url);
          children.push(child);
        }
      });
      item.childs = children;
    }
    if (item.url && isFrontendRoute) item.isFrontendRoute = isFrontendRoute(item.url);

    if (item.name && settingsGroupNames[item.name]) {
      settingsPageGroups.push(item);
    } else {
      mainNavItems.push(item);
    }
  });
  
  if (originalData.settings && originalData.settings.length > 0) {
    originalData.settings.forEach(settingSection => {
      if (!settingSection) return;
      const settingChildren: (MenuObjectChildProps | string)[] = [];
      if (settingSection.childs) {
        settingSection.childs.forEach((child: MenuObjectChildProps | string) => {
          if (typeof child === 'string') settingChildren.push(child);
          else if (child.label) {
            if (child.url && isFrontendRoute) child.isFrontendRoute = isFrontendRoute(child.url);
            settingChildren.push(child);
          }
        });
        settingSection.childs = settingChildren;
      }
      if (settingSection.url && isFrontendRoute) settingSection.isFrontendRoute = isFrontendRoute(settingSection.url);
      if (!settingsPageGroups.find(sgp => sgp.name === settingSection.name)) {
          settingsPageGroups.push(settingSection);
      }
    });
  }

  // Define createMenuItems (previously hardcoded in Menu component)
  // Ensure isFrontendRoute is applied to urls here
  const createMenuItems: MenuObjectProps[] = [
    {
      label: t('SQL query'),
      name: 'sql_query_action',
      icon: 'fa-fw fa-search',
      url: '/sqllab?new=true',
      isFrontendRoute: isFrontendRoute ? isFrontendRoute('/sqllab?new=true') : false,
    },
    {
      label: t('Chart'),
      name: 'chart_action',
      icon: 'fa-fw fa-bar-chart',
      url: '/chart/add',
      isFrontendRoute: isFrontendRoute ? isFrontendRoute('/chart/add') : false,
    },
    {
      label: t('Dashboard'),
      name: 'dashboard_action',
      icon: 'fa-fw fa-dashboard',
      url: '/dashboard/new',
      isFrontendRoute: isFrontendRoute ? isFrontendRoute('/dashboard/new') : false,
    },
    {
        label: t('Data'), // This is the "Data" submenu under "Create"
        name: 'data_create_submenu_action',
        icon: 'fa-database',
        childs: [
            {
                label: t('Connect database'),
                name: 'connect_database_action_item',
                url: '#!', 
                icon: 'fa-plus',
            },
            {
                label: t('Create dataset'),
                name: 'create_dataset_action_item',
                url: '/dataset/add/',
                icon: 'fa-table',
                isFrontendRoute: isFrontendRoute ? isFrontendRoute('/dataset/add/') : false,
            },
            {
                label: t('Upload file'),
                name: 'upload_file_action_item',
                url: '#!', 
                icon: 'fa-upload',
            },
        ],
    },
  ];
  
  const finalSidebarData: MenuDataForSidebar = {
    mainNavItems,
    createMenuItems, // Add createMenuItems here
    settingsPageGroups,
    brand: originalData.brand,
    navbar_right: originalData.navbar_right,
    environment_tag: originalData.environment_tag,
  };

  return <Menu data={finalSidebarData} isFrontendRoute={isFrontendRoute} />;
}

