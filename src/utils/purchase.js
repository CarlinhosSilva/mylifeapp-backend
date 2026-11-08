export function parsePurchaseTotal(value) {
  if (typeof value !== 'string') return Number.NaN

  const cleaned = value.replace(/R\$\s*/gi, '').replace(/\s+/g, '')
  const brazilianFormat = /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/
  const internationalFormat = /^-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.') && brazilianFormat.test(cleaned)) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.'))
    }
    if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',') && internationalFormat.test(cleaned)) {
      return Number(cleaned.replace(/,/g, ''))
    }
    return Number.NaN
  }
  if (cleaned.includes(',')) {
    if (brazilianFormat.test(cleaned)) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.'))
    }
    return Number.NaN
  }
  if (cleaned.includes('.')) {
    if (/^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned)) {
      return Number(cleaned.replace(/\./g, ''))
    }
    return /^-?\d+\.\d{1,2}$/.test(cleaned) ? Number(cleaned) : Number.NaN
  }
  return /^-?\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN
}
