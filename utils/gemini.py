import os
import google.generativeai as genai
from utils.formatters import format_number_as_brazilian_money

def build_system_instruction() -> str:
    """Retorna as instruções de sistema detalhadas para o perfil do assistente de IA."""
    return (
        "Voce e a IA especialista do chatbot do Analisador Contabil Pro, com atuacao senior em analise de balancete no contexto brasileiro. "
        "Seu objetivo e interpretar os achados do sistema com precisao tecnica, linguagem clara e foco em apoio a conferencia contabil. "
        "Responda sempre em portugues do Brasil. "
        "Nao invente contas, valores, documentos, fatos, pareceres ou conclusoes que nao estejam no contexto recebido. "
        "Quando faltar dado, diferencie explicitamente [Fato], [Inferencia] e [Hipotese]. "
        "Quando houver risco alto, destaque isso logo no inicio da resposta. "
        "Classifique os achados por severidade: Alto, Medio ou Baixo, considerando materialidade e impacto provavel no fechamento. "
        "Explique de forma pratica o que aconteceu, por que isso importa e qual verificacao manual fazer em seguida. "
        "Nao afirme conformidade fiscal, societaria ou contabil definitiva. "
        "Considere como referencia de alto nivel a Lei 6.404/1976, as Leis 11.638/2007 e 11.941/2009, o Codigo Civil sobre escrituracao, a ITG 2000 (R1), a NBC TG Estrutura Conceitual, a NBC TG 26, NBC TG 23, NBC TG 16, NBC TG 25, NBC TG 27, NBC TG 47, NBC TG 48 e a NBC TG 1000 quando aplicavel. "
        "Use essas referencias apenas como base interpretativa geral; nao cite artigo ou item especifico sem evidencia clara no contexto. "
        "Antes de responder, valide internamente se voce usou apenas dados presentes no contexto, classificou a severidade, apontou limitacoes e sugeriu acoes praticas de conferencia. "
        "Padrao visual obrigatorio: use titulos em negrito, uma linha em branco entre secoes, frases curtas e listas numeradas para prioridades. "
        "Evite texto corrido longo, excesso de asteriscos e repeticoes. "
        "Quando citar numeros, destaque em negrito os totais principais e a severidade. "
        "Se a resposta ficar extensa, entregue primeiro uma versao executiva curta e ofereca aprofundamento em seguida. "
        "Formato obrigatorio da resposta: \n"
        "1. Empresa com mais alertas\n"
        "2. Resumo executivo\n"
        "3. Achados priorizados\n"
        "4. Limitacoes e incertezas\n"
        "5. Proximos passos.\n"
        "Se o usuario pedir algo fora do contexto do balancete, responda de forma breve e puxe a conversa de volta para o dominio contabil do produto."
    )

def summarize_reports_for_prompt(reports: list) -> str:
    """
    Compacta as inconsistências e resumos das empresas analisadas localmente
    para enviá-las como contexto enxuto ao Gemini.
    """
    if not reports:
        return (
            "- Nenhum balancete foi processado nesta sessao.\n"
            "- O sistema consegue detectar saldos invertidos, contas sem movimentacao, divergencias entre distribuicao e resultado e analises de clientes, fornecedores e estoques.\n"
            "- O processamento atual do produto e local no navegador."
        )
        
    blocks = []
    total_occurrences = 0
    
    for r in reports:
        analysis_flags = []
        for a in r.get('analysisReports', []):
            if a.get('isAttention'):
                occ_cnt = len(a.get('depreciationPairs', [])) if a['kind'] == 'analysis11' else (len(a.get('rows', [])) if a.get('rows') else 1)
                analysis_flags.append(f"{a['title']}: {occ_cnt} ocorrencia(s)")
                total_occurrences += occ_cnt
                
        top_inverted = "; ".join([f"{row['account']} {row['name']} ({row['currentBalance']})" for row in r.get('invertedRows', [])[:4]])
        top_zero = "; ".join([f"{row['account']} {row['name']}" for row in r.get('zeroMovementRows', [])[:4]])
        
        total_occurrences += len(r.get('invertedRows', []))
        total_occurrences += len(r.get('zeroMovementRows', []))
        if r.get('comparisonReport', {}).get('isAttention'):
            total_occurrences += 1
            
        block = (
            f"Empresa: {r['companyName']}\n"
            f"CNPJ: {r['cnpj']}\n"
            f"Periodo: {r['period']}\n"
            f"Linhas extraidas: {len(r.get('rows', []))}\n"
            f"Saldos invertidos: {len(r.get('invertedRows', []))}{' | exemplos: ' + top_inverted if top_inverted else ''}\n"
            f"Sem movimentacao: {len(r.get('zeroMovementRows', []))}{' | exemplos: ' + top_zero if top_zero else ''}\n"
            f"Comparacao distribuicao x resultado: {'atencao' if r.get('comparisonReport', {}).get('isAttention') else 'ok'} | mensagem: {r.get('comparisonReport', {}).get('message')}\n"
            f"Linhas nao classificadas: {len(r.get('unclassified', []))}\n"
            f"Erros de leitura: {len(r.get('errors', []))}\n"
            f"Analises em atencao: {' | '.join(analysis_flags) if analysis_flags else 'nenhuma'}"
        )
        blocks.append(block)
        
    totals = (
        f"Empresas processadas: {len(reports)}\n"
        f"Ocorrencias totais detectadas: {total_occurrences}"
    )
    
    return totals + "\n" + "\n---\n".join(blocks)

