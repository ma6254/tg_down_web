/**
 * 手机号脱敏：保留国家码与前 3 位、后 4 位。
 *
 * 服务端返回的是纯数字（如 `8613754320364`），展示为 `+86 137****0364`；
 * 无法识别的输入原样返回，避免把非手机号字段误截断。
 */
export function maskPhone(raw?: string): string {
  if (!raw) {
    return "—"
  }
  const value = raw.trim()
  const digits = value.replace(/\D/g, "")
  if (digits.length < 7) {
    return value
  }

  // 中国大陆手机号：国家码 86 + 11 位。
  if (digits.startsWith("86") && digits.length === 13) {
    return `+86 ${digits.slice(2, 5)}****${digits.slice(-4)}`
  }

  // 带 + 号的国际号码：国家码按长度反推（剩余 10 位视作本地号码）。
  if (value.startsWith("+") && digits.length > 10) {
    const countryLength = digits.length - 10
    const country = digits.slice(0, countryLength)
    const rest = digits.slice(countryLength)
    return `+${country} ${rest.slice(0, 3)}****${rest.slice(-4)}`
  }

  // 不带国家码的 11 位手机号（按中国大陆处理）。
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}****${digits.slice(-4)}`
  }

  // 其余情况：国家码按长度反推。
  const countryLength = Math.max(1, digits.length - 10)
  const country = digits.slice(0, countryLength)
  const rest = digits.slice(countryLength)
  return `+${country} ${rest.slice(0, 3)}****${rest.slice(-4)}`
}

/**
 * 密钥脱敏：保留首尾各 4 位，中间用固定 8 个圆点代替。
 *
 * 长度不超过 8 时全部打码；空值返回占位符，避免把短密钥露出。
 */
export function maskSecret(raw?: string): string {
  const text = raw?.trim() ?? ""
  if (!text) {
    return "—"
  }
  if (text.length <= 8) {
    return "•".repeat(text.length)
  }
  return `${text.slice(0, 4)}${"•".repeat(8)}${text.slice(-4)}`
}

/**
 * 代理地址脱敏：只隐藏密码部分，保留协议、用户名与主机。
 *
 * 后端目前会把 `http_proxy` 原样返回，前端展示时必须先过这一层；
 * 不是合法 URL 时原样返回，避免把普通字符串误改。
 */
export function maskProxyUrl(raw?: string): string {
  if (!raw) {
    return "—"
  }
  const value = raw.trim()
  if (!value) {
    return "—"
  }
  try {
    const url = new URL(value)
    if (!url.password) {
      return value
    }
    url.password = "***"
    const masked = url.toString()
    return value.endsWith("/") ? masked : masked.replace(/\/$/, "")
  } catch {
    return value
  }
}
