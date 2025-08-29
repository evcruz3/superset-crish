import ResponsiveChartSlug from 'src/components/Chart/ResponsiveChartSlug';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ChartContainer } from 'src/pages/Home';

function Dengue() {
  return (
    <ChartContainer>
      <ResponsiveChartSlug slug="weekly-dengue-cases" fillHeight />
    </ChartContainer>
  );
}

export default withToasts(Dengue);
