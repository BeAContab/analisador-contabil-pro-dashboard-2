export function DataSecurity() {
  return (
    <div className="space-y-xl animate-in fade-in duration-500">
      <section className="flex flex-col gap-sm border-b border-outline-variant pb-md">
        <span className="text-label-caps font-label-caps text-secondary uppercase">Segurança</span>
        <h2 className="font-display-lg text-primary">Segurança dos Dados</h2>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm space-y-md">
          <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined">shield_lock</span>
          </div>
          <h3 className="font-title-sm text-primary">Isolamento Local</h3>
          <p className="text-body-sm text-secondary leading-relaxed">
            Todo o processamento de OCR e análise lógica é executado dentro da sandbox do seu navegador. O arquivo PDF não cruza a rede em nenhum momento. A única exceção é o assistente de IA opcional, desativado por padrão e detalhado abaixo.
          </p>
        </article>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm space-y-md">
          <div className="w-12 h-12 bg-secondary-container rounded-full flex items-center justify-center text-on-secondary-container">
            <span className="material-symbols-outlined">memory</span>
          </div>
          <h3 className="font-title-sm text-primary">Memória Volátil</h3>
          <p className="text-body-sm text-secondary leading-relaxed">
            Os dados do balancete residem apenas na memória RAM enquanto a aplicação está aberta. Não gravamos informações em bancos de dados ou armazenamento persistente sem sua ação explícita (como baixar um PDF ou salvar a chave da API, que expira em 30 dias).
          </p>
        </article>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm space-y-md">
          <div className="w-12 h-12 bg-tertiary-container rounded-full flex items-center justify-center text-on-tertiary-container">
            <span className="material-symbols-outlined">encrypted</span>
          </div>
          <h3 className="font-title-sm text-primary">Criptografia em Trânsito</h3>
          <p className="text-body-sm text-secondary leading-relaxed">
            O acesso à aplicação é feito via HTTPS (TLS 1.3), garantindo que o código da ferramenta que chega ao seu navegador não foi interceptado ou modificado. Se o assistente de IA for ativado, a chamada à API do Google também trafega criptografada.
          </p>
        </article>

        <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm space-y-md">
          <div className="w-12 h-12 bg-surface-container-highest rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined">verified_user</span>
          </div>
          <h3 className="font-title-sm text-primary">Conformidade Corporativa</h3>
          <p className="text-body-sm text-secondary leading-relaxed">
            Mantendo o assistente de IA desativado, nenhum dado do balancete trafega para terceiros — arquitetura compatível com as políticas de TI mais rigorosas.
          </p>
        </article>
      </div>

      <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-sm space-y-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
          <h3 className="font-title-sm text-primary">Assistente de IA: a única exceção</h3>
        </div>
        <p className="text-body-sm text-secondary leading-relaxed">
          O chat com IA é <strong>opcional e vem desligado</strong>. Ele só entra em operação depois que você informa sua
          própria chave da API do Gemini e confirma o aviso de privacidade dentro do assistente.
        </p>
        <p className="text-body-sm text-secondary leading-relaxed">
          Quando ativado, o PDF continua sem sair do navegador, mas um resumo pseudonimizado da análise é enviado ao
          Google: a razão social vira &quot;Empresa 1&quot; e CNPJ/CPF são removidos antes do envio. Códigos e nomes de
          contas, saldos, período e alertas <strong>são transmitidos</strong>, pois são necessários para a interpretação.
          A partir daí, o tratamento segue a política de privacidade do Google.
        </p>
      </article>
    </div>
  );
}
