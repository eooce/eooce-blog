/**
 * 构造 LIKE 模糊匹配参数：转义 LIKE 的通配符，避免用户输入的 % 和 _ 被当成通配符。
 * 需与 SQL 中的 ESCAPE '\' 成对使用。
 */
export function likePattern(input: string): string {
  const escaped = input.replace(/[\\%_]/g, (ch) => `\\${ch}`)
  return `%${escaped}%`
}