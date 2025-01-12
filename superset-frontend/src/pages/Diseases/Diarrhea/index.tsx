import withToasts from "src/components/MessageToasts/withToasts";
import DashboardPage from "src/dashboard/containers/DashboardPage";

function Diarrhea() {
    return <DashboardPage idOrSlug={"diseases-diarrhea"}/>;
}

export default withToasts(Diarrhea); 