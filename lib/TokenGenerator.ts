import jwt from "jsonwebtoken";
import ms from "ms";

const JWT_ACCESS_SECRET_KEY = process.env.JWT_ACCESS_SECRET_KEY;
const JWT_REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY;
const SERVER_DOMAIN = process.env.SERVER_DOMAIN || "http://localhost:3000";

class TokenGenerator {
  private static audience = SERVER_DOMAIN;
  private static issuer = SERVER_DOMAIN;

  static readonly expiration = {
    access: ms("15m") / 1000,
    refresh: ms("7d") / 1000,
  };

  static readonly generate = {
    AccessToken: (payload: object = {}) => {
      if (!JWT_ACCESS_SECRET_KEY)
        throw new jwt.JsonWebTokenError("JWT Access key undefined");
      return jwt.sign(
        {
          ...payload,
          aud: TokenGenerator.audience,
          iss: TokenGenerator.issuer,
        },
        JWT_ACCESS_SECRET_KEY,
        {
          expiresIn: TokenGenerator.expiration.access,
        }
      );
    },
    RefreshToken: (payload: object = {}) => {
      if (!JWT_REFRESH_SECRET_KEY)
        throw new jwt.JsonWebTokenError("JWT Refresh key undefined");
      return jwt.sign(
        {
          ...payload,
          aud: TokenGenerator.audience,
          iss: TokenGenerator.issuer,
        },
        JWT_REFRESH_SECRET_KEY,
        { expiresIn: TokenGenerator.expiration.refresh }
      );
    },
  };

  static readonly verify = {
    AccessToken: (token: string) => {
      if (!JWT_ACCESS_SECRET_KEY)
        throw new jwt.JsonWebTokenError("JWT Access key undefined");
      return jwt.verify(token, JWT_ACCESS_SECRET_KEY);
    },
    RefreshToken: (token: string) => {
      if (!JWT_REFRESH_SECRET_KEY)
        throw new jwt.JsonWebTokenError("JWT Refresh key undefined");
      return jwt.verify(token, JWT_REFRESH_SECRET_KEY);
    },
  };

  static readonly decode = {
    AccessToken: (token: string) => {
      if (!JWT_ACCESS_SECRET_KEY)
        throw new jwt.JsonWebTokenError("JWT Access key undefined");
      return jwt.decode(token);
    },
    RefreshToken: (token: string) => {
      if (!JWT_REFRESH_SECRET_KEY)
        throw new jwt.JsonWebTokenError("JWT Refresh key undefined");
      return jwt.decode(token);
    },
  };

  static readonly handleError = (error: Error) => error.message;

  static readonly Error = jwt.JsonWebTokenError;
  static readonly ExpiredError = jwt.TokenExpiredError;
}

export default TokenGenerator;
