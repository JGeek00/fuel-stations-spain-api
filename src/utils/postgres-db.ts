
export const validatePostgresDbData = () => {
  console.log(process.env.POSTGRES_HOST, process.env.POSTGRES_PORT, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD, process.env.POSTGRES_DATABASE)
  if (process.env.POSTGRES_HOST && process.env.POSTGRES_PORT && process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DATABASE) {
    return true
  }
  return false
}