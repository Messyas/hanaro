"""Tests for configuration settings."""

import os
from unittest.mock import patch

import pytest

from src.infrastructure.config.settings import Settings, get_settings


class TestSettings:
    """Test cases for application settings."""

    def test_settings_creation(self):
        """Test creating settings instance."""
        settings = Settings()
        assert settings is not None
        assert hasattr(settings, "DATABASE_URL")
        assert hasattr(settings, "SECRET_KEY")

    def test_get_settings_singleton(self):
        """Test that get_settings returns the same instance."""
        settings1 = get_settings()
        settings2 = get_settings()
        assert settings1 is settings2

    @patch.dict(os.environ, {"SECRET_KEY": "test_secret_key"})
    def test_settings_from_env(self):
        """Test loading settings from environment variables."""
        settings = Settings()
        assert settings.SECRET_KEY == "test_secret_key"

    def test_database_url_format(self):
        """Test database URL format validation."""
        settings = get_settings()
        assert settings.DATABASE_URL is not None
        # Should be a valid database URL format
        assert "://" in settings.DATABASE_URL

    @patch.dict(
        os.environ,
        {"DATABASE_URL": "postgresql+asyncpg://prod_user:prod_pass@prod.example.com:5432/prod_db"},
        clear=False,
    )
    def test_database_url_env_var_override(self):
        """Test that DATABASE_URL environment variable takes precedence."""
        settings = Settings()
        expected_url = "postgresql+asyncpg://prod_user:prod_pass@prod.example.com:5432/prod_db"
        assert settings.DATABASE_URL == expected_url

    @patch.dict(
        os.environ,
        {"DATABASE_URL": "postgresql://prod_user:prod_pass@prod.example.com:5432/prod_db?sslmode=require"},
        clear=False,
    )
    def test_database_url_normalizes_aiven_connection_string(self):
        """A standard Aiven URL is converted to the asyncpg/TLS form."""
        settings = Settings()

        assert settings.DATABASE_URL == "postgresql+asyncpg://prod_user:prod_pass@prod.example.com:5432/prod_db?ssl=require"

    @patch.dict(os.environ, {"REDIS_URL": "rediss://avnadmin:secret@valkey.example.com:12345/0"}, clear=False)
    def test_redis_url_accepts_tls_connection_string(self):
        """A managed Valkey TLS URL is exposed unchanged to all Redis consumers."""
        settings = Settings()

        assert settings.REDIS_URL == "rediss://avnadmin:secret@valkey.example.com:12345/0"

    @patch.dict(os.environ, {"POSTGRES_SERVER": "localhost"}, clear=True)
    def test_database_url_fallback_to_constructed(self):
        """Test that DATABASE_URL falls back to constructed URL when env var not set."""
        # Remove DATABASE_URL if it exists
        if "DATABASE_URL" in os.environ:
            del os.environ["DATABASE_URL"]

        settings = Settings()
        # Should construct URL from components
        assert "postgresql+asyncpg://" in settings.DATABASE_URL
        assert "postgres:postgres@localhost:5432" in settings.DATABASE_URL

    @patch.dict(os.environ, {"DEBUG": "true"})
    def test_debug_mode_setting(self):
        """Test debug mode configuration."""
        settings = Settings()
        # Assuming DEBUG is a boolean setting
        if hasattr(settings, "DEBUG"):
            assert isinstance(settings.DEBUG, bool)

    def test_required_settings_exist(self):
        """Test that all required settings are present."""
        settings = get_settings()

        # Core required settings
        required_attrs = [
            "DATABASE_URL",
            "SECRET_KEY",
        ]

        for attr in required_attrs:
            assert hasattr(settings, attr), f"Missing required setting: {attr}"
            assert getattr(settings, attr) is not None, f"Setting {attr} is None"

    @patch.dict(
        os.environ,
        {
            "CORS_ENABLED": "false",
            "CORS_ORIGINS": "",
            "TRUSTED_HOSTS": "localhost,127.0.0.1,backend",
        },
    )
    def test_same_origin_security_defaults(self):
        """Browser traffic defaults to same-origin with an explicit Host allowlist."""
        settings = Settings()

        assert settings.CORS_ENABLED is False
        assert settings.CORS_ORIGINS_LIST == []
        assert settings.TRUSTED_HOSTS_LIST == ["localhost", "127.0.0.1", "backend"]

    @patch.dict(os.environ, {"SQLITE_URI": ":memory:"})
    def test_test_database_override(self):
        """Test that test database settings work."""
        settings = Settings()
        # In test mode, should use in-memory database
        if hasattr(settings, "SQLITE_URI"):
            assert ":memory:" in settings.SQLITE_URI


