# Abordagem pretendida

No exemplar, tornar a finalidade de cada campo avaliado clara tanto visualmente quanto no nome acessível, inclusive durante o preenchimento e a revisão. Ao rejeitar uma submissão, apresentar os problemas de modo identificável e corrigível, preservar os dados apropriados e permitir uma nova tentativa sem quebrar o fluxo de cadastro. Refinar as decisões concretas após a construção do projeto inicial e do exemplar; não afirmar conformidade geral com a WCAG.

# Evidências por critério

## identificacao-dos-campos (45%, APPLICATION, ai)

Inspecionar a página e sua experiência assistida: os campos avaliados devem comunicar sua finalidade na interface e pelo nome acessível, mesmo quando há conteúdo digitado ou revisão dos dados. Distinguir cobertura parcial de cobertura completa e clareza consistente, sem exigir uma técnica específica de implementação.

## correcao-de-entradas-invalidas (55%, APPLICATION, automated)

Usar somente a saída de `npm test`: resultados nominados para identificação dos erros, preservação de dados e nova submissão distinguem os níveis 0–2; a suíte inteira sem falhas distingue o nível 3. Conferir, após o trabalho de fonte, que o comando imprime esses nomes e resultados; ajustar o contrato se não imprimir.

# Verificação do estado inicial

A fonte inicial ainda não foi criada. Ela deverá produzir falhas nos três testes indicados em starter_state/known_state.yaml. Após construí-la, registrar resultados reais, confirmar os nomes dos testes e revisar a fundamentação do exemplar.
