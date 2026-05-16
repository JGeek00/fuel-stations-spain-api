export const formatCurrentDate = () => {
  const twoDigits = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumIntegerDigits: 2,
      useGrouping: false
    })
  }

  const now = new Date()
  return `${now.getFullYear()}-${twoDigits(now.getMonth()+1)}-${twoDigits(now.getDate())} ${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}:${twoDigits(now.getSeconds())}`
}