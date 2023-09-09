import { NextRequest, NextResponse } from "next/server";

interface Context {
  params: { id: string };
}

// Protected route: Get a specific profile using id
export async function GET(request: NextRequest, context: Context) {
  const { id } = context.params;

  const res = { id, method: request.method };
  return NextResponse.json(res);
}

// Protected route: Partially update a profile using id
export async function PATCH(request: NextRequest, context: Context) {
  const { id } = context.params;
  const res = { id, method: request.method };
  return NextResponse.json(res);
}

// Protected route: Delete a profile using id
export async function DELETE(request: NextRequest, context: Context) {
  const { id } = context.params;
  const res = { id, method: request.method };
  return NextResponse.json(res);
}
