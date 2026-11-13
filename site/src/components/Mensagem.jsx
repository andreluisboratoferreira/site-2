import { Children, isValidElement, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import './Mensagem.css'

function textoDosFilhos(children) {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child)
      }

      return isValidElement(child) ? textoDosFilhos(child.props.children) : ''
    })
    .join('')
}

function BlocoCodigo({ children }) {
  const [copiado, setCopiado] = useState(false)
  const [erroCopia, setErroCopia] = useState('')
  const codigo = textoDosFilhos(children)

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setErroCopia('')
    } catch {
      setCopiado(false)
      setErroCopia('Não foi possível copiar o código.')
    }
  }

  return (
    <div className="mensagem__bloco-codigo">
      <div className="mensagem__cabecalho-codigo">
        <span>Código</span>
        <button
          className="mensagem__copiar"
          type="button"
          onClick={copiarCodigo}
        >
          {copiado ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre>{children}</pre>
      {erroCopia && (
        <p className="mensagem__erro-copia" role="alert">
          {erroCopia}
        </p>
      )}
    </div>
  )
}

function Mensagem({ mensagem, autor }) {
  return (
    <div className={`mensagem mensagem--${autor}`}>
      <ReactMarkdown components={{ pre: BlocoCodigo }}>{mensagem}</ReactMarkdown>
    </div>
  )
}

export default Mensagem
