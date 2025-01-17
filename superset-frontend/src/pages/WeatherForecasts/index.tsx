import React from 'react';
import withToasts from "src/components/MessageToasts/withToasts";
import DashboardPageWrapper from "src/components/DashboardPageWrapper";

function WeatherForecasts() {
    return <DashboardPageWrapper idOrSlug="weather_forecast" />;
}

export default withToasts(WeatherForecasts);