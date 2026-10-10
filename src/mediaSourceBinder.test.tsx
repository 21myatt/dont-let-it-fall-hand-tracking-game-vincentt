// The framed startup path, driven through the REAL MediaSourceBinder against a
// fake stream. No camera, no phone, no tunnel.
//
// The load-bearing assertion is a NEGATIVE one: `getUserMedia` is never called
// when framed. That is what makes the frame's absent `allow` attribute cost
// nothing — with no camera request on the startup path there is no permission to
// be denied, so the whole-scene camera error is unreachable AT STARTUP. (It is
// NOT unreachable once the switcher is mounted; that door is closed separately,
// by filtering the webcam entries out of the switcher's list.)

import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The SDK's real media-source module is used as-is: the preset URL asserted
// below is READ FROM IT, never hand-written, so this cannot drift from the SDK.
import { sdkVideoMediaSources } from "@vincentt-xr/sdk/debug-ui/media-source";

import { MediaSourceBinder } from "./App";

const { setMediaSource, start } = vi.hoisted(() => ({
  setMediaSource: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vincentt-xr/sdk/low-level", () => ({
  useXRContext: () => ({ session: { setMediaSource, start } }),
  useXRReady: () => false,
  useXRError: () => undefined,
}));

let getUserMedia: ReturnType<typeof vi.fn>;
let videoSrc: string | undefined;

const FAKE_STREAM = { id: "fake-stream", getTracks: () => [] } as unknown as MediaStream;

beforeEach(() => {
  setMediaSource.mockClear();
  start.mockClear();
  videoSrc = undefined;

  getUserMedia = vi.fn().mockRejectedValue(new Error("getUserMedia must not be called"));
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  // jsdom implements neither video playback nor captureStream, so both are
  // faked. Nothing else about the binder is stubbed.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function play(
    this: HTMLMediaElement,
  ) {
    videoSrc = (this as HTMLVideoElement).src;
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    writable: true,
    value: () => FAKE_STREAM,
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Put the document inside a frame, the way the console embeds it. */
const frameIt = () => {
  vi.spyOn(window, "top", "get").mockReturnValue({ name: "embedder" } as unknown as Window);
};

describe("MediaSourceBinder · framed startup", () => {
  it("framed with no configured source: sets a STREAM and never calls getUserMedia", async () => {
    frameIt();
    render(<MediaSourceBinder />);

    await waitFor(() => expect(setMediaSource).toHaveBeenCalled());
    expect(setMediaSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "stream", stream: FAKE_STREAM }),
    );
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("framed: the stream is built from a real SDK VIDEO preset — a moving clip, not a still", async () => {
    frameIt();
    render(<MediaSourceBinder />);

    await waitFor(() => expect(setMediaSource).toHaveBeenCalled());
    expect(sdkVideoMediaSources.map((p) => p.url)).toContain(videoSrc);
  });

  it("framed: the selected preset is handed back, so the controlled switcher shows it", async () => {
    frameIt();
    const onSourceSelected = vi.fn();
    render(<MediaSourceBinder onSourceSelected={onSourceSelected} />);

    await waitFor(() => expect(onSourceSelected).toHaveBeenCalled());
    const preset = onSourceSelected.mock.calls[0][0];
    expect(preset.kind).toBe("video");
    expect(preset.kind).not.toBe("webcam");
  });

  it("framed: the session never carries a permission error, because none is ever requested", async () => {
    frameIt();
    render(<MediaSourceBinder />);

    await waitFor(() => expect(start).toHaveBeenCalled());
    // The only producer of a PermissionError on this path is getUserMedia.
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(setMediaSource).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: "webcam" }),
    );
  });
});

describe("MediaSourceBinder · a configured source is never overridden", () => {
  const CONFIGURED = "https://example.test/client-footage.mp4";

  it("framed + configured video: the creator's URL plays, not the preset", async () => {
    // Overriding a deliberate config pointed at client footage would hide work
    // the creator did, so the framing check does not reach this branch.
    frameIt();
    render(<MediaSourceBinder env={{ VITE_INPUT_SOURCE: "video", VITE_INPUT_URL: CONFIGURED }} />);

    await waitFor(() => expect(setMediaSource).toHaveBeenCalled());
    expect(videoSrc).toBe(CONFIGURED);
    expect(sdkVideoMediaSources.map((p) => p.url)).not.toContain(videoSrc);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("framed + configured video: the switcher shows the CONFIGURED input, not an SDK preset", async () => {
    frameIt();
    const onSourceSelected = vi.fn();
    render(
      <MediaSourceBinder
        env={{ VITE_INPUT_SOURCE: "video", VITE_INPUT_URL: CONFIGURED }}
        onSourceSelected={onSourceSelected}
      />,
    );

    await waitFor(() => expect(onSourceSelected).toHaveBeenCalled());
    const announced = onSourceSelected.mock.calls[0][0];
    expect(announced.url).toBe(CONFIGURED);
    expect(announced.kind).not.toBe("webcam");
  });

  it("a configured video resolves to the same URL framed and unframed", async () => {
    render(<MediaSourceBinder env={{ VITE_INPUT_SOURCE: "video", VITE_INPUT_URL: CONFIGURED }} />);
    await waitFor(() => expect(setMediaSource).toHaveBeenCalled());
    const unframed = videoSrc;

    setMediaSource.mockClear();
    videoSrc = undefined;
    frameIt();
    render(<MediaSourceBinder env={{ VITE_INPUT_SOURCE: "video", VITE_INPUT_URL: CONFIGURED }} />);
    await waitFor(() => expect(setMediaSource).toHaveBeenCalled());

    expect(videoSrc).toBe(unframed);
  });
});

describe("MediaSourceBinder · unframed startup", () => {
  it("unframed with no configured source: the WEBCAM, exactly as shipped today", async () => {
    // A regression pin on the shipped default. Every published app runs this.
    render(<MediaSourceBinder />);

    await waitFor(() => expect(setMediaSource).toHaveBeenCalled());
    expect(setMediaSource).toHaveBeenCalledWith({ source: "webcam" });
    expect(setMediaSource).toHaveBeenCalledTimes(1);
  });

  it("unframed: the switcher is told the WEBCAM is playing, so the control is honest", async () => {
    const onSourceSelected = vi.fn();
    render(<MediaSourceBinder onSourceSelected={onSourceSelected} />);

    await waitFor(() => expect(onSourceSelected).toHaveBeenCalled());
    expect(onSourceSelected.mock.calls[0][0].kind).toBe("webcam");
  });
});
