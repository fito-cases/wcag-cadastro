import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirPagina, botaoDeEnvio, estaVisivel } from './support/dom.js';

function enviar(pagina, nome, codigo) {
  pagina.documento.getElementById('nome').value = nome;
  pagina.documento.getElementById('codigo').value = codigo;
  botaoDeEnvio(pagina.documento.getElementById('cadastro')).click();
}

test('campos têm rótulos visíveis associados e indicação de obrigatoriedade', () => {
  const { documento } = abrirPagina();
  for (const [id, texto] of [['nome', 'Nome'], ['codigo', 'Código postal']]) {
    const controle = documento.getElementById(id);
    const rotulo = documento.querySelector(`label[for="${id}"]`);
    assert.ok(rotulo && estaVisivel(rotulo));
    assert.ok(rotulo.textContent.includes(texto));
    assert.ok(rotulo.textContent.includes('obrigatório'));
    assert.equal(controle.required, true);
    rotulo.click();
    assert.equal(documento.activeElement, controle);
    assert.equal(controle.getAttribute('aria-invalid'), null);
    assert.equal(estaVisivel(documento.getElementById(`${id}-erro`)), false);
  }
  const codigo = documento.getElementById('codigo');
  assert.ok(codigo.getAttribute('aria-describedby').split(/\s+/).includes('codigo-dica'));
  assert.equal(estaVisivel(documento.getElementById('codigo-dica')), true);
});

test('envio inválido foca o resumo e seus links focam os campos correspondentes', () => {
  const pagina = abrirPagina();
  enviar(pagina, '', 'abc');
  const { documento } = pagina;
  assert.equal(documento.activeElement, documento.getElementById('erros'));
  assert.equal(botaoDeEnvio(documento.getElementById('cadastro')).disabled, false);
  for (const id of ['nome', 'codigo']) {
    documento.querySelector(`a[href="#${id}"]`).click();
    assert.equal(documento.activeElement, documento.getElementById(id));
  }
  assert.equal(pagina.navegou, false);
});

test('código postal conserva zero inicial e erros desaparecem após correção', () => {
  const pagina = abrirPagina();
  enviar(pagina, '   ', '1234567');
  enviar(pagina, 'Ana Souza', '01234567');
  const { documento } = pagina;
  assert.equal(documento.getElementById('codigo').value, '01234567');
  assert.equal(estaVisivel(documento.getElementById('confirmacao')), true);
  assert.equal(estaVisivel(documento.getElementById('erros')), false);
  assert.equal(documento.querySelectorAll('#lista-erros a').length, 0);
  for (const id of ['nome', 'codigo']) {
    assert.equal(estaVisivel(documento.getElementById(`${id}-erro`)), false);
    assert.notEqual(documento.getElementById(id).getAttribute('aria-invalid'), 'true');
  }
  assert.ok(documento.getElementById('codigo').getAttribute('aria-describedby').includes('codigo-dica'));
});

test('entrada inválida após sucesso remove a confirmação e permite outra tentativa', () => {
  const pagina = abrirPagina();
  enviar(pagina, 'Ana Souza', '20040020');
  enviar(pagina, 'Ana Souza', '20040-020');
  const { documento } = pagina;
  assert.equal(estaVisivel(documento.getElementById('confirmacao')), false);
  assert.equal(documento.querySelector('a[href="#nome"]'), null);
  assert.ok(documento.querySelector('a[href="#codigo"]'));
  assert.equal(documento.getElementById('codigo').value, '20040-020');
  enviar(pagina, 'Ana Souza', '20040020');
  assert.equal(estaVisivel(documento.getElementById('confirmacao')), true);
  assert.equal(pagina.navegou, false);
});
