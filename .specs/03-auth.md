# M3 — Autenticação e Rotas Protegidas

**Objetivo:** login funcional, sessão persistida entre recarregamentos, refresh
automático de token, e nenhuma rota interna acessível sem sessão.

**Pré-requisitos:** M1 e M2 concluídos.

---

## Escopo

**Dentro:** `AuthContext`, tela de login, guard de rota, logout, tratamento de sessão
expirada.

**Fora:** cadastro público, recuperação de senha por e-mail, OAuth, multi-usuário.

---

## Decisão de arquitetura

O `supabase-js` resolve persistência de sessão e refresh de token — reimplementar
isso na mão seria trabalho puro sem retorno. Este milestone usa o cliente
**exclusivamente** para autenticação; a partir do M4, o mesmo cliente (`lib/supabase.ts`)
também vira o único caminho de acesso a dados (`.from()`/`.rpc()` contra PostgREST),
já que não há mais motivo para uma lib HTTP à parte.

Nenhum componente React importa `supabase` diretamente. Os únicos pontos de contato
são o `AuthContext` (auth) e, a partir do M4, a camada de serviços em `src/services/`
(dados) — ambos importando o cliente único de `lib/supabase.ts`.

---

## Tarefas

### 3.1 Provisionamento do usuário

Como é um app de usuário único, **não existe tela de cadastro**. Criar o usuário
manualmente no painel do Supabase (Authentication → Users → Add user), com e-mail
e senha.

No painel do Supabase, em Authentication → Providers, **desabilitar** o sign-up
público. Isso evita que a URL da Vercel vire porta aberta.

### 3.2 Cliente Supabase

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { env } from './env'

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
```

### 3.3 AuthContext

`src/contexts/AuthContext.tsx` expõe:

```ts
type AuthState = {
  user: User | null
  session: Session | null
  isLoading: boolean          // true durante a checagem inicial de sessão
  entrar(email: string, senha: string): Promise<void>   // lança em caso de erro
  sair(): Promise<void>
}
```

Comportamento:

1. No mount, chamar `supabase.auth.getSession()` e manter `isLoading = true` até
   resolver. **Não renderizar as rotas enquanto isso** — senão o guard redireciona
   pro login por um frame e o usuário vê um flash.
2. Registrar `supabase.auth.onAuthStateChange` para atualizar o estado em refresh de
   token, logout e expiração. Guardar o unsubscribe e limpar no cleanup.
3. `entrar` chama `signInWithPassword`. Traduzir os erros:
   - `Invalid login credentials` → "E-mail ou senha incorretos."
   - falha de rede → "Não foi possível conectar. Verifique sua internet."
   - qualquer outro → "Não foi possível entrar. Tente novamente."
4. `sair` chama `signOut` e navega para `/login`.

### 3.4 Tela de login

`src/pages/LoginPage.tsx`.

- Campos: e-mail (`type="email"`, `autoComplete="email"`) e senha
  (`autoComplete="current-password"`).
- Submit no `Enter`. Botão em estado `loading` durante a requisição, desabilitado.
- Erro aparece **acima do formulário**, não em toast — o usuário precisa relê-lo
  enquanto corrige.
- Se já houver sessão, redirecionar para `/` imediatamente.
- Visual: tela contida, sem sidebar. Marca "Lugom" em Geist Sans. Sem ilustração,
  sem gradiente, sem card centralizado com sombra — um bloco de formulário alinhado
  à esquerda num container estreito basta.

### 3.5 Guard de rota

`src/components/ProtectedRoute.tsx` (ou um `layout route` no React Router v7):

```tsx
function ProtectedLayout() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return <TelaCarregando />
  if (!session) return <Navigate to="/login" replace state={{ from: location }} />
  return <AppShell><Outlet /></AppShell>
}
```

Reorganizar `routes.tsx` para que todas as rotas internas sejam filhas desse layout.
Após login bem-sucedido, redirecionar para `location.state.from` se existir, senão `/`.

### 3.6 Logout na UI

Item no rodapé da sidebar (desktop) e no menu (mobile), mostrando o e-mail do usuário
e um botão "Sair".

### 3.7 Sessão expirada

Se o refresh falhar, `onAuthStateChange` emite `SIGNED_OUT`. O contexto limpa o
estado, o guard redireciona, e um toast informa: "Sua sessão expirou. Entre
novamente." Não perder silenciosamente — o usuário precisa saber por que voltou pro
login.

---

## Critérios de aceite

- [ ] Acessar `/`, `/entradas`, `/saidas` sem sessão redireciona para `/login`
- [ ] Login com credenciais corretas leva ao dashboard
- [ ] Login com credenciais erradas mostra "E-mail ou senha incorretos." e mantém o
      e-mail digitado no campo
- [ ] F5 numa rota interna mantém a sessão (não volta pro login)
- [ ] Não há flash da tela de login durante o carregamento inicial
- [ ] Acessar `/login` já logado redireciona para `/`
- [ ] "Sair" limpa a sessão e leva ao login; voltar no histórico do navegador não
      recupera acesso
- [ ] Sign-up público desabilitado no painel do Supabase
- [ ] Nenhum arquivo fora de `lib/supabase.ts` e `contexts/AuthContext.tsx` importa
      o cliente supabase

## Definition of Done

Autenticação funcionando também no deploy da Vercel (env vars configuradas lá).
