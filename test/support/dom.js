// DOM de teste: um modelo pequeno do navegador, sem dependências.
//
// Ele lê index.html, monta a árvore de elementos e executa os scripts da página
// num contexto isolado (node:vm). Assim os testes exercitam o app.js de produção,
// sem uma cópia da lógica.
//
// O modelo cobre só uma parte do navegador: elementos e atributos, texto,
// seletores simples, eventos, foco, formulários e FormData. Ele não avalia CSS de
// classes nem layout. Quando o código da página usa um recurso que o modelo não
// tem, o teste para com uma mensagem que nomeia o recurso. Nesse caso, use outro
// recurso do DOM ou confira a página direto no navegador.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const VAZIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TEXTO_BRUTO = new Set(['script', 'style']);
const TEXTO_ESCAPAVEL = new Set(['textarea', 'title']);
const CONTROLES = new Set(['input', 'button', 'select', 'textarea', 'fieldset', 'output']);
const MANIPULADORES = ['onclick', 'onsubmit', 'onreset', 'oninput', 'onchange', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'oninvalid'];
const ENDERECO_DA_PAGINA = 'http://pagina.local/index.html';

class RecursoNaoSuportado extends Error {
  constructor(recurso) {
    super(`O DOM de teste (test/support/dom.js) não implementa ${recurso}. Ele modela só uma parte do navegador: use outro recurso do DOM ou confira a página direto no navegador.`);
    this.name = 'RecursoNaoSuportado';
  }
}

function naoSuportado(recurso) {
  throw new RecursoNaoSuportado(recurso);
}

// ---------------------------------------------------------------------------
// Texto e entidades

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteiro, codigo) => {
    if (codigo[0] === '#') {
      const numero = codigo[1].toLowerCase() === 'x' ? parseInt(codigo.slice(2), 16) : parseInt(codigo.slice(1), 10);
      return Number.isFinite(numero) ? String.fromCodePoint(numero) : inteiro;
    }
    return ENTIDADES[codigo.toLowerCase()] ?? inteiro;
  });
}

function escaparTexto(texto) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}

function escaparAtributo(texto) {
  return texto.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/ /g, '&nbsp;');
}

// ---------------------------------------------------------------------------
// Eventos

export class Evento {
  constructor(tipo, opcoes = {}) {
    this.type = String(tipo);
    this.bubbles = Boolean(opcoes.bubbles);
    this.cancelable = Boolean(opcoes.cancelable);
    this.composed = Boolean(opcoes.composed);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this.isTrusted = false;
    this.timeStamp = Date.now();
    this._parar = false;
    this._pararJa = false;
  }

  get srcElement() {
    return this.target;
  }

  get returnValue() {
    return !this.defaultPrevented;
  }

  set returnValue(valor) {
    if (valor === false) {
      this.preventDefault();
    }
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }

  stopPropagation() {
    this._parar = true;
  }

  stopImmediatePropagation() {
    this._parar = true;
    this._pararJa = true;
  }
}

class EventoPersonalizado extends Evento {
  constructor(tipo, opcoes = {}) {
    super(tipo, opcoes);
    this.detail = opcoes.detail ?? null;
  }
}

class EventoDeEnvio extends Evento {
  constructor(tipo, opcoes = {}) {
    super(tipo, opcoes);
    this.submitter = opcoes.submitter ?? null;
  }
}

class EventoDeTeclado extends Evento {
  constructor(tipo, opcoes = {}) {
    super(tipo, opcoes);
    this.key = opcoes.key ?? '';
    this.code = opcoes.code ?? '';
    this.shiftKey = Boolean(opcoes.shiftKey);
    this.ctrlKey = Boolean(opcoes.ctrlKey);
    this.altKey = Boolean(opcoes.altKey);
    this.metaKey = Boolean(opcoes.metaKey);
  }
}

function chamarOuvintes(alvo, evento, fase) {
  evento.currentTarget = alvo;
  for (const registro of [...(alvo._ouvintes.get(evento.type) ?? [])]) {
    if (fase === 'captura' && !registro.captura) continue;
    if (fase === 'bolha' && registro.captura) continue;
    if (registro.uma) {
      alvo.removeEventListener(evento.type, registro.ouvinte, registro.captura);
    }
    if (typeof registro.ouvinte === 'function') {
      registro.ouvinte.call(alvo, evento);
    } else {
      registro.ouvinte.handleEvent(evento);
    }
    if (evento._pararJa) return;
  }
  if (fase !== 'captura') {
    const manipulador = alvo['on' + evento.type];
    if (typeof manipulador === 'function' && manipulador.call(alvo, evento) === false) {
      evento.preventDefault();
    }
  }
}

class AlvoDeEventos {
  constructor() {
    this._ouvintes = new Map();
  }

  addEventListener(tipo, ouvinte, opcoes) {
    if (!ouvinte) return;
    const captura = typeof opcoes === 'boolean' ? opcoes : Boolean(opcoes?.capture);
    const uma = typeof opcoes === 'object' && opcoes !== null && Boolean(opcoes.once);
    const lista = this._ouvintes.get(tipo) ?? [];
    if (lista.some((registro) => registro.ouvinte === ouvinte && registro.captura === captura)) return;
    lista.push({ ouvinte, captura, uma });
    this._ouvintes.set(tipo, lista);
  }

  removeEventListener(tipo, ouvinte, opcoes) {
    const captura = typeof opcoes === 'boolean' ? opcoes : Boolean(opcoes?.capture);
    const lista = this._ouvintes.get(tipo);
    if (!lista) return;
    const indice = lista.findIndex((registro) => registro.ouvinte === ouvinte && registro.captura === captura);
    if (indice >= 0) lista.splice(indice, 1);
  }

