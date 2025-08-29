import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ChartContainer } from 'src/pages/Home';

function AcuteRespiratoryInfection() {
  return (
    <ChartContainer>
      <ResponsiveChartSlug slug="weekly-ari-cases" fillHeight />
    </ChartContainer>
  );
}

export default withToasts(AcuteRespiratoryInfection);
