import unittest

from sqlalchemy import create_engine, inspect, text


class RuntimeSchemaTests(unittest.TestCase):
    def test_schedule_config_migration_runs_without_recommendations_table(self):
        from app import database

        original_engine = database.engine
        engine = create_engine("sqlite:///:memory:")
        with engine.begin() as conn:
            conn.execute(text("CREATE TABLE schedule_config (id INTEGER PRIMARY KEY, enabled BOOLEAN DEFAULT 1)"))

        try:
            database.engine = engine
            database.ensure_runtime_schema()

            columns = {col["name"] for col in inspect(engine).get_columns("schedule_config")}
            self.assertIn("run_update_returns", columns)
        finally:
            database.engine = original_engine


if __name__ == "__main__":
    unittest.main()
