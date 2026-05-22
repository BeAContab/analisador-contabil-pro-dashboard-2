import re
import unicodedata
from utils.formatters import parse_brazilian_money, balance_nature, is_zero_money

# --- Funções Auxiliares de Validação ---

def find_account_row(rows: list, account: str) -> dict:
    """Retorna a linha correspondente à conta exata."""
    return next((row for row in rows if row['account'] == account), None)

def find_account_family(rows: list, account: str) -> list:
    """Retorna todas as contas da mesma família (começam com o prefixo da conta)."""
    return [row for row in rows if row['account'] == account or row['account'].startswith(f"{account}.")]

def absolute_current_balance(row: dict) -> float:
    """Retorna o valor absoluto do saldo atual."""
    return abs(row['currentBalanceNumber']) if row else 0.0

def absolute_value(value: str) -> float:
    """Retorna o valor absoluto a partir de uma string."""
    return abs(parse_brazilian_money(value))

def numbers_are_equal(left: float, right: float) -> bool:
    """Verifica igualdade numérica com tolerância de centavos."""
    if left is None or right is None:
        return False
    return abs(left - right) < 0.005

def sum_credits(rows: list) -> float:
    """Soma todos os créditos de uma lista de linhas."""
    return sum(row['creditNumber'] for row in rows)

def signed_current_balance(row: dict) -> float:
    """
    Retorna o valor do saldo com sinal contábil:
    Natureza D é saldo negativo (devedor).
    Natureza C é saldo positivo (credor).
    """
    if not row:
        return 0.0
    value = abs(row['currentBalanceNumber'])
    nature = balance_nature(row['currentBalance'])
    return -value if nature == 'D' else value

def normalize_for_compare(value: str) -> str:
    """Normaliza strings removendo acentos, espaços extras e colocando em maiúsculas."""
    if not value:
        return ""
    normalized = unicodedata.normalize('NFD', value)
    cleaned = "".join([c for c in normalized if not unicodedata.combining(c)])
    cleaned = cleaned.upper()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    return cleaned.strip()

def normalize_asset_depreciation_pair_name(value: str) -> str:
    """
    Normaliza os nomes de bens e depreciação acumulada para pareamento textual,
    tolerando abreviações comuns (p/, contr., expl., depreciação, etc.).
    """
    val = normalize_for_compare(value)
    val = re.sub(r'^\(-\)\s*', '', val)
    val = val.replace('P/', ' PARA ')
    val = re.sub(r'\bCONTR\.?', ' CONTRATUAIS ', val)
    val = re.sub(r'\bEXPL\.?', ' EXPLORACAO ', val)
    val = re.sub(r'\bDEPREC(?:IACAO)?\.?\s*', '', val)
    val = re.sub(r'\bAMORT(?:IZACAO)?\.?\s*', '', val)
    val = re.sub(r'\bEXAUST(?:AO)?\.?\s*', '', val)
    val = re.sub(r'\bACUMULADA\b', '', val)
    # Substitui pontuações por espaço
    val = re.sub(r'[.\-_/]+', ' ', val)
    val = re.sub(r'\s+', ' ', val)
    return val.strip()

# --- Relatório Comparação Distribuição x Resultado ---

