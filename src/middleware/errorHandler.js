export function errorHandler(error, _req, res, _next) {
  console.error(error)

  if (res.headersSent) return

  if (error.statusCode === 413) {
    return res.status(413).json({ error: 'A imagem da nota deve ter no máximo 8 MB' })
  }

  return res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'Erro interno do servidor',
  })
}
