import re
from pypdf import PdfReader
from utils.formatters import parse_brazilian_money, slugify

# ExpressÃµes regulares equivalentes Ã s originais em JS
account_regex = re.compile(r'^\s*([1-9](?:\.\d+)*)(?=\s|$)')
cnpj_regex = re.compile(r'\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b')
company_code_regex = re.compile(r'^\(\s*(\d+)\s*-\s*(\d+)\s*\)\s*(.+)$')
money_regex = re.compile(r'\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?[DC]?|\(?\d+,\d{2}\)?[DC]?', re.IGNORECASE)
money_boundary_regex = re.compile(r'([A-Za-z])(\(?\d{1,3}(?:\.\d{3})*,\d{2}\)?[DC]?)', re.IGNORECASE)

default_nature_accounts = ['1.2.05.007', '2.4.13.004']

def extract_pdf_lines(pdf_file) -> list:
    """
    Extrai o texto das pÃ¡ginas do PDF e agrupa elementos textuais por alinhamento vertical (coordenada y)
    e horizontal (coordenada x), replicando o comportamento posicional do PDF.js.
    """
    reader = PdfReader(pdf_file)
    page_lines = []
    
    for page_idx, page in enumerate(reader.pages):
        page_number = page_idx + 1
        items = []
        
        # Callback para obter os trechos de texto e suas coordenadas posicionais
        def visitor(text, cm, tm, fontDict, fontSize):
            cleaned = text.strip()
            if cleaned:
                # tm[4] Ã© o X, tm[5] Ã© o Y
                x = tm[4]
                y = tm[5]
                # Estimativa de largura do trecho (largura mÃ©dia por caractere)
                width = len(text) * (fontSize if fontSize else 8) * 0.5
                items.append({
                    'text': text,
                    'x': x,
                    'y': y,
                    'width': width,
                    'page': page_number
                })
                
        # Aciona o visitor para extrair o texto estruturado da pÃ¡gina
        page.extract_text(visitor_text=visitor)
        
        if items:
            # Agrupa os itens contidos na mesma linha horizontal (tolerÃ¢ncia de Y <= 3 pixels)
            buckets = []
            # Ordena por Y decrescente (do topo para baixo) e X crescente (da esquerda para a direita)
            sorted_items = sorted(items, key=lambda item: (-item['y'], item['x']))
            
            for item in sorted_items:
                found_bucket = None
                for bucket in buckets:
                    if abs(bucket[0]['y'] - item['y']) <= 3:
                        found_bucket = bucket
                        break
                
                if found_bucket is not None:
                    found_bucket.append(item)
                else:
                    buckets.append([item])
            
            # ReconstrÃ³i as linhas preservando gaps de colunas
            for bucket in buckets:
                bucket_sorted = sorted(bucket, key=lambda item: item['x'])
                pieces = []
                previous_x = 0
                
                for idx, item in enumerate(bucket_sorted):
                    gap = 0 if idx == 0 else item['x'] - previous_x
                    # Se houver um espaÃ§o maior que 12 pixels, insere um espaÃ§o separador de coluna
                    if idx > 0 and gap > 12:
                        pieces.append(' ')
                    pieces.append(item['text'])
                    previous_x = item['x'] + max(item['width'], 8)
                
                line_text = "".join(pieces)
                # Normaliza espaÃ§os extras
                line_text = re.sub(r'\s+', ' ', line_text).strip()
                if line_text:
                    page_lines.append({
                        'page': page_number,
                        'text': line_text
                    })
                    
    return page_lines

