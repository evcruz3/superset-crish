import withToasts from "src/components/MessageToasts/withToasts";
import DashboardPage from "src/dashboard/containers/DashboardPage";

function Dengue() {
    return <DashboardPage idOrSlug={"diseases-dengue"}/>;
}

export default withToasts(Dengue); 