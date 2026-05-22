import io
from datetime import datetime
from typing import Any

import pandas as pd

from utils.analyzer import signed_current_balance
from utils.formatters import (
    classify_account,
    format_number_as_brazilian_money,
    format_number_as_percentage,
)

report_tabs = [
    {"kind": "inverted", "label": "Saldos invertidos"},
    {"kind": "zero", "label": "Contas sem movimentacao"},
    {"kind": "comparison", "label": "Distribuicao x Resultado"},
    {"kind": "analysis1", "label": "Clientes com Saldo Atual Baixo"},
    {"kind": "analysis2", "label": "Cliente Pessoa Fisica Fora da Regra"},
    {"kind": "analysis3", "label": "Conciliacao Clientes x Receitas Operacionais"},
    {"kind": "analysis4", "label": "Clientes com Saldo Residual"},
    {"kind": "analysis5", "label": "Clientes sem Credito no Periodo"},
    {"kind": "analysis6", "label": "Fornecedores sem Debito no Periodo"},
    {"kind": "analysis7", "label": "Validacao Estoques x Fornecedores"},
    {"kind": "analysis8", "label": "Fornecedores com Saldo Residual"},
    {"kind": "analysis9", "label": "Fornecedores com Credito sem Debito"},
    {"kind": "analysis10", "label": "CMV x Receita Mercadorias"},
    {"kind": "analysis11", "label": "Depreciacao x Bens"},
    {"kind": "analysis12", "label": "Despesas Credoras na Classe 3"},
]

BASE_COLUMNS = [
    "Natureza",
    "Conta Contabil",
    "Cod. R.",
    "Nome da Conta",
    "S. Anterior",
    "Debito",
    "Credito",
    "S. Atual",
    "Status",
    "Acao Corretiva",
    "Valor no Calculo",
]


def corrective_action(kind: str, row: dict[str, Any] | None = None) -> str:
    if kind == "inverted":
        if row and row.get("alertType") == "Ativo com saldo C":
            return "Revisar classificacao, natureza e lancamentos da conta do ativo para eliminar saldo credor indevido no encerramento."
        if row and row.get("alertType") == "Passivo/PL com saldo D":
            return "Revisar classificacao, natureza e lancamentos da conta do passivo ou PL para eliminar saldo devedor indevido no encerramento."
        return "Revisar a natureza contabil e os lancamentos que formaram o saldo final para corrigir a inversao identificada."

    actions = {
        "zero": "Confirmar se a conta deveria ter movimentacao no periodo; se sim, revisar integracao, parametrizacao e lancamentos.",
        "comparison": "Conferir composicao das contas 3, 6, 2.4.13 e 1.1.04.019, validar formula aplicada e ajustar lancamentos/classificacoes.",
        "analysis1": "Conferir se o saldo do cliente foi baixado corretamente; ajustar recebimentos, compensacoes ou reclassificacoes.",
        "analysis2": "Validar cadastro e historico do cliente e corrigir classificacao comercial/contabil se necessario.",
        "analysis3": "Conciliar saldo de clientes com receitas operacionais vinculadas e revisar lancamentos faltantes/incorretos.",
        "analysis4": "Investigar saldo residual e ajustar baixas, estornos, abatimentos ou reclassificacoes.",
        "analysis5": "Revisar se houve faturamento/recebimento/baixa sem credito contabil correspondente.",
        "analysis6": "Conferir compras/pagamentos/baixas sem debito contabil correspondente e regularizar.",
        "analysis7": "Comparar saldo de estoques com fornecedores relacionados e ajustar classificacao/lancamentos.",
        "analysis8": "Analisar saldo residual do fornecedor e ajustar pagamentos, estornos e compensacoes.",
        "analysis9": "Verificar reconhecimento de obrigacao sem contrapartida esperada em debito e corrigir lancamentos.",
        "analysis10": "Conferir Cod. R. 3001, 2603, 2652 e 2700 e revisar classificacoes/lancamentos se CMV ultrapassar 100%.",
        "analysis11": "Conferir pareamento bem x depreciacao e revisar classificacoes/lancamentos quando depreciacao superar o bem.",
        "analysis12": "Revisar classificacao e lancamentos da conta de despesa com saldo credor fora das excecoes permitidas.",
    }
    return actions.get(kind, "Revisar a origem do alerta e ajustar os lancamentos ou classificacoes contabeis relacionados.")


