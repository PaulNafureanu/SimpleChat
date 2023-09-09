import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const routes = [
    "categories",
    "chats",
    "conversations",
    "messages",
    "profiles",
  ];
  const res: any = {};
  routes.map((route) => (res[route] = "/api/" + route));
  return NextResponse.json(res);
}
