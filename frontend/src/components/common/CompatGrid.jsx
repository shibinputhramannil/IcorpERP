import React from 'react';
import MuiGrid, { gridClasses, getGridUtilityClass } from '@mui/system/Grid';

const CompatGrid = React.forwardRef(function CompatGrid(props, ref) {
  const { item, xs, sm, md, lg, xl, size, ...rest } = props;
  let computedSize = size;
  if (
    !computedSize &&
    (xs !== undefined || sm !== undefined || md !== undefined || lg !== undefined || xl !== undefined)
  ) {
    computedSize = {};
    if (xs !== undefined) computedSize.xs = xs;
    if (sm !== undefined) computedSize.sm = sm;
    if (md !== undefined) computedSize.md = md;
    if (lg !== undefined) computedSize.lg = lg;
    if (xl !== undefined) computedSize.xl = xl;
  }
  return <MuiGrid ref={ref} size={computedSize} {...rest} />;
});

export default CompatGrid;
export { CompatGrid as Grid, gridClasses, getGridUtilityClass };
