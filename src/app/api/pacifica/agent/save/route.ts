import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      error: "Deprecated endpoint",
      details: "Use POST /api/pacifica/agent/create for automatic backend-generated agent setup.",
    },
    { status: 410 }
  );
}
