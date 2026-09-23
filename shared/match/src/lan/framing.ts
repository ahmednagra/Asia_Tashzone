/**
 * Length-prefixed frames for TCP on same Wi-Fi play (brief §9): a 4-byte big-endian length, then that
 * many bytes of UTF-8 JSON. TCP delivers a byte stream, so the decoder buffers partial frames and may
 * return several complete ones from a single chunk.
 */
const HEADER_BYTES = 4;
const MAX_FRAME_BYTES = 64 * 1024;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeFrame(text: string): Uint8Array {
  const body = encoder.encode(text);
  if (body.length > MAX_FRAME_BYTES) throw new Error(`frame of ${body.length} bytes exceeds ${MAX_FRAME_BYTES}`);
  const frame = new Uint8Array(HEADER_BYTES + body.length);
  new DataView(frame.buffer).setUint32(0, body.length, false);
  frame.set(body, HEADER_BYTES);
  return frame;
}

export class FrameDecoder {
  private buffer = new Uint8Array(0);

  /** Adds received bytes and returns every complete message. Throws on an oversized frame (close the socket). */
  push(chunk: Uint8Array): string[] {
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;

    const messages: string[] = [];
    while (this.buffer.length >= HEADER_BYTES) {
      const length = new DataView(this.buffer.buffer, this.buffer.byteOffset).getUint32(0, false);
      if (length > MAX_FRAME_BYTES) throw new Error(`incoming frame of ${length} bytes exceeds ${MAX_FRAME_BYTES}`);
      if (this.buffer.length < HEADER_BYTES + length) break;
      messages.push(decoder.decode(this.buffer.subarray(HEADER_BYTES, HEADER_BYTES + length)));
      this.buffer = this.buffer.slice(HEADER_BYTES + length);
    }
    return messages;
  }
}
