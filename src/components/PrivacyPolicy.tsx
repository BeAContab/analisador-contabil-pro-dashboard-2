export function PrivacyPolicy() {
  return (
    <div className="space-y-xl animate-in fade-in duration-500">
      <section className="flex flex-col gap-sm border-b border-outline-variant pb-md">
        <span className="text-label-caps font-label-caps text-secondary uppercase">Institucional</span>
        <h2 className="font-display-lg text-primary">Política de Privacidade</h2>
      </section>

      <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-sm space-y-lg text-on-surface">
        <section className="space-y-md">
          <h3 className="font-headline-md text-primary">1. Compromisso com a Privacidade</h3>
          <p className="text-body-md leading-relaxed">
            O Analisador Contábil Pro foi desenvolvido com o princípio de "Privacidade por Design". Entendemos que os dados contábeis são sensíveis e estratégicos, por isso nossa arquitetura garante que suas informações nunca saiam do seu controle.
          </p>
        </section>

        <section className="space-y-md">
          <h3 className="font-headline-md text-primary">2. Coleta de Dados</h3>
          <p className="text-body-md leading-relaxed">
            <strong>Não coletamos seus dados contábeis.</strong> O processamento dos arquivos PDF é realizado
            inteiramente no seu navegador (client-side). Os arquivos não são enviados para nossos servidores e não são
            armazenados em nuvem por nós.
          </p>
        </section>

        <section className="space-y-md">
          <h3 className="font-headline-md text-primary">3. Assistente de IA (recurso opcional)</h3>
          <p className="text-body-md leading-relaxed">
            O produto oferece um assistente de IA <strong>opcional e desativado por padrão</strong>. Ele só funciona
            depois que você informa sua própria chave da API do Gemini e autoriza expressamente o envio, marcando o
            aviso de privacidade exibido no próprio assistente.
          </p>
          <p className="text-body-md leading-relaxed">
            Quando ativado, o arquivo PDF continua sem sair do seu navegador, mas um <strong>resumo pseudonimizado da
            análise</strong> é transmitido para a API do Google (Gemini). Antes do envio, a razão social é substituída
            por um apelido genérico (&quot;Empresa 1&quot;) e números de CNPJ e CPF são removidos. O resumo ainda contém
            códigos e nomes de contas, saldos, período e os alertas identificados — informações necessárias para a
            interpretação técnica.
          </p>
          <p className="text-body-md leading-relaxed">
            Esse tratamento passa a ser regido pelos termos e pela política de privacidade do Google. Não temos controle
            sobre retenção ou uso posterior por parte desse provedor. Se preferir não compartilhar nada, basta manter o
            assistente no modo local: todas as análises permanecem disponíveis sem qualquer transmissão.
          </p>
        </section>

        <section className="space-y-md">
          <h3 className="font-headline-md text-primary">4. Cookies e Armazenamento Local</h3>
          <p className="text-body-md leading-relaxed">
            Utilizamos apenas cookies essenciais para o funcionamento técnico da plataforma e armazenamento temporário
            de preferências de interface (como o modo de visualização). Não utilizamos cookies de rastreamento de
            marketing ou publicidade. Caso você opte por salvar a chave da API do Gemini, ela é gravada sem criptografia
            no armazenamento local do seu navegador, expira automaticamente em 30 dias e pode ser apagada a qualquer
            momento pelo botão &quot;Limpar&quot; no assistente.
          </p>
        </section>

        <section className="space-y-md">
          <h3 className="font-headline-md text-primary">5. Seus Direitos (LGPD)</h3>
          <p className="text-body-md leading-relaxed">
            Como os dados são processados localmente, você detém o controle total sobre eles. Ao fechar a aba ou limpar
            o cache do navegador, todos os dados processados na sessão são permanentemente eliminados da memória local.
            Ao usar o assistente de IA, você atua como controlador dos dados compartilhados e deve avaliar previamente
            se possui base legal para transmiti-los a um provedor externo.
          </p>
        </section>
      </article>
    </div>
  );
}
