export function errorHandler(error, _req, res, _next) {
  console.error(error)

  if (res.headersSent) return

  return res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'Erro interno do servidor',
  })
}
