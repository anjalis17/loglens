from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    secret_key: str = "local-dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080
    database_url: str = "postgresql+asyncpg://loglens:loglens@postgres:5432/loglens"
    anthropic_api_key: str = "your-key-here"
    whisper_model: str = "base"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
