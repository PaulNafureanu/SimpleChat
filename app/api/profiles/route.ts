import HashGenerator from "@/lib/HashGenerator";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const password = "myDevPassword@01246";

  const startTime = performance.now();
  const hash = await HashGenerator.hash(password);
  const endTime1 = performance.now();
  const time1 = endTime1 - startTime;

  const match = await HashGenerator.compare(password, hash);
  const endTime2 = performance.now();
  const time2 = endTime2 - endTime1;

  const res = { data: "profiles", password, hash, match, time1, time2 };

  return NextResponse.json(res);
}
