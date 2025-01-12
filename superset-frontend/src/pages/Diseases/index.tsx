import withToasts from "src/components/MessageToasts/withToasts";
import DashboardPage from "src/dashboard/containers/DashboardPage";

function Diseases() {
    return <DashboardPage idOrSlug={"diseases-overview"}/>;
}

export default withToasts(Diseases); 