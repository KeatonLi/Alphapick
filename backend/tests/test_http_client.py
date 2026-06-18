import unittest


class DatasourceHttpClientTests(unittest.TestCase):
    def test_create_datasource_session_ignores_environment_proxy_by_default(self):
        from app.datasource.http_client import create_datasource_session

        session = create_datasource_session()

        self.assertFalse(session.trust_env)
        self.assertEqual(session.proxies, {})

    def test_create_datasource_session_uses_explicit_proxy(self):
        from app.datasource.http_client import create_datasource_session

        session = create_datasource_session("http://127.0.0.1:7897")

        self.assertFalse(session.trust_env)
        self.assertEqual(session.proxies["http"], "http://127.0.0.1:7897")
        self.assertEqual(session.proxies["https"], "http://127.0.0.1:7897")


if __name__ == "__main__":
    unittest.main()
