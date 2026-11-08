export const env = {
  // Endereço do PostgREST. Padrão '/api': o nginx (produção) e o Vite (dev) repassam
  // para o PostgREST na mesma origem, sem CORS.
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) || '/api',
}
