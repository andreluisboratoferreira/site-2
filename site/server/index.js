import { createServer } from 'node:http'

const port = Number(process.env.API_PORT || 3001)
const maxBodySize = 256 * 1024
const maxMessages = 20
const maxMessageLength = 6000
const maxInstructionsLength = 1200
const model = 'openai/gpt-oss-20b'
const responseStyles = {
  conciso: 'Responda de forma direta e concisa, priorizando o essencial.',
  equilibrado: 'Equilibre clareza, concisão e detalhes úteis.',
  detalhado: 'Explique com detalhes, incluindo contexto e etapas quando forem úteis.',
  criativo: 'Use um tom criativo e envolvente, mantendo precisão e clareza.',
}

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(data))
}

async function readJson(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodySize) {
      throw new RangeError('A solicitação excede o tamanho permitido.')
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new SyntaxError('O corpo da solicitação não contém JSON válido.')
  }
}

function isValidMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= maxMessages &&
    messages.every(
      (message) =>
        message &&
        ['user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0 &&
        message.content.length <= maxMessageLength,
    ) &&
    messages.at(-1).role === 'user'
  )
}

function isValidSettings(settings) {
  if (settings === undefined) return true

  return (
    settings &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    (settings.responseStyle === undefined ||
      Object.hasOwn(responseStyles, settings.responseStyle)) &&
    (settings.customInstructions === undefined ||
      (typeof settings.customInstructions === 'string' &&
        settings.customInstructions.length <= maxInstructionsLength))
  )
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)

  if (url.pathname !== '/api/chat' || request.method !== 'POST') {
    sendJson(response, 404, { error: 'Endpoint não encontrado.' })
    return
  }

  if (!process.env.GROQ_API_KEY) {
    sendJson(response, 500, {
      error: 'Configure GROQ_API_KEY no arquivo .env do servidor.',
    })
    return
  }

  let body
  try {
    body = await readJson(request)
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400
    sendJson(response, status, { error: error.message })
    return
  }

  if (!isValidMessages(body?.messages) || !isValidSettings(body?.settings)) {
    sendJson(response, 400, {
      error: 'As mensagens ou configurações enviadas são inválidas.',
    })
    return
  }

  const estilo = responseStyles[body.settings?.responseStyle] ?? responseStyles.equilibrado
  const instrucoes = body.settings?.customInstructions?.trim()
  const systemPrompt = [
    'Seja preciso e útil. As instruções personalizadas do usuário têm prioridade sobre as preferências gerais de idioma e estilo. Se elas não especificarem um idioma, responda no idioma da mensagem mais recente do usuário.',
    estilo,
    instrucoes && `Siga estas instruções personalizadas do usuário: ${instrucoes}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  let groqResponse
  try {
    groqResponse = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...body.messages,
          ],
          temperature: 0.7,
          max_completion_tokens: 1024,
        }),
        signal: AbortSignal.timeout(60_000),
      },
    )
  } catch {
    sendJson(response, 502, {
      error: 'Não foi possível conectar à API da Groq. Tente novamente.',
    })
    return
  }

  let result
  try {
    result = await groqResponse.json()
  } catch {
    sendJson(response, 502, { error: 'A API da Groq retornou uma resposta inválida.' })
    return
  }

  if (!groqResponse.ok) {
    const detail = result.error?.message
    sendJson(response, 502, {
      error: typeof detail === 'string' ? detail : 'A API da Groq recusou a solicitação.',
    })
    return
  }

  const reply = result.choices?.[0]?.message?.content
  if (typeof reply !== 'string' || !reply.trim()) {
    sendJson(response, 502, { error: 'A API da Groq não retornou uma resposta.' })
    return
  }

  sendJson(response, 200, { reply })
})

server.listen(port, () => {
  console.log(`API do chat disponível em http://localhost:${port}`)
})
