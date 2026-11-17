'use strict';

// Comportamento da página de cadastro de demonstração.
// A validação no navegador ajuda quem preenche, mas não protege um servidor:
// se esta página passar a enviar dados a um endpoint real, ele deve validar tudo de novo.

(function () {
  const formulario = document.getElementById('cadastro');
  const resumo = document.getElementById('erros');
  const confirmacao = document.getElementById('confirmacao');

  if (!formulario || !resumo || !confirmacao) {
    return;
  }

  const listaErros = document.getElementById('lista-erros');
  const campos = [
    {
      controle: document.getElementById('nome'),
      erro: document.getElementById('nome-erro'),
      validar: (valor) => valor.trim() !== '',
      mensagem: 'Nome: informe seu nome.',
    },
    {
      controle: document.getElementById('codigo'),
      erro: document.getElementById('codigo-erro'),
      validar: (valor) => /^\d{8}$/.test(valor.trim()),
      mensagem: 'Código postal: informe exatamente 8 dígitos, sem espaços ou hífen.',
    },
  ];

  function atualizarErros() {
    listaErros.textContent = '';
    for (const { controle, erro, validar, mensagem } of campos) {
      const invalido = !validar(controle.value);
      erro.textContent = invalido ? mensagem : '';
      erro.hidden = !invalido;
      if (!invalido) {
        controle.removeAttribute('aria-invalid');
        continue;
      }

      controle.setAttribute('aria-invalid', 'true');
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.setAttribute('href', `#${controle.id}`);
      link.textContent = mensagem;
      link.addEventListener('click', (evento) => {
        evento.preventDefault();
        controle.focus();
      });
      item.appendChild(link);
      listaErros.appendChild(item);
    }

    resumo.hidden = listaErros.children.length === 0;
    return resumo.hidden;
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    confirmacao.hidden = true;
    confirmacao.textContent = '';

    if (!atualizarErros()) {
      resumo.focus();
      return;
    }

    const nome = document.getElementById('nome').value.trim();
    confirmacao.textContent = `Cadastro de ${nome} concluído nesta página de demonstração. Nenhum dado foi enviado a um servidor.`;
    confirmacao.hidden = false;
  });
})();
