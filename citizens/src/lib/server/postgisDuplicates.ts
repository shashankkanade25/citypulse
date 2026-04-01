import type { PoolClient } from 'pg';

export type DuplicateMatch = {
  incidentId: string;
};

export async function findDuplicateIncident(params: {
  client: PoolClient;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  radiusMeters?: number;
  windowHours?: number;
}): Promise<DuplicateMatch | null> {
  const { client, latitude, longitude, category } = params;
  const radiusMeters = params.radiusMeters ?? 100;
  const windowHours = params.windowHours ?? 24;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;

  const result = await client.query(
    `SELECT id
     FROM incidents
     WHERE location IS NOT NULL
       AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
       AND created_at >= now() - make_interval(hours => $4)
       AND ($5::text IS NULL OR category = $5)
     ORDER BY created_at DESC
     LIMIT 1`,
    [longitude, latitude, radiusMeters, windowHours, category]
  );

  const incidentId: string | undefined = result.rows[0]?.id;
  return incidentId ? { incidentId } : null;
}
