import "dotenv/config";
import jwt from "jsonwebtoken";

const JWT_ACCESS_SECRET_KEY = process.env.JWT_ACCESS_SECRET_KEY;
const JWT_REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET_KEY;

class TokenGenerator {
  private static audience = "http://localhost:3000";
  private static issuer = "http://localhost:3000";

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
          expiresIn: "15m",
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
        { expiresIn: "7d" }
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

  static readonly Error = jwt.JsonWebTokenError;
  static readonly ExpiredError = jwt.TokenExpiredError;
}

export default TokenGenerator;
