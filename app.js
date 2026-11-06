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

  const campos = [
    {
      id: 'nome',
      validar(valor) {
        return valor.trim() === '' ? 'Informe o seu nome.' : '';
      },
    },
    {
      id: 'codigo',
      validar(valor) {
        const codigo = valor.trim();
        if (codigo === '') {
          return 'Informe o código postal, com 8 dígitos.';
        }
        if (!/^\d{8}$/.test(codigo)) {
          return 'O código postal precisa ter 8 dígitos, somente números. Exemplo: 20040020.';
        }
        return '';
      },
    },
  ];

  function idsDescritos(controle) {
    return (controle.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  }

  function mostrarErroDoCampo(controle, mensagem) {
    const idMensagem = `erro-${controle.id}`;
    const elementoMensagem = document.getElementById(idMensagem);
    const outrosIds = idsDescritos(controle).filter((id) => id !== idMensagem);

    if (mensagem) {
      elementoMensagem.textContent = `Erro: ${mensagem}`;
      elementoMensagem.hidden = false;
      controle.setAttribute('aria-invalid', 'true');
      controle.setAttribute('aria-describedby', [...outrosIds, idMensagem].join(' '));
    } else {
      elementoMensagem.textContent = '';
      elementoMensagem.hidden = true;
      controle.removeAttribute('aria-invalid');
      if (outrosIds.length > 0) {
        controle.setAttribute('aria-describedby', outrosIds.join(' '));
      } else {
        controle.removeAttribute('aria-describedby');
      }
    }
  }

  function mostrarResumo(erros) {
    const titulo = document.createElement('h2');
    titulo.textContent = erros.length === 1
      ? 'Corrija 1 erro para continuar:'
      : `Corrija ${erros.length} erros para continuar:`;

    const lista = document.createElement('ul');
    for (const erro of erros) {
      const link = document.createElement('a');
      link.setAttribute('href', `#${erro.controle.id}`);
      link.textContent = erro.mensagem;
      const item = document.createElement('li');
      item.appendChild(link);
      lista.appendChild(item);
    }

    resumo.replaceChildren(titulo, lista);
    resumo.hidden = false;
    resumo.focus();
  }

  function esconderResumo() {
    resumo.replaceChildren();
    resumo.hidden = true;
  }

  // Um link do resumo leva o foco direto ao campo que precisa de correção.
  resumo.addEventListener('click', (evento) => {
    const link = evento.target.closest('a');
    const destino = link ? link.getAttribute('href') : '';
    if (!destino || !destino.startsWith('#')) {
      return;
    }
    const controle = document.getElementById(destino.slice(1));
    if (controle) {
      evento.preventDefault();
      controle.focus();
    }
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    confirmacao.hidden = true;
    confirmacao.textContent = '';

    const erros = [];
    for (const campo of campos) {
      const controle = document.getElementById(campo.id);
      const mensagem = campo.validar(controle.value);
      mostrarErroDoCampo(controle, mensagem);
      if (mensagem) {
        erros.push({ controle, mensagem });
      }
    }

    if (erros.length > 0) {
      mostrarResumo(erros);
      return;
    }

    esconderResumo();
    const nome = document.getElementById('nome').value.trim();
    confirmacao.textContent = `Cadastro de ${nome} concluído nesta página de demonstração. Nenhum dado foi enviado a um servidor.`;
    confirmacao.hidden = false;
  });
})();
