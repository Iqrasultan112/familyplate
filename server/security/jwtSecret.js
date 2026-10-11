export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32 || /your-jwt-secret|change-this|replace|generate|placeholder|example/i.test(secret)) {
    throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
  }
  return secret;
};
