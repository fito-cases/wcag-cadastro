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

  // Uma regra por campo: devolve o que a pessoa precisa corrigir, ou '' se o valor é válido.
  const regras = {
    nome(valor) {
      return valor === '' ? 'Informe seu nome completo.' : '';
    },
    codigo(valor) {
      if (valor === '') {
        return 'Informe o CEP, com 8 dígitos.';
      }
      if (!/^\d+$/.test(valor)) {
        return 'Digite o CEP só com números, sem hífen, pontos, espaços ou letras.';
      }
      if (valor.length !== 8) {
        const digitados = valor.length === 1 ? 'foi digitado 1' : `foram digitados ${valor.length}`;
        return `O CEP deve ter 8 dígitos; ${digitados}.`;
      }
      return '';
    },
  };

  function valorDe(id) {
    return document.getElementById(id).value.trim();
  }

  // Mostra ou retira a mensagem do campo e mantém aria-invalid e aria-describedby
  // de acordo, para que a mensagem seja lida junto com o campo só enquanto vale.
  function marcarCampo(id, mensagem) {
    const controle = document.getElementById(id);
    const erro = document.getElementById(`${id}-erro`);
    const descricoes = (controle.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((ref) => ref !== '' && ref !== erro.id);

    erro.textContent = mensagem;
    erro.hidden = mensagem === '';

    if (mensagem === '') {
      controle.removeAttribute('aria-invalid');
    } else {
      controle.setAttribute('aria-invalid', 'true');
      descricoes.unshift(erro.id);
    }

    if (descricoes.length > 0) {
      controle.setAttribute('aria-describedby', descricoes.join(' '));
    } else {
      controle.removeAttribute('aria-describedby');
    }
  }

  // Resumo no topo com um link para cada campo a corrigir; recebe o foco para
  // que quem usa leitor de tela ou teclado saiba de imediato o que aconteceu.
  function mostrarResumo(erros) {
    const titulo = document.createElement('h2');
    titulo.textContent = erros.length === 1
      ? 'Corrija 1 campo para concluir o cadastro'
      : `Corrija ${erros.length} campos para concluir o cadastro`;

    const lista = document.createElement('ul');
    for (const { id, mensagem } of erros) {
      const link = document.createElement('a');
      link.setAttribute('href', `#${id}`);
      link.textContent = mensagem;
      const item = document.createElement('li');
      item.append(link);
      lista.append(item);
    }

    resumo.replaceChildren(titulo, lista);
    resumo.hidden = false;
    resumo.focus();
  }

  function esconderResumo() {
    resumo.replaceChildren();
    resumo.hidden = true;
  }

  // O link do resumo leva o foco ao campo e deixa o rótulo à vista,
  // em vez de só rolar a página até o campo.
  resumo.addEventListener('click', (evento) => {
    const link = evento.target.closest('a');
    const id = (link?.getAttribute('href') ?? '').slice(1);
    const destino = id === '' ? null : document.getElementById(id);
    if (!destino || !formulario.contains(destino)) {
      return;
    }
    evento.preventDefault();
    const rotulo = formulario.querySelector(`label[for="${id}"]`);
    (rotulo ?? destino).scrollIntoView();
    destino.focus({ preventScroll: true });
  });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    confirmacao.hidden = true;
    confirmacao.textContent = '';

    // Os valores digitados ficam nos campos: a pessoa corrige só o que foi apontado.
    const erros = [];
    for (const [id, regra] of Object.entries(regras)) {
      const mensagem = regra(valorDe(id));
      marcarCampo(id, mensagem);
      if (mensagem !== '') {
        erros.push({ id, mensagem });
      }
    }

    if (erros.length > 0) {
      mostrarResumo(erros);
      return;
    }

    esconderResumo();
    confirmacao.hidden = false;
    confirmacao.textContent = `Cadastro de ${valorDe('nome')} concluído nesta página de demonstração. Nenhum dado foi enviado a um servidor.`;
  });
})();
