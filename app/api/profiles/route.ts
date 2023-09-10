import { NextRequest, NextResponse } from "next/server";
import Validator from "@/lib/Validator";
import UserProfile from "@/db/UserProfile";
import TokenGenerator from "@/lib/TokenGenerator";

// Protected route: get all profiles
export async function GET(request: NextRequest) {
  const res = { data: "profiles" };

  return NextResponse.json(res);
}

// Public route: create a profile
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate input data
    const { error, value } = Validator.validate.profile(data);
    if (error) throw error;

    // Create a new user profile serialized
    const userProfile = await UserProfile.create(value);

    // Create new access and refresh tokens for the user profile
    const payload = { sub: userProfile.id };
    const access = TokenGenerator.generate.AccessToken(payload);
    const refresh = TokenGenerator.generate.RefreshToken(payload);

    // Send back to the client the tokens and the user profile serialized
    const response = NextResponse.json(
      { ...userProfile, access },
      { status: 201 }
    );
    response.cookies.set("refresh", refresh, {
      httpOnly: true,
      sameSite: true,
      maxAge: TokenGenerator.expiration.refresh,
    });
    return response;
  } catch (error) {
    // Handle specific errors
    if (error instanceof Validator.Error)
      return NextResponse.json(Validator.handleError(error), { status: 400 });

    if (error instanceof UserProfile.Error)
      return NextResponse.json(UserProfile.handleError(error), { status: 500 });

    if (error instanceof TokenGenerator.Error)
      return NextResponse.json(TokenGenerator.handleError(error), {
        status: 500,
      });

    return NextResponse.json({ error }, { status: 500 });
  }
}
