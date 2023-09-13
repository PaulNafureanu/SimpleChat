import { NextRequest, NextResponse } from "next/server";
import Validator from "@/db/Validator";
import UserProfile from "@/db/UserProfile";
import TokenGenerator from "@/lib/TokenGenerator";
import QueryString from "@/lib/QueryString";
import Auth from "@/lib/Auth";

// Protected route: get all profiles
export async function GET(request: NextRequest) {
  try {
    // Profile authentication check on the request
    const auth = await Auth.authenticate(request);

    // Define the search query object and get all the specified profiles
    const query = QueryString.define(request.url, UserProfile.QueryTemplate);
    const userProfiles = await UserProfile.getAll(query);

    // Return the proper response
    const response = NextResponse.json(userProfiles);
    return Auth.handleResponse(response, auth);
  } catch (error) {
    if (error instanceof Auth.Error)
      return NextResponse.json(Auth.handleError(error), { status: 401 });
    if (error instanceof QueryString.Error)
      return NextResponse.json(QueryString.handleError(error), { status: 500 });
    if (error instanceof UserProfile.Error)
      return NextResponse.json(UserProfile.handleError(error), { status: 500 });
    return NextResponse.json((error as Error).message, { status: 500 });
  }
}

// Public route: create a profile
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validate input data
    const { error, value } = Validator.validate.userProfile(data);
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
    return NextResponse.json((error as Error).message, { status: 500 });
  }
}
