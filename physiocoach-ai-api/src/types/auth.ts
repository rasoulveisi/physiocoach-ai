export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName?: string;
  role?: 'user' | 'admin';
  roles?: string[];
}