def build_comparison_report(rows: list) -> dict:
    """
    Compara o valor de Distribuição de Lucros com o Resultado do período.
    Lida com os modos 'distribution' (com lucros antecipados) e 'fallback'.
    """
    distribution_row = next((row for row in rows if row['account'] == '1.1.04.019' or 'DISTRIBUICAO ANTECIPADA DE LUCROS' in normalize_for_compare(row['name'])), None)
    account_3_row = find_account_row(rows, '3')
    account_6_row = find_account_row(rows, '6')
    account_2413_row = find_account_row(rows, '2.4.13')
    
    distribution_value = abs(distribution_row['currentBalanceNumber']) if distribution_row else 0.0
    should_use_fallback = (distribution_value == 0.0)
    
    if should_use_fallback:
        base_value = signed_current_balance(account_3_row) + signed_current_balance(account_6_row)
        target_value = absolute_current_balance(account_2413_row)
        comparable_base_value = abs(base_value)
        comparable_target_value = abs(target_value)
    else:
        base_value = signed_current_balance(account_3_row) + signed_current_balance(account_6_row) + signed_current_balance(account_2413_row)
        target_value = distribution_value
        comparable_base_value = base_value
        comparable_target_value = target_value
        
    difference = comparable_base_value - comparable_target_value
    has_missing_rows = (
        not account_3_row or 
        (not account_2413_row if should_use_fallback else (not distribution_row or not account_2413_row))
    )
    is_attention = has_missing_rows or (comparable_base_value < comparable_target_value)
    
    if should_use_fallback:
        message = 'Tudo OK: a soma das contas 3 e 6 é maior que o S. Atual da conta 2.4.13.'
        if has_missing_rows:
            message = 'Atenção: não foi possível localizar todas as contas necessárias para a comparação.'
        elif comparable_base_value < comparable_target_value:
            message = 'Atenção: a soma das contas 3 e 6 está menor que o S. Atual da conta 2.4.13.'
    else:
        message = 'Tudo OK: a soma das contas 3, 6 e 2.4.13 é maior que o S. Atual da conta 1.1.04.019.'
        if has_missing_rows:
            message = 'Atenção: não foi possível localizar todas as contas necessárias para a comparação.'
        elif comparable_base_value < comparable_target_value:
            message = 'Atenção: a soma das contas 3, 6 e 2.4.13 está menor que o S. Atual da conta 1.1.04.019.'
            
    return {
        'distributionRow': distribution_row,
        'account3Row': account_3_row,
        'account6Row': account_6_row,
        'account2413Row': account_2413_row,
        'mode': 'fallback' if should_use_fallback else 'distribution',
        'baseValue': base_value,
        'targetValue': target_value,
        'difference': difference,
        'isAttention': is_attention,
        'message': message
    }

# --- As 12 Análises Contábeis ---

def build_analysis_1(rows: list) -> dict:
    client_row = find_account_row(rows, '1.1.02')
    is_attention = False
    
    if client_row:
        nature = balance_nature(client_row['currentBalance'])
        is_attention = (nature == 'D' and abs(client_row['currentBalanceNumber']) < 10)
        
    return {
        'kind': 'analysis1',
        'title': 'Clientes com Saldo Atual Baixo',
        'intro': 'Mostra a conta 1.1.02 (Clientes) apenas quando o S. Atual estiver com natureza D e valor menor que 10,00.',
        'message': (
            'Atenção: a conta 1.1.02 (CLIENTES) está com S. Atual menor que 10 e natureza D.'
            if is_attention and client_row else
            'Tudo OK: a conta 1.1.02 (CLIENTES) não está com S. Atual menor que 10D.' if client_row else
            'Atenção: a conta 1.1.02 (CLIENTES) não foi localizada no balancete.'
        ),
        'rows': [client_row] if is_attention and client_row else [],
        'isAttention': not client_row or is_attention
    }

def build_analysis_2(rows: list) -> dict:
    matched_rows = [row for row in rows if row['code'] == '142' and normalize_for_compare(row['name']) == 'CLIENTE PESSOA FISICA']
    flagged_rows = []
    
    for row in matched_rows:
        previous_is_zero = is_zero_money(row['previousBalance'], row['previousBalanceNumber'])
        current_is_zero = is_zero_money(row['currentBalance'], row['currentBalanceNumber'])
        debit_equals_credit = numbers_are_equal(row['debitNumber'], row['creditNumber'])
        if not previous_is_zero or not current_is_zero or not debit_equals_credit:
            flagged_rows.append(row)
            
    return {
        'kind': 'analysis2',
        'title': 'Cliente Pessoa Física Fora da Regra',
        'intro': 'Procura a linha Cliente Pessoa Física com Cod. R. 142 e alerta quando S. Anterior ou S. Atual não estão zerados, ou quando Débito e Crédito são diferentes.',
        'message': (
            'Atenção: nenhuma linha com nome Cliente Pessoa Física e Cod. R. 142 foi localizada.'
            if not matched_rows else
            'Atenção: foram encontradas linhas de Cliente Pessoa Física com Cod. R. 142 fora da regra.'
            if flagged_rows else
            'Tudo OK: as linhas de Cliente Pessoa Física com Cod. R. 142 seguem as regras informadas.'
        ),
        'rows': flagged_rows,
        'isAttention': not matched_rows or len(flagged_rows) > 0
    }