def extract_metadata(all_text: str, file_name: str) -> dict:
    """
    Extrai metadados do balancete: CÃ³digo da Empresa, Nome da Empresa, CNPJ e PerÃ­odo de ReferÃªncia.
    """
    lines = [line.strip() for line in all_text.split('\n') if line.strip()]
    
    # Procura linha do nome da empresa
    company_line = None
    for line in lines:
        if re.search(r'^\(\s*[^)]*\)\s+.+', line):
            company_line = line
            break
            
    if not company_line:
        for line in lines:
            if re.search(r'LTDA|S/A|EIRELI|ME\b|EPP\b', line, re.IGNORECASE):
                company_line = line
                break
                
    company_code = None
    company_name = file_name.replace('.pdf', '').replace('.PDF', '')
    
    if company_line:
        match = company_code_regex.match(company_line)
        if match:
            company_code = f"{match.group(1)}-{match.group(2)}"
            company_name = match.group(3).strip()
        else:
            # Limpa prefixos de cÃ³digos de parÃªnteses se houver
            company_name = re.sub(r'^\(\s*[^)]*\)\s*', '', company_line).strip()
            if not company_name:
                company_name = company_line
                
    cnpj = "CNPJ nao identificado"
    cnpj_match = cnpj_regex.search(all_text)
    if cnpj_match:
        cnpj = cnpj_match.group(0)
        
    period = "Periodo nao identificado"
    for line in lines:
        if re.search(r'Referencia', line, re.IGNORECASE):
            period_match = re.search(r'(\d{2}/[A-Z]{3}/\d{4}\s+ate\s+\d{2}/[A-Z]{3}/\d{4})', line, re.IGNORECASE)
            if period_match:
                period = period_match.group(1)
                break
                
    return {
        'companyCode': company_code,
        'companyName': company_name,
        'cnpj': cnpj,
        'period': period
    }

def merge_continuation_lines(lines: list) -> list:
    """
    Mescla linhas de continuaÃ§Ã£o de contas longas.
    Se uma linha nÃ£o comeÃ§a com uma conta contÃ¡bil, mas a anterior comeÃ§ava e ainda nÃ£o
    tinha seus 4 valores numÃ©ricos identificados, junta as duas.
    """
    merged = []
    
    for line in lines:
        text = line['text']
        starts_account = bool(account_regex.match(text))
        previous = merged[-1] if merged else None
        
        if not starts_account and previous and account_regex.match(previous['text']) and not has_four_money_values(previous['text']):
            previous['text'] = f"{previous['text']} {text}".strip()
            # Limpa espaÃ§os extras
            previous['text'] = re.sub(r'\s+', ' ', previous['text'])
        else:
            merged.append({'page': line['page'], 'text': text})
            
    return merged

def has_four_money_values(text: str) -> bool:
    """
    Verifica se a string possui pelo menos 4 blocos de valores monetÃ¡rios.
    """
    return len(money_regex.findall(text)) >= 4

def parse_ledger_line(raw_line: str, page: int) -> dict:
    """
    Faz o parse de uma Ãºnica linha de balancete contÃ¡bil, extraindo a conta,
    o cÃ³digo reduzido (se houver), o nome da conta e os 4 valores (Saldo Anterior, DÃ©bito, CrÃ©dito e Saldo Atual).
    """
    # Adiciona espaÃ§o de margem entre letras e nÃºmeros monetÃ¡rios
    normalized_line = re.sub(r'(?<=\d)\s+,\s*(?=\d)', ',', raw_line)
    normalized_line = re.sub(r'(?<=,)\s+(?=\d)', '', normalized_line)
    normalized_line = re.sub(r'(?<=,\d)\s+(?=\d(?:\D|$))', '', normalized_line)
    raw = money_boundary_regex.sub(r'\1 \2', normalized_line)
    # Limpa espaÃ§os extras
    raw = re.sub(r'\s+', ' ', raw).strip()
    
    account_match = account_regex.match(raw)
    if not account_match:
        return None
        
    account = account_match.group(1)
    rest = raw[len(account_match.group(0)):].strip()
    code = None
    
    # Tenta obter cÃ³digo reduzido no inÃ­cio do restante do texto
    leading_code = re.match(r'^(\d{1,8})\s+(?=\D)', rest)
    if leading_code:
        code = leading_code.group(1)
        rest = rest[len(leading_code.group(0)):].strip()
        
    # Tenta obter cÃ³digo reduzido no final do restante do texto (antes dos valores)
    trailing_code = re.search(r'\s+(\d{1,8})$', rest)
    if not code and trailing_code:
        code = trailing_code.group(1)
        rest = rest[:trailing_code.start()].strip()
        
    money_matches = list(money_regex.finditer(rest))
    if len(money_matches) < 4:
        return None
        
    # Pega os 4 Ãºltimos valores monetÃ¡rios da linha
    last_four = money_matches[-4:]
    first_money_idx = last_four[0].start()
    
    name = rest[:first_money_idx].strip()
    if not name:
        return None
        
    values = [match.group(0) for match in last_four]
    previous_balance, debit, credit, current_balance = values
    
    return {
        'account': account,
        'name': name,
        'previousBalance': previous_balance,
        'debit': debit,
        'credit': credit,
        'currentBalance': current_balance,
        'code': code,
        'page': page,
        'raw': raw,
        'previousBalanceNumber': parse_brazilian_money(previous_balance),
        'debitNumber': parse_brazilian_money(debit),
        'creditNumber': parse_brazilian_money(credit),
        'currentBalanceNumber': parse_brazilian_money(current_balance)
    }

