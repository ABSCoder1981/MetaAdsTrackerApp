import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
        }}
      >
        <div style={{ width: "50%", height: "50%", background: "#ffffff", borderRadius: 56 }} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
