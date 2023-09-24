import { NextRequest, NextResponse } from "next/server";
import TokenGenerator from "./TokenGenerator";
import { ProfilesRecord, getXataClient } from "@/db2/xata";
import { SelectedPick } from "@xata.io/client";

const xata = getXataClient();

interface AuthCheck {
  profile: Readonly<SelectedPick<ProfilesRecord, ["*"]>>;
  access?: string;
}

// Get the profile if access token is valid
// Otherwise, refresh access token if expired and try getting the profile again
// Return the new acess token and profile, otherwise, throw error.
class Auth {
  private static readonly getTokens = (request: NextRequest) => {
    // Get the schema, access and refresh jwt tokens
    const auth = request.headers.get("Authorization")?.split(" ");
    const refresh = request.cookies.get("refresh")?.value;

    // Validate header and cookie data
    if (auth && auth[0] === "JWT" && auth[1] && refresh)
      return {
        access: auth[1],
        refresh,
      };
    else throw new Auth.Error("Invalid tokens.");
  };

  private static readonly getProfile = {
    useAccessToken: async (access: string) => {
      try {
        // Verify the access token
        const vAccess = TokenGenerator.verify.AccessToken(access);
        const subject = vAccess["sub"];

        // Try getting the profile
        if (typeof subject === "string") {
          return (await xata.db.Profiles.read(subject)) || undefined;
        } else return undefined;
      } catch (error) {
        return undefined;
      }
    },
    useRefreshToken: async (refresh: string) => {
      // Verify the refresh token
      const vRefresh = TokenGenerator.verify.RefreshToken(refresh);
      const subject = vRefresh["sub"];

      // Try generating a new access token and get the profile
      let payload = {};
      if (typeof subject === "string") {
        payload = { sub: subject };
        const access = TokenGenerator.generate.AccessToken(payload);
        const profile = (await xata.db.Profiles.read(subject)) || undefined;
        if (!profile)
          throw new Auth.Error("Invalid tokens or database could not respond.");
        return { access, profile };
      } else throw new Auth.Error("Invalid tokens.");
    },
  };

  static readonly authenticate = async (
    request: NextRequest
  ): Promise<AuthCheck> => {
    try {
      const { access, refresh } = Auth.getTokens(request);
      let profile = await Auth.getProfile.useAccessToken(access);
      if (profile) return { profile };
      else return await Auth.getProfile.useRefreshToken(refresh);
    } catch (error) {
      throw new Auth.Error(
        "Authentication failed. " + (error as Error).message
      );
    }
  };

  static readonly handleResponse = async (
    response: NextResponse,
    auth: AuthCheck
  ) => {
    if (auth.access) {
      response.headers.set("jwt-access-changed", auth.access);
    }

    return response;
  };

  static readonly handleError = (error: Error) => error.message;

  static readonly Error = class AuthError extends Error {};
}

export default Auth;
