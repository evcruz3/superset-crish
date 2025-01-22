import React from 'react';
import DashboardTabs from './DashboardTabs';

function WeatherForecasts() {
    return <DashboardTabs idOrSlug="weather_forecast" selectedTabIndex={0} />;
}

export default WeatherForecasts;