def report_occurrence_count(company: dict[str, Any], kind: str) -> int:
    if kind == "inverted":
        return len(company.get("invertedRows", []))
    if kind == "zero":
        return len(company.get("zeroMovementRows", []))
    if kind == "comparison":
        return 1 if company.get("comparisonReport", {}).get("isAttention") else 0

    for report in company.get("analysisReports", []):
        if report["kind"] == kind:
            if kind == "analysis11":
                return len(report.get("depreciationPairs", []))
            rows = report.get("rows", [])
            return len(rows) if rows else (1 if report.get("isAttention") else 0)
    return 0


def report_has_occurrence(company: dict[str, Any], kind: str) -> bool:
    return report_occurrence_count(company, kind) > 0


def get_report_rows(company: dict[str, Any], kind: str) -> list[dict[str, Any]]:
    if kind == "inverted":
        return company.get("invertedRows", [])
    if kind == "zero":
        return company.get("zeroMovementRows", [])
    if kind == "comparison":
        return []
    for report in company.get("analysisReports", []):
        if report["kind"] == kind:
            return report.get("rows", [])
    return []


def get_report_intro(kind: str, company: dict[str, Any] | None = None) -> str:
    if kind == "inverted":
        return "Mostra contas do ativo com S. Atual credor e contas do passivo/PL com S. Atual devedor."
    if kind == "zero":
        return "Mostra contas com Debito igual a zero e Credito igual a zero no periodo."
    if kind == "comparison":
        return "Compara o resultado consolidado com distribuicao/lucros acumulados conforme regra de negocio."
    if company:
        for report in company.get("analysisReports", []):
            if report["kind"] == kind:
                return report.get("intro", "")
    return ""


def get_report_title(kind: str, company: dict[str, Any] | None = None) -> str:
    if kind == "inverted":
        return "Saldos invertidos Ativo/Passivo"
    if kind == "zero":
        return "Contas sem movimentacao no periodo"
    if kind == "comparison":
        return "Comparacao Distribuicao x Resultado"
    if company:
        for report in company.get("analysisReports", []):
            if report["kind"] == kind:
                return report.get("title", kind)
    return kind


def _empty_row() -> dict[str, Any]:
    return {col: "" for col in BASE_COLUMNS}


def _base_row(kind: str, row: dict[str, Any]) -> dict[str, Any]:
    data = _empty_row()
    data.update(
        {
            "Natureza": classify_account(row["account"]),
            "Conta Contabil": row["account"],
            "Cod. R.": row.get("code", "") or "",
            "Nome da Conta": row["name"],
            "S. Anterior": row["previousBalance"],
            "Debito": row["debit"],
            "Credito": row["credit"],
            "S. Atual": row["currentBalance"],
            "Status": "Ocorrencia",
            "Acao Corretiva": corrective_action(kind, row),
        }
    )
    return data


def _comparison_rows(company: dict[str, Any]) -> list[dict[str, Any]]:
    rep = company.get("comparisonReport", {})
    if not rep.get("isAttention"):
        return []

    def make_row(item: str, row_obj: dict[str, Any] | None, calc_val: float) -> dict[str, Any]:
        data = _empty_row()
        data.update(
            {
                "Natureza": classify_account(row_obj["account"]) if row_obj else "",
                "Conta Contabil": row_obj["account"] if row_obj else "",
                "Cod. R.": row_obj.get("code", "") if row_obj else "",
                "Nome da Conta": row_obj["name"] if row_obj else "Conta nao localizada",
                "S. Atual": row_obj.get("currentBalance", "") if row_obj else "",
                "Status": rep.get("message", ""),
                "Acao Corretiva": f"{item}: {corrective_action('comparison')}",
                "Valor no Calculo": format_number_as_brazilian_money(calc_val),
            }
        )
        return data

    rows = [
        make_row("Conta 3", rep.get("account3Row"), signed_current_balance(rep.get("account3Row"))),
        make_row("Conta 6", rep.get("account6Row"), signed_current_balance(rep.get("account6Row"))),
    ]

    if rep.get("mode") == "distribution":
        rows.append(make_row("Conta 2.4.13", rep.get("account2413Row"), signed_current_balance(rep.get("account2413Row"))))
        rows.append(make_row("Conta comparada: 1.1.04.019", rep.get("distributionRow"), rep.get("targetValue", 0.0)))
    else:
        rows.append(make_row("Conta comparada: 2.4.13", rep.get("account2413Row"), rep.get("targetValue", 0.0)))

    resume = _empty_row()
    resume.update(
        {
            "Nome da Conta": "Resumo",
            "Status": rep.get("message", ""),
            "Acao Corretiva": corrective_action("comparison"),
            "Valor no Calculo": (
                f"Base: {format_number_as_brazilian_money(rep.get('baseValue', 0.0))} | "
                f"Comparado: {format_number_as_brazilian_money(rep.get('targetValue', 0.0))} | "
                f"Diferenca: {format_number_as_brazilian_money(rep.get('difference', 0.0))}"
            ),
        }
    )
    rows.append(resume)
    return rows


