import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirPagina, botaoDeEnvio, estaVisivel, Evento } from './support/dom.js';

const ENVIO_RECARREGOU = 'o envio recarregou a página: o retorno do formulário deve acontecer na própria página';

function campo(pagina, id) {
  const controle = pagina.documento.getElementById(id);
  assert.ok(controle, `o campo #${id} não existe na página`);
  return controle;
}

// Preenche como uma pessoa: foca o campo, digita e sai dele.
function preencher(pagina, valores) {
  for (const [id, valor] of Object.entries(valores)) {
    const controle = campo(pagina, id);
    controle.focus();
    controle.value = valor;
    controle.dispatchEvent(new Evento('input', { bubbles: true }));
    controle.dispatchEvent(new Evento('change', { bubbles: true }));
  }
}

async function enviar(pagina) {
  const formulario = pagina.documento.getElementById('cadastro');
  assert.ok(formulario, 'o formulário #cadastro não existe na página');
  const botao = botaoDeEnvio(formulario);
  assert.ok(botao, 'o formulário #cadastro não tem botão de envio');
  botao.click();
  await new Promise((resolver) => setTimeout(resolver, 0));
}

// Textos visíveis ligados ao campo por aria-describedby.
function mensagensAssociadas(pagina, controle) {
  const ids = (controle.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  return ids
    .map((id) => pagina.documento.getElementById(id))
    .filter((elemento) => elemento && estaVisivel(elemento) && elemento.textContent.trim() !== '')
    .map((elemento) => elemento.textContent.trim());
}

function linkVisivelPara(pagina, id) {
  return [...pagina.documento.querySelectorAll('a')].find((link) =>
    link.getAttribute('href') === `#${id}` && estaVisivel(link) && link.textContent.trim() !== '') ?? null;
}

function confirmacaoVisivel(pagina) {
  const confirmacao = pagina.documento.getElementById('confirmacao');
  return Boolean(confirmacao && estaVisivel(confirmacao) && confirmacao.textContent.trim() !== '');
}

test('identificação dos erros após submissão inválida', async () => {
  const pagina = abrirPagina();
  const controles = { nome: campo(pagina, 'nome'), codigo: campo(pagina, 'codigo') };
  const antes = {
    nome: mensagensAssociadas(pagina, controles.nome),
    codigo: mensagensAssociadas(pagina, controles.codigo),
  };

  preencher(pagina, { nome: '', codigo: '123' });
  await enviar(pagina);

  assert.equal(pagina.navegou, false, ENVIO_RECARREGOU);
  for (const id of ['nome', 'codigo']) {
    assert.ok(linkVisivelPara(pagina, id), `o resumo dos erros não tem um link visível para #${id}`);
  }
  const novas = {};
  for (const [id, controle] of Object.entries(controles)) {
    assert.equal(controle.getAttribute('aria-invalid'), 'true', `#${id} não está marcado com aria-invalid="true"`);
    novas[id] = mensagensAssociadas(pagina, controle).filter((texto) => !antes[id].includes(texto));
    assert.ok(novas[id].length > 0, `nenhuma mensagem de erro visível está ligada a #${id} por aria-describedby`);
  }
  assert.notDeepEqual(novas.nome, novas.codigo, 'as mensagens de #nome e #codigo são iguais: cada uma deve dizer o que corrigir no seu campo');

  // Só o código continua inválido: o retorno deve apontar só para ele.
  preencher(pagina, { nome: 'Ana Souza' });
  await enviar(pagina);

  assert.equal(linkVisivelPara(pagina, 'nome'), null, 'o resumo ainda aponta para #nome, que já foi corrigido');
  assert.notEqual(controles.nome.getAttribute('aria-invalid'), 'true', '#nome continua marcado como inválido depois de corrigido');
  assert.ok(linkVisivelPara(pagina, 'codigo'), 'o resumo deixou de apontar para #codigo, que continua inválido');
});

test('preservação de dados após submissão inválida', async () => {
  const pagina = abrirPagina();

  preencher(pagina, { nome: 'Ana Souza', codigo: '2004' });
  await enviar(pagina);

  assert.equal(pagina.navegou, false, ENVIO_RECARREGOU);
  assert.equal(campo(pagina, 'nome').value, 'Ana Souza', 'o nome digitado foi apagado após o envio inválido');
  assert.equal(campo(pagina, 'codigo').value, '2004', 'o código postal digitado foi apagado após o envio inválido: mantenha-o para que a pessoa possa corrigi-lo');
  assert.equal(confirmacaoVisivel(pagina), false, 'a confirmação apareceu mesmo com o código postal inválido');
});

test('nova submissão após correção', async () => {
  const pagina = abrirPagina();

  preencher(pagina, { nome: '', codigo: 'abc' });
  await enviar(pagina);
  assert.equal(confirmacaoVisivel(pagina), false, 'a confirmação apareceu mesmo com dados inválidos');

  preencher(pagina, { nome: 'Ana Souza', codigo: '20040020' });
  await enviar(pagina);

  assert.equal(pagina.navegou, false, ENVIO_RECARREGOU);
  assert.ok(confirmacaoVisivel(pagina), 'depois de corrigir os dados, o novo envio não mostrou a confirmação do cadastro');
  for (const id of ['nome', 'codigo']) {
    assert.notEqual(campo(pagina, id).getAttribute('aria-invalid'), 'true', `#${id} continua marcado como inválido depois do envio correto`);
    assert.equal(linkVisivelPara(pagina, id), null, `o resumo dos erros continua visível com um link para #${id}`);
  }
});

test('cadastro concluído na primeira tentativa válida', async () => {
  const pagina = abrirPagina();

  preencher(pagina, { nome: 'Ana Souza', codigo: '20040020' });
  await enviar(pagina);

  assert.equal(pagina.navegou, false, ENVIO_RECARREGOU);
  assert.ok(confirmacaoVisivel(pagina), 'o envio com dados válidos não mostrou a confirmação do cadastro');
  for (const id of ['nome', 'codigo']) {
    assert.notEqual(campo(pagina, id).getAttribute('aria-invalid'), 'true', `#${id} foi marcado como inválido com dados válidos`);
  }
});
