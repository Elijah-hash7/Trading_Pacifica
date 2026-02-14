import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      status: "not_implemented",
      message: "Withdraw flow is not implemented yet.",
    },
    { status: 501 }
  );
}
