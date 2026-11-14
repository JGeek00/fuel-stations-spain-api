export const parseStringToFloat = (input?: string): number | null=> {
  if (input == null || input == "") return null
  // Remove thousands dot and replace decimals comma with dot
  return parseFloat(input.replace(/\./g, '').replace(',', '.'))
}