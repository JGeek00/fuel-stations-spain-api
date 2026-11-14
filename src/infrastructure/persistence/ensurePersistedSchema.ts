import { sql } from 'drizzle-orm';

/**
 * Ensures the persisted historic schema exists with the current (post-migration)
 * production shape. Moved verbatim from DatabaseService so migrations own the
 * DDL and the service stays a connection factory (T6).
 * Idempotent: safe on fresh installs and existing DBs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensurePersistedSchema(db: any): Promise<void> {
  await db.execute(sql`
      CREATE TABLE IF NOT EXISTS historic_data (
        "id" uuid PRIMARY KEY,
        "stationId" varchar(255),
        "stationSignage" varchar(255),
        "adbluePrice" double precision,
        "ammoniaPrice" double precision,
        "biodieselPrice" double precision,
        "bioethanolPrice" double precision,
        "compressedBiogasPrice" double precision,
        "liquefiedBiogasPrice" double precision,
        "renewableDieselPrice" double precision,
        "cngPrice" double precision,
        "lngPrice" double precision,
        "lpgPrice" double precision,
        "gasoilAPrice" double precision,
        "gasoilBPrice" double precision,
        "premiumGasoilPrice" double precision,
        "gasoline95E10Price" double precision,
        "gasoline95E25Price" double precision,
        "gasoline95E5Price" double precision,
        "gasoline95E5PremiumPrice" double precision,
        "gasoline95E85Price" double precision,
        "gasoline98E10Price" double precision,
        "gasoline98E5Price" double precision,
        "renewableGasolinePrice" double precision,
        "hydrogenPrice" double precision,
        "methanolPrice" double precision,
        "date" date
      )
    `);
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_historic_station_date ON historic_data ("stationId", "date")`
  );
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS historic_no_data ("date" date PRIMARY KEY)`
  );
}
