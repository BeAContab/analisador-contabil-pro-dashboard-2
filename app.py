import json
import os
from pathlib import Path
from typing import Any

import pandas as pd
import plotly.express as px
import streamlit as st

from utils.analyzer import build_comparison_report, run_all_analyses
from utils.formatters import (
    format_number_as_brazilian_money,
    format_number_as_percentage,
    slugify,
)
from utils.gemini import generate_gemini_reply
from utils.parser import parse_pdf_file
from utils.reports import (
    corrective_action,
    generate_xlsx_report,
    get_report_intro,
    get_report_title,
    report_has_occurrence,
    report_tabs,
)


def parsed_nature_exempt(account: str) -> bool:
    """Ignore accounts whose accounting nature is intentionally inverted."""
    exempts = ["1.2.05.007", "2.4.13.004"]
    return any(account == item or account.startswith(f"{item}.") for item in exempts)


def init_state() -> None:
    if "processed_companies" not in st.session_state:
        st.session_state.processed_companies = {}
    if "selected_company_key" not in st.session_state:
        st.session_state.selected_company_key = None
    if "gemini_api_key" not in st.session_state:
        st.session_state.gemini_api_key = load_saved_api_key() or os.getenv("VITE_GEMINI_API_KEY", "")
    if "chat_history" not in st.session_state:
        st.session_state.chat_history = []
    if "chat_draft" not in st.session_state:
        st.session_state.chat_draft = ""
    if "current_view" not in st.session_state:
        st.session_state.current_view = "home"
    if "show_zero_reports" not in st.session_state:
        st.session_state.show_zero_reports = False
    if "uploader_nonce" not in st.session_state:
        st.session_state.uploader_nonce = 0


