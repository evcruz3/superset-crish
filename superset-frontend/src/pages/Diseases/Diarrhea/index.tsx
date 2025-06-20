import ResponsiveChartSlug from "src/components/Chart/ResponsiveChartSlug";
import withToasts from "src/components/MessageToasts/withToasts";
import { ChartContainer } from "src/pages/Home";

function Diarrhea() {
    return <ChartContainer>
        <ResponsiveChartSlug slug="weekly-diarrhea-cases" fillHeight />
    </ChartContainer>
}

export default withToasts(Diarrhea); 