def build_analysis_3(rows: list) -> dict:
    client_row = find_account_row(rows, '1.1.02')
    merchandise_rows = [row for row in rows if row['code'] == '2652']
    service_rows = [row for row in rows if row['code'] == '2700']
    product_rows = [row for row in rows if row['code'] == '2603']
    
    merchandise_credit = sum_credits(merchandise_rows)
    service_credit = sum_credits(service_rows)
    product_credit = sum_credits(product_rows)
    
    target_value = merchandise_credit + service_credit + product_credit
    has_missing_rows = not client_row or not merchandise_rows or not service_rows or not product_rows
    difference = (client_row['debitNumber'] if client_row else 0.0) - target_value
    is_balanced = numbers_are_equal(client_row['debitNumber'] if client_row else 0.0, target_value)
    is_attention = not is_balanced
    
    calculation_rows = []
    if not is_balanced:
        calculation_rows = [r for r in [client_row] + merchandise_rows + service_rows + product_rows if r]
        
    return {
        'kind': 'analysis3',
        'title': 'Conciliação Clientes x Receitas Operacionais',
        'intro': 'Compara o Débito da conta 1.1.02 (Clientes) com a soma dos Créditos das linhas de Cod. R. 2652, 2700 e 2603.',
        'message': (
            'Tudo OK: o Débito da conta 1.1.02 está igual à soma dos Créditos de Vendas de Mercadorias (Cod. R. 2652), Prestação de Serviços (Cod. R. 2700) e Vendas de Produtos (Cod. R. 2603).'
            if is_balanced else
            'Atenção: não foi possível localizar a conta 1.1.02 e/ou as linhas de Cod. R. 2652, 2700 e 2603 para comparação.'
            if has_missing_rows else
            'Atenção: o Débito da conta 1.1.02 difere da soma dos Créditos de Vendas de Mercadorias (Cod. R. 2652), Prestação de Serviços (Cod. R. 2700) e Vendas de Produtos (Cod. R. 2603).'
        ),
        'rows': calculation_rows,
        'isAttention': is_attention,
        'calculation': {
            'formula': 'Débito da conta 1.1.02 (Clientes) deve ser igual ao Crédito das linhas Cod. R. 2652 (Vendas de Mercadorias) mais Cod. R. 2700 (Prestação de Serviços) mais Cod. R. 2603 (Vendas de Produtos).',
            'items': [
                {'label': 'Débito de 1.1.02 (CLIENTES)', 'value': client_row['debitNumber'] if client_row else 0.0},
                {'label': 'Crédito Cod. R. 2652 (VENDAS DE MERCADORIAS)', 'value': merchandise_credit},
                {'label': 'Crédito Cod. R. 2700 (PRESTAÇÃO DE SERVIÇOS)', 'value': service_credit},
                {'label': 'Crédito Cod. R. 2603 (VENDAS DE PRODUTOS)', 'value': product_credit},
                {'label': 'Soma das receitas', 'value': target_value},
                {'label': 'Diferença', 'value': difference}
            ]
        }
    }

def build_analysis_4(rows: list) -> dict:
    client_rows = []
    for row in find_account_family(rows, '1.1.02'):
        nature = balance_nature(row['currentBalance'])
        val = abs(row['currentBalanceNumber'])
        if nature == 'D' and 0 < val <= 10.00:
            client_rows.append(row)
            
    return {
        'kind': 'analysis4',
        'title': 'Clientes com Saldo Residual',
        'intro': 'Mostra contas da família 1.1.02 quando o S. Atual estiver com natureza D, maior que 0 e menor ou igual a 10,00.',
        'message': (
            'Atenção: foram encontrados Clientes e/ou subitens com S. Atual maior que 0 e menor ou igual a 10D.'
            if client_rows else
            'Tudo OK: não foram encontrados Clientes ou subitens com S. Atual entre 0 e 10D.'
        ),
        'rows': client_rows,
        'isAttention': len(client_rows) > 0
    }

