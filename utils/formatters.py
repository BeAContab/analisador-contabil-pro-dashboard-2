import re
import unicodedata
from datetime import datetime

def slugify(value: str) -> str:
    """
    Remove acentos, converte para minúsculas e substitui caracteres não-alfanuméricos por hífen.
    """
    if not value:
        return "empresa"
    # Normalização NFD para separar caracteres de seus acentos
    normalized = unicodedata.normalize('NFD', value)
    cleaned = "".join([c for c in normalized if not unicodedata.combining(c)])
    # Caixa baixa
    cleaned = cleaned.lower()
    # Substituir caracteres não alfanuméricos por hífen
    cleaned = re.sub(r'[^a-z0-9]+', '-', cleaned)
    # Remover hífens nas extremidades
    cleaned = cleaned.strip('-')
    return cleaned[:80] if cleaned else "empresa"

def now_label() -> str:
    """
    Retorna a data e hora atual formatada no estilo pt-BR (dd/mm/aaaa hh:mm).
    """
    return datetime.now().strftime("%d/%m/%Y %H:%M")

def parse_brazilian_money(value: str) -> float:
    """
    Converte uma string no formato de moeda brasileiro (ex: "1.234,56D", "(120,00)", "R$ -50,00C") para float.
    """
    if not value:
        return 0.0
    
    clean = value.strip()
    # Remove D ou C no final
    clean = re.sub(r'[DC]$', '', clean, flags=re.IGNORECASE).strip()
    # Remove R$ no início
    clean = re.sub(r'^R\$\s*', '', clean, flags=re.IGNORECASE).strip()
    
    if not clean:
        return 0.0
    
    # Verifica se está entre parênteses (formato contábil para negativo)
    negative = clean.startswith('(') and clean.endswith(')')
    if negative:
        clean = clean[1:-1].strip()
        
    # Remove pontos de milhares e substitui a vírgula decimal por ponto
    clean = clean.replace('.', '').replace(',', '.')
    
    try:
        parsed = float(clean)
        return -parsed if negative else parsed
    except ValueError:
        return 0.0

def balance_nature(value: str) -> str:
    """
    Identifica a natureza (D ou C) no final de uma string contábil. Retorna 'D', 'C' ou None.
    """
    if not value:
        return None
    match = re.search(r'([DC])\s*$', value.strip(), re.IGNORECASE)
    return match.group(1).upper() if match else None

def is_zero_money(value: str, parsed_value: float) -> bool:
    """
    Verifica se um valor contábil é considerado zero (nulo/sem movimentação).
    """
    if abs(parsed_value) == 0:
        return True
    clean = value.strip()
    return clean in ('', '0', '0,00', '0.00')

def classify_account(account: str) -> str:
    """
    Classifica a conta em 'Ativo' ou 'Passivo' com base no dígito inicial.
    """
    if not account:
        return ''
    if account.startswith('1'):
        return 'Ativo'
    elif account.startswith('2'):
        return 'Passivo'
    return ''

def format_number_as_brazilian_money(value: float) -> str:
    """
    Formata um float como string de moeda brasileira (ex: 1234.56 -> "1.234,56").
    """
    # Lida com o sinal de forma limpa para exibição
    is_neg = value < 0
    abs_val = abs(value)
    
    # Formatação básica com duas casas decimais e separador de milhar customizado
    formatted = f"{abs_val:,.2f}"
    # Troca separadores (, por ponto, . por vírgula)
    parts = formatted.split('.')
    thousands = parts[0].replace(',', '.')
    decimals = parts[1]
    
    result = f"{thousands},{decimals}"
    return f"-{result}" if is_neg else result

def format_number_as_percentage(value: float) -> str:
    """
    Formata uma taxa fracionária como percentual brasileiro (ex: 0.1234 -> "12,34%").
    """
    percentage_value = value * 100
    is_neg = percentage_value < 0
    abs_val = abs(percentage_value)
    
    formatted = f"{abs_val:,.2f}"
    parts = formatted.split('.')
    thousands = parts[0].replace(',', '.')
    decimals = parts[1]
    
    result = f"{thousands},{decimals}%"
    return f"-{result}" if is_neg else result
