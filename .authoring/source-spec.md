# Especificação da fonte — cadastro

## Projeto

Caso diagnóstico, **Recuperar a acessibilidade de um formulário de cadastro** (v1.0.0). Construir na raiz do repositório uma única página estática de cadastro `index.html`, estilo `styles.css`, comportamento `app.js`, `package.json`, `.gitignore`, testes `test/cadastro.test.js` e, se necessário, auxiliares sem dependências em `test/support/`. A pasta `.case/` permanece no ramo entregue. HTML, CSS e JavaScript sem framework; `npm test` invoca exatamente `node --test` e não instala bibliotecas externas de teste ou DOM. Node.js, instalado pelo aluno, **22 como linha mínima, ou qualquer versão posterior**, sem teto em `engines.node` (por exemplo, `>=22`); npm acompanha a instalação de Node, sem exigência de versão exata. Não fixar versões de pacotes inexistentes.

A árvore deve parecer a página de cadastro descrita no ticket de produto e atendimento: campos de **Nome (obrigatório)** e **Código postal (8 dígitos)**, botão **Enviar**, tratamento de entradas omitidas ou com formato incorreto, sem confundir erro de entrada com falha técnica. Esses dois campos são *todos* os campos avaliados neste projeto; não criar dados sensíveis desnecessários. A página deve tornar evidente o fluxo de envio de teste: entrada válida produz confirmação local de cadastro; esta demonstração estática não é um backend de produção nem promete gravar dados. Se o projeto vier a enviar dados reais a um endpoint, este deverá validar novamente no servidor; validação somente no navegador não é proteção suficiente. O texto do ticket não autoriza afirmar conformidade geral com a WCAG.

Exemplar: textos de finalidade visíveis e persistentes vinculados aos controles por `<label for="nome">` / `<input id="nome" name="nome">` e analogamente para `codigo`; a dica do formato aparece antes da tentativa. `novalidate` permite exercitar o retorno próprio da página; na submissão inválida, mensagens textuais específicas junto aos controles, `aria-invalid`, `aria-describedby`, resumo de links `href="#nome"` / `href="#codigo"` só para os erros presentes, preservação dos valores inclusive o inválido para edição, e possibilidade de tentar novamente. Não basta cor, placeholder, atributo `name` ou mensagem genérica. A suíte sem dependências usa Node `node --test` com testes de nome exato abaixo e verifica comportamento da implementação de produção (não uma cópia separada da lógica); inspecionar também a página em navegador e o nome acessível, especialmente após digitar/revisar.

## Estado inicial — ramo que leva `.case/`

A página aparenta aceitar cadastros e a primeira tentativa válida ainda funciona, mas alguns campos deixam de ter rótulo visível persistente e associação programática; a tentativa inválida mostra somente mensagem genérica, apaga respostas e impede corrigir e tentar novamente. **`npm test` termina com falha (`build_status: failing`)**; os três testes seguintes existem, são impressos por nome e falham **cada um por sua causa**:

- `identificação dos erros após submissão inválida`: ausência de resumo navegável com links para os campos rejeitados e mensagens textuais específicas associadas a cada controle.
- `preservação de dados após submissão inválida`: as entradas apropriadas previamente digitadas são apagadas no retorno inválido.
- `nova submissão após correção`: após o retorno inválido não é possível corrigir e concluir uma segunda tentativa válida.

`starter_state/known_state.yaml` **não declara texto de `known_errors`**; portanto não há mensagem de erro literal adicional exigida pelo contrato. A falha observável é o resultado dos três testes acima (não inventar mensagens de erro contratuais). Todo outro teste da suíte deve passar; não deixar erro de sintaxe, dependência ausente ou falha de instalação. Não incluir solução pronta, comentários que anunciem os defeitos, gabarito ou `solution/notes.md` fora do material já controlado em `.case/`.

## Estado de solução — ramo local `case/solution-v1.0.0`

A página implementa o exemplar descrito acima e demonstra as duas entregas: (1) página com campos identificáveis e retorno após entrada inválida que permite localizar erros, conservar dados apropriados e tentar novamente; (2) suíte inteira passando com `npm test`, inclusive os três testes nomeados. O ramo é criado a partir do estado funcional **antes** da regressão que constitui o starter; permanece local. O critério `identificacao-dos-campos` tem avaliação por IA, sem comando de gate; deve ser conferido visualmente e pela identificação assistida dos dois controles após preenchimento. Gate automatizado, comando e condição **literalmente** como no contrato:

- `npm test` — `A saída de npm test identifica nominalmente e marca como aprovados os testes de identificação dos erros, preservação de dados e nova submissão; para o nível 3, todos os demais testes também passam e o comando termina com código 0.`

## Restrições

Não há `task/constraints.md` nem `task/steps.md`; valem o objetivo, as entregas, o ticket e o recorte acima. Manter cadastro válido funcionando, apenas tratar omissão/formato rejeitado como erro de entrada; não confundir indisponibilidade do serviço com culpa do usuário. Mensagens indicam campo e correção, sem apagar entradas apropriadas. Revisão humana/assistida complementa a suíte, não certifica a página inteira. Os exemplos HTML/DOM foram fundamentados nos componentes WCAG 2 de associação de nomes, reapresentação corrigível, Label e Input Error; a sintaxe concreta do teste nativo de Node e do ambiente de simulação DOM deve ser conferida na instalação real de Node 22 antes de implementar.
