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
import { PureComponent, MouseEvent } from 'react';
import {
  t,
  getNumberFormatter,
  getTimeFormatter,
  SMART_DATE_VERBOSE_ID,
  computeMaxFontSize,
  BRAND_COLOR,
  styled,
  BinaryQueryObjectFilterClause,
} from '@superset-ui/core';
import Echart from '../components/Echart';
import { BigNumberVizProps } from './types';
import { EventHandlers } from '../types';

const defaultNumberFormatter = getNumberFormatter();

const PROPORTION = {
  // text size: proportion of the chart container sans trendline
  KICKER: 0.1,
  HEADER: 0.3,
  SUBHEADER: 0.125,
  // trendline size: proportion of the whole chart container
  TRENDLINE: 0.3,
};

// SVG Icons Map
const ICONS: { [key: string]: string } = {
  'dollar': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>`,
  'user': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  'chart-line': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/></svg>`,
  'chart-bar': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>`,
  'chart-pie': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 2v20c-5.07-.5-9-4.79-9-10s3.93-9.5 9-10zm2.03 0v8.99H22c-.47-4.74-4.24-8.52-8.97-8.99zm0 11.01V22c4.74-.47 8.5-4.25 8.97-8.99h-8.97z"/></svg>`,
  'percentage': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 11C9.43 11 11 9.43 11 7.5S9.43 4 7.5 4 4 5.57 4 7.5 5.57 11 7.5 11zm0-5C8.33 6 9 6.67 9 7.5S8.33 9 7.5 9 6 8.33 6 7.5 6.67 6 7.5 6zM4.0025 18.5831L18.5831 4.0025L19.9973 5.4167L5.4167 19.9973L4.0025 18.5831ZM16.5 13C14.57 13 13 14.57 13 16.5s1.57 3.5 3.5 3.5 3.5-1.57 3.5-3.5-1.57-3.5-3.5-3.5zm0 5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  'coins': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/></svg>`,
  'clock': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  'calendar': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>`,
  // Weather Parameters
  'cloud-rain': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 13v8H8v-8h8m2-5a5 5 0 00-5-5 5 5 0 00-5 5v2H6a2 2 0 00-2 2v12c0 1.1.9 2 2 2h12a2 2 0 002-2V12a2 2 0 00-2-2h-2v-2z"/></svg>`,
  'droplet': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>`,
  'temperature-high': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 13V5a3 3 0 00-6 0v8a5 5 0 106 0M12 4a1 1 0 011 1v8h-2V5a1 1 0 011-1z"/></svg>`,
  'temperature-low': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 13V5a3 3 0 00-6 0v8a5 5 0 106 0M12 4a1 1 0 011 1v8h-2V5a1 1 0 011-1z"/></svg>`,
  'wind': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10h12a2 2 0 110 4H4m0-4a2 2 0 110 4m0-4v4m8-8h8a2 2 0 110 4h-8m0-4a2 2 0 110 4m0-4v4m4 4h4a2 2 0 110 4h-4m0-4a2 2 0 110 4m0-4v4"/></svg>`,
  'sun': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 015 5 5 5 0 01-5 5 5 5 0 01-5-5 5 5 0 015-5m0 2a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3m0-7l2.39 3.42C13.65 5.15 12.84 5 12 5c-.84 0-1.65.15-2.39.42L12 2M3.34 7l4.16-.35A7.2 7.2 0 005.94 8.5c-.44.74-.69 1.5-.83 2.29L3.34 7m.02 10l1.76-3.77a7.131 7.131 0 002.38 4.14L3.36 17M20.65 7l-1.77 3.79a7.023 7.023 0 00-2.38-4.15l4.15.36m-.01 10l-4.14.36c.59-.51 1.12-1.14 1.54-1.86.42-.73.69-1.5.83-2.29L20.64 17M12 22l-2.39-3.42c.74.27 1.55.42 2.39.42.84 0 1.65-.15 2.39-.42L12 22z"/></svg>`,
  'cloud': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.03A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.03A6.004 6.004 0 000 14a6 6 0 006 6h13a5 5 0 005-5c0-2.64-2.05-4.78-4.65-4.97z"/></svg>`,
  
  // Diseases
  'virus': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm1-9h4v2h-4v4h-2v-4H7v-2h4V7h2v4z"/></svg>`,
  'head-side-cough': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8.5 10.5h-2v-2h2v2zm0-4.5h-2v-2h2v2zm4.5 4.5h-2v-2h2v2zm0-4.5h-2v-2h2v2z"/></svg>`,
  'toilet': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 22v-2h12v2H6zm3-4v-3h6v3H9zm11-7V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v6c0 2.8 2.2 5 5 5h4c2.8 0 5-2.2 5-5zm-2 0c0 1.7-1.3 3-3 3H9c-1.7 0-3-1.3-3-3V5h12v6z"/></svg>`,
  'hospital': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3h2v2h2v2h-2v2h-2v-2H8V8h2V6zm-1 9h4v2h-4v-2z"/></svg>`,
  'syringe': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.15 15.18l1.67-1.67L9.35 10l-1.66 1.67 3.46 3.51zm5.66-5.66l1.67-1.67-3.46-3.46L16.69 2.7 2.7 16.69l1.4 1.4L5.77 20h3.46l1.67-1.67L9.35 16.8l-1.66 1.67h-1.67l-.94-.94L16.69 5.92l.94.94v1.67z"/></svg>`,
  'prescription-bottle-medical': `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3h2v2h2v2h-2v2h-2v-2H8V8h2V6zm-1 9h4v2h-4v-2z"/></svg>`,
} as const;