class TestTaskiqSettings:
    """Test cases for Taskiq configuration settings."""

    @patch.dict(os.environ, {"TASKIQ_REDIS_HOST": "localhost"}, clear=True)
    def test_taskiq_settings_defaults(self):
        """Test Taskiq settings have correct defaults."""
        settings = Settings()

        # Test default values
        assert settings.TASKIQ_ENABLED is True
        assert settings.TASKIQ_BROKER_TYPE == "redis"
        assert settings.TASKIQ_REDIS_HOST == "localhost"
        assert settings.TASKIQ_REDIS_PORT == 6379
        assert settings.TASKIQ_REDIS_DB == 3
        assert settings.TASKIQ_REDIS_PASSWORD is None
        assert settings.TASKIQ_WORKER_CONCURRENCY == 2
        assert settings.TASKIQ_MAX_TASKS_PER_WORKER == 1000

    @patch.dict(
        os.environ,
        {
            "TASKIQ_ENABLED": "false",
            "TASKIQ_BROKER_TYPE": "rabbitmq",
            "TASKIQ_REDIS_HOST": "redis-server",
            "TASKIQ_REDIS_PORT": "6380",
            "TASKIQ_REDIS_DB": "5",
            "TASKIQ_REDIS_PASSWORD": "test-password",
            "TASKIQ_WORKER_CONCURRENCY": "4",
            "TASKIQ_MAX_TASKS_PER_WORKER": "500",
        },
    )
    def test_taskiq_settings_from_env(self):
        """Test loading Taskiq settings from environment variables."""
        settings = Settings()

        assert settings.TASKIQ_ENABLED is False
        assert settings.TASKIQ_BROKER_TYPE == "rabbitmq"
        assert settings.TASKIQ_REDIS_HOST == "redis-server"
        assert settings.TASKIQ_REDIS_PORT == 6380
        assert settings.TASKIQ_REDIS_DB == 5
        assert settings.TASKIQ_REDIS_PASSWORD == "test-password"
        assert settings.TASKIQ_WORKER_CONCURRENCY == 4
        assert settings.TASKIQ_MAX_TASKS_PER_WORKER == 500

    @patch.dict(
        os.environ,
        {
            "TASKIQ_RABBITMQ_HOST": "rabbitmq-server",
            "TASKIQ_RABBITMQ_PORT": "5673",
            "TASKIQ_RABBITMQ_USER": "test-user",
            "TASKIQ_RABBITMQ_PASSWORD": "test-password",
            "TASKIQ_RABBITMQ_VHOST": "/test",
        },
    )
    def test_taskiq_rabbitmq_settings_from_env(self):
        """Test loading Taskiq RabbitMQ settings from environment variables."""
        settings = Settings()

        assert settings.TASKIQ_RABBITMQ_HOST == "rabbitmq-server"
        assert settings.TASKIQ_RABBITMQ_PORT == 5673
        assert settings.TASKIQ_RABBITMQ_USER == "test-user"
        assert settings.TASKIQ_RABBITMQ_PASSWORD == "test-password"
        assert settings.TASKIQ_RABBITMQ_VHOST == "/test"

    def test_taskiq_redis_broker_url_generation(self):
        """Test Redis broker URL generation."""
        settings = get_settings()

        # Test Redis URL without password
        broker_url = settings.TASKIQ_BROKER_URL
        expected_url = f"redis://{settings.TASKIQ_REDIS_HOST}:{settings.TASKIQ_REDIS_PORT}/{settings.TASKIQ_REDIS_DB}"
        assert broker_url == expected_url

    @patch.dict(
        os.environ,
        {
            "TASKIQ_REDIS_PASSWORD": "test-password",
            "TASKIQ_REDIS_HOST": "redis-host",
            "TASKIQ_REDIS_PORT": "6380",
            "TASKIQ_REDIS_DB": "2",
        },
    )
    def test_taskiq_redis_broker_url_with_password(self):
        """Test Redis broker URL generation with password."""
        settings = Settings()

        broker_url = settings.TASKIQ_BROKER_URL
        expected_url = "redis://:test-password@redis-host:6380/2"
        assert broker_url == expected_url

    @patch.dict(
        os.environ,
        {"TASKIQ_REDIS_URL": "rediss://:secret@redis.example.com:6380/3"},
        clear=False,
    )
    def test_taskiq_redis_broker_url_uses_full_tls_url(self):
        """Managed Redis/Valkey URLs can be used without losing TLS settings."""
        settings = Settings()

        assert settings.TASKIQ_BROKER_URL == "rediss://:secret@redis.example.com:6380/3"

    @patch.dict(
        os.environ,
        {"REDIS_URL": "rediss://avnadmin:secret@valkey.example.com:6380/0"},
        clear=False,
    )
    def test_taskiq_redis_broker_url_prefers_shared_tls_url(self):
        """Taskiq keeps the rediss scheme required by managed Valkey."""
        settings = Settings()

        assert settings.TASKIQ_BROKER_URL == "rediss://avnadmin:secret@valkey.example.com:6380/0"

    @patch.dict(
        os.environ,
        {
            "TASKIQ_BROKER_TYPE": "rabbitmq",
            "TASKIQ_RABBITMQ_USER": "test-user",
            "TASKIQ_RABBITMQ_PASSWORD": "test-password",
            "TASKIQ_RABBITMQ_HOST": "rabbitmq-host",
            "TASKIQ_RABBITMQ_PORT": "5673",
            "TASKIQ_RABBITMQ_VHOST": "/test",
        },
    )
    def test_taskiq_rabbitmq_broker_url_generation(self):
        """Test RabbitMQ broker URL generation."""
        settings = Settings()

        broker_url = settings.TASKIQ_BROKER_URL
        expected_url = "amqp://test-user:test-password@rabbitmq-host:5673/test"
        assert broker_url == expected_url

    @patch.dict(os.environ, {"TASKIQ_BROKER_TYPE": "invalid"})
    def test_taskiq_invalid_broker_type_raises_error(self):
        """Test that invalid broker type raises ValueError."""
        settings = Settings()

        with pytest.raises(ValueError, match="Unsupported broker type: invalid"):
            settings.TASKIQ_BROKER_URL

    def test_taskiq_required_settings_exist(self):
        """Test that all required Taskiq settings are present."""
        settings = get_settings()

        required_attrs = [
            "TASKIQ_ENABLED",
            "TASKIQ_BROKER_TYPE",
            "TASKIQ_REDIS_HOST",
            "TASKIQ_REDIS_PORT",
            "TASKIQ_REDIS_DB",
            "TASKIQ_RABBITMQ_HOST",
            "TASKIQ_RABBITMQ_PORT",
            "TASKIQ_RABBITMQ_USER",
            "TASKIQ_RABBITMQ_PASSWORD",
            "TASKIQ_RABBITMQ_VHOST",
            "TASKIQ_WORKER_CONCURRENCY",
            "TASKIQ_MAX_TASKS_PER_WORKER",
            "TASKIQ_BROKER_URL",
        ]

        for attr in required_attrs:
            assert hasattr(settings, attr), f"Missing required Taskiq setting: {attr}"