def apply_theme() -> None:
    st.set_page_config(
        page_title="Analisador Contabil Pro - Dashboard",
        page_icon=":bar_chart:",
        layout="wide",
        initial_sidebar_state="expanded",
    )
    st.markdown(
        """
        <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        html, body, [class*="css"] {
            font-family: 'Outfit', sans-serif;
        }
        .hero {
            background: linear-gradient(135deg, #154E5E 0%, #0F3742 100%);
            border-radius: 18px;
            padding: 30px;
            color: white;
            box-shadow: 0 12px 30px rgba(15, 55, 66, 0.20);
        }
        .hero h1 {
            margin: 0 0 8px 0;
            font-size: 2.0rem;
        }
        .hero p {
            margin: 0;
            opacity: 0.92;
            max-width: 820px;
        }
        .soft-card {
            background: linear-gradient(180deg, #ffffff 0%, #f7fbfc 100%);
            border: 1px solid #d7e6ea;
            border-radius: 16px;
            padding: 18px;
        }
        .status-ok {
            background: #f0fdf4;
            border-left: 5px solid #22c55e;
            color: #166534;
            padding: 12px 14px;
            border-radius: 10px;
        }
        .status-attention {
            background: #fef2f2;
            border-left: 5px solid #ef4444;
            color: #991b1b;
            padding: 12px 14px;
            border-radius: 10px;
        }
        .cmv-highlight {
            background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%);
            color: #fff;
            border-radius: 16px;
            padding: 22px;
            margin: 10px 0 14px 0;
            box-shadow: 0 16px 35px rgba(127, 29, 29, 0.30);
            border: 2px solid rgba(255, 255, 255, 0.18);
        }
        .cmv-highlight h4 {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 700;
            opacity: 0.95;
            letter-spacing: 0.2px;
        }
        .cmv-highlight .cmv-value {
            margin-top: 6px;
            font-size: 3rem;
            line-height: 1.05;
            font-weight: 800;
        }
        .cmv-highlight .cmv-sub {
            margin-top: 8px;
            font-size: 0.95rem;
            opacity: 0.95;
        }
        div[data-testid="stPopover"] {
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            bottom: 22px;
            z-index: 999999;
        }
        div[data-testid="stPopover"] button {
            border-radius: 999px !important;
            width: 58px !important;
            height: 58px !important;
            min-height: 58px !important;
            padding: 0 !important;
            border: none !important;
            background: linear-gradient(135deg, #154E5E 0%, #0F3742 100%) !important;
            color: white !important;
            box-shadow: 0 18px 40px rgba(15, 55, 66, 0.26) !important;
            font-weight: 700 !important;
            font-size: 22px !important;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def user_prefs_path() -> Path:
    return Path(".streamlit") / "user_prefs.json"


def load_saved_api_key() -> str:
    path = user_prefs_path()
    if not path.exists():
        return ""
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return str(payload.get("gemini_api_key", "")).strip()
    except Exception:
        return ""


def save_api_key(value: str) -> None:
    path = user_prefs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"gemini_api_key": value.strip()}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def process_uploaded_files(uploaded_files: list[Any]) -> None:
    if not uploaded_files:
        return

    for file in uploaded_files:
        file_key = f"{file.name}-{file.size}"
        if file_key in st.session_state.processed_companies:
            continue

        with st.spinner(f"Analisando {file.name}..."):
            parsed = parse_pdf_file(file)
            if not parsed or parsed.get("errors"):
                error_msg = (
                    parsed.get("errors", ["Formato invalido"])
                    if isinstance(parsed, dict)
                    else ["Erro inesperado ao processar o PDF."]
                )
                st.error(f"Erro ao ler {file.name}: {' | '.join(error_msg)}")
                continue

            rows = parsed["rows"]
            parsed["invertedRows"] = [
                {
                    **row,
                    "alertType": (
                        "Ativo com saldo C"
                        if row["account"].startswith("1")
                        else "Passivo/PL com saldo D"
                    ),
                }
                for row in rows
                if not parsed_nature_exempt(row["account"])
                and (
                    (
                        row["account"].startswith("1")
                        and row["currentBalanceNumber"] > 0
                        and row["currentBalance"].strip().endswith("C")
                    )
                    or (
                        row["account"].startswith("2")
                        and row["currentBalanceNumber"] > 0
                        and row["currentBalance"].strip().endswith("D")
                    )
                )
            ]
            parsed["zeroMovementRows"] = [
                row
                for row in rows
                if abs(row["debitNumber"]) == 0.0 and abs(row["creditNumber"]) == 0.0
            ]
            parsed["comparisonReport"] = build_comparison_report(rows)
            parsed["analysisReports"] = run_all_analyses(rows)

            st.session_state.processed_companies[file_key] = parsed
            st.session_state.selected_company_key = file_key


def build_results_summary(companies: list[dict[str, Any]]) -> dict[str, int]:
    companies_with_alerts = 0
    reports_with_occurrences = 0
    total_occurrences = 0
    total_unclassified = 0

    for company in companies:
        company_report_count = 0
        company_occurrences = 0

        inverted_count = len(company.get("invertedRows", []))
        zero_count = len(company.get("zeroMovementRows", []))
        comparison_count = 1 if company.get("comparisonReport", {}).get("isAttention") else 0

        company_report_count += 1 if inverted_count else 0
        company_report_count += 1 if zero_count else 0
        company_report_count += comparison_count

        company_occurrences += inverted_count + zero_count + comparison_count

        for analysis in company.get("analysisReports", []):
            if analysis.get("isAttention"):
                company_report_count += 1
                if analysis["kind"] == "analysis11":
                    company_occurrences += len(analysis.get("depreciationPairs", []))
                else:
                    rows = analysis.get("rows", [])
                    company_occurrences += len(rows) if rows else 1

        if company_report_count > 0:
            companies_with_alerts += 1

        reports_with_occurrences += company_report_count
        total_occurrences += company_occurrences
        total_unclassified += len(company.get("unclassified", []))

    return {
        "companiesWithAlerts": companies_with_alerts,
        "reportsWithOccurrences": reports_with_occurrences,
        "totalOccurrences": total_occurrences,
        "totalUnclassified": total_unclassified,
    }


def company_options() -> list[tuple[str, str]]:
    options = []
    for key, company in st.session_state.processed_companies.items():
        label = f"{company['companyName']} | {company['period']}"
        options.append((key, label))
    return options


def get_active_company() -> dict[str, Any] | None:
    options = company_options()
    if not options:
        return None

    keys = [key for key, _ in options]
    labels = {key: label for key, label in options}

    selected = st.sidebar.selectbox(
        "Selecionar cliente",
        keys,
        index=keys.index(st.session_state.selected_company_key)
        if st.session_state.selected_company_key in keys
        else 0,
        format_func=lambda key: labels[key],
    )
    st.session_state.selected_company_key = selected
    return st.session_state.processed_companies[selected]


def rows_to_dataframe(rows: list[dict[str, Any]], kind: str) -> pd.DataFrame:
    data = []
    for row in rows:
        data.append(
            {
                "Natureza": "Ativo" if row["account"].startswith("1") else "Passivo",
                "Conta Contabil": row["account"],
                "Cod. R.": row.get("code", "") or "",
                "Nome da Conta": row["name"],
                "S. Anterior": row["previousBalance"],
                "Debito": row["debit"],
                "Credito": row["credit"],
                "S. Atual": row["currentBalance"],
                "Acao corretiva": corrective_action(kind, row),
            }
        )
    return pd.DataFrame(data)


REPORT_EMOJIS = {
    "inverted": "🔁",
    "zero": "🧊",
    "comparison": "⚖️",
    "analysis1": "👥",
    "analysis2": "🪪",
    "analysis3": "📈",
    "analysis4": "🧾",
    "analysis5": "💳",
    "analysis6": "🏭",
    "analysis7": "📦",
    "analysis8": "🧮",
    "analysis9": "🏷️",
    "analysis10": "📊",
    "analysis11": "🏗️",
    "analysis12": "🚨",
}


def get_report_count(company: dict[str, Any], kind: str) -> int:
    if kind == "inverted":
        return len(company.get("invertedRows", []))
    if kind == "zero":
        return len(company.get("zeroMovementRows", []))
    if kind == "comparison":
        return 1 if company.get("comparisonReport", {}).get("isAttention") else 0

    for report in company.get("analysisReports", []):
        if report["kind"] != kind:
            continue
        if kind == "analysis11":
            return len(report.get("depreciationPairs", []))
        rows = report.get("rows", [])
        return len(rows) if rows else (1 if report.get("isAttention") else 0)

    return 0


def get_report_display_title(kind: str, label: str, company: dict[str, Any]) -> str:
    if kind in {"inverted", "zero", "comparison"}:
        return get_report_title(kind)
    for report in company.get("analysisReports", []):
        if report["kind"] == kind:
            return report.get("title", label)
    return label


def render_sidebar_navigation(company: dict[str, Any] | None) -> None:
    st.sidebar.markdown("---")
    st.sidebar.markdown("### Menu")

    if st.sidebar.button("🏠 Home", use_container_width=True, key="nav_home"):
        st.session_state.current_view = "home"

    if company and st.sidebar.button("📤 Exportacao", use_container_width=True, key="nav_export"):
        st.session_state.current_view = "export"

    if not company:
        return

    reports_with_occurrence: list[tuple[str, str]] = []
    reports_without_occurrence: list[tuple[str, str]] = []
    for tab in report_tabs:
        kind = tab["kind"]
        count = get_report_count(company, kind)
        emoji = REPORT_EMOJIS.get(kind, "📌")
        title = get_report_display_title(kind, tab["label"], company)
        item = (f"report:{kind}", f"{emoji} {title} ({count})")
        if count > 0:
            reports_with_occurrence.append(item)
        else:
            reports_without_occurrence.append(item)

    st.sidebar.markdown("### Relatorios com ocorrencias")
    if reports_with_occurrence:
        for view_id, label in reports_with_occurrence:
            if st.sidebar.button(label, use_container_width=True, key=f"btn_{view_id}"):
                st.session_state.current_view = view_id
    else:
        st.sidebar.caption("Nenhum relatorio com ocorrencias.")

    toggle_text = (
        "Ocultar relatorios sem ocorrencias"
        if st.session_state.show_zero_reports
        else "Revelar relatorios sem ocorrencias"
    )
    if st.sidebar.button(toggle_text, use_container_width=True, key="toggle_zero_reports"):
        st.session_state.show_zero_reports = not st.session_state.show_zero_reports

    if st.session_state.show_zero_reports:
        st.sidebar.markdown("### Relatorios sem ocorrencias")
        for view_id, label in reports_without_occurrence:
            if st.sidebar.button(label, use_container_width=True, key=f"btn_{view_id}"):
                st.session_state.current_view = view_id


def render_hero() -> None:
    st.markdown(
        """
        <div class="hero">
            <h1>Analisador Contabil Pro</h1>
            <p>
                Audite multiplos balancetes em PDF, identifique inconsistencias contabeis
                e gere um consolidado tecnico para conferencia e exportacao.
            </p>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_home_page(companies: list[dict[str, Any]]) -> None:
    render_hero()
    st.markdown("")
    st.markdown("## O que a ferramenta entrega")
    col1, col2, col3 = st.columns(3)
    with col1:
        st.markdown("### Analise local")
        st.write("Processa balancetes em PDF no ambiente atual para localizar inconsistencias, saldos invertidos e divergencias estruturais.")
    with col2:
        st.markdown("### Priorizacao de alertas")
        st.write("Organiza os achados por relatorio, facilitando a revisao contabil por empresa, grupo e regra de negocio.")
    with col3:
        st.markdown("### Exportacao tecnica")
        st.write("Gera consolidado em Excel com ocorrencias e acao corretiva para apoiar conferencia, documentacao e fechamento.")

    st.markdown("")
    st.markdown("## Vantagens de uso")
    box1, box2 = st.columns(2)
    with box1:
        st.markdown(
            """
            <div class="soft-card">
                <h4>Mais velocidade na revisao</h4>
                <p>Reduz o tempo gasto procurando linhas criticas manualmente em balancetes extensos.</p>
                <h4>Padronizacao das verificacoes</h4>
                <p>Aplica a mesma logica de validacao em todos os arquivos processados, diminuindo variacao operacional.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
    with box2:
        st.markdown(
            """
            <div class="soft-card">
                <h4>Base para conferencia senior</h4>
                <p>Ajuda a identificar pontos que merecem julgamento tecnico antes do fechamento e da entrega ao cliente.</p>
                <h4>Navegacao por relatorio</h4>
                <p>Depois do upload, use o menu lateral para abrir diretamente a interface de cada relatorio da empresa ativa.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    if companies:
        st.markdown("")
        render_summary_cards(build_results_summary(companies))
        st.info("Os balancetes ja foram processados. Use o menu lateral para abrir qualquer relatorio ou exportacao.")


def render_summary_cards(summary: dict[str, int]) -> None:
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Empresas com alerta", summary["companiesWithAlerts"])
    col2.metric("Relatorios com ocorrencias", summary["reportsWithOccurrences"])
    col3.metric("Ocorrencias totais", summary["totalOccurrences"])
    col4.metric("Linhas nao classificadas", summary["totalUnclassified"])


def render_company_header(company: dict[str, Any]) -> None:
    st.subheader(company["companyName"])
    meta1, meta2, meta3, meta4 = st.columns(4)
    meta1.caption(f"Codigo: {company.get('companyCode') or '-'}")
    meta2.caption(f"CNPJ: {company.get('cnpj') or '-'}")
    meta3.caption(f"Periodo: {company.get('period') or '-'}")
    meta4.caption(f"Linhas parseadas: {len(company.get('rows', []))}")


def render_overview_chart(company: dict[str, Any]) -> None:
    chart_rows = []
    for tab in report_tabs:
        kind = tab["kind"]
        count = 0
        if kind == "inverted":
            count = len(company.get("invertedRows", []))
        elif kind == "zero":
            count = len(company.get("zeroMovementRows", []))
        elif kind == "comparison":
            count = 1 if company.get("comparisonReport", {}).get("isAttention") else 0
        else:
            for report in company.get("analysisReports", []):
                if report["kind"] == kind:
                    if kind == "analysis11":
                        count = len(report.get("depreciationPairs", []))
                    else:
                        rows = report.get("rows", [])
                        count = len(rows) if rows else (1 if report.get("isAttention") else 0)
                    break
        if count > 0:
            chart_rows.append({"Relatorio": tab["label"], "Ocorrencias": count})

    if not chart_rows:
        st.markdown('<div class="status-ok">Nenhuma ocorrencia ativa para esta empresa.</div>', unsafe_allow_html=True)
        return

    df = pd.DataFrame(chart_rows)
    fig = px.bar(
        df,
        x="Ocorrencias",
        y="Relatorio",
        orientation="h",
        color="Ocorrencias",
        color_continuous_scale=["#f59e0b", "#dc2626"],
        title="Ocorrencias por relatorio",
    )
    fig.update_layout(height=max(300, 55 * len(df)), coloraxis_showscale=False, margin=dict(l=10, r=10, t=50, b=10))
    st.plotly_chart(fig, use_container_width=True)


def render_comparison_report(company: dict[str, Any]) -> None:
    report = company["comparisonReport"]
    if not report.get("isAttention"):
        return

    st.markdown(f"### {get_report_title('comparison')}")
    st.caption(get_report_intro("comparison"))
    css_class = "status-attention" if report["isAttention"] else "status-ok"
    st.markdown(f'<div class="{css_class}">{report["message"]}</div>', unsafe_allow_html=True)

    rows = [
        {
            "Item": "Base calculada",
            "Valor": format_number_as_brazilian_money(report["baseValue"]),
        },
        {
            "Item": "Valor comparado",
            "Valor": format_number_as_brazilian_money(report["targetValue"]),
        },
        {
            "Item": "Diferenca",
            "Valor": format_number_as_brazilian_money(report["difference"]),
        },
    ]
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


def render_standard_report(kind: str, title: str, intro: str, rows: list[dict[str, Any]]) -> None:
    st.markdown(f"### {title}")
    if intro:
        st.caption(intro)
    st.dataframe(rows_to_dataframe(rows, kind), use_container_width=True, hide_index=True)


def render_analysis_calculation(report: dict[str, Any]) -> None:
    calculation = report.get("calculation")
    if not calculation:
        return

    st.caption(f"Formula: {calculation['formula']}")
    calc_rows = []
    for item in calculation.get("items", []):
        value = item["value"]
        formatted = (
            format_number_as_percentage(value)
            if item.get("format") == "percentage"
            else format_number_as_brazilian_money(value)
        )
        calc_rows.append({"Item": item["label"], "Valor": formatted})
    if calc_rows:
        st.dataframe(pd.DataFrame(calc_rows), use_container_width=True, hide_index=True)


def render_cmv_highlight(report: dict[str, Any]) -> None:
    if report.get("kind") != "analysis10":
        return
    calculation = report.get("calculation") or {}
    items = calculation.get("items", [])
    percentage_value = None
    for item in items:
        if item.get("format") == "percentage":
            percentage_value = item.get("value")
            break
    if percentage_value is None:
        return

    formatted = format_number_as_percentage(percentage_value)
    st.markdown(
        f"""
        <div class="cmv-highlight">
            <h4>Percentual CMV x Receita Mercadorias</h4>
            <div class="cmv-value">{formatted}</div>
            <div class="cmv-sub">Indicador de atencao para avaliacao contabil deste balancete.</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_analysis_11(report: dict[str, Any]) -> None:
    st.markdown(f"### {report['title']}")
    st.caption(report.get("intro", ""))
    st.markdown(f'<div class="status-attention">{report["message"]}</div>', unsafe_allow_html=True)
    pairs = report.get("depreciationPairs", [])
    if not pairs:
        return
    st.dataframe(pd.DataFrame(pairs), use_container_width=True, hide_index=True)
    render_analysis_calculation(report)


def render_analysis_report(report: dict[str, Any]) -> None:
    if not report.get("isAttention"):
        return

    if report["kind"] == "analysis11":
        render_analysis_11(report)
        return

    st.markdown(f"### {report['title']}")
    st.caption(report.get("intro", ""))
    render_cmv_highlight(report)
    st.markdown(f'<div class="status-attention">{report["message"]}</div>', unsafe_allow_html=True)
    rows = report.get("rows", [])
    if rows:
        st.dataframe(rows_to_dataframe(rows, report["kind"]), use_container_width=True, hide_index=True)
    render_analysis_calculation(report)


def render_report_page(company: dict[str, Any], kind: str) -> None:
    render_company_header(company)
    st.markdown("---")

    if kind == "inverted":
        st.markdown(f"## {get_report_title('inverted')}")
        st.caption(get_report_intro("inverted"))
        rows = company.get("invertedRows", [])
        if rows:
            st.dataframe(rows_to_dataframe(rows, "inverted"), use_container_width=True, hide_index=True)
        else:
            st.markdown('<div class="status-ok">Nenhum alerta encontrado neste relatorio.</div>', unsafe_allow_html=True)
        return

    if kind == "zero":
        st.markdown(f"## {get_report_title('zero')}")
        st.caption(get_report_intro("zero"))
        rows = company.get("zeroMovementRows", [])
        if rows:
            st.dataframe(rows_to_dataframe(rows, "zero"), use_container_width=True, hide_index=True)
        else:
            st.markdown('<div class="status-ok">Nenhum alerta encontrado neste relatorio.</div>', unsafe_allow_html=True)
        return

    if kind == "comparison":
        st.markdown(f"## {get_report_title('comparison')}")
        if company.get("comparisonReport", {}).get("isAttention"):
            render_comparison_report(company)
        else:
            st.caption(get_report_intro("comparison"))
            st.markdown('<div class="status-ok">Nenhum alerta encontrado neste relatorio.</div>', unsafe_allow_html=True)
        return

    selected_report = next(
        (report for report in company.get("analysisReports", []) if report["kind"] == kind),
        None,
    )
    if not selected_report:
        st.warning("Relatorio nao localizado para esta empresa.")
        return

    st.markdown(f"## {selected_report['title']}")
    if selected_report.get("isAttention"):
        render_analysis_report(selected_report)
    else:
        st.caption(selected_report.get("intro", ""))
        render_cmv_highlight(selected_report)
        render_analysis_calculation(selected_report)
        st.markdown('<div class="status-ok">Nenhum alerta encontrado neste relatorio.</div>', unsafe_allow_html=True)


def render_unclassified(company: dict[str, Any]) -> None:
    unclassified = company.get("unclassified", [])
    if not unclassified:
        return

    with st.expander(f"Linhas nao classificadas ({len(unclassified)})"):
        st.dataframe(pd.DataFrame(unclassified), use_container_width=True, hide_index=True)


def render_export(company: dict[str, Any]) -> None:
    excel_data = generate_xlsx_report(company)
    st.download_button(
        "Exportar Excel consolidado",
        data=excel_data,
        file_name=f"{slugify(company['companyName'])}_consolidado.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        use_container_width=True,
    )


def render_floating_chatbot(companies: list[dict[str, Any]]) -> None:
    with st.popover("AI", use_container_width=False):
        st.markdown("#### Assistente Contabil")
        st.caption("Interprete os balancetes processados com apoio do Gemini.")

        current_key = st.session_state.gemini_api_key.strip()
        if not current_key:
            st.warning("Chave API do Google/Gemini nao configurada.")
            st.markdown(
                """
1. Acesse `https://aistudio.google.com`.
2. Clique em **Get started**.
3. Faca login com sua conta Google.
4. Clique em **Get API key**.
5. Clique em **Criar chave de API**.
6. Clique em **Criar chave**.
7. Em **Chave de API**, copie o codigo e cole abaixo.
                """
            )
            api_key_input = st.text_input("Cole sua chave API", type="password", key="floating_gemini_api_key")
            if st.button("Salvar chave", use_container_width=True) and api_key_input.strip():
                st.session_state.gemini_api_key = api_key_input.strip()
                save_api_key(api_key_input)
                st.success("Chave salva com sucesso. Ela sera reutilizada no proximo acesso.")
                st.rerun()
            return

        api_key = st.text_input(
            "Chave API do Gemini",
            value=current_key,
            type="password",
            key="floating_gemini_api_key",
        )
        col_save, col_clear = st.columns(2)
        with col_save:
            if st.button("Salvar", use_container_width=True):
                st.session_state.gemini_api_key = api_key.strip()
                save_api_key(api_key)
                st.success("Chave atualizada.")
        with col_clear:
            if st.button("Limpar", use_container_width=True):
                st.session_state.gemini_api_key = ""
                save_api_key("")
                st.rerun()

        history_box = st.container(height=260)
        with history_box:
            if not st.session_state.chat_history:
                st.info("Envie uma pergunta sobre os relatorios carregados.")
            for item in st.session_state.chat_history:
                with st.chat_message(item["role"]):
                    st.markdown(item["text"])

        with st.form("chatbot_form", clear_on_submit=True):
            prompt = st.text_area(
                "Pergunta",
                placeholder="Ex.: Quais achados merecem maior atencao neste cliente?",
                height=90,
            )
            send = st.form_submit_button("Enviar", use_container_width=True)

        if send and prompt.strip():
            question = prompt.strip()
            st.session_state.chat_history.append({"role": "user", "text": question})
            reply = generate_gemini_reply(
                api_key=st.session_state.gemini_api_key,
                reports=companies,
                history=st.session_state.chat_history[:-1],
                user_message=question,
            )
            st.session_state.chat_history.append({"role": "assistant", "text": reply})
            st.rerun()

def main() -> None:
    apply_theme()
    init_state()

    st.sidebar.title("Operacao")
    uploaded_files = st.sidebar.file_uploader(
        "Arraste ou selecione balancetes PDF",
        type="pdf",
        accept_multiple_files=True,
        key=f"pdf_uploader_{st.session_state.uploader_nonce}",
    )
    process_uploaded_files(uploaded_files or [])

    if st.sidebar.button("Limpar empresas carregadas", use_container_width=True):
        saved_api_key = st.session_state.gemini_api_key
        st.session_state.clear()
        st.session_state.gemini_api_key = saved_api_key
        st.session_state.processed_companies = {}
        st.session_state.selected_company_key = None
        st.session_state.current_view = "home"
        st.session_state.chat_history = []
        st.session_state.chat_draft = ""
        st.session_state.show_zero_reports = False
        st.session_state.uploader_nonce = 1
        st.rerun()

    active_company = get_active_company()
    companies = list(st.session_state.processed_companies.values())

    render_sidebar_navigation(active_company)

    current_view = st.session_state.current_view
    if current_view == "home" or not active_company:
        render_home_page(companies)
    elif current_view == "export":
        render_company_header(active_company)
        st.markdown("---")
        st.markdown("## Exportacao")
        st.write("Gera um arquivo `.xlsx` com as abas dos relatorios que possuem ocorrencias.")
        render_export(active_company)
        render_unclassified(active_company)
    elif current_view.startswith("report:"):
        render_report_page(active_company, current_view.split(":", 1)[1])
    else:
        render_home_page(companies)

    render_floating_chatbot(companies)


if __name__ == "__main__":
    main()


