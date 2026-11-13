import { useEffect, useState } from 'react'
import './Chat.css'
import Mensagem from './Mensagem.jsx'

const configuracoesPadrao = {
  tema: 'dark',
  estilo: 'equilibrado',
  instrucoes: '',
}

function carregarConfiguracoes() {
  const salvas = localStorage.getItem('chat-configuracoes')
  if (!salvas) return configuracoesPadrao

  try {
    const dados = JSON.parse(salvas)
    return {
      tema: dados.tema === 'light' ? 'light' : 'dark',
      estilo: ['conciso', 'equilibrado', 'detalhado', 'criativo'].includes(
        dados.estilo,
      )
        ? dados.estilo
        : 'equilibrado',
      instrucoes:
        typeof dados.instrucoes === 'string'
          ? dados.instrucoes.slice(0, 1200)
          : '',
    }
  } catch (error) {
    console.error('Não foi possível carregar as configurações salvas.', error)
    return configuracoesPadrao
  }
}

function Chat() {
  const [texto, setTexto] = useState('')
  const [mensagens, setMensagens] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [configuracoes, setConfiguracoes] = useState(carregarConfiguracoes)
  const [configuracoesAbertas, setConfiguracoesAbertas] = useState(false)

  useEffect(() => {
    localStorage.setItem(
      'chat-configuracoes',
      JSON.stringify(configuracoes),
    )
  }, [configuracoes])

  function atualizarConfiguracao(chave, valor) {
    setConfiguracoes((atuais) => ({ ...atuais, [chave]: valor }))
  }

  async function enviarMensagem(event) {
    event.preventDefault()
    const textoEnviado = texto.trim()

    if (!textoEnviado || carregando) return

    const mensagemUsuario = { role: 'user', texto: textoEnviado }
    const historico = [...mensagens, mensagemUsuario]
    setMensagens(historico)
    setTexto('')
    setErro('')
    setCarregando(true)

    try {
      const resposta = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historico.slice(-20).map(({ role, texto: content }) => ({
            role,
            content,
          })),
          settings: {
            responseStyle: configuracoes.estilo,
            customInstructions: configuracoes.instrucoes,
          },
        }),
      })
      const dados = await resposta.json()

      if (!resposta.ok) {
        throw new Error(dados.error || 'Não foi possível obter uma resposta.')
      }

      if (typeof dados.reply !== 'string' || !dados.reply.trim()) {
        throw new Error('A API retornou uma resposta vazia.')
      }

      setMensagens((atuais) => [
        ...atuais,
        { role: 'assistant', texto: dados.reply },
      ])
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a mensagem.',
      )
    } finally {
      setCarregando(false)
    }
  }

  return (
    <section
      className={`chat chat--${configuracoes.tema}`}
      aria-label="Chat"
    >
      <header className="chat__cabecalho">
        <h1>Chat</h1>
        <button
          className="chat__botao-configuracoes"
          type="button"
          aria-expanded={configuracoesAbertas}
          aria-controls="chat-configuracoes"
          onClick={() => setConfiguracoesAbertas((abertas) => !abertas)}
        >
          Configurações
        </button>
      </header>
      {configuracoesAbertas && (
        <aside
          className="chat__painel-configuracoes"
          id="chat-configuracoes"
          aria-label="Configurações do chat"
        >
          <div className="chat__titulo-configuracoes">
            <h2>Personalização</h2>
            <button
              className="chat__fechar-configuracoes"
              type="button"
              aria-label="Fechar configurações"
              onClick={() => setConfiguracoesAbertas(false)}
            >
              Fechar
            </button>
          </div>
          <label className="chat__campo-configuracao" htmlFor="chat-tema">
            Aparência
            <select
              id="chat-tema"
              value={configuracoes.tema}
              onChange={(event) =>
                atualizarConfiguracao('tema', event.target.value)
              }
            >
              <option value="dark">Escura</option>
              <option value="light">Clara</option>
            </select>
          </label>
          <label className="chat__campo-configuracao" htmlFor="chat-estilo">
            Estilo das respostas
            <select
              id="chat-estilo"
              value={configuracoes.estilo}
              onChange={(event) =>
                atualizarConfiguracao('estilo', event.target.value)
              }
            >
              <option value="conciso">Conciso</option>
              <option value="equilibrado">Equilibrado</option>
              <option value="detalhado">Detalhado</option>
              <option value="criativo">Criativo</option>
            </select>
          </label>
          <label className="chat__campo-configuracao" htmlFor="chat-instrucoes">
            Instruções personalizadas
            <textarea
              id="chat-instrucoes"
              value={configuracoes.instrucoes}
              onChange={(event) =>
                atualizarConfiguracao('instrucoes', event.target.value)
              }
              maxLength={1200}
              rows={4}
              placeholder="Ex.: responda em português e inclua exemplos."
            />
            <span className="chat__ajuda-configuracao">
              {configuracoes.instrucoes.length}/1200 caracteres. As instruções
              são enviadas à API junto com a conversa.
            </span>
          </label>
          <p className="chat__salvamento">As alterações são salvas automaticamente.</p>
        </aside>
      )}
      <div className="chat__mensagens" aria-live="polite">
        {mensagens.map((mensagem, indice) => (
          <Mensagem
            key={`${indice}-${mensagem.role}`}
            mensagem={mensagem.texto}
            autor={mensagem.role}
          />
        ))}
        {carregando && (
          <p className="chat__status" role="status">
            Aguardando resposta...
          </p>
        )}
        {erro && (
          <p className="chat__erro" role="alert">
            {erro}
          </p>
        )}
      </div>
      <form className="chat__formulario" onSubmit={enviarMensagem}>
        <label className="chat__rotulo" htmlFor="chat-mensagem">
          Escreva uma mensagem
        </label>
        <input
          id="chat-mensagem"
          className="chat__entrada"
          type="text"
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Digite sua mensagem..."
          disabled={carregando}
        />
        <button
          className="chat__botao"
          type="submit"
          disabled={carregando || !texto.trim()}
        >
          {carregando ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
    </section>
  )
}

export default Chat