  dispatchEvent(evento) {
    if (!(evento instanceof Evento)) {
      throw new TypeError('dispatchEvent precisa receber um Event.');
    }
    const caminho = this._caminho();
    evento.target = this;
    evento._parar = false;
    evento._pararJa = false;
    for (let i = caminho.length - 1; i >= 1 && !evento._parar; i -= 1) {
      chamarOuvintes(caminho[i], evento, 'captura');
    }
    if (!evento._parar) {
      chamarOuvintes(this, evento, 'alvo');
    }
    if (evento.bubbles) {
      for (let i = 1; i < caminho.length && !evento._parar; i += 1) {
        chamarOuvintes(caminho[i], evento, 'bolha');
      }
    }
    evento.currentTarget = null;
    return !evento.defaultPrevented;
  }

  _caminho() {
    return [this];
  }
}

// ---------------------------------------------------------------------------
// Seletores: tipo, #id, .classe, [atributo], [atributo=valor], descendente e ">"

function analisarSeletor(texto) {
  const fonte = String(texto).trim();
  const alternativas = [[]];
  let combinador = ' ';
  let i = 0;
  while (i < fonte.length) {
    const caractere = fonte[i];
    if (/\s/.test(caractere)) {
      if (combinador === null) combinador = ' ';
      i += 1;
      continue;
    }
    if (caractere === ',') {
      alternativas.push([]);
      combinador = ' ';
      i += 1;
      continue;
    }
    if (caractere === '>') {
      combinador = '>';
      i += 1;
      continue;
    }
    if (caractere === '+' || caractere === '~') {
      naoSuportado(`o combinador "${caractere}" (seletor "${fonte}")`);
    }
    const composto = { tag: null, id: null, classes: [], atributos: [] };
    let leu = false;
    while (i < fonte.length && !/[\s,>+~]/.test(fonte[i])) {
      const resto = fonte.slice(i);
      let achado = null;
      if (!leu && (achado = /^(\*|[a-zA-Z][\w-]*)/.exec(resto))) {
        composto.tag = achado[1].toLowerCase();
      } else if ((achado = /^#([\w-]+)/.exec(resto))) {
        composto.id = achado[1];
      } else if ((achado = /^\.([\w-]+)/.exec(resto))) {
        composto.classes.push(achado[1]);
      } else if ((achado = /^\[\s*([^\s~|^$*=\]]+)\s*(?:([~^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*)?\]/.exec(resto))) {
        composto.atributos.push({
          nome: achado[1].toLowerCase(),
          operador: achado[2] ?? null,
          valor: achado[3] ?? achado[4] ?? achado[5] ?? null,
        });
      } else if (resto[0] === ':') {
        naoSuportado(`a pseudo-classe "${resto.split(/[\s,>]/)[0]}" (seletor "${fonte}")`);
      } else {
        throw new SyntaxError(`O seletor "${fonte}" não é válido.`);
      }
      i += achado[0].length;
      leu = true;
    }
    alternativas.at(-1).push({ combinador, composto });
    combinador = null;
  }
  if (alternativas.some((alternativa) => alternativa.length === 0)) {
    throw new SyntaxError(`O seletor "${fonte}" não é válido.`);
  }
  return alternativas;
}

function casaAtributo(elemento, { nome, operador, valor }) {
  const atual = elemento.getAttribute(nome);
  if (atual === null) return false;
  switch (operador) {
    case null: return true;
    case '=': return atual === valor;
    case '~=': return atual.split(/\s+/).includes(valor);
    case '^=': return valor !== '' && atual.startsWith(valor);
    case '$=': return valor !== '' && atual.endsWith(valor);
    case '*=': return valor !== '' && atual.includes(valor);
    default: return false;
  }
}

function casaComposto(elemento, composto) {
  if (elemento.nodeType !== 1) return false;
  if (composto.tag && composto.tag !== '*' && elemento.localName !== composto.tag) return false;
  if (composto.id && elemento.getAttribute('id') !== composto.id) return false;
  const classes = (elemento.getAttribute('class') ?? '').split(/\s+/);
  if (composto.classes.some((classe) => !classes.includes(classe))) return false;
  return composto.atributos.every((atributo) => casaAtributo(elemento, atributo));
}

function casaCadeia(elemento, partes, indice) {
  if (!casaComposto(elemento, partes[indice].composto)) return false;
  if (indice === 0) return true;
  if (partes[indice].combinador === '>') {
    const pai = elemento.parentElement;
    return pai ? casaCadeia(pai, partes, indice - 1) : false;
  }
  for (let ancestral = elemento.parentElement; ancestral; ancestral = ancestral.parentElement) {
    if (casaCadeia(ancestral, partes, indice - 1)) return true;
  }
  return false;
}

function casaSeletor(elemento, alternativas) {
  return alternativas.some((partes) => casaCadeia(elemento, partes, partes.length - 1));
}

function* percorrer(raiz) {
  for (const filho of raiz._filhos) {
    if (filho.nodeType === 1) {
      yield filho;
      yield* percorrer(filho);
    }
  }
}

function comoLista(itens) {
  Object.defineProperty(itens, 'item', { value: (indice) => itens[indice] ?? null, enumerable: false });
  return itens;
}

// ---------------------------------------------------------------------------
// Estilo em linha (atributo style)

function lerEstilo(elemento) {
  const declaracoes = new Map();
  for (const declaracao of (elemento._atributos.get('style') ?? '').split(';')) {
    const separador = declaracao.indexOf(':');
    if (separador > 0) {
      declaracoes.set(declaracao.slice(0, separador).trim().toLowerCase(), declaracao.slice(separador + 1).trim());
    }
  }
  return declaracoes;
}

function gravarEstilo(elemento, declaracoes) {
  if (declaracoes.size === 0) {
    elemento._atributos.delete('style');
  } else {
    elemento._atributos.set('style', [...declaracoes].map(([nome, valor]) => `${nome}: ${valor}`).join('; '));
  }
}

function nomeCss(propriedade) {
  return propriedade.startsWith('--') ? propriedade : propriedade.replace(/[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);
}

function criarEstilo(elemento) {
  const metodos = {
    getPropertyValue: (nome) => lerEstilo(elemento).get(String(nome).toLowerCase()) ?? '',
    setProperty: (nome, valor) => {
      const declaracoes = lerEstilo(elemento);
      if (valor === null || valor === undefined || valor === '') declaracoes.delete(String(nome).toLowerCase());
      else declaracoes.set(String(nome).toLowerCase(), String(valor));
      gravarEstilo(elemento, declaracoes);
    },
    removeProperty: (nome) => {
      const declaracoes = lerEstilo(elemento);
      const anterior = declaracoes.get(String(nome).toLowerCase()) ?? '';
      declaracoes.delete(String(nome).toLowerCase());
      gravarEstilo(elemento, declaracoes);
      return anterior;
    },
  };
  return new Proxy({}, {
    get(_alvo, propriedade) {
      if (typeof propriedade !== 'string') return undefined;
      if (propriedade in metodos) return metodos[propriedade];
      if (propriedade === 'cssText') return elemento._atributos.get('style') ?? '';
      return lerEstilo(elemento).get(nomeCss(propriedade)) ?? '';
    },
    set(_alvo, propriedade, valor) {
      if (typeof propriedade !== 'string') return false;
      if (propriedade === 'cssText') {
        elemento._atributos.set('style', String(valor));
        return true;
      }
      metodos.setProperty(nomeCss(propriedade), valor);
      return true;
    },
  });
}

function criarListaDeClasses(elemento) {
  const ler = () => (elemento.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
  const gravar = (classes) => elemento.setAttribute('class', classes.join(' '));
  return {
    get length() { return ler().length; },
    get value() { return elemento.getAttribute('class') ?? ''; },
    item: (indice) => ler()[indice] ?? null,
    contains: (classe) => ler().includes(classe),
    add: (...classes) => gravar([...new Set([...ler(), ...classes])]),
    remove: (...classes) => gravar(ler().filter((atual) => !classes.includes(atual))),
    toggle(classe, forcar) {
      const tem = ler().includes(classe);
      const quer = forcar === undefined ? !tem : Boolean(forcar);
      if (quer && !tem) this.add(classe);
      if (!quer && tem) this.remove(classe);
      return quer;
    },
    replace(antiga, nova) {
      if (!ler().includes(antiga)) return false;
      gravar(ler().map((atual) => (atual === antiga ? nova : atual)));
      return true;
    },
    forEach: (funcao) => ler().forEach(funcao),
    [Symbol.iterator]: () => ler()[Symbol.iterator](),
    toString: () => elemento.getAttribute('class') ?? '',
  };
}

// ---------------------------------------------------------------------------
// Nós

function converterNo(documento, valor) {
  return typeof valor === 'string' ? documento.createTextNode(valor) : valor;
}

class No extends AlvoDeEventos {
  constructor(documento) {
    super();
    this._documento = documento;
    this._pai = null;
    this._filhos = [];
  }

  get ownerDocument() { return this._documento; }
  get parentNode() { return this._pai; }
  get parentElement() { return this._pai && this._pai.nodeType === 1 ? this._pai : null; }
  get childNodes() { return comoLista([...this._filhos]); }
  get firstChild() { return this._filhos[0] ?? null; }
  get lastChild() { return this._filhos.at(-1) ?? null; }

  get nextSibling() {
    if (!this._pai) return null;
    return this._pai._filhos[this._pai._filhos.indexOf(this) + 1] ?? null;
  }

  get previousSibling() {
    if (!this._pai) return null;
    return this._pai._filhos[this._pai._filhos.indexOf(this) - 1] ?? null;
  }

  get isConnected() {
    let raiz = this;
    while (raiz._pai) raiz = raiz._pai;
    return raiz === this._documento;
  }

  get textContent() {
    return this._filhos.map((filho) => (filho.nodeType === 1 || filho.nodeType === 3 ? filho.textContent : '')).join('');
  }

  set textContent(valor) {
    this.replaceChildren();
    if (valor !== null && valor !== undefined && valor !== '') {
      this.appendChild(this._documento.createTextNode(String(valor)));
    }
  }

  hasChildNodes() { return this._filhos.length > 0; }

  contains(outro) {
    for (let no = outro; no; no = no._pai) {
      if (no === this) return true;
    }
    return false;
  }

  appendChild(no) {
    return this.insertBefore(no, null);
  }

  insertBefore(no, referencia) {
    if (!(no instanceof No)) {
      throw new TypeError('O argumento não é um nó do DOM.');
    }
    if (no.nodeType === 11) {
      for (const filho of [...no._filhos]) this.insertBefore(filho, referencia);
      return no;
    }
    if (no.contains(this)) {
      throw new Error('HierarchyRequestError: um nó não pode ficar dentro de si mesmo.');
    }
    if (referencia && referencia._pai !== this) {
      throw new Error('NotFoundError: o nó de referência não é filho deste nó.');
    }
    if (no._pai) no._pai._retirar(no);
    if (referencia) {
      this._filhos.splice(this._filhos.indexOf(referencia), 0, no);
    } else {
      this._filhos.push(no);
    }
    no._pai = this;
    return no;
  }

  removeChild(no) {
    if (no._pai !== this) {
      throw new Error('NotFoundError: o nó não é filho deste nó.');
    }
    this._retirar(no);
    return no;
  }

  replaceChild(novo, antigo) {
    this.insertBefore(novo, antigo);
    return this.removeChild(antigo);
  }

  _retirar(no) {
    const indice = this._filhos.indexOf(no);
    if (indice >= 0) this._filhos.splice(indice, 1);
    no._pai = null;
  }

  remove() {
    if (this._pai) this._pai._retirar(this);
  }

  append(...nos) {
    for (const no of nos) this.appendChild(converterNo(this._documento, no));
  }

  prepend(...nos) {
    const referencia = this.firstChild;
    for (const no of nos) this.insertBefore(converterNo(this._documento, no), referencia);
  }

  replaceChildren(...nos) {
    for (const filho of [...this._filhos]) this._retirar(filho);
    this.append(...nos);
  }

  before(...nos) {
    if (!this._pai) return;
    for (const no of nos) this._pai.insertBefore(converterNo(this._documento, no), this);
  }

  after(...nos) {
    if (!this._pai) return;
    const referencia = this.nextSibling;
    for (const no of nos) this._pai.insertBefore(converterNo(this._documento, no), referencia);
  }

  replaceWith(...nos) {
    if (!this._pai) return;
    const pai = this._pai;
    const referencia = this.nextSibling;
    pai._retirar(this);
    for (const no of nos) pai.insertBefore(converterNo(this._documento, no), referencia);
  }

  querySelector(seletor) {
    const alternativas = analisarSeletor(seletor);
    for (const elemento of percorrer(this)) {
      if (casaSeletor(elemento, alternativas)) return elemento;
    }
    return null;
  }

  querySelectorAll(seletor) {
    const alternativas = analisarSeletor(seletor);
    return comoLista([...percorrer(this)].filter((elemento) => casaSeletor(elemento, alternativas)));
  }

  _caminho() {
    const caminho = [];
    for (let no = this; no; no = no._pai) caminho.push(no);
    if (caminho.at(-1) === this._documento && this._documento._alvoDaJanela) {
      caminho.push(this._documento._alvoDaJanela);
    }
    return caminho;
  }
}

class Texto extends No {
  constructor(documento, dados) {
    super(documento);
    this._dados = String(dados);
  }

  get nodeType() { return 3; }
  get nodeName() { return '#text'; }
  get data() { return this._dados; }
  set data(valor) { this._dados = String(valor); }
  get nodeValue() { return this._dados; }
  set nodeValue(valor) { this._dados = String(valor); }
  get textContent() { return this._dados; }
  set textContent(valor) { this._dados = String(valor ?? ''); }
}

class Fragmento extends No {
  get nodeType() { return 11; }
  get nodeName() { return '#document-fragment'; }
}

function serializar(no) {
  if (no.nodeType === 3) {
    return no._pai && TEXTO_BRUTO.has(no._pai.localName) ? no._dados : escaparTexto(no._dados);
  }
  if (no.nodeType !== 1) return '';
  const atributos = [...no._atributos].map(([nome, valor]) => ` ${nome}="${escaparAtributo(valor)}"`).join('');
  if (VAZIOS.has(no.localName)) return `<${no.localName}${atributos}>`;
  return `<${no.localName}${atributos}>${no._filhos.map(serializar).join('')}</${no.localName}>`;
}

function refletirTexto(classe, propriedade, atributo) {
  Object.defineProperty(classe.prototype, propriedade, {
    get() { return this.getAttribute(atributo) ?? ''; },
    set(valor) { this.setAttribute(atributo, String(valor)); },
    configurable: true,
  });
}

function refletirBooleano(classe, propriedade, atributo) {
  Object.defineProperty(classe.prototype, propriedade, {
    get() { return this.hasAttribute(atributo); },
    set(valor) { this.toggleAttribute(atributo, Boolean(valor)); },
    configurable: true,
  });
}

function refletirAnulavel(classe, propriedade, atributo) {
  Object.defineProperty(classe.prototype, propriedade, {
    get() { return this.getAttribute(atributo); },
    set(valor) {
      if (valor === null || valor === undefined) this.removeAttribute(atributo);
      else this.setAttribute(atributo, String(valor));
    },
    configurable: true,
  });
}

class Elemento extends No {
  constructor(documento, nome) {
    super(documento);
    this._nome = nome;
    this._atributos = new Map();
  }

  get nodeType() { return 1; }
  get nodeName() { return this._nome.toUpperCase(); }
  get tagName() { return this._nome.toUpperCase(); }
  get localName() { return this._nome; }

  getAttribute(nome) {
    const valor = this._atributos.get(String(nome).toLowerCase());
    return valor === undefined ? null : valor;
  }

  setAttribute(nome, valor) { this._atributos.set(String(nome).toLowerCase(), String(valor)); }
  removeAttribute(nome) { this._atributos.delete(String(nome).toLowerCase()); }
  hasAttribute(nome) { return this._atributos.has(String(nome).toLowerCase()); }
  hasAttributes() { return this._atributos.size > 0; }
  getAttributeNames() { return [...this._atributos.keys()]; }

  toggleAttribute(nome, forcar) {
    const tem = this.hasAttribute(nome);
    const quer = forcar === undefined ? !tem : Boolean(forcar);
    if (quer && !tem) this.setAttribute(nome, '');
    if (!quer && tem) this.removeAttribute(nome);
    return quer;
  }

  get className() { return this.getAttribute('class') ?? ''; }
  set className(valor) { this.setAttribute('class', String(valor)); }
  get classList() { return (this._listaDeClasses ??= criarListaDeClasses(this)); }
  get style() { return (this._estilo ??= criarEstilo(this)); }

  get children() { return comoLista(this._filhos.filter((filho) => filho.nodeType === 1)); }
  get childElementCount() { return this.children.length; }
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { return this.children.at(-1) ?? null; }

  get nextElementSibling() {
    for (let no = this.nextSibling; no; no = no.nextSibling) {
      if (no.nodeType === 1) return no;
    }
    return null;
  }

  get previousElementSibling() {
    for (let no = this.previousSibling; no; no = no.previousSibling) {
      if (no.nodeType === 1) return no;
    }
    return null;
  }

  get innerHTML() { return this._filhos.map(serializar).join(''); }
  set innerHTML(html) { this.replaceChildren(...analisarFragmento(String(html), this._documento)); }
  get innerText() { return this.textContent; }
  set innerText(valor) { this.textContent = valor; }

  insertAdjacentHTML(posicao, html) {
    this._inserirAdjacente(posicao, analisarFragmento(String(html), this._documento));
  }

  insertAdjacentElement(posicao, elemento) {
    this._inserirAdjacente(posicao, [elemento]);
    return elemento;
  }

  _inserirAdjacente(posicao, nos) {
    switch (String(posicao).toLowerCase()) {
      case 'beforebegin':
        this.before(...nos);
        break;
      case 'afterbegin':
        this.prepend(...nos);
        break;
      case 'beforeend':
        this.append(...nos);
        break;
      case 'afterend':
        this.after(...nos);
        break;
      default:
        throw new SyntaxError(`Posição inválida para insertAdjacent: "${posicao}".`);
    }
  }

  matches(seletor) { return casaSeletor(this, analisarSeletor(seletor)); }

  closest(seletor) {
    const alternativas = analisarSeletor(seletor);
    for (let elemento = this; elemento && elemento.nodeType === 1; elemento = elemento._pai) {
      if (casaSeletor(elemento, alternativas)) return elemento;
    }
    return null;
  }

  get tabIndex() {
    const valor = Number.parseInt(this.getAttribute('tabindex') ?? '', 10);
    if (Number.isInteger(valor)) return valor;
    return this._focavelPorNatureza() ? 0 : -1;
  }

  set tabIndex(valor) { this.setAttribute('tabindex', String(Math.trunc(Number(valor)))); }

  _focavelPorNatureza() { return false; }
  _desabilitado() { return false; }

  _focavel() {
    if (this._desabilitado() || !estaVisivel(this)) return false;
    return this.hasAttribute('tabindex') || this._focavelPorNatureza();
  }

  focus() {
    if (!this._focavel()) return;
    const anterior = this._documento.activeElement;
    if (anterior === this) return;
    this._documento._ativo = this;
    if (anterior && anterior !== this._documento.body) {
      anterior.dispatchEvent(new Evento('blur'));
      anterior.dispatchEvent(new Evento('focusout', { bubbles: true }));
    }
    this.dispatchEvent(new Evento('focus'));
    this.dispatchEvent(new Evento('focusin', { bubbles: true }));
  }

  blur() {
    if (this._documento.activeElement !== this) return;
    this._documento._ativo = null;
    this.dispatchEvent(new Evento('blur'));
    this.dispatchEvent(new Evento('focusout', { bubbles: true }));
  }

  click() {
    if (this._desabilitado()) return;
    const evento = new Evento('click', { bubbles: true, cancelable: true });
    this.dispatchEvent(evento);
    if (!evento.defaultPrevented) this._acaoDoClique();
  }

  _acaoDoClique() {}

  scrollIntoView() {}
  scrollTo() {}
  scrollBy() {}
}

refletirTexto(Elemento, 'id', 'id');
refletirTexto(Elemento, 'title', 'title');
refletirTexto(Elemento, 'lang', 'lang');
refletirTexto(Elemento, 'dir', 'dir');
refletirBooleano(Elemento, 'hidden', 'hidden');
refletirAnulavel(Elemento, 'role', 'role');
for (const [propriedade, atributo] of [
  ['ariaInvalid', 'aria-invalid'],
  ['ariaLabel', 'aria-label'],
  ['ariaLive', 'aria-live'],
  ['ariaHidden', 'aria-hidden'],
  ['ariaRequired', 'aria-required'],
  ['ariaAtomic', 'aria-atomic'],
  ['ariaExpanded', 'aria-expanded'],
  ['ariaDisabled', 'aria-disabled'],
]) {
  refletirAnulavel(Elemento, propriedade, atributo);
}

function formularioDe(controle) {
  const id = controle.getAttribute('form');
  if (id) return controle._documento.getElementById(id);
  return controle.closest('form');
}

class Entrada extends Elemento {
  get type() {
    const tipo = (this.getAttribute('type') ?? '').toLowerCase();
    return tipo || 'text';
  }

  set type(valor) { this.setAttribute('type', String(valor)); }

  get value() { return this._valor ?? this.getAttribute('value') ?? ''; }
  set value(valor) { this._valor = valor === null ? '' : String(valor); }
  get defaultValue() { return this.getAttribute('value') ?? ''; }
  set defaultValue(valor) { this.setAttribute('value', String(valor)); }
  get checked() { return this._marcado ?? this.hasAttribute('checked'); }
  set checked(valor) { this._marcado = Boolean(valor); }
  get form() { return formularioDe(this); }

  _restaurar() {
    this._valor = undefined;
    this._marcado = undefined;
  }

  _desabilitado() { return this.hasAttribute('disabled'); }
  _focavelPorNatureza() { return this.type !== 'hidden'; }

  _acaoDoClique() {
    const formulario = this.form;
    if (this.type === 'checkbox') this.checked = !this.checked;
    if (this.type === 'radio') this.checked = true;
    if (!formulario) return;
    if (this.type === 'submit' || this.type === 'image') formulario._enviar(this, true);
    if (this.type === 'reset') formulario.reset();
  }
}

for (const nome of ['name', 'placeholder', 'pattern', 'autocomplete', 'inputMode']) {
  refletirTexto(Entrada, nome, nome.toLowerCase());
}
for (const nome of ['disabled', 'required', 'readOnly', 'multiple']) {
  refletirBooleano(Entrada, nome, nome.toLowerCase());
}

class Botao extends Elemento {
  get type() {
    const tipo = (this.getAttribute('type') ?? '').toLowerCase();
    return ['submit', 'reset', 'button'].includes(tipo) ? tipo : 'submit';
  }

  set type(valor) { this.setAttribute('type', String(valor)); }
  get form() { return formularioDe(this); }
  _desabilitado() { return this.hasAttribute('disabled'); }
  _focavelPorNatureza() { return true; }

  _acaoDoClique() {
    const formulario = this.form;
    if (!formulario) return;
    if (this.type === 'submit') formulario._enviar(this, true);
    if (this.type === 'reset') formulario.reset();
  }
}

refletirTexto(Botao, 'name', 'name');
refletirTexto(Botao, 'value', 'value');
refletirBooleano(Botao, 'disabled', 'disabled');

class Formulario extends Elemento {
  constructor(documento, nome) {
    super(documento, nome);
    // Como no navegador, formulario.nome devolve o controle de name/id "nome".
    return new Proxy(this, {
      get(alvo, propriedade, receptor) {
        if (typeof propriedade === 'string' && !(propriedade in alvo)) {
          const controle = alvo._controlePorNome.call(receptor, propriedade);
          if (controle) return controle;
        }
        return Reflect.get(alvo, propriedade, receptor);
      },
    });
  }

  get elements() {
    const lista = comoLista([...percorrer(this)].filter((elemento) => CONTROLES.has(elemento.localName)));
    for (const controle of lista) {
      for (const chave of [controle.getAttribute('id'), controle.getAttribute('name')]) {
        if (chave && !(chave in lista)) {
          Object.defineProperty(lista, chave, { value: controle, enumerable: false });
        }
      }
    }
    Object.defineProperty(lista, 'namedItem', {
      value: (nome) => this._controlePorNome(nome),
      enumerable: false,
    });
    return lista;
  }

  get length() { return this.elements.length; }

  _controlePorNome(nome) {
    for (const elemento of percorrer(this)) {
      if (CONTROLES.has(elemento.localName) && (elemento.getAttribute('id') === nome || elemento.getAttribute('name') === nome)) {
        return elemento;
      }
    }
    return null;
  }

  _validarRestricoes() {
    let valido = true;
    for (const controle of this.elements) {
      if (controle.localName !== 'input' || controle._desabilitado()) continue;
      if (['submit', 'button', 'reset', 'hidden', 'image', 'checkbox', 'radio', 'file'].includes(controle.type)) continue;
      const valor = controle.value;
      let invalido = controle.hasAttribute('required') && valor === '';
      if (!invalido && valor !== '' && controle.hasAttribute('pattern')) {
        try {
          invalido = !new RegExp(`^(?:${controle.getAttribute('pattern')})$`, 'v').test(valor);
        } catch {
          invalido = false;
        }
      }
      if (!invalido && valor !== '' && controle.hasAttribute('minlength')) {
        invalido = valor.length < Number(controle.getAttribute('minlength'));
      }
      if (invalido) {
        valido = false;
        controle.dispatchEvent(new Evento('invalid', { cancelable: true }));
      }
    }
    return valido;
  }

  // Envio pelo navegador: valida (sem novalidate), dispara "submit" e,
  // se ninguém chamar preventDefault, a página seria recarregada.
  _enviar(submissor, validar) {
    const semValidacao = this.hasAttribute('novalidate') || (submissor && submissor.hasAttribute('formnovalidate'));
    if (validar && !semValidacao && !this._validarRestricoes()) return;
    const evento = new EventoDeEnvio('submit', { bubbles: true, cancelable: true, submitter: submissor ?? null });
    this.dispatchEvent(evento);
    if (!evento.defaultPrevented) this._documento._pagina.navegou = true;
  }

  requestSubmit(submissor) { this._enviar(submissor ?? null, true); }
  submit() { this._documento._pagina.navegou = true; }

  reset() {
    const evento = new Evento('reset', { bubbles: true, cancelable: true });
    this.dispatchEvent(evento);
    if (evento.defaultPrevented) return;
    for (const controle of this.elements) {
      if (typeof controle._restaurar === 'function') controle._restaurar();
    }
  }

  checkValidity() { return this._validarRestricoes(); }
  reportValidity() { return this._validarRestricoes(); }
}

refletirBooleano(Formulario, 'noValidate', 'novalidate');
refletirTexto(Formulario, 'name', 'name');
refletirTexto(Formulario, 'action', 'action');
refletirTexto(Formulario, 'method', 'method');

class Link extends Elemento {
  get href() {
    const valor = this.getAttribute('href');
    return valor === null ? '' : new URL(valor, ENDERECO_DA_PAGINA).href;
  }

  set href(valor) { this.setAttribute('href', String(valor)); }

  get hash() {
    const valor = this.getAttribute('href');
    return valor === null ? '' : new URL(valor, ENDERECO_DA_PAGINA).hash;
  }

  _focavelPorNatureza() { return this.hasAttribute('href'); }

  _acaoDoClique() {
    const valor = this.getAttribute('href');
    if (valor === null) return;
    if (valor.startsWith('#')) {
      this._documento.location.hash = valor;
    } else {
      this._documento._pagina.navegou = true;
    }
  }
}

class Rotulo extends Elemento {
  get htmlFor() { return this.getAttribute('for') ?? ''; }
  set htmlFor(valor) { this.setAttribute('for', String(valor)); }

  get control() {
    const id = this.getAttribute('for');
    if (id !== null) return this._documento.getElementById(id);
    return this.querySelector('input, button, select, textarea');
  }

  _acaoDoClique() {
    const controle = this.control;
    if (controle) controle.focus();
  }
}

function criarElemento(documento, nome) {
  switch (nome) {
    case 'input': return new Entrada(documento, nome);
    case 'button': return new Botao(documento, nome);
    case 'form': return new Formulario(documento, nome);
    case 'a': return new Link(documento, nome);
    case 'label': return new Rotulo(documento, nome);
    default: return new Elemento(documento, nome);
  }
}

class Documento extends No {
  constructor(pagina) {
    super(null);
    this._documento = this;
    this._pagina = pagina;
    this._ativo = null;
    this._estado = 'loading';
    this._alvoDaJanela = null;
    this._janela = null;
    this._local = null;
  }

  get nodeType() { return 9; }
  get nodeName() { return '#document'; }
  get textContent() { return null; }
  set textContent(_valor) {}
  get documentElement() { return this._filhos.find((filho) => filho.nodeType === 1) ?? null; }
  get head() { return this.querySelector('head'); }
  get body() { return this.querySelector('body'); }
  get readyState() { return this._estado; }
  get location() { return this._local; }
  get defaultView() { return this._janela; }

  get title() { return this.querySelector('title')?.textContent.trim() ?? ''; }
  set title(valor) {
    const titulo = this.querySelector('title');
    if (titulo) titulo.textContent = valor;
  }

  get activeElement() {
    const ativo = this._ativo;
    if (ativo && ativo.isConnected && estaVisivel(ativo)) return ativo;
    return this.body;
  }

  hasFocus() { return true; }

  getElementById(id) {
    for (const elemento of percorrer(this)) {
      if (elemento.getAttribute('id') === String(id)) return elemento;
    }
    return null;
  }

  createElement(nome) { return criarElemento(this, String(nome).toLowerCase()); }
  createTextNode(texto) { return new Texto(this, texto); }
  createDocumentFragment() { return new Fragmento(this); }
}

// Recursos reais do DOM que este modelo não tem: usar um deles para o teste
// com uma mensagem clara, em vez de devolver undefined em silêncio.
function bloquear(prototipo, prefixo, nomes) {
  for (const nome of nomes) {
    if (nome in prototipo) continue;
    Object.defineProperty(prototipo, nome, {
      get() { return naoSuportado(`${prefixo}.${nome}`); },
      set() { naoSuportado(`${prefixo}.${nome}`); },
      configurable: true,
    });
  }
}

bloquear(Elemento.prototype, 'elemento', [
  'dataset', 'validity', 'validationMessage', 'willValidate', 'checkValidity', 'reportValidity',
  'setCustomValidity', 'labels', 'getBoundingClientRect', 'getClientRects', 'offsetWidth',
  'offsetHeight', 'offsetTop', 'offsetLeft', 'offsetParent', 'clientWidth', 'clientHeight',
  'scrollTop', 'scrollLeft', 'scrollWidth', 'scrollHeight', 'attachShadow', 'shadowRoot',
  'animate', 'getAnimations', 'getElementsByClassName', 'getElementsByTagName', 'cloneNode',
  'outerHTML', 'insertAdjacentText', 'ariaDescribedByElements', 'ariaLabelledByElements',
  'ariaErrorMessageElements', 'showModal', 'showPopover', 'hidePopover', 'togglePopover',
  'selectionStart', 'selectionEnd', 'setSelectionRange', 'select', 'attributes',
  'computedStyleMap', 'requestFullscreen', 'normalize', 'isEqualNode', 'getRootNode',
  'compareDocumentPosition',
]);

bloquear(Documento.prototype, 'document', [
  'getElementsByClassName', 'getElementsByTagName', 'getElementsByName', 'createRange',
  'evaluate', 'cookie', 'forms', 'images', 'links', 'scripts', 'elementFromPoint',
  'elementsFromPoint', 'execCommand', 'createEvent', 'createElementNS', 'importNode',
  'adoptNode', 'implementation', 'getSelection',
]);

for (const nome of MANIPULADORES) {
  for (const prototipo of [Elemento.prototype, Documento.prototype]) {
    Object.defineProperty(prototipo, nome, { value: null, writable: true, configurable: true });
  }
}

// ---------------------------------------------------------------------------
// Análise do HTML

const PADRAO_HTML = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const PADRAO_ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function analisar(html, raiz, documento) {
  const pilha = [raiz];
  const atual = () => pilha.at(-1);
  const adicionarTexto = (texto) => {
    if (texto !== '') atual().appendChild(new Texto(documento, decodificar(texto)));
  };
  const padrao = new RegExp(PADRAO_HTML.source, 'g');
  let posicao = 0;
  let achado;
  while ((achado = padrao.exec(html))) {
    adicionarTexto(html.slice(posicao, achado.index));
    posicao = padrao.lastIndex;
    const [, fechamento, abertura, textoDosAtributos, autoFechado] = achado;

    if (fechamento) {
      const nome = fechamento.toLowerCase();
      const indice = pilha.findLastIndex((no, posicaoNaPilha) => posicaoNaPilha > 0 && no.localName === nome);
      if (indice > 0) pilha.length = indice;
      continue;
    }
    if (!abertura) continue; // comentário ou doctype

    const nome = abertura.toLowerCase();
    const elemento = criarElemento(documento, nome);
    for (const atributo of (textoDosAtributos ?? '').matchAll(PADRAO_ATRIBUTO)) {
      const nomeDoAtributo = atributo[1].toLowerCase();
      if (!elemento._atributos.has(nomeDoAtributo)) {
        elemento._atributos.set(nomeDoAtributo, decodificar(atributo[2] ?? atributo[3] ?? atributo[4] ?? ''));
      }
    }
    atual().appendChild(elemento);
    if (VAZIOS.has(nome) || autoFechado) continue;

    if (TEXTO_BRUTO.has(nome) || TEXTO_ESCAPAVEL.has(nome)) {
      const fim = new RegExp(`</${nome}\\s*>`, 'ig');
      fim.lastIndex = posicao;
      const achadoDoFim = fim.exec(html);
      const conteudo = html.slice(posicao, achadoDoFim ? achadoDoFim.index : html.length);
      if (conteudo !== '') {
        elemento.appendChild(new Texto(documento, TEXTO_BRUTO.has(nome) ? conteudo : decodificar(conteudo)));
      }
      posicao = achadoDoFim ? fim.lastIndex : html.length;
      padrao.lastIndex = posicao;
      continue;
    }
    pilha.push(elemento);
  }
  adicionarTexto(html.slice(posicao));
}

function analisarFragmento(html, documento) {
  const fragmento = new Fragmento(documento);
  analisar(html, fragmento, documento);
  return [...fragmento._filhos];
}

// ---------------------------------------------------------------------------
// Janela e execução da página

function criarLocal(pagina) {
  let hash = '';
  return {
    get href() { return ENDERECO_DA_PAGINA + hash; },
    set href(_valor) { pagina.navegou = true; },
    get hash() { return hash; },
    set hash(valor) {
      const texto = String(valor);
      hash = texto === '' || texto === '#' ? '' : (texto.startsWith('#') ? texto : `#${texto}`);
    },
    origin: new URL(ENDERECO_DA_PAGINA).origin,
    protocol: 'http:',
    host: 'pagina.local',
    hostname: 'pagina.local',
    pathname: '/index.html',
    search: '',
    assign() { pagina.navegou = true; },
    replace() { pagina.navegou = true; },
    reload() { pagina.navegou = true; },
    toString() { return this.href; },
  };
}

class DadosDoFormulario {
  constructor(formulario) {
    this._pares = [];
    if (!formulario) return;
    for (const controle of formulario.elements) {
      const nome = controle.getAttribute('name');
      if (!nome || controle.hasAttribute('disabled')) continue;
      if (controle.localName !== 'input') continue;
      const tipo = controle.type;
      if (['submit', 'button', 'reset', 'image', 'file'].includes(tipo)) continue;
      if ((tipo === 'checkbox' || tipo === 'radio') && !controle.checked) continue;
      this._pares.push([nome, (tipo === 'checkbox' || tipo === 'radio') ? (controle.getAttribute('value') ?? 'on') : controle.value]);
    }
  }

  append(nome, valor) { this._pares.push([String(nome), String(valor)]); }
  delete(nome) { this._pares = this._pares.filter(([chave]) => chave !== nome); }
  get(nome) { return this._pares.find(([chave]) => chave === nome)?.[1] ?? null; }
  getAll(nome) { return this._pares.filter(([chave]) => chave === nome).map(([, valor]) => valor); }
  has(nome) { return this._pares.some(([chave]) => chave === nome); }

  set(nome, valor) {
    this.delete(String(nome));
    this.append(nome, valor);
  }

  entries() { return this._pares.map((par) => [...par])[Symbol.iterator](); }
  keys() { return this._pares.map(([chave]) => chave)[Symbol.iterator](); }
  values() { return this._pares.map(([, valor]) => valor)[Symbol.iterator](); }
  forEach(funcao) { for (const [chave, valor] of this._pares) funcao(valor, chave, this); }
  [Symbol.iterator]() { return this.entries(); }
}

function criarJanela(documento, pagina) {
  const alvo = new AlvoDeEventos();
  const janela = {
    document: documento,
    location: documento._local,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    requestAnimationFrame: (funcao) => setTimeout(() => funcao(Date.now()), 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
    Event: Evento,
    CustomEvent: EventoPersonalizado,
    SubmitEvent: EventoDeEnvio,
    FocusEvent: Evento,
    InputEvent: Evento,
    MouseEvent: Evento,
    KeyboardEvent: EventoDeTeclado,
    FormData: DadosDoFormulario,
    Node: No,
    Text: Texto,
    Element: Elemento,
    HTMLElement: Elemento,
    HTMLFormElement: Formulario,
    HTMLInputElement: Entrada,
    HTMLButtonElement: Botao,
    HTMLAnchorElement: Link,
    HTMLLabelElement: Rotulo,
    alert: (mensagem) => pagina.alertas.push(String(mensagem)),
    addEventListener: alvo.addEventListener.bind(alvo),
    removeEventListener: alvo.removeEventListener.bind(alvo),
    dispatchEvent: alvo.dispatchEvent.bind(alvo),
    scrollTo() {},
    scrollBy() {},
    scroll() {},
  };
  janela.window = janela;
  janela.self = janela;
  for (const nome of [
    'fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage', 'getComputedStyle', 'matchMedia',
    'MutationObserver', 'IntersectionObserver', 'ResizeObserver', 'history', 'navigator',
    'confirm', 'prompt', 'open',
  ]) {
    Object.defineProperty(janela, nome, {
      get() { return naoSuportado(`window.${nome}`); },
      set() { naoSuportado(`window.${nome}`); },
      configurable: true,
    });
  }
  documento._alvoDaJanela = alvo;
  documento._janela = janela;
  vm.createContext(janela);
  return { janela, alvo };
}

/**
 * Abre index.html no DOM de teste e executa os scripts da página, como o
 * navegador faria com scripts "defer". Devolve a página: documento, janela e
 * o que ela registrou (navegou = o envio recarregaria a página).
 */
export function abrirPagina(arquivo = 'index.html') {
  const endereco = new URL(`../../${arquivo}`, import.meta.url);
  const pagina = { navegou: false, alertas: [] };
  const documento = new Documento(pagina);
  documento._local = criarLocal(pagina);
  analisar(readFileSync(endereco, 'utf8'), documento, documento);
  const { janela, alvo } = criarJanela(documento, pagina);

  documento._estado = 'interactive';
  for (const script of documento.querySelectorAll('script')) {
    const tipo = (script.getAttribute('type') ?? '').trim().toLowerCase();
    if (tipo === 'module') {
      naoSuportado('<script type="module"> (um módulo também não roda quando a página é aberta direto do disco)');
    }
    if (tipo && !['text/javascript', 'application/javascript'].includes(tipo)) continue;
    const origem = script.getAttribute('src');
    const enderecoDoScript = origem ? new URL(origem, endereco) : null;
    const codigo = enderecoDoScript ? readFileSync(enderecoDoScript, 'utf8') : script.textContent;
    vm.runInContext(codigo, janela, { filename: enderecoDoScript ? fileURLToPath(enderecoDoScript) : arquivo });
  }
  documento.dispatchEvent(new Evento('DOMContentLoaded', { bubbles: true }));
  documento._estado = 'complete';
  alvo.dispatchEvent(new Evento('load'));
  if (typeof janela.onload === 'function') janela.onload(new Evento('load'));

  pagina.documento = documento;
  pagina.janela = janela;
  return pagina;
}

/** O elemento está na página e não está oculto por hidden ou por estilo em linha. */
export function estaVisivel(elemento) {
  if (!elemento || !elemento.isConnected) return false;
  for (let no = elemento; no && no.nodeType === 1; no = no._pai) {
    if (no.hasAttribute('hidden')) return false;
    const estilo = lerEstilo(no);
    if (estilo.get('display') === 'none' || estilo.get('visibility') === 'hidden') return false;
  }
  return true;
}

/** O primeiro botão de envio do formulário, como o que a pessoa clicaria. */
export function botaoDeEnvio(formulario) {
  for (const controle of formulario.querySelectorAll('button, input')) {
    if (controle.type === 'submit' || controle.type === 'image') return controle;
  }
  return null;
}
