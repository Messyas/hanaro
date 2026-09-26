class ReportError(ValueError):
    """Expected report-domain failure safe to expose to API clients."""


class ReportNotFoundError(ReportError):
    pass


class ReportConflictError(ReportError):
    pass


class ReportValidationError(ReportError):
    pass
