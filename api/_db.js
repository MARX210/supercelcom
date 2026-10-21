import { neon } from '@neondatabase/serverless'
export const db = () => neon(process.env.DATABASE_URL)
// API pública: usuário só-leitura, se existir; senão cai no principal
export const dbVitrine = () => neon(process.env.DATABASE_URL_VITRINE || process.env.DATABASE_URL)