def _analysis11_rows(report: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for pair in report.get("depreciationPairs", []):
        data = _empty_row()
        data.update(
            {
                "Cod. R.": f"Bem {pair.get('assetCode', '')} | Dep {pair.get('depreciationCode', '')}",
                "Nome da Conta": f"{pair.get('assetName', '')} x {pair.get('depreciationName', '')}",
                "S. Atual": f"Bem: {pair.get('assetCurrentBalance', '')} | Dep: {pair.get('depreciationCurrentBalance', '')}",
                "Status": report.get("message", ""),
                "Acao Corretiva": pair.get("correctiveAction", corrective_action("analysis11")),
            }
        )
        rows.append(data)
    return rows


def _calc_suffix(report: dict[str, Any]) -> str:
    calc = report.get("calculation")
    if not calc:
        return ""
    parts = [f"Formula: {calc.get('formula', '')}"]
    for item in calc.get("items", []):
        value = item.get("value", 0.0)
        formatted = format_number_as_percentage(value) if item.get("format") == "percentage" else format_number_as_brazilian_money(value)
        parts.append(f"{item.get('label', 'Item')}: {formatted}")
    return " | ".join(parts)


def _collect_sections(company: dict[str, Any]) -> list[tuple[str, list[dict[str, Any]]]]:
    sections: list[tuple[str, list[dict[str, Any]]]] = []

    for kind in ("inverted", "zero"):
        if report_has_occurrence(company, kind):
            sections.append((get_report_title(kind, company), [_base_row(kind, row) for row in get_report_rows(company, kind)]))

    if report_has_occurrence(company, "comparison"):
        sections.append((get_report_title("comparison", company), _comparison_rows(company)))

    for report in company.get("analysisReports", []):
        kind = report["kind"]
        if not report_has_occurrence(company, kind):
            continue

        title = get_report_title(kind, company)
        if kind == "analysis11":
            sections.append((title, _analysis11_rows(report)))
            continue

        calc_extra = _calc_suffix(report)
        rows = []
        for row in report.get("rows", []):
            item = _base_row(kind, row)
            if report.get("message"):
                item["Status"] = report["message"]
            if calc_extra:
                item["Acao Corretiva"] = f"{item['Acao Corretiva']} | {calc_extra}"
            rows.append(item)
        sections.append((title, rows))

    return sections


def generate_xlsx_report(company: dict[str, Any]) -> bytes:
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="xlsxwriter") as writer:
        workbook = writer.book
        sheet_name = "Relatorios com Ocorrencia"
        worksheet = workbook.add_worksheet(sheet_name)
        writer.sheets[sheet_name] = worksheet

        meta_label = workbook.add_format({"bold": True, "font_color": "#154E5E"})
        section_title = workbook.add_format({"bold": True, "font_size": 12, "font_color": "#154E5E"})
        header_format = workbook.add_format({"bold": True, "bg_color": "#154E5E", "font_color": "#FFFFFF", "border": 1})

        row = 0
        meta = [
            ("Empresa", company.get("companyName", "-")),
            ("Codigo da Empresa", company.get("companyCode") or "-"),
            ("CNPJ", company.get("cnpj", "-")),
            ("Periodo", company.get("period", "-")),
            ("Arquivo", company.get("fileName", "-")),
            ("Gerado em", datetime.now().strftime("%d/%m/%Y %H:%M:%S")),
        ]
        for label, value in meta:
            worksheet.write(row, 0, label, meta_label)
            worksheet.write(row, 1, value)
            row += 1

        row += 1
        sections = _collect_sections(company)
        if not sections:
            worksheet.write(row, 0, "Sem ocorrencias", section_title)
            worksheet.write(row + 1, 0, "Nao ha relatorios com ocorrencia para exportacao.")
        else:
            for title, items in sections:
                worksheet.write(row, 0, title, section_title)
                row += 1
                df = pd.DataFrame(items or [_empty_row()], columns=BASE_COLUMNS)
                df.to_excel(writer, sheet_name=sheet_name, startrow=row, startcol=0, index=False)
                for col_idx, col_name in enumerate(df.columns):
                    worksheet.write(row, col_idx, col_name, header_format)
                row += len(df.index) + 3

        widths = {
            "A": 18,
            "B": 16,
            "C": 14,
            "D": 42,
            "E": 14,
            "F": 14,
            "G": 14,
            "H": 14,
            "I": 30,
            "J": 80,
            "K": 42,
        }
        for col, width in widths.items():
            worksheet.set_column(f"{col}:{col}", width)

    output.seek(0)
    return output.getvalue()
