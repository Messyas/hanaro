"""Plain-text simulation templates, separate from domain consumers."""

POSITIVE = {"GOAL_ACHIEVED", "TASK_VALIDATED", "REPORT_EXPORT_COMPLETED"}


def email_content(event_type: str, payload: dict) -> tuple[str, str]:
    title = payload.get("title", event_type)
    severity = payload.get("severity", "INFO")
    direction = "Resultado confirmado" if event_type in POSITIVE else "Requer acompanhamento"
    subject = f"[Hanaro][{severity}] {title}"[:300]
    body = f"{direction}\n{title}\n{payload.get('description', '')}\n"
    for key in ("observed", "threshold", "currency", "period", "component", "line"):
        if payload.get(key) is not None:
            body += f"{key}: {payload[key]}\n"
    body += f"Ação sugerida: {payload.get('suggested_action', 'Consultar o registro e avaliar as próximas ações.')}\n"
    body += f"Acesso autenticado: {payload.get('link', '/alertas')}\n"
    return subject, body
