import withToasts from "src/components/MessageToasts/withToasts";
import DashboardTabs from "../WeatherForecasts/DashboardTabs";

function Diseases() {
    return <DashboardTabs idOrSlug={"diseases-overview"} selectedTabIndex={0} />;
}

export default withToasts(Diseases); 