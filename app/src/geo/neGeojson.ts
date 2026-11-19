/** Slim Natural Earth 110m admin-0 (public domain), served from this origin. */
export function neGeojsonUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  const root = base.endsWith("/") ? base : `${base}/`;
  return `${root}geo/ne_110m_admin_0_countries.slim.geojson`;
}
