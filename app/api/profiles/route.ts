import HashGenerator from "@/lib/HashGenerator";
import TokenGenerator from "@/lib/TokenGenerator";
import Validator from "@/lib/Validator";
import { NextRequest, NextResponse } from "next/server";

// Protected route: get all profiles
export async function GET(request: NextRequest) {
  const res = { data: "profiles" };

  return NextResponse.json(res);
}

// Public route: create a profile
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // const { error, value } = Validator.validate.profile(data);
    // if (error) throw error;

    const access = TokenGenerator.generate.AccessToken();
    const refresh = TokenGenerator.generate.RefreshToken();

    // const vAccessToken = TokenGenerator.verify.AccessToken(accessToken);
    // const vRefreshToken = TokenGenerator.verify.RefreshToken(refreshToken);

    const response = NextResponse.json({ access });
    response.cookies.set("refresh", refresh, {
      httpOnly: true,
      sameSite: true,
      maxAge: TokenGenerator.expiration.refresh,
    });

    return response;
  } catch (error) {
    if (error instanceof Validator.Error)
      return NextResponse.json(Validator.handleError(error), { status: 400 });

    return NextResponse.json({ error }, { status: 500 });
  }
}