def build_analysis_5(rows: list) -> dict:
    flagged_rows = []
    for row in find_account_family(rows, '1.1.02'):
        prev_val = abs(row['previousBalanceNumber'])
        if prev_val > 0 and row['debitNumber'] > 0 and is_zero_money(row['credit'], row['creditNumber']):
            flagged_rows.append(row)
            
    return {
        'kind': 'analysis5',
        'title': 'Clientes sem Crédito no Período',
        'intro': 'Mostra contas da família 1.1.02 quando S. Anterior e Débito são maiores que zero e o Crédito está zerado.',
        'message': (
            'Atenção: foram encontrados Clientes e/ou subitens com S. Anterior e Débito maiores que zero e Crédito zerado.'
            if flagged_rows else
            'Tudo OK: não foram encontrados Clientes ou subitens nesta condição.'
        ),
        'rows': flagged_rows,
        'isAttention': len(flagged_rows) > 0
    }

def build_analysis_6(rows: list) -> dict:
    flagged_rows = []
    for row in find_account_family(rows, '2.1.03'):
        prev_val = abs(row['previousBalanceNumber'])
        curr_val = abs(row['currentBalanceNumber'])
        if prev_val > 0 and row['creditNumber'] > 0 and curr_val > 0 and is_zero_money(row['debit'], row['debitNumber']):
            flagged_rows.append(row)
            
    return {
        'kind': 'analysis6',
        'title': 'Fornecedores sem Débito no Período',
        'intro': 'Mostra contas da família 2.1.03 quando S. Anterior, Crédito e S. Atual são maiores que zero e o Débito está zerado.',
        'message': (
            'Atenção: foram encontrados Fornecedores e/ou subitens com Débito zerado e S. Anterior, Crédito e S. Atual positivos.'
            if flagged_rows else
            'Tudo OK: não foram encontrados Fornecedores ou subitens nesta condição.'
        ),
        'rows': flagged_rows,
        'isAttention': len(flagged_rows) > 0
    }

def build_analysis_7(rows: list) -> dict:
    stock_row = find_account_row(rows, '1.1.08')
    supplier_row = find_account_row(rows, '2.1.03')
    
    missing_supplier = not supplier_row
    missing_stock = not stock_row
    is_attention = missing_supplier or (not missing_stock and stock_row['debitNumber'] > supplier_row['creditNumber'])
    
    calculation_rows = []
    if not missing_stock and is_attention:
        calculation_rows = [r for r in [stock_row, supplier_row] if r]
        
    return {
        'kind': 'analysis7',
        'title': 'Validação Estoques x Fornecedores',
        'intro': 'Compara o Débito da conta 1.1.08 com o Crédito da conta 2.1.03 e alerta quando Estoques fica maior que Fornecedores.',
        'message': (
            'Atenção: não foi possível localizar a conta 2.1.03 para comparação.'
            if missing_supplier else
            'Tudo OK: a conta 1.1.08 não foi localizada, então este relatório pode permanecer oculto.'
            if missing_stock else
            'Atenção: o Débito da conta 1.1.08 está maior que o Crédito da conta 2.1.03.'
            if is_attention else
            'Tudo OK: o Débito da conta 1.1.08 não está maior que o Crédito da conta 2.1.03.'
        ),
        'rows': calculation_rows,
        'isAttention': is_attention,
        'missingStock': missing_stock
    }

def build_analysis_8(rows: list) -> dict:
    supplier_rows = []
    for row in find_account_family(rows, '2.1.03'):
        nature = balance_nature(row['currentBalance'])
        val = abs(row['currentBalanceNumber'])
        if nature == 'C' and 0 < val <= 10.00:
            supplier_rows.append(row)
            
    return {
        'kind': 'analysis8',
        'title': 'Fornecedores com Saldo Residual',
        'intro': 'Mostra contas da família 2.1.03 quando o S. Atual estiver com natureza C, maior que 0 e menor ou igual a 10,00.',
        'message': (
            'Atenção: foram encontrados Fornecedores e/ou subitens com S. Atual maior que 0 e menor ou igual a 10C.'
            if supplier_rows else
            'Tudo OK: não foram encontrados Fornecedores ou subitens com S. Atual entre 0 e 10C.'
        ),
        'rows': supplier_rows,
        'isAttention': len(supplier_rows) > 0
    }

