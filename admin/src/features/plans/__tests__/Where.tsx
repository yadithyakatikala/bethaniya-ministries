import { useLocation } from 'react-router-dom';

/** Shows where the router is, so a test can say "and it went to /plans/x/edit". */
export function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{`${pathname}${search}`}</output>;
}
