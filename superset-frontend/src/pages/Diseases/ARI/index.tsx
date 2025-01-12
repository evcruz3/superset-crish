import withToasts from "src/components/MessageToasts/withToasts";
import DashboardPage from "src/dashboard/containers/DashboardPage";

function AcuteRespiratoryInfection() {
    return <DashboardPage idOrSlug={"diseases-ari"}/>;
}

export default withToasts(AcuteRespiratoryInfection); 