type IconKey = keyof typeof ICONS;

const BackgroundIconDiv = styled.div<{ color: string }>`
  position: absolute;
  right: -60px;
  top: -60px;
  width: 300px;
  height: 300px;
  opacity: ${props => {
    const opacity = parseFloat(props.color.split(',')[3].replace(')', ''));
    return Math.min(opacity * 0.5, 0.10);
  }};
  color: rgba(${props => props.color.split('(')[1].split(')')[0]});
  z-index: 0;
  transform: rotate(15deg);
  pointer-events: none;

  svg {
    width: 100%;
    height: 100%;
  }
`;

const ContentWrapper = styled.div`
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: flex-start;
  width: 100%;
`;

class BigNumberVis extends PureComponent<BigNumberVizProps> {
  static defaultProps = {
    className: '',
    headerFormatter: defaultNumberFormatter,
    formatTime: getTimeFormatter(SMART_DATE_VERBOSE_ID),
    headerFontSize: PROPORTION.HEADER,
    kickerFontSize: PROPORTION.KICKER,
    mainColor: BRAND_COLOR,
    showTimestamp: false,
    showTrendLine: false,
    startYAxisAtZero: true,
    subheader: '',
    subheaderFontSize: PROPORTION.SUBHEADER,
    timeRangeFixed: false,
  };

  getClassName() {
    const { className, showTrendLine, bigNumberFallback } = this.props;
    const names = `superset-legacy-chart-big-number ${className} ${
      bigNumberFallback ? 'is-fallback-value' : ''
    }`;
    if (showTrendLine) return names;
    return `${names} no-trendline`;
  }

  createTemporaryContainer() {
    const container = document.createElement('div');
    container.className = this.getClassName();
    container.style.position = 'absolute'; // so it won't disrupt page layout
    container.style.opacity = '0'; // and not visible
    return container;
  }

  renderFallbackWarning() {
    const { bigNumberFallback, formatTime, showTimestamp } = this.props;
    if (!formatTime || !bigNumberFallback || showTimestamp) return null;
    return (
      <span
        className="alert alert-warning"
        role="alert"
        title={t(
          `Last available value seen on %s`,
          formatTime(bigNumberFallback[0]),
        )}
      >
        {t('Not up to date')}
      </span>
    );
  }

