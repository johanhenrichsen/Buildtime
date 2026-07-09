const TOKEN_KEY = 'admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface JwtPayload {
  sub: string;
  name: string;
  permissions: string[];
  exp: number;
  type: string;
}

export function getUser(): JwtPayload | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as JwtPayload;
    // Check expiry
    if (Date.now() / 1000 >= payload.exp) {
      clearToken();
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
