# Abordagem pretendida

O exemplar está no ramo `case/solution-v1.0.0`. A correção tem duas partes, uma por critério.

**1. Identificação dos campos (`index.html`).** No estado inicial, "Nome" é um texto solto (`<span>`), sem ligação com o campo, e o campo não tem nome acessível. O código postal tem só um `placeholder`, que some quando a pessoa digita. No exemplar:

- cada campo tem um rótulo visível e persistente, ligado por `<label for>` / `id`: "Nome (obrigatório)" e "Código postal (8 dígitos)";
- a dica de formato ("Somente números, por exemplo 20040020.") aparece antes da tentativa e fica ligada ao código postal por `aria-describedby="dica-codigo"`.

**2. Retorno após submissão inválida (`app.js`).** No estado inicial, um envio inválido mostra só "Não foi possível concluir o cadastro.", apaga os campos com `reset()` e desabilita o botão Enviar. No exemplar, o envio:

- chama `preventDefault()` e valida cada campo: nome obrigatório; código postal com 8 dígitos, somente números;
- para cada campo com erro, mostra uma mensagem de texto própria em `#erro-nome` / `#erro-codigo`, começando por "Erro:", marca o campo com `aria-invalid="true"` e acrescenta o id da mensagem ao `aria-describedby`, mantendo a dica;
- mostra em `#erros` um resumo com um título e um link `#nome` / `#codigo` para cada erro presente, e só para eles. O foco vai para o resumo (`tabindex="-1"`), e um clique num link leva o foco ao campo;
- mantém os valores digitados, inclusive o inválido, para que a pessoa possa corrigir;
- limpa o retorno de um campo quando ele é corrigido, e nunca bloqueia o botão Enviar;
- com dados válidos, mostra a confirmação local em `#confirmacao` (`role="status"`). A página deixa claro que nada é enviado a um servidor.

**Variações equivalentes que atendem ao caso:** outro texto nas mensagens; um rótulo que envolve o campo; `aria-labelledby` que aponta para um texto visível; um resumo montado com `innerHTML`; leitura dos dados com `FormData`; validação também ao sair do campo. Mover o foco para o resumo é uma boa prática, mas não é exigido.

**Não atende:** só cor para indicar o erro; `placeholder` como único rótulo; só `aria-label`, sem texto visível; uma mensagem genérica para todo o formulário.

O caso não afirma conformidade geral da página com a WCAG.

# Evidências por critério

## identificacao-dos-campos (45%, APPLICATION, ai)

Leia o `index.html` da entrega. Para cada um dos dois campos, verifique:

- **finalidade visível e persistente:** há um texto visível que diz o que o campo pede e que não some quando a pessoa digita (não pode ser só `placeholder`);
- **ligação programática:** esse texto forma o nome acessível do campo, por `<label for>` / `id`, por um rótulo que envolve o campo, ou por `aria-labelledby`;
- **para o nível 3:** a exigência ("obrigatório") e o formato ("8 dígitos", somente números) também ficam visíveis antes do envio e continuam visíveis durante a revisão.

Gradação:

- **0:** os dois campos continuam como no estado inicial.
- **1:** um só campo corrigido, ou texto visível sem ligação, ou ligação sem texto visível (por exemplo, só `aria-label`).
- **2:** os dois campos com texto visível, persistente e ligado.
- **3:** o nível 2, mais a exigência e o formato claros antes do envio e durante a revisão.

A suíte de testes não verifica os rótulos. Isso é de propósito: um teste de rótulos criaria uma quarta falha no estado inicial. A avaliação deste critério depende só da leitura da entrega.

## correcao-de-entradas-invalidas (55%, APPLICATION, automated)

O comando é `npm test`, que executa `node --test`. Os testes ficam em `test/cadastro.test.js`. Eles executam o `app.js` real dentro de um DOM de teste (`test/support/dom.js`), montado a partir do `index.html`. Cada teste nomeado verifica:

- **identificação dos erros após submissão inválida:** com nome vazio e código "123", a página não recarrega; há links visíveis para `#nome` e `#codigo`; os dois campos ficam com `aria-invalid="true"`; cada campo ganha um texto visível novo por `aria-describedby`, diferente do outro campo. Depois de corrigir só o nome e enviar de novo, o link para `#nome` some, o nome deixa de ser inválido e o link para `#codigo` continua.
- **preservação de dados após submissão inválida:** com nome "Ana Souza" e código "2004", os dois valores continuam nos campos depois do envio, e a confirmação não aparece.
- **nova submissão após correção:** depois de um envio inválido e da correção dos dados, o novo envio mostra a confirmação, sem campo inválido e sem links de erro.

Os outros testes protegem contra regressões, e contam para o nível 3: **cadastro concluído na primeira tentativa válida** e **projeto configurado para npm test**.

Formato da saída:

- no Node 24, cada teste aparece como `✔ <nome>` ou `✖ <nome>`;
- no Node 22, quando a saída não vai para um terminal, aparece em TAP: `ok N - <nome>` ou `not ok N - <nome>`;
- a linha `test/support/dom.js` aparece como um teste a mais que passa, porque o `node --test` executa todo arquivo `.js` dentro de `test/`. Ela não é um teste da pessoa que faz o caso.

No exemplar, os 6 testes passam e o comando termina com código 0.

Duas observações para quem revisa:

- se o diff alterar arquivos em `test/`, a aprovação automatizada deixa de provar o comportamento;
- se a correção usar um recurso do DOM que o modelo de teste não tem, o teste para com a mensagem "O DOM de teste (test/support/dom.js) não implementa …". Isso é um limite do ambiente de teste, não um erro da correção.

# Verificação do estado inicial

No ramo `main`, que leva o estado inicial, `npm test` termina com código 1. Falham exatamente os três testes de `starter_state/known_state.yaml`, cada um pela sua causa:

- **identificação dos erros após submissão inválida:** "o resumo dos erros não tem um link visível para #nome";
- **preservação de dados após submissão inválida:** "o nome digitado foi apagado após o envio inválido";
- **nova submissão após correção:** "depois de corrigir os dados, o novo envio não mostrou a confirmação do cadastro".

Os outros três testes passam: a primeira tentativa válida, a configuração do projeto e a linha de `test/support/dom.js`.

Esse resultado foi conferido no Node 22.23.4 e no Node 24.14.1, no Linux e no Windows, e também com finais de linha do Windows (CRLF). No navegador (Chromium), o estado inicial mostra:

- o campo do nome sem nome acessível;
- o código postal nomeado só pelo `placeholder`;
- a mensagem genérica, os campos apagados e o botão Enviar desabilitado depois de um envio inválido;
- a confirmação normal numa primeira tentativa válida.

O exemplar foi conferido da mesma forma: os 6 testes passam, e no navegador os rótulos, os links do resumo, o foco, os valores mantidos e a confirmação funcionam, sem erros na página.