def parse_account_stub(raw_line: str, page: int) -> dict:
    """Extrai conta, Cod. R. e eventual S. Anterior quando o PDF separa colunas."""
    raw = re.sub(r'\s+', ' ', raw_line).strip()
    account_match = account_regex.match(raw)
    if not account_match:
        return None

    account = account_match.group(1)
    rest = raw[len(account_match.group(0)):].strip()
    code = None
    previous_balance = None

    code_match = re.match(r'^(\d{1,8})(?:\s+|$)', rest)
    if code_match:
        code = code_match.group(1)
        rest = rest[code_match.end():].strip()

    money_match = money_regex.fullmatch(rest) if rest else None
    if money_match:
        previous_balance = money_match.group(0)

    return {
        'account': account,
        'code': code,
        'previousBalance': previous_balance,
        'page': page,
        'raw': raw
    }

def payload_body_from_compact_line(text: str) -> str:
    """Retorna a parte de nomes e valores no layout compacto extraido do PDF."""
    if 'Folha:' not in text or 'S. Atual' not in text:
        return None

    header_match = re.search(r'S\.\s*Atual\s+S\.\s*Anterior\s+D\S+\s+', text, re.IGNORECASE)
    if not header_match:
        return None

    return text[header_match.end():].strip()

def parse_compact_page_rows(stubs: list, payload_text: str) -> list:
    """ReconstrÃ³i pÃ¡ginas em que Conta/Cod.R. e Nome/valores saem em colunas separadas."""
    rows = []
    position = 0

    for stub in stubs:
        required_values = 3 if stub.get('previousBalance') else 4
        matches = []

        for match in money_regex.finditer(payload_text, position):
            matches.append(match)
            if len(matches) == required_values:
                break

        if len(matches) < required_values:
            return None

        name = payload_text[position:matches[0].start()].strip()
        if not name:
            return None

        values = [match.group(0) for match in matches]
        if stub.get('previousBalance'):
            previous_balance = stub['previousBalance']
            debit, credit, current_balance = values
        else:
            previous_balance, debit, credit, current_balance = values

        raw = f"{stub['raw']} {name} {' '.join(values)}"
        rows.append({
            'account': stub['account'],
            'name': name,
            'previousBalance': previous_balance,
            'debit': debit,
            'credit': credit,
            'currentBalance': current_balance,
            'code': stub.get('code'),
            'page': stub['page'],
            'raw': raw,
            'previousBalanceNumber': parse_brazilian_money(previous_balance),
            'debitNumber': parse_brazilian_money(debit),
            'creditNumber': parse_brazilian_money(credit),
            'currentBalanceNumber': parse_brazilian_money(current_balance)
        })
        position = matches[-1].end()

    return rows

def parse_compact_balancete_pages(page_lines: list) -> tuple:
    """Parseia pÃ¡ginas compactadas que o extrator devolve como uma linha textual gigante."""
    rows = []
    parsed_pages = set()
    pages = {}

    for line in page_lines:
        pages.setdefault(line['page'], []).append(line)

    for page, lines in pages.items():
        payload = None
        stubs = []

        for line in lines:
            body = payload_body_from_compact_line(line['text'])
            if body:
                payload = body
                continue

            stub = parse_account_stub(line['text'], line['page'])
            if stub:
                stubs.append(stub)

        if not payload or not stubs:
            continue

        page_rows = parse_compact_page_rows(stubs, payload)
        if page_rows:
            rows.extend(page_rows)
            parsed_pages.add(page)

    return rows, parsed_pages

