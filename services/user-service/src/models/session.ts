export interface Session {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  user_agent: string | null;
  ip_address: string | null;
  issued_at: Date;
  expires_at: Date;
  last_used_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}
