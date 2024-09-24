export const parseStringToFloat = (input?: string) => {
  if (input == null || input == "") return null
  // Remove thousands dot and replace decimals comma with dot
  return input.replace(".", "").replace(",", ".")
}