def looks_like_code_and_values_only(text: str) -> bool:
    """Detecta linhas sem nome de conta, contendo apenas conta/codigo e blocos monetarios."""
    cleaned = money_regex.sub(' ', text)
    cleaned = re.sub(r'[0-9.\-()/,]', ' ', cleaned)
    cleaned = re.sub(r'\b[DC]\b', ' ', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned == ''

def is_default_nature_account(account: str) -> bool:
    """
    Verifica se a conta possui natureza padrÃ£o invertida (ex: DepreciaÃ§Ã£o ou PrejuÃ­zos Acumulados).
    """
    return any(account == default or account.startswith(default + '.') for default in default_nature_accounts)

def enrich_zero_movement_rows(zero_rows: list, all_rows: list) -> list:
    """
    Adiciona o prefixo do nome da conta pai a subcontas sem movimentaÃ§Ã£o
    para melhorar o entendimento textual (ex: "Banco X - Conta Principal").
    """
    account_names = {row['account']: row['name'] for row in all_rows}
    enriched = []
    
    for row in zero_rows:
        levels = row['account'].split('.')
        if len(levels) < 5:
            enriched.append(row)
            continue
            
        parent_account = ".".join(levels[:4])
        parent_name = account_names.get(parent_account)
        
        if not parent_name or row['name'].startswith(f"{parent_name} - "):
            enriched.append(row)
            continue
            
        enriched_row = dict(row)
        enriched_row['name'] = f"{parent_name} - {row['name']}"
        enriched.append(enriched_row)
        
    return enriched

def parse_pdf_file(pdf_file) -> dict:
    """
    Funcao principal de parsing: recebe o arquivo PDF, le as linhas, agrupa, normaliza,
    extrai metadados, cria as linhas da Ledger contabil e identifica erros basicos de formato.
    """
    errors = []
    try:
        page_lines = extract_pdf_lines(pdf_file)
        all_text = "\n".join([line['text'] for line in page_lines])
        meta = extract_metadata(all_text, getattr(pdf_file, 'name', 'balancete.pdf'))

        compact_rows, compact_pages = parse_compact_balancete_pages(page_lines)
        regular_page_lines = [line for line in page_lines if line['page'] not in compact_pages]
        candidates = merge_continuation_lines(regular_page_lines)

        rows = compact_rows[:]
        unclassified = []

        for candidate in candidates:
            if not account_regex.match(candidate['text']):
                continue

            row = parse_ledger_line(candidate['text'], candidate['page'])
            if row:
                rows.append(row)
                continue

            # Linhas de indice (conta/codigo sem 4 valores) nao sao inconsistencias de parse.
            stub = parse_account_stub(candidate['text'], candidate['page'])
            money_count = len(money_regex.findall(candidate['text']))
            if stub and money_count <= 1:
                continue

            # Linhas parciais com 3 (ou menos) valores costumam ser restos de quebra de coluna.
            if money_count <= 3:
                continue

            if looks_like_code_and_values_only(candidate['text']):
                continue

            unclassified.append({
                'page': candidate['page'],
                'text': candidate['text'],
                'reason': 'Linha com conta contabil sem quatro valores monetarios identificaveis.'
            })

        if not rows:
            errors.append('Nao foi possivel identificar linhas contabeis neste arquivo.')

        return {
            'fileName': getattr(pdf_file, 'name', 'balancete.pdf'),
            'companyCode': meta['companyCode'],
            'companyName': meta['companyName'],
            'cnpj': meta['cnpj'],
            'period': meta['period'],
            'rows': rows,
            'unclassified': unclassified,
            'errors': errors
        }

    except Exception as e:
        return {
            'fileName': getattr(pdf_file, 'name', 'balancete.pdf'),
            'companyCode': None,
            'companyName': getattr(pdf_file, 'name', 'balancete').replace('.pdf', '').replace('.PDF', ''),
            'cnpj': 'CNPJ nao identificado',
            'period': 'Periodo nao identificado',
            'rows': [],
            'unclassified': [],
            'errors': [f'Nao foi possivel ler este PDF. Detalhes: {str(e)}']
        }