def build_gemini_prompt(reports: list, user_message: str) -> str:
    """Monta a query final formatada para enviar ao modelo."""
    return (
        "Contexto estruturado do sistema:\n"
        f"{summarize_reports_for_prompt(reports)}\n\n"
        "Checklist interno antes de responder:\n"
        "- Use apenas dados presentes no contexto.\n"
        "- Diferencie [Fato], [Inferencia] e [Hipotese] quando houver incerteza.\n"
        "- Classifique a severidade dos achados em Alto, Medio ou Baixo.\n"
        "- Informe limitacoes de parsing, ausencia de conta ou dado insuficiente.\n"
        "- Sugira proximos passos concretos de conferencia.\n\n"
        "- A resposta deve ser legivel: secoes curtas, espaco entre blocos e sem paragrafos longos.\n"
        "- Destaque em negrito empresa lider, totais e severidade.\n\n"
        "Formato obrigatorio da resposta:\n"
        "1. Empresa com mais alertas\n"
        "2. Resumo executivo\n"
        "3. Achados priorizados\n"
        "4. Limitacoes e incertezas\n"
        "5. Proximos passos\n\n"
        "Instrucao de resposta:\n"
        "Use apenas o contexto acima e a pergunta do usuario para responder de forma util, objetiva, tecnicamente cautelosa e adequada a um contador senior.\n"
        "Nao use markdown de lista com asterisco (*). Prefira lista numerada.\n"
        "Cada secao deve ter no maximo 3 a 5 linhas, salvo quando o usuario pedir aprofundamento.\n\n"
        f"Pergunta do usuario: {user_message}"
    )

def generate_gemini_reply(api_key: str, reports: list, history: list, user_message: str) -> str:
    """
    Executa a requisição ao Gemini 2.5 Flash usando o SDK oficial do Google,
    gerenciando histórico e gerando respostas no formato contábil sênior.
    """
    if not api_key:
        return (
            "Chave de API do Gemini não configurada.\n\n"
            "Informe sua API Key na seção correspondente do menu lateral para que eu possa "
            "interpretar os relatórios e analisar inconsistências utilizando Inteligência Artificial de nível sênior."
        )
        
    try:
        # Configura a chave de API
        genai.configure(api_key=api_key)
        
        # Cria a instrução do sistema
        system_instruction = build_system_instruction()
        
        # Configurações de geração do modelo
        generation_config = genai.types.GenerationConfig(
            temperature=0.45,
            top_p=0.9,
            max_output_tokens=2048
        )
        
        # Cria o modelo (usando gemini-2.5-flash como no JS original)
        model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            system_instruction=system_instruction,
            generation_config=generation_config
        )
        
        # Reconstrói o histórico no formato adequado ao SDK
        chat_contents = []
        for turn in history:
            role = 'user' if turn['role'] == 'user' else 'model'
            chat_contents.append({
                'role': role,
                'parts': [turn['text']]
            })
            
        # Inicia a sessão de chat
        chat = model.start_chat(history=chat_contents)
        
        # Prepara o prompt atual contendo o contexto
        prompt = build_gemini_prompt(reports, user_message)
        
        # Envia a mensagem e coleta a resposta
        response = chat.send_message(prompt)
        
        return response.text
        
    except Exception as e:
        return (
            f"Erro ao obter resposta da API do Gemini.\n\n"
            f"Detalhes técnicos: {str(e)}\n\n"
            "Verifique se a chave de API está correta e se possui saldo ou cota ativa."
        )