  renderKicker(maxHeight: number) {
    const { timestamp, showTimestamp, formatTime, width } = this.props;
    if (
      !formatTime ||
      !showTimestamp ||
      typeof timestamp === 'string' ||
      typeof timestamp === 'boolean'
    )
      return null;

    const text = timestamp === null ? '' : formatTime(timestamp);

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width,
      maxHeight,
      className: 'kicker',
      container,
    });
    container.remove();

    return (
      <div
        className="kicker"
        style={{
          fontSize,
          height: maxHeight,
        }}
      >
        {text}
      </div>
    );
  }

  renderHeader(maxHeight: number) {
    const { bigNumber, headerFormatter, width, colorThresholdFormatters } =
      this.props;
    // @ts-ignore
    const text = bigNumber === null ? t('No data') : headerFormatter(bigNumber);

    const hasThresholdColorFormatter =
      Array.isArray(colorThresholdFormatters) &&
      colorThresholdFormatters.length > 0;

    let numberColor;
    if (hasThresholdColorFormatter) {
      colorThresholdFormatters!.forEach(formatter => {
        const formatterResult = bigNumber
          ? formatter.getColorFromValue(bigNumber as number)
          : false;
        if (formatterResult) {
          numberColor = formatterResult;
        }
      });
    } else {
      numberColor = 'black';
    }

    const container = this.createTemporaryContainer();
    document.body.append(container);
    const fontSize = computeMaxFontSize({
      text,
      maxWidth: width - 8, // Decrease 8px for more precise font size
      maxHeight,
      className: 'header-line',
      container,
    });
    container.remove();

    const onContextMenu = (e: MouseEvent<HTMLDivElement>) => {
      if (this.props.onContextMenu) {
        e.preventDefault();
        this.props.onContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY);
      }
    };

    return (
      <div
        className="header-line"
        style={{
          fontSize,
          height: maxHeight,
          color: numberColor,
        }}
        onContextMenu={onContextMenu}
      >
        {text}
      </div>
    );
  }

  renderSubheader(maxHeight: number) {
    const { bigNumber, subheader, width, bigNumberFallback } = this.props;
    let fontSize = 0;

    const NO_DATA_OR_HASNT_LANDED = t(
      'No data after filtering or data is NULL for the latest time record',
    );
    const NO_DATA = t(
      'Try applying different filters or ensuring your datasource has data',
    );
    let text = subheader;
    if (bigNumber === null) {
      text = bigNumberFallback ? NO_DATA : NO_DATA_OR_HASNT_LANDED;
    }
    if (text) {
      const container = this.createTemporaryContainer();
      document.body.append(container);
      fontSize = computeMaxFontSize({
        text,
        maxWidth: width,
        maxHeight,
        className: 'subheader-line',
        container,
      });
      container.remove();

      return (
        <div
          className="subheader-line"
          style={{
            fontSize,
            height: maxHeight,
          }}
        >
          {text}
        </div>
      );
    }
    return null;
  }

  renderTrendline(maxHeight: number) {
    const { width, trendLineData, echartOptions, refs } = this.props;

    // if can't find any non-null values, no point rendering the trendline
    if (!trendLineData?.some(d => d[1] !== null)) {
      return null;
    }

    const eventHandlers: EventHandlers = {
      contextmenu: eventParams => {
        if (this.props.onContextMenu) {
          eventParams.event.stop();
          const { data } = eventParams;
          if (data) {
            const pointerEvent = eventParams.event.event;
            const drillToDetailFilters: BinaryQueryObjectFilterClause[] = [];
            drillToDetailFilters.push({
              col: this.props.formData?.granularitySqla,
              grain: this.props.formData?.timeGrainSqla,
              op: '==',
              val: data[0],
              formattedVal: this.props.xValueFormatter?.(data[0]),
            });
            this.props.onContextMenu(
              pointerEvent.clientX,
              pointerEvent.clientY,
              { drillToDetail: drillToDetailFilters },
            );
          }
        }
      },
    };

    return (
      echartOptions && (
        <Echart
          refs={refs}
          width={Math.floor(width)}
          height={maxHeight}
          echartOptions={echartOptions}
          eventHandlers={eventHandlers}
        />
      )
    );
  }

  render() {
    const {
      showTrendLine,
      height,
      kickerFontSize,
      headerFontSize,
      subheaderFontSize,
      background_icon,
      background_icon_color,
    } = this.props;
    const className = this.getClassName();

    console.log(this.props);

    let iconColor = 'rgba(200, 200, 200, 0.3)';
    if (background_icon_color) {
      const { r, g, b, a } = background_icon_color;
      iconColor = `rgba(${r},${g},${b},${a})`;
    }

    const icon = background_icon?.replace('fa-', '') as IconKey | undefined;
    const svgIcon = icon ? ICONS[icon] : null;

    if (showTrendLine) {
      const chartHeight = Math.floor(PROPORTION.TRENDLINE * height);
      const allTextHeight = height - chartHeight;

      return (
        <div className={className} style={{ position: 'relative' }}>
          {svgIcon && (
            <BackgroundIconDiv
              color={iconColor}
              dangerouslySetInnerHTML={{ __html: svgIcon }}
            />
          )}
          <ContentWrapper>
            <div className="text-container" style={{ height: allTextHeight }}>
              {this.renderFallbackWarning()}
              {this.renderKicker(
                Math.ceil(
                  (kickerFontSize || 0) * (1 - PROPORTION.TRENDLINE) * height,
                ),
              )}
              {this.renderHeader(
                Math.ceil(headerFontSize * (1 - PROPORTION.TRENDLINE) * height),
              )}
              {this.renderSubheader(
                Math.ceil(
                  subheaderFontSize * (1 - PROPORTION.TRENDLINE) * height,
                ),
              )}
            </div>
            {this.renderTrendline(chartHeight)}
          </ContentWrapper>
        </div>
      );
    }

    return (
      <div className={className} style={{ position: 'relative', height }}>
        {svgIcon && (
          <BackgroundIconDiv
            color={iconColor}
            dangerouslySetInnerHTML={{ __html: svgIcon }}
          />
        )}
        <ContentWrapper>
          {this.renderFallbackWarning()}
          {this.renderKicker((kickerFontSize || 0) * height)}
          {this.renderHeader(Math.ceil(headerFontSize * height))}
          {this.renderSubheader(Math.ceil(subheaderFontSize * height))}
        </ContentWrapper>
      </div>
    );
  }
}

export default styled(BigNumberVis)`
  ${({ theme }) => `
    font-family: ${theme.typography.families.sansSerif};
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;

    &.no-trendline .subheader-line {
      padding-bottom: 0.3em;
    }

    .text-container {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      .alert {
        font-size: ${theme.typography.sizes.s};
        margin: -0.5em 0 0.4em;
        line-height: 1;
        padding: ${theme.gridUnit}px;
        border-radius: ${theme.gridUnit}px;
      }
    }

    .kicker {
      line-height: 1em;
      padding-bottom: 2em;
    }

    .header-line {
      position: relative;
      line-height: 1em;
      white-space: nowrap;
      span {
        position: absolute;
        bottom: 0;
      }
    }

    .subheader-line {
      line-height: 1em;
      padding-bottom: 0;
    }

    &.is-fallback-value {
      .kicker,
      .header-line,
      .subheader-line {
        opacity: ${theme.opacity.mediumHeavy};
      }
    }
  `}
`;
