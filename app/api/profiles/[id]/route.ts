import UserProfile from "@/db/UserProfile";
import Auth from "@/lib/Auth";
import Validator from "@/lib/Validator";
import { NextRequest, NextResponse } from "next/server";

interface Context {
  params: { id: string };
}

// Protected route: Get a specific profile using id
export async function GET(request: NextRequest, context: Context) {
  try {
    // Profile authentication check on the request
    const auth = await Auth.authenticate(request);

    // Get a specific user profile
    const { id } = context.params;
    const userProfile = await UserProfile.get(id);

    // Return the proper response
    const response = NextResponse.json(userProfile);
    return Auth.handleResponse(response, auth);
  } catch (error) {
    if (error instanceof Auth.Error)
      return NextResponse.json(Auth.handleError(error), { status: 401 });
    if (error instanceof UserProfile.Error)
      return NextResponse.json(UserProfile.handleError(error), { status: 404 });
    return NextResponse.json((error as Error).message, { status: 500 });
  }
}

// Protected route: Partially update a profile using id
export async function PUT(request: NextRequest, context: Context) {
  try {
    // Profile authentication check on the request
    const auth = await Auth.authenticate(request);

    const data = await request.json();

    // Validate input data
    const { error, value } = Validator.validate.partialUserProfile(data);
    if (error) throw error;

    // Update the user profile
    const { id } = context.params;
    const userProfile = await UserProfile.update(id, value);

    // Return the proper response
    const response = NextResponse.json(userProfile);
    return Auth.handleResponse(response, auth);
  } catch (error) {
    if (error instanceof Auth.Error)
      return NextResponse.json(Auth.handleError(error), { status: 401 });
    if (error instanceof UserProfile.Error)
      return NextResponse.json(UserProfile.handleError(error), { status: 500 });
    return NextResponse.json((error as Error).message, { status: 500 });
  }
}

// Protected route: Delete a profile using id
export async function DELETE(request: NextRequest, context: Context) {
  try {
    // Profile authentication check on the request
    const auth = await Auth.authenticate(request);

    // Delete user profile by id
    const { id } = context.params;
    const userProfile = await UserProfile.delete(id);

    // Return the proper response
    const response = NextResponse.json(userProfile);
    return Auth.handleResponse(response, auth);
  } catch (error) {
    if (error instanceof Auth.Error)
      return NextResponse.json(Auth.handleError(error), { status: 401 });
    if (error instanceof UserProfile.Error)
      return NextResponse.json(UserProfile.handleError(error), { status: 404 });
    return NextResponse.json((error as Error).message, { status: 500 });
  }
}
