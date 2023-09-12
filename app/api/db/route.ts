import DirectDB from "@/data/DirectDB";
import QueryString from "@/lib/QueryString";
import { NextRequest, NextResponse } from "next/server";

/**
 * TODO: Warning: Deactivate or delete the '/api/db' endpoint for production or after the final use!
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== "development") throw new DirectDB.Error();
    const query = QueryString.define(request.url, DirectDB.QueryTemplate);
    return await DirectDB.run(query);
  } catch (error) {
    if (error instanceof DirectDB.Error)
      return new NextResponse(undefined, { status: 405 });
    return NextResponse.json((error as Error).message, { status: 500 });
  }
}