def build_analysis_9(rows: list) -> dict:
    flagged_rows = []
    for row in find_account_family(rows, '2.1.03'):
        prev_val = abs(row['previousBalanceNumber'])
        if prev_val > 0 and row['creditNumber'] > 0 and is_zero_money(row['debit'], row['debitNumber']):
            flagged_rows.append(row)
            
    return {
        'kind': 'analysis9',
        'title': 'Fornecedores com Crédito sem Débito',
        'intro': 'Mostra contas da família 2.1.03 quando S. Anterior e Crédito são maiores que zero e o Débito está zerado.',
        'message': (
            'Atenção: foram encontrados Fornecedores e/ou subitens com S. Anterior e Crédito maiores que zero e Débito zerado.'
            if flagged_rows else
            'Tudo OK: não foram encontrados Fornecedores ou subitens nesta condição.'
        ),
        'rows': flagged_rows,
        'isAttention': len(flagged_rows) > 0
    }

def build_analysis_10(rows: list) -> dict:
    cmv_rows = [row for row in rows if row['code'] == '3001']
    product_rows = [row for row in rows if row['code'] == '2603']
    merchandise_rows = [row for row in rows if row['code'] == '2652']
    service_rows = [row for row in rows if row['code'] == '2700']
    
    cmv_debits = sum(row['debitNumber'] for row in cmv_rows)
    cmv_credits = sum(row['creditNumber'] for row in cmv_rows)
    net_cmv = cmv_debits - cmv_credits
    
    product_credits = sum_credits(product_rows)
    merchandise_credits = sum_credits(merchandise_rows)
    service_credits = sum_credits(service_rows)
    
    total_revenue = product_credits + merchandise_credits + service_credits
    percentage = net_cmv / total_revenue if total_revenue > 0 else 0.0
    
    missing_codes = []
    if not cmv_rows: missing_codes.append('3001')
    if not product_rows: missing_codes.append('2603')
    if not merchandise_rows: missing_codes.append('2652')
    if not service_rows: missing_codes.append('2700')
    
    has_missing_rows = len(missing_codes) > 0
    has_zero_revenue = numbers_are_equal(total_revenue, 0.0)
    is_attention = has_missing_rows or has_zero_revenue or (percentage > 1.0)
    
    calculation_rows = []
    if is_attention:
        calculation_rows = cmv_rows + product_rows + merchandise_rows + service_rows
        
    message = 'Tudo OK: o CMV liquido do Cod. R. 3001 nao ultrapassa a soma das receitas dos Cod. R. 2603, 2652 e 2700.'
    if has_missing_rows:
        message = f"Atencao: base incompleta para o calculo do CMV/Receita. Cod. R. ausente(s): {', '.join(missing_codes)}."
    elif has_zero_revenue:
        message = 'Atencao: a soma das receitas dos Cod. R. 2603, 2652 e 2700 ficou zerada, entao o percentual de CMV nao pode ser calculado.'
    elif percentage > 1.0:
        message = 'Atencao: o CMV liquido do Cod. R. 3001 esta maior que a soma das receitas dos Cod. R. 2603, 2652 e 2700.'
        
    return {
        'kind': 'analysis10',
        'title': 'CMV x Receita Mercadorias',
        'intro': 'Calcula (Debitos do Cod. R. 3001 menos Creditos do Cod. R. 3001) dividido pela soma dos Creditos dos Cod. R. 2603, 2652 e 2700.',
        'message': message,
        'rows': calculation_rows,
        'isAttention': is_attention,
        'calculation': {
            'formula': '(Debitos Cod. R. 3001 - Creditos Cod. R. 3001) / (Creditos Cod. R. 2603 + Creditos Cod. R. 2652 + Creditos Cod. R. 2700)',
            'items': [
                {'label': 'Debitos Cod. R. 3001', 'value': cmv_debits},
                {'label': 'Creditos Cod. R. 3001', 'value': cmv_credits},
                {'label': 'CMV liquido', 'value': net_cmv},
                {'label': 'Creditos Cod. R. 2603', 'value': product_credits},
                {'label': 'Creditos Cod. R. 2652', 'value': merchandise_credits},
                {'label': 'Creditos Cod. R. 2700', 'value': service_credits},
                {'label': 'Receita total considerada', 'value': total_revenue},
                {'label': 'Percentual CMV/Receita', 'value': percentage, 'format': 'percentage'}
            ]
        }
    }

