# services/llama-stylist/utils/logger.py
"""
Standardized logging utility for Llama Stylist service.
Provides structured logging with consistent format across all services.
"""

import os
import sys
import json
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured JSON logs."""

    def __init__(self, service_name: str = "llama-stylist"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        # Base log structure
        log_obj = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "service": self.service_name,
            "pid": os.getpid(),
            "message": record.getMessage(),
        }

        # Add extra fields if present
        if hasattr(record, "meta") and record.meta:
            log_obj["meta"] = record.meta

        # Add exception info if present
        if record.exc_info:
            log_obj["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": (
                    self.formatException(record.exc_info) if record.exc_info else None
                ),
            }

        return json.dumps(log_obj)


class ColoredConsoleFormatter(logging.Formatter):
    """Formatter for colored console output in development."""

    COLORS = {
        "DEBUG": "\033[37m",  # White
        "INFO": "\033[36m",  # Cyan
        "WARNING": "\033[33m",  # Yellow
        "ERROR": "\033[31m",  # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def __init__(self, service_name: str = "llama-stylist"):
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET

        timestamp = datetime.utcnow().isoformat() + "Z"
        level = record.levelname.ljust(8)
        message = record.getMessage()

        formatted = (
            f"{color}[{timestamp}] {level} [{self.service_name}] {message}{reset}"
        )

        # Add meta information if present
        if hasattr(record, "meta") and record.meta:
            formatted += f"\n{json.dumps(record.meta, indent=2)}"

        # Add exception info if present
        if record.exc_info:
            formatted += f"\n{self.formatException(record.exc_info)}"

        return formatted


class ServiceLogger:
    """Main logger class for the service."""

    def __init__(self, service_name: str = "llama-stylist", level: str = None):
        self.service_name = service_name
        self.logger = logging.getLogger(service_name)

        # Set log level
        log_level = level or os.environ.get("LOG_LEVEL", "INFO")
        self.logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

        # Clear existing handlers
        self.logger.handlers.clear()

        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)

        # Use colored formatter in development, structured in production
        is_production = os.environ.get("NODE_ENV") == "production"
        if is_production:
            console_handler.setFormatter(StructuredFormatter(service_name))
        else:
            console_handler.setFormatter(ColoredConsoleFormatter(service_name))

        self.logger.addHandler(console_handler)

        # File handler for production
        if is_production:
            try:
                os.makedirs("logs", exist_ok=True)
                file_handler = logging.FileHandler("logs/app.log")
                file_handler.setFormatter(StructuredFormatter(service_name))
                self.logger.addHandler(file_handler)

                # Error file handler
                error_handler = logging.FileHandler("logs/error.log")
                error_handler.setLevel(logging.ERROR)
                error_handler.setFormatter(StructuredFormatter(service_name))
                self.logger.addHandler(error_handler)
            except Exception as e:
                self.logger.warning(f"Failed to setup file logging: {e}")

    def _log_with_meta(
        self, level: int, message: str, meta: Optional[Dict[str, Any]] = None
    ):
        """Internal method to log with metadata."""
        record = self.logger.makeRecord(
            self.logger.name, level, "", 0, message, (), None
        )
        if meta:
            record.meta = meta
        self.logger.handle(record)

    def debug(self, message: str, meta: Optional[Dict[str, Any]] = None):
        """Log debug message."""
        self._log_with_meta(logging.DEBUG, message, meta)

    def info(self, message: str, meta: Optional[Dict[str, Any]] = None):
        """Log info message."""
        self._log_with_meta(logging.INFO, message, meta)

    def warning(self, message: str, meta: Optional[Dict[str, Any]] = None):
        """Log warning message."""
        self._log_with_meta(logging.WARNING, message, meta)

    def warn(self, message: str, meta: Optional[Dict[str, Any]] = None):
        """Alias for warning."""
        self.warning(message, meta)

    def error(
        self,
        message: str,
        meta: Optional[Dict[str, Any]] = None,
        exc_info: bool = False,
    ):
        """Log error message."""
        if exc_info:
            # Capture current exception info
            import sys

            record = self.logger.makeRecord(
                self.logger.name, logging.ERROR, "", 0, message, (), sys.exc_info()
            )
        else:
            record = self.logger.makeRecord(
                self.logger.name, logging.ERROR, "", 0, message, (), None
            )

        if meta:
            record.meta = meta
        self.logger.handle(record)

    def critical(self, message: str, meta: Optional[Dict[str, Any]] = None):
        """Log critical message."""
        self._log_with_meta(logging.CRITICAL, message, meta)

    def exception(self, message: str, meta: Optional[Dict[str, Any]] = None):
        """Log exception with traceback."""
        self.error(message, meta, exc_info=True)

    # Service-specific logging methods
    def log_request(
        self,
        method: str,
        path: str,
        status_code: int,
        response_time_ms: int,
        client_ip: str = None,
        user_agent: str = None,
    ):
        """Log HTTP request."""
        meta = {
            "method": method,
            "path": path,
            "statusCode": status_code,
            "responseTime": f"{response_time_ms}ms",
        }

        if client_ip:
            meta["ip"] = client_ip
        if user_agent:
            meta["userAgent"] = user_agent

        if status_code >= 400:
            self.warning("HTTP Request", meta)
        else:
            self.info("HTTP Request", meta)

    def log_ai_operation(
        self,
        operation: str,
        duration_ms: int,
        success: bool = True,
        meta: Optional[Dict[str, Any]] = None,
    ):
        """Log AI operation."""
        log_meta = {
            "operation": operation,
            "duration": f"{duration_ms}ms",
            "success": success,
        }

        if meta:
            log_meta.update(meta)

        if success:
            self.info(f"AI {operation}", log_meta)
        else:
            self.error(f"AI {operation} failed", log_meta)

    def log_performance(
        self, operation: str, duration_ms: int, meta: Optional[Dict[str, Any]] = None
    ):
        """Log performance metrics."""
        log_meta = {
            "operation": operation,
            "duration": f"{duration_ms}ms",
        }

        if meta:
            log_meta.update(meta)

        if duration_ms > 5000:  # > 5 seconds
            self.warning("Slow Operation", log_meta)
        else:
            self.debug("Performance", log_meta)


# Create default logger instance
logger = ServiceLogger()


# FastAPI middleware helper
def create_logging_middleware():
    """Create FastAPI middleware for request logging."""
    from fastapi import Request
    import time

    async def log_requests(request: Request, call_next):
        start_time = time.time()

        # Process request
        response = await call_next(request)

        # Log request
        process_time = int((time.time() - start_time) * 1000)
        logger.log_request(
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            response_time_ms=process_time,
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )

        return response

    return log_requests


# Exception logging helper
def log_exception(exc: Exception, context: Optional[Dict[str, Any]] = None):
    """Log exception with context."""
    meta = {
        "type": type(exc).__name__,
        "message": str(exc),
    }

    if context:
        meta.update(context)

    logger.exception("Application Exception", meta)


# Startup logging
def log_startup(port: int, environment: str = None, **kwargs):
    """Log service startup information."""
    meta = {
        "port": port,
        "environment": environment or os.environ.get("NODE_ENV", "development"),
        "pid": os.getpid(),
    }

    # Add any additional startup info
    meta.update(kwargs)

    logger.info("🎭 LLaMA Stylist started", meta)
