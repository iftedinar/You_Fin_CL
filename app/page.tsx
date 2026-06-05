// app/page.tsx
import { redirect } from 'next/navigation'

export default async function RootPage() {
  // Your middleware already intercepts requests and forces authenticated users to /library 
  // and unauthenticated users to /auth/login.
  // This default redirect is a clean fallback to kickstart that middleware logic.
  redirect('/library')
}