def build_analysis_11(rows: list) -> dict:
    asset_root = next((row for row in rows if row['account'] == '1.2.05' and normalize_for_compare(row['name']) == 'IMOBILIZADO'), None)
    depreciation_root = next((row for row in rows if row['account'] == '1.2.05.007' and 'DEPRECIACAO/AMORTIZACAO/EXAUST' in normalize_for_compare(row['name'])), None)
    
    if not asset_root or not depreciation_root:
        return {
            'kind': 'analysis11',
            'title': 'Depreciacao x Bens',
            'intro': 'Compara os valores de S. Atual dos bens dentro de IMOBILIZADO com suas respectivas contas de depreciacao acumulada, excluindo IMOBILIZADO EM ANDAMENTO.',
            'message': 'Atencao: nao foi possivel localizar as contas raiz de IMOBILIZADO e/ou (-)DEPRECIACAO/AMORTIZACAO/EXAUSTAO ACUMULADA.',
            'rows': [],
            'depreciationPairs': [],
            'isAttention': True
        }
        
    excluded_root = next((row for row in rows if row['account'].startswith(f"{asset_root['account']}.") and normalize_for_compare(row['name']) == 'IMOBILIZADO EM ANDAMENTO'), None)
    excluded_prefix = excluded_root['account'] if excluded_root else None
    
    asset_rows = []
    for row in rows:
        if row['account'] == asset_root['account']: continue
        if not row['account'].startswith(f"{asset_root['account']}."): continue
        if row['account'].startswith(f"{depreciation_root['account']}."): continue
        if excluded_prefix and (row['account'] == excluded_prefix or row['account'].startswith(f"{excluded_prefix}.")): continue
        asset_rows.append(row)
        
    depreciation_rows = [row for row in rows if row['account'].startswith(f"{depreciation_root['account']}.") and row['account'] != depreciation_root['account']]
    
    # Mapeamento de bens pelo nome normalizado
    asset_map = {}
    for row in asset_rows:
        key = normalize_asset_depreciation_pair_name(row['name'])
        if not key: continue
        if key not in asset_map:
            asset_map[key] = []
        asset_map[key].append(row)
        
    flagged_rows = []
    depreciation_pairs = []
    used_asset_accounts = set()
    calculation_items = []
    
    for depreciation_row in depreciation_rows:
        key = normalize_asset_depreciation_pair_name(depreciation_row['name'])
        if not key: continue
        
        candidates = asset_map.get(key, [])
        # Ordena candidatos por tamanho de conta decrescente (mais específica primeiro)
        candidates_sorted = sorted(candidates, key=lambda x: -len(x['account']))
        matched_asset = next((c for c in candidates_sorted if c['account'] not in used_asset_accounts), None)
        depreciation_value = abs(depreciation_row['currentBalanceNumber'])
        
        if not matched_asset:
            flagged_rows.append(depreciation_row)
            depreciation_pairs.append({
                'assetCode': '',
                'assetName': 'Bem equivalente nao localizado',
                'assetCurrentBalance': '',
                'depreciationCode': depreciation_row['code'] or '',
                'depreciationName': depreciation_row['name'],
                'depreciationCurrentBalance': depreciation_row['currentBalance'],
                'correctiveAction': 'Localizar ou cadastrar o bem correspondente a esta depreciacao/exaustao e revisar a classificacao contabil.'
            })
            calculation_items.append({
                'label': f"Depreciacao sem bem equivalente: {depreciation_row['name']}",
                'value': depreciation_value
            })
            continue
            
        used_asset_accounts.add(matched_asset['account'])
        asset_value = abs(matched_asset['currentBalanceNumber'])
        
        if depreciation_value > asset_value:
            flagged_rows.extend([matched_asset, depreciation_row])
            depreciation_pairs.append({
                'assetCode': matched_asset['code'] or '',
                'assetName': matched_asset['name'],
                'assetCurrentBalance': matched_asset['currentBalance'],
                'depreciationCode': depreciation_row['code'] or '',
                'depreciationName': depreciation_row['name'],
                'depreciationCurrentBalance': depreciation_row['currentBalance'],
                'correctiveAction': 'Revisar o pareamento entre o bem e sua depreciacao, pois a depreciacao acumulada esta maior que o valor do bem.'
            })
            calculation_items.extend([
                {'label': f"Bem: {matched_asset['name']}", 'value': asset_value},
                {'label': f"Depreciacao: {depreciation_row['name']}", 'value': depreciation_value},
                {'label': f"Excesso de depreciacao: {matched_asset['name']}", 'value': depreciation_value - asset_value}
            ])
            
    return {
        'kind': 'analysis11',
        'title': 'Depreciacao x Bens',
        'intro': 'Compara os valores de S. Atual de cada bem dentro de IMOBILIZADO com a sua depreciacao equivalente, ignorando C/D e parenteses, e excluindo IMOBILIZADO EM ANDAMENTO.',
        'message': (
            'Atencao: foram encontradas depreciacoes maiores que os bens equivalentes e/ou depreciacoes sem bem correspondente.'
            if depreciation_pairs else
            'Tudo OK: nao foram encontradas depreciacoes maiores que os bens equivalentes nem depreciacoes sem bem correspondente.'
        ),
        'rows': flagged_rows,
        'depreciationPairs': depreciation_pairs,
        'isAttention': len(depreciation_pairs) > 0,
        'calculation': {
            'formula': 'Comparacao entre o valor numerico de S. Atual dos bens do grupo IMOBILIZADO e o valor numerico de S. Atual das respectivas contas de depreciacao acumulada equivalentes.',
            'items': calculation_items
        } if calculation_items else None
    }

