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

  const botao = formulario.querySelector('button[type="submit"]');

  function dadosValidos() {
    const nome = document.getElementById('nome').value.trim();
    const codigo = document.getElementById('codigo').value.trim();
    return nome !== '' && /^\d{8}$/.test(codigo);
  }

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    confirmacao.hidden = true;
    confirmacao.textContent = '';

    if (!dadosValidos()) {
      resumo.textContent = 'Não foi possível concluir o cadastro.';
      resumo.hidden = false;
      formulario.reset();
      botao.disabled = true;
      return;
    }

    resumo.textContent = '';
    resumo.hidden = true;
    const nome = document.getElementById('nome').value.trim();
    confirmacao.textContent = `Cadastro de ${nome} concluído nesta página de demonstração. Nenhum dado foi enviado a um servidor.`;
    confirmacao.hidden = false;
  });
})();
