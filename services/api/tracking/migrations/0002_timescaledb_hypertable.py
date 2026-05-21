"""
Convert tracking_trackingevent to a TimescaleDB hypertable.

TimescaleDB automatically partitions the table by the ``timestamp`` column
into chunks (7-day intervals by default), enabling:
  - Faster range queries on time (the most common access pattern).
  - Automatic compression of chunks older than 30 days (90%+ space savings).
  - Continuous aggregates for real-time dashboard rollups.

This migration is idempotent: it uses IF NOT EXISTS / IF EXISTS guards
so it can be re-run safely.
"""
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('tracking', '0001_initial'),
    ]

    operations = [
        # 1. Enable the TimescaleDB extension (loaded by shared_preload_libraries
        #    in the timescaledb Docker image).
        migrations.RunSQL(
            sql='CREATE EXTENSION IF NOT EXISTS timescaledb;',
            reverse_sql='DROP EXTENSION IF EXISTS timescaledb;',
        ),

        # 2. TimescaleDB 2.x requires the partition column to be part of the
        #    primary key.  Drop the auto-generated single-column PK and replace
        #    it with a composite (id, timestamp) so the hypertable can be created.
        migrations.RunSQL(
            sql=(
                "DO $$ BEGIN"
                "  ALTER TABLE tracking_trackingevent DROP CONSTRAINT IF EXISTS tracking_trackingevent_pkey;"
                "  ALTER TABLE tracking_trackingevent ADD PRIMARY KEY (id, timestamp);"
                "END $$;"
            ),
            reverse_sql=(
                "DO $$ BEGIN"
                "  ALTER TABLE tracking_trackingevent DROP CONSTRAINT IF EXISTS tracking_trackingevent_pkey;"
                "  ALTER TABLE tracking_trackingevent ADD PRIMARY KEY (id);"
                "END $$;"
            ),
        ),

        # 3. Convert tracking_trackingevent into a hypertable, partitioned by
        #    the ``timestamp`` column using 7-day chunk intervals.  This means
        #    every 7 days of data lives in its own physical partition, making
        #    range queries fast and compression efficient.
        migrations.RunSQL(
            sql=(
                "SELECT create_hypertable("
                "  'tracking_trackingevent', 'timestamp',"
                "  chunk_time_interval => INTERVAL '7 days',"
                "  if_not_exists => TRUE"
                ");"
            ),
            reverse_sql='SELECT 1;',  # No reverse — hypertable is drop-safe via CASCADE
        ),

        # 3. Enable native compression on the hypertable.  segment_by groups
        #    data by event_type within each compressed chunk so queries that
        #    filter on event_type can skip irrelevant segments entirely.
        migrations.RunSQL(
            sql=(
                "ALTER TABLE tracking_trackingevent SET ("
                "  timescaledb.compress,"
                "  timescaledb.compress_segmentby = 'event_type'"
                ");"
            ),
            reverse_sql=(
                "ALTER TABLE tracking_trackingevent SET (timescaledb.compress = false);"
            ),
        ),

        # 4. Automatically compress chunks older than 30 days.  Compressed
        #    chunks are read-only and typically achieve 90-97 % space savings
        #    on tracking data (many repeated event_type/location values).
        migrations.RunSQL(
            sql=(
                "SELECT add_compression_policy("
                "  'tracking_trackingevent',"
                "  INTERVAL '30 days',"
                "  if_not_exists => TRUE"
                ");"
            ),
            reverse_sql=(
                "SELECT remove_compression_policy('tracking_trackingevent', if_exists => TRUE);"
            ),
        ),

        # 5. Create a continuous aggregate that rolls up tracking events
        #    into hourly buckets.  This powers the "events over time" chart
        #    on the analytics dashboard without scanning raw data.
        migrations.RunSQL(
            sql=(
                "CREATE MATERIALIZED VIEW IF NOT EXISTS tracking_events_hourly"
                "  WITH (timescaledb.continuous) AS"
                "  SELECT"
                "    time_bucket('1 hour', timestamp) AS bucket,"
                "    event_type,"
                "    COUNT(*) AS event_count"
                "  FROM tracking_trackingevent"
                "  GROUP BY bucket, event_type"
                "  WITH NO DATA;"
                ""
                "SELECT add_continuous_aggregate_policy('tracking_events_hourly',"
                "  start_offset     => INTERVAL '2 days',"
                "  end_offset       => INTERVAL '1 hour',"
                "  schedule_interval => INTERVAL '1 hour',"
                "  if_not_exists    => TRUE"
                ");"
            ),
            reverse_sql=(
                "DROP MATERIALIZED VIEW IF EXISTS tracking_events_hourly CASCADE;"
            ),
        ),

        # 6. Daily rollup for longer-range trend queries (retention: 2 years).
        migrations.RunSQL(
            sql=(
                "CREATE MATERIALIZED VIEW IF NOT EXISTS tracking_events_daily"
                "  WITH (timescaledb.continuous) AS"
                "  SELECT"
                "    time_bucket('1 day', timestamp) AS bucket,"
                "    event_type,"
                "    COUNT(*) AS event_count"
                "  FROM tracking_trackingevent"
                "  GROUP BY bucket, event_type"
                "  WITH NO DATA;"
                ""
                "SELECT add_continuous_aggregate_policy('tracking_events_daily',"
                "  start_offset     => INTERVAL '7 days',"
                "  end_offset       => INTERVAL '1 day',"
                "  schedule_interval => INTERVAL '1 day',"
                "  if_not_exists    => TRUE"
                ");"
            ),
            reverse_sql=(
                "DROP MATERIALIZED VIEW IF EXISTS tracking_events_daily CASCADE;"
            ),
        ),
    ]