def build_analysis_12(rows: list) -> dict:
    excluded_roots = ['3', '3.1', '3.1.02', '3.1.03', '3.1.06', '3.9']
    flagged_rows = []
    
    for row in rows:
        if not row['account'].startswith('3'):
            continue
        # Verifica se está contido em alguma exceção
        is_excluded = any(row['account'] == root or row['account'].startswith(f"{root}.") for root in excluded_roots)
        if is_excluded:
            continue
            
        nature = balance_nature(row['currentBalance'])
        curr_val = abs(row['currentBalanceNumber'])
        
        # Alerta se saldo for credor e maior que zero
        if nature == 'C' and curr_val > 0.0:
            flagged_rows.append(row)
            
    return {
        'kind': 'analysis12',
        'title': 'Despesas Credoras na Classe 3',
        'intro': 'Verifica contas da classe 3 que deveriam encerrar com S. Atual em D, excluindo os grupos 3, 3.1, 3.1.02, 3.1.03, 3.1.06 e 3.9, com seus respectivos filhos.',
        'message': (
            'Atencao: foram encontradas contas da classe 3 com S. Atual credor fora dos grupos de excecao definidos.'
            if flagged_rows else
            'Tudo OK: nao foram encontradas contas da classe 3 com S. Atual credor fora dos grupos de excecao definidos.'
        ),
        'rows': flagged_rows,
        'isAttention': len(flagged_rows) > 0
    }

# --- Orquestrador das Análises ---

def run_all_analyses(rows: list) -> list:
    """Executa as 12 análises de auditoria contábil de forma síncrona."""
    return [
        build_analysis_1(rows),
        build_analysis_2(rows),
        build_analysis_3(rows),
        build_analysis_4(rows),
        build_analysis_5(rows),
        build_analysis_6(rows),
        build_analysis_7(rows),
        build_analysis_8(rows),
        build_analysis_9(rows),
        build_analysis_10(rows),
        build_analysis_11(rows),
        build_analysis_12(rows)
    ]
