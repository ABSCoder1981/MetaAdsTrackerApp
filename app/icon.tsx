import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 6,
        }}
      >
        <div style={{ width: "45%", height: "45%", background: "#ffffff", borderRadius: 3 }} />
      </div>
    ),
    { ...size }
  